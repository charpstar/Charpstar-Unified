import { NextRequest, NextResponse } from "next/server";
import { generateMultiAngleScenes } from "@/lib/geminiService";
import { processMultipleImages } from "@/lib/cloudinaryService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      base64Images,
      objectSize,
      objectType,
      productDescription,
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

    // First, analyze the fabric textures from the uploaded images
    let fabricDescription = "";
    try {
      console.log("Analyzing fabric textures from uploaded images...");

      const fabricAnalysisResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/analyze-fabric`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            base64Images,
            objectType,
          }),
        }
      );

      if (fabricAnalysisResponse.ok) {
        const fabricData = await fabricAnalysisResponse.json();
        fabricDescription = fabricData.fabricDescription;
        console.log("Fabric analysis completed:");
        console.log("Full fabric description:", fabricDescription);
      } else {
        console.warn(
          "Fabric analysis failed, proceeding without fabric details"
        );
      }
    } catch (error) {
      console.warn("Error analyzing fabric:", error);
    }

    // Generate product renders using all angles together for consistency, including fabric description
    const enhancedProductDescription = productDescription
      ? `${productDescription}\n\nFabric Details: ${fabricDescription}`
      : `Fabric Details: ${fabricDescription}`;

    console.log("=== ENHANCED PRODUCT DESCRIPTION ===");
    console.log("Original product description:", productDescription);
    console.log("Fabric description:", fabricDescription);
    console.log("Enhanced description:", enhancedProductDescription);
    console.log("=== END ENHANCED PRODUCT DESCRIPTION ===");

    const generatedProducts = await generateMultiAngleScenes(
      base64Images,
      objectSize || "Unknown dimensions",
      objectType,
      enhancedProductDescription || fabricDescription,
      inspirationImage || null
    );

    // Upload original images to Cloudinary and upscale them
    try {
      console.log("Uploading and upscaling product images with Cloudinary...");

      // Upload original images to Cloudinary
      const originalCloudinaryUrls = await processMultipleImages(
        generatedProducts,
        { width: 4096 }, // Original width, height will scale proportionally
        "product-render/original"
      );

      // Upscale images using Cloudinary
      const upscaledCloudinaryUrls = await processMultipleImages(
        generatedProducts,
        { width: 4096, height: 2048 }, // Exact dimensions you want
        "product-render/upscaled"
      );

      console.log(
        `Successfully processed ${originalCloudinaryUrls.length} product images`
      );

      // Return both original and upscaled Cloudinary URLs for comparison
      return NextResponse.json({
        products: originalCloudinaryUrls,
        upscaledProducts: upscaledCloudinaryUrls,
        comparison: true,
      });
    } catch (cloudinaryError) {
      console.warn(
        "Cloudinary processing failed, returning original images:",
        cloudinaryError
      );
      // Fallback to original generated images if Cloudinary fails
      return NextResponse.json({ products: generatedProducts });
    }
  } catch (error) {
    console.error("Error generating product renders:", error);
    return NextResponse.json(
      { error: "Failed to generate product renders" },
      { status: 500 }
    );
  }
}

