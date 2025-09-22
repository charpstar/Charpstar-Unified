import { NextRequest, NextResponse } from "next/server";
import { generateSingleScene } from "@/lib/geminiService";

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

    // Generate scenes for each angle
    const allScenes: string[] = [];

    for (let i = 0; i < base64Images.length; i++) {
      const base64Image = base64Images[i];
      console.log(`Generating scene for angle ${i + 1}/${base64Images.length}`);

      const scene = await generateSingleScene(
        base64Image,
        objectSize || "Unknown dimensions",
        objectType,
        sceneDescription || "",
        inspirationImage || null
      );

      allScenes.push(scene);
    }

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
