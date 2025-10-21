import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { allocation_list_id, correction_amount } = await request.json();

    if (
      !allocation_list_id ||
      correction_amount === undefined ||
      correction_amount === null
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: allocation_list_id and correction_amount",
        },
        { status: 400 }
      );
    }

    // Validate correction amount is a number
    const amount = parseFloat(correction_amount);
    if (isNaN(amount)) {
      return NextResponse.json(
        { error: "Correction amount must be a valid number" },
        { status: 400 }
      );
    }

    // Update the allocation list with the correction amount
    const { data, error } = await supabase
      .from("allocation_lists")
      .update({ correction_amount: amount })
      .eq("id", allocation_list_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating allocation list with correction:", error);
      return NextResponse.json(
        { error: "Failed to update allocation list" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      allocation_list: data,
    });
  } catch (error) {
    console.error("Error in add-correction API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
