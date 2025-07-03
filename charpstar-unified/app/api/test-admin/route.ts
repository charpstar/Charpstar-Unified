import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    console.log("=== TESTING ADMIN CLIENT ===");

    const adminClient = createAdminClient();

    // Test basic connection
    const { data: testData, error: testError } = await adminClient
      .from("profiles")
      .select("id, email")
      .limit(1);

    console.log("Admin client test:", { testData, testError });

    if (testError) {
      return NextResponse.json(
        {
          error: "Admin client failed",
          details: testError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin client working",
      data: testData,
    });
  } catch (error) {
    console.error("Admin client test error:", error);
    return NextResponse.json(
      {
        error: "Admin client test failed",
        details: error,
      },
      { status: 500 }
    );
  }
}
