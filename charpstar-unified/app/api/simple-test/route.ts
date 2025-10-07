import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Test basic functionality
    console.log("🧪 Simple test endpoint working");

    return NextResponse.json({
      success: true,
      message: "Simple test endpoint is working",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in simple test:", error);
    return NextResponse.json(
      {
        error: "Simple test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
