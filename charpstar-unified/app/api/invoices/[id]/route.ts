import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the session from the request
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoiceId = params.id;

    // Fetch invoice with related data
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        *,
        modeler:profiles!invoices_modeler_id_fkey(id, email, title),
        reviewer:profiles!invoices_reviewed_by_fkey(id, email, title)
      `
      )
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Check access: user must be the modeler or an admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isOwner = invoice.modeler_id === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoice: invoice,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the session from the request
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoiceId = params.id;

    // Fetch existing invoice
    const { data: existingInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (fetchError || !existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email, title")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";
    const isOwner = existingInvoice.modeler_id === user.id;

    // Parse request body
    const body = await request.json();

    let updateData: any = {};

    // Admin actions
    if (isAdmin && body.action) {
      const { action, adminComments } = body;

      if (action === "approve") {
        updateData = {
          status: "approved",
          admin_comments: adminComments || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        };
      } else if (action === "reject") {
        updateData = {
          status: "rejected",
          admin_comments: adminComments || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        };
      } else if (action === "request_changes") {
        updateData = {
          status: "changes_requested",
          admin_comments: adminComments || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        };
      } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      // Notify modeler
      await supabase.from("notifications").insert({
        user_id: existingInvoice.modeler_id,
        type: `invoice_${action}`,
        title: `Invoice ${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Changes Requested"}`,
        message: `Your invoice ${existingInvoice.invoice_number} has been ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "returned for changes"}${adminComments ? `: ${adminComments}` : ""}`,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: existingInvoice.invoice_number,
          admin_comments: adminComments,
          reviewed_by: user.email,
        },
        created_at: new Date().toISOString(),
      });
    }
    // Modeler updates (only for pending or changes_requested invoices)
    else if (isOwner) {
      if (
        existingInvoice.status !== "pending" &&
        existingInvoice.status !== "changes_requested"
      ) {
        return NextResponse.json(
          { error: "Cannot update invoice with current status" },
          { status: 403 }
        );
      }

      const { bankDetails, modelerNotes } = body;

      updateData = {
        bank_name: bankDetails?.bankName ?? existingInvoice.bank_name,
        bank_account_nr:
          bankDetails?.bankAccountNr ?? existingInvoice.bank_account_nr,
        street_address:
          bankDetails?.streetAddress ?? existingInvoice.street_address,
        city_state_zip:
          bankDetails?.cityStateZip ?? existingInvoice.city_state_zip,
        bic_swift_code:
          bankDetails?.bicSwiftCode ?? existingInvoice.bic_swift_code,
        modeler_notes: modelerNotes ?? existingInvoice.modeler_notes,
        status: "pending", // Reset to pending when modeler makes changes
      };
    } else {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select(
        `
        *,
        modeler:profiles!invoices_modeler_id_fkey(id, email, title),
        reviewer:profiles!invoices_reviewed_by_fkey(id, email, title)
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        invoice: updatedInvoice,
        message: "Invoice updated successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
