import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64Image } = body;

    if (!base64Image) {
      return NextResponse.json(
        { error: "Missing required field: base64Image" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable not set.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = {
      inlineData: {
        mimeType: "image/png",
        data: base64Image,
      },
    };

    const upscalePrompt = `You are an expert image upscaling specialist.

**TASK:** Upscale and enhance this product scene image to the highest possible quality.

**REQUIREMENTS:**
- Increase resolution to 2048x2048 or higher while maintaining aspect ratio
- Enhance sharpness and detail clarity
- Preserve all colors, lighting, and composition exactly
- DO NOT add new elements or change the scene
- DO NOT alter the product in any way
- Reduce any compression artifacts
- Enhance texture details subtly
- Maintain photorealistic quality

**OUTPUT:** Return ONLY the upscaled image with no modifications to content.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: {
        parts: [imagePart, { text: upscalePrompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No upscaled image returned from AI");
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error("Invalid response structure from AI");
    }

    // Extract the image from the response
    let upscaledBase64: string | null = null;
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        upscaledBase64 = part.inlineData.data;
        break;
      }
    }

    if (!upscaledBase64) {
      throw new Error("No image data in AI response");
    }

    return NextResponse.json({
      upscaledImage: upscaledBase64,
      success: true,
    });
  } catch (error) {
    console.error("Error upscaling image:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred during upscaling" },
      { status: 500 }
    );
  }
}
