import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireQaOrAdmin() {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const { data: profile, error: profileError } = await supabaseAuth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Failed to fetch user profile:", profileError);
    return { error: "Failed to verify user role", status: 500 } as const;
  }

  const role = (profile?.role || "").toLowerCase();
  if (role !== "qa" && role !== "admin" && role !== "production") {
    return {
      error: "QA, Admin, or Production access required",
      status: 403,
    } as const;
  }

  return { userId: user.id } as const;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const authCheck = await requireQaOrAdmin();
    if ("error" in authCheck) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { listId: listIdParam } = await params;
    if (!listIdParam) {
      return NextResponse.json(
        { error: "Missing allocation list id" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const name = body?.name;

    if (name === undefined || name === null) {
      return NextResponse.json(
        { error: "Missing name in request body" },
        { status: 400 }
      );
    }

    // Validate name is a string
    if (typeof name !== "string") {
      return NextResponse.json(
        { error: "Name must be a string" },
        { status: 400 }
      );
    }

    // Trim the name
    const trimmedName = name.trim();

    // Update the allocation list name
    const { error: updateError } = await supabaseAdmin
      .from("allocation_lists")
      .update({ name: trimmedName })
      .eq("id", listIdParam);

    if (updateError) {
      console.error("Failed to update allocation list name:", updateError);
      return NextResponse.json(
        { error: "Failed to update allocation list name" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      name: trimmedName,
    });
  } catch (error) {
    console.error("Error updating allocation list name:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
