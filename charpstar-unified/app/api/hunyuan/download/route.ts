import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Proxy endpoint to download 3D models from Tencent COS
 * Bypasses CORS restrictions by downloading server-side
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelUrl = searchParams.get("url");

    if (!modelUrl) {
      return NextResponse.json(
        { error: "Model URL is required" },
        { status: 400 }
      );
    }

    // Validate URL is from Tencent COS
    if (!modelUrl.includes("tencentcos.cn")) {
      return NextResponse.json(
        { error: "Invalid model URL - must be from Tencent COS" },
        { status: 400 }
      );
    }

    console.log("Downloading model from:", modelUrl);

    // Fetch the model file from Tencent COS
    const response = await fetch(modelUrl);

    if (!response.ok) {
      console.error("Failed to download from Tencent:", response.status);
      return NextResponse.json(
        { error: `Failed to download model: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the file as a buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Model downloaded successfully (${buffer.length} bytes)`);

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        "Access-Control-Allow-Origin": "*", // Allow CORS
      },
    });
  } catch (error: any) {
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to download model" },
      { status: 500 }
    );
  }
}
