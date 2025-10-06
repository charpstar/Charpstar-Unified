import { NextRequest, NextResponse } from "next/server";
import { generateMultiAngleScenes } from "@/lib/geminiService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      base64Images,
      objectSize,
      objectType,
      sceneDescription,
      inspirationImage,
    } = body;

    if (
      !base64Images ||
      !Array.isArray(base64Images) ||
      base64Images.length === 0 ||
      !objectType
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: base64Images array and objectType are required",
        },
        { status: 400 }
      );
    }

    // Generate scenes using all angles together for consistency

    const allScenes = await generateMultiAngleScenes(
      base64Images,
      objectSize || "Unknown dimensions",
      objectType,
      sceneDescription || "",
      inspirationImage || null
    );

    return NextResponse.json({ scenes: allScenes });
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
