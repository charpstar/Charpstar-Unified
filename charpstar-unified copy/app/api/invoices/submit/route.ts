import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
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

    // Verify user is a modeler
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "modeler") {
      console.error(
        "Profile check error:",
        profileError,
        "User role:",
        profile?.role
      );
      return NextResponse.json(
        { error: "Only modelers can submit invoices" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      invoiceNumber,
      periodStart,
      periodEnd,
      assets,
      subtotal,
      bonusEarnings,
      totalAmount,
      bankDetails,
      modelerNotes,
      clients,
      categories,
    } = body;

    // Validate required fields
    if (
      !invoiceNumber ||
      !periodStart ||
      !periodEnd ||
      !assets ||
      assets.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if invoice number already exists
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("invoice_number", invoiceNumber)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { error: "Invoice number already exists" },
        { status: 409 }
      );
    }

    // Extract asset IDs
    const assetIds = assets.map((asset: any) => asset.id);

    // Prepare metadata
    const metadata = {
      assets: assets,
      clients: clients || [],
      categories: categories || [],
      assetCount: assets.length,
    };

    // Insert invoice
    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        modeler_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        asset_ids: assetIds,
        subtotal: subtotal || 0,
        bonus_earnings: bonusEarnings || 0,
        total_amount: totalAmount || 0,
        bank_name: bankDetails?.bankName || null,
        bank_account_nr: bankDetails?.bankAccountNr || null,
        street_address: bankDetails?.streetAddress || null,
        city_state_zip: bankDetails?.cityStateZip || null,
        bic_swift_code: bankDetails?.bicSwiftCode || null,
        modeler_notes: modelerNotes || null,
        status: "pending",
        submitted_at: new Date().toISOString(),
        metadata: metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting invoice:", insertError);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 }
      );
    }

    // Get all admin users for notification
    const { data: admins } = await supabase
      .from("profiles")
      .select("user_id, email")
      .eq("role", "admin");

    // Send notifications to admins
    if (admins && admins.length > 0) {
      const notifications = admins.map((admin) => ({
        user_id: admin.user_id,
        type: "invoice_submitted",
        title: "New Invoice Submitted",
        message: `Invoice ${invoiceNumber} has been submitted for review by ${user.email}`,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          modeler_email: user.email,
          total_amount: totalAmount,
        },
        created_at: new Date().toISOString(),
      }));

      await supabase.from("notifications").insert(notifications);
    }

    return NextResponse.json(
      {
        success: true,
        invoice: invoice,
        message: "Invoice submitted successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in invoice submission:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
