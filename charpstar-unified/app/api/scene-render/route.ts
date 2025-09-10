import { NextRequest, NextResponse } from "next/server";
import { generateScenes } from "@/lib/geminiService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      base64Image,
      objectSize,
      objectType,
      sceneDescription,
      inspirationImage,
    } = body;

    if (!base64Image || !objectType) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: base64Image and objectType are required",
        },
        { status: 400 }
      );
    }

    const scenes = await generateScenes(
      base64Image,
      objectSize || "Unknown dimensions",
      objectType,
      sceneDescription || "",
      inspirationImage || null
    );

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error("Error generating scenes:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
