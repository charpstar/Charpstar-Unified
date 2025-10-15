import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64Images, objectType } = body;

    if (
      !base64Images ||
      !Array.isArray(base64Images) ||
      base64Images.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required field: base64Images array" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable not set.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Create image parts for analysis
    const imageParts = base64Images.map((base64Data: string) => ({
      inlineData: {
        mimeType: "image/png",
        data: base64Data,
      },
    }));

    const analysisPrompt = `You are an expert furniture and material analyst. Analyze these ${objectType} images and provide detailed descriptions of the furniture arrangement, fabric textures, materials, and surface details.

**FURNITURE ARRANGEMENT ANALYSIS:**
- **CRITICAL: Count chairs very carefully** - Look at each chair individually and count them precisely
- **For dining sets:** Examine each side of the table separately:
  * Count chairs on the LEFT long side
  * Count chairs on the RIGHT long side  
  * Count chairs on the TOP short side (if any)
  * Count chairs on the BOTTOM short side (if any)
- **Be extremely specific:** Say exactly "X chairs on the left long side, Y chairs on the right long side"
- Note the table shape (rectangular, round, oval, square)
- Identify any matching pieces (matching chairs, accent pieces, etc.)
- Describe the overall furniture set composition

**FABRIC AND MATERIAL FOCUS:**
- Fabric texture (smooth, rough, woven, knit, leather, suede, etc.)
- Material type (cotton, linen, velvet, microfiber, etc.)
- Surface patterns (solid, striped, floral, geometric, etc.)
- Color variations and gradients
- Light reflection properties (matte, glossy, satin, etc.)
- Wear patterns or distressing
- Stitching details and construction

**OUTPUT FORMAT:**
Provide a detailed analysis in two parts:
1. **Furniture Arrangement:** Exact chair count and positioning details
2. **Fabric Description:** Detailed material and texture information

**EXAMPLE OUTPUT:**
"FURNITURE ARRANGEMENT: This is a rectangular dining set. I count exactly 3 chairs on the left long side and 3 chairs on the right long side. There are 0 chairs on the top short side and 0 chairs on the bottom short side. Total chairs: 6. All chairs are evenly spaced and match the table's design perfectly.

FABRIC DESCRIPTION: Soft, plush velvet upholstery in deep navy blue with subtle diagonal ribbing. The fabric has a rich, luxurious sheen with slight color variations that catch light beautifully. The surface shows gentle wear patterns with slightly flattened areas on the seat cushions."

**FINAL INSTRUCTION:**
Before finalizing your analysis, double-check your chair count by going through each chair one by one. Make sure you haven't missed any chairs or counted any twice.

Analyze each image and provide the most detailed analysis possible:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [...imageParts, { text: analysisPrompt }],
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No analysis returned from AI");
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error("Invalid response structure from AI");
    }

    // Extract the fabric description
    let fabricDescription = "";
    for (const part of candidate.content.parts) {
      if (part.text) {
        fabricDescription = part.text;
        break;
      }
    }

    if (!fabricDescription) {
      throw new Error("No fabric description in AI response");
    }

    console.log("=== FABRIC ANALYSIS RESULTS ===");
    console.log("Object Type:", objectType);
    console.log("Number of images analyzed:", base64Images.length);
    console.log("Fabric Description:", fabricDescription.trim());
    console.log("=== END FABRIC ANALYSIS ===");

    return NextResponse.json({
      fabricDescription: fabricDescription.trim(),
      success: true,
    });
  } catch (error) {
    console.error("Error analyzing fabric:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "An unexpected error occurred during fabric analysis" },
      { status: 500 }
    );
  }
}
