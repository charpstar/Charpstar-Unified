import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    console.log("[qa-allocations/remove] POST request start");

    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      console.log("[qa-allocations/remove] No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { modelerId, qaId } = await request.json();
    console.log("[qa-allocations/remove] Removing QA:", { modelerId, qaId });

    if (!modelerId || !qaId) {
      return NextResponse.json(
        { error: "Missing required fields: modelerId, qaId" },
        { status: 400 }
      );
    }

    // Remove the QA allocation
    const { error } = await supabaseAdmin
      .from("qa_allocations")
      .delete()
      .eq("modeler_id", modelerId)
      .eq("qa_id", qaId);

    if (error) {
      console.error("Error removing QA allocation:", error);
      return NextResponse.json(
        { error: "Failed to remove QA allocation" },
        { status: 500 }
      );
    }

    console.log("[qa-allocations/remove] QA allocation removed successfully");
    return NextResponse.json({
      message: "QA allocation removed successfully",
    });
  } catch (error) {
    console.error("Error in qa-allocations/remove API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
