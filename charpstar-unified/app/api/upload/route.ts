// src/app/api/upload/route.ts

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: "File and fileName are required" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    // Upload to Bunny Storage
    const response = await fetch(
      `${process.env.BUNNY_STORAGE_URL}/preview_images/${fileName}`,
      {
        method: "PUT",
        headers: {
          AccessKey: process.env.BUNNY_STORAGE_KEY!,
          "Content-Type": "image/png",
          "x-bunnycdn-access-key": process.env.BUNNY_STORAGE_KEY!,
        },
        body: buffer,
      }
    );

    if (!response.ok) {
      throw new Error(`Bunny Storage error: ${response.statusText}`);
    }

    return NextResponse.json({
      success: true,
      url: `${process.env.BUNNY_STORAGE_PUBLIC_URL}/preview_images/${fileName}`,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
