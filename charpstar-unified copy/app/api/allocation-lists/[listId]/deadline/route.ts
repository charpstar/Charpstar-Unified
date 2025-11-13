import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { format } from "date-fns";

async function requireAdmin() {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Admin access required", status: 403 } as const;
  }

  return { userId: user.id } as const;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const listId = params.listId;
    if (!listId) {
      return NextResponse.json(
        { error: "Missing allocation list id" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const rawDeadline = body?.deadline;

    if (!rawDeadline || typeof rawDeadline !== "string") {
      return NextResponse.json(
        { error: "Missing deadline in request body" },
        { status: 400 }
      );
    }

    const parsedDeadline = new Date(rawDeadline);
    if (Number.isNaN(parsedDeadline.getTime())) {
      return NextResponse.json(
        { error: "Invalid deadline format" },
        { status: 400 }
      );
    }

    const normalizedDeadline = format(parsedDeadline, "yyyy-MM-dd");

    const { error: updateError } = await supabaseAdmin
      .from("allocation_lists")
      .update({ deadline: normalizedDeadline })
      .eq("id", listId);

    if (updateError) {
      console.error("Failed to update allocation list deadline:", updateError);
      return NextResponse.json(
        { error: "Failed to update allocation list deadline" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deadline: normalizedDeadline,
    });
  } catch (error) {
    console.error("Error updating allocation list deadline:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
