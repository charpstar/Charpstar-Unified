import { NextRequest, NextResponse } from "next/server";
import { editImageWithAI } from "@/lib/geminiService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, prompt } = body as { image?: string; prompt?: string };

    if (!image || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: image and prompt" },
        { status: 400 }
      );
    }

    // Handle different image formats
    let base64Image: string;

    if (image.startsWith("data:image/")) {
      // Already a data URL, extract base64
      base64Image = image.replace(/^data:image\/[^;]+;base64,/, "");
    } else if (image.startsWith("http")) {
      // It's a URL, fetch the image and convert to base64
      try {
        const response = await fetch(image);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Image = buffer.toString("base64");
      } catch (fetchError) {
        console.error("Error fetching image from URL:", fetchError);
        return NextResponse.json(
          { error: "Failed to load image for editing" },
          { status: 400 }
        );
      }
    } else {
      // Assume it's already base64
      base64Image = image;
    }

    // Use AI to edit the image
    const editedImageBase64 = await editImageWithAI(base64Image, prompt);

    // Return the edited image as a data URL
    const editedImageUrl = `data:image/png;base64,${editedImageBase64}`;

    return NextResponse.json({ editedImage: editedImageUrl });
  } catch (error) {
    console.error("Error processing image edit:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("GEMINI_API_KEY")) {
        return NextResponse.json(
          { error: "AI service configuration error" },
          { status: 500 }
        );
      }
      if (error.message.includes("400") || error.message.includes("invalid")) {
        return NextResponse.json(
          {
            error: "Invalid edit request. Please try a different description.",
          },
          { status: 400 }
        );
      }
      if (
        error.message.includes("429") ||
        error.message.includes("rate limit")
      ) {
        return NextResponse.json(
          { error: "AI service is busy. Please try again in a moment." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process image edit request" },
      { status: 500 }
    );
  }
}
