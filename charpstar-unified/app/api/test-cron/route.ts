import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET || "your-secret-key-here-12345";

    const response = await fetch(
      `${request.nextUrl.origin}/api/cron/weekly-status-summary`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response:", text);
      return NextResponse.json(
        {
          error: "Cron job returned non-JSON response",
          status: response.status,
          response: text.substring(0, 500), // First 500 chars
        },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      message: "Cron job triggered successfully",
      result: result,
    });
  } catch (error) {
    console.error("Error triggering cron job:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger cron job",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
