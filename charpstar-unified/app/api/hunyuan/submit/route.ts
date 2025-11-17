import { NextRequest, NextResponse } from "next/server";
import { callTencentHunyuan3D } from "@/lib/tencentHunyuan3D";

export const maxDuration = 60;

interface ViewImage {
  ViewType: string;
  ViewImageUrl?: string;
  ViewImageBase64?: string;
}

interface SubmitJobRequest {
  Prompt?: string;
  ImageBase64?: string;
  ImageUrl?: string;
  MultiViewImages?: ViewImage[];
  EnablePBR?: boolean;
  FaceCount?: number;
  GenerateType?: string;
  PolygonType?: string;
}

interface SubmitJobResponse {
  Response: {
    JobId: string;
    RequestId: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitJobRequest = await request.json();

    console.log("=== API ROUTE DEBUG ===");
    console.log("Received request body structure:", {
      hasPrompt: !!body.Prompt,
      hasImageBase64: !!body.ImageBase64,
      hasImageUrl: !!body.ImageUrl,
      hasMultiViewImages: !!body.MultiViewImages,
      multiViewCount: body.MultiViewImages?.length || 0,
      faceCount: body.FaceCount,
      enablePBR: body.EnablePBR,
      generateType: body.GenerateType,
    });

    if (body.MultiViewImages) {
      console.log("Multi-view images received:");
      body.MultiViewImages.forEach((img, index) => {
        const base64Size = img.ViewImageBase64?.length || 0;
        const sizeInMB = ((base64Size * 3) / 4 / 1024 / 1024).toFixed(2);
        console.log(`  ${index + 1}. ${img.ViewType}:`, {
          hasViewImageBase64: !!img.ViewImageBase64,
          hasViewImageUrl: !!img.ViewImageUrl,
          base64Size: `${sizeInMB} MB`,
        });
      });
    }

    // Validate that at least one input is provided
    if (
      !body.Prompt &&
      !body.ImageBase64 &&
      !body.ImageUrl &&
      !body.MultiViewImages
    ) {
      console.error("❌ Validation failed: No input provided");
      return NextResponse.json(
        {
          error:
            "At least one of Prompt, ImageBase64, ImageUrl, or MultiViewImages is required",
        },
        { status: 400 }
      );
    }

    console.log("✓ Validation passed, calling Tencent API...");

    const result = await callTencentHunyuan3D<SubmitJobResponse>(
      "SubmitHunyuanTo3DProJob",
      body as Record<string, unknown>
    );

    console.log("Tencent API response status:", result.status);
    console.log(
      "Tencent API response data:",
      JSON.stringify(result.data, null, 2)
    );

    if (!result.ok) {
      console.error("Tencent API error:", result.rawText);

      // Check for InvalidAction error - usually means service not activated
      const errorData = result.data as any;
      if (
        errorData?.Response?.Error?.Code === "InvalidAction" ||
        errorData?.Response?.Error?.Message?.includes("invalid or not found")
      ) {
        return NextResponse.json(
          {
            error:
              "Hunyuan 3D service is not activated. Please activate it in Tencent Cloud Console: https://console.intl.cloud.tencent.com/",
            code: "SERVICE_NOT_ACTIVATED",
            details: errorData?.Response?.Error?.Message || result.rawText,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to submit job to Tencent API",
          details: result.rawText,
        },
        { status: result.status }
      );
    }

    // Return the full result data
    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error("Submit job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit 3D generation job" },
      { status: 500 }
    );
  }
}
