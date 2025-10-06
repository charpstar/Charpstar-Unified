import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the client name from the request body
    const { clientName } = await request.json();

    if (!clientName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    // Note: Supabase client available if needed for future database operations

    // Call the external API with proper error handling and timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(
        `https://scraper.charpstar.co/process-client/${encodeURIComponent(clientName)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `External API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Log the successful operation

      return NextResponse.json({
        success: true,
        message:
          result.message ||
          "Images have been processed and saved to the database",
        data: result,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error("Request timed out after 30 seconds");
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("Error in scrape-images API:", error);

    return NextResponse.json(
      {
        error: "Failed to scrape images",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
