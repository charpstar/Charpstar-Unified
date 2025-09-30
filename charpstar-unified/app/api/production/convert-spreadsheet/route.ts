import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  console.log("🚀 Convert spreadsheet API called");

  try {
    console.log("🔐 Checking authentication...");
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      console.log("❌ No user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("👤 User found:", user.id);

    // Check if user has admin or production role
    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      (profile.role !== "admin" && profile.role !== "production")
    ) {
      console.log("❌ User role not authorized:", profile?.role);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("✅ User authorized with role:", profile.role);

    console.log("📝 Parsing request body...");
    const body = await request.json();
    const { spreadsheetData } = body;

    if (!spreadsheetData || !spreadsheetData.trim()) {
      console.log("❌ No spreadsheet data provided");
      return NextResponse.json(
        { error: "Spreadsheet data is required" },
        { status: 400 }
      );
    }

    // Check maximum length
    if (spreadsheetData.length > 5800) {
      console.log("❌ Spreadsheet data too large:", spreadsheetData.length);
      return NextResponse.json(
        {
          error: "Spreadsheet data too large",
          details: `Data length ${spreadsheetData.length} exceeds maximum of 5800 characters`,
          suggestion:
            "Please split your data into smaller chunks or remove unnecessary content",
        },
        { status: 400 }
      );
    }

    console.log(
      "📊 Spreadsheet data received, length:",
      spreadsheetData.length
    );

    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log("❌ No Gemini API key found");
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    console.log("🔑 API key found, initializing Gemini...");
    const genAI = new GoogleGenAI({ apiKey });

    const prompt = `
You are a data conversion assistant. Convert the following spreadsheet data into a structured JSON format for asset management.

IMPORTANT: You must return ONLY a valid JSON array. No explanations, no markdown, no additional text.

The output should be an array of objects with these exact fields:
- article_id: Product identifier (string)
- product_name: Product name (string)
- product_link: Product URL (string)
- cad_file_link: CAD/File URL (string, can be empty if not available)
- category: Product category (string)
- subcategory: Product subcategory (string, can be empty if not available)

Rules:
1. Extract data from any tabular format (Excel, Google Sheets, etc.)
2. Clean and normalize the data
3. If a field is missing, use empty string ""
4. Ensure all product names and categories are properly formatted
5. URLs should be valid format
6. Return ONLY valid JSON array - no other text, no explanations

Input data:
${spreadsheetData}

Return the JSON array:`;

    try {
      console.log("Calling Gemini API with model: gemini-2.0-flash-exp");

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      // Get the response text from Gemini
      const text = result.text?.trim() ?? "";

      if (!text) {
        console.error(
          "No response text from AI. Full result:",
          JSON.stringify(result, null, 2)
        );
        throw new Error("No response text from AI");
      }

      console.log("Raw AI response:", text.substring(0, 500) + "...");

      // Remove markdown code fences if present
      let jsonText = text
        .replace(/^```(json)?/i, "")
        .replace(/```$/, "")
        .trim();

      // Extract JSON array if surrounded by extra text
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      console.log("Cleaned JSON text:", jsonText.substring(0, 300) + "...");

      let convertedData;
      try {
        convertedData = JSON.parse(jsonText);
      } catch (err) {
        console.error("JSON parse error:", err);
        console.error("Failed to parse text:", jsonText);

        // Try to extract valid JSON from the response
        const arrayMatch = text.match(/\[[\s\S]*?\]/);
        if (arrayMatch) {
          try {
            convertedData = JSON.parse(arrayMatch[0]);
            console.log("Successfully parsed JSON from array match");
          } catch (secondErr) {
            console.error("Second JSON parse attempt failed:", secondErr);
            throw new Error(
              `AI returned invalid JSON format. Raw response: ${text.substring(0, 200)}...`
            );
          }
        } else {
          throw new Error(
            `AI returned invalid JSON format. Raw response: ${text.substring(0, 200)}...`
          );
        }
      }

      if (!Array.isArray(convertedData)) {
        throw new Error("Invalid response format: expected array");
      }

      const validatedData = convertedData.map((item: any) => ({
        article_id: String(item.article_id || ""),
        product_name: String(item.product_name || ""),
        product_link: String(item.product_link || ""),
        cad_file_link: String(item.cad_file_link || ""),
        category: String(item.category || ""),
        subcategory: String(item.subcategory || ""),
      }));

      return NextResponse.json({
        success: true,
        data: validatedData,
        count: validatedData.length,
      });
    } catch (aiError: any) {
      console.error("Gemini API error:", aiError);

      // Provide a more helpful error message
      let errorMessage = "Failed to convert data with AI";
      if (aiError.message.includes("invalid JSON format")) {
        errorMessage =
          "AI returned invalid JSON format. Please try again with simpler data or check the spreadsheet format.";
      } else if (aiError.message.includes("No response text")) {
        errorMessage = "AI did not return any response. Please try again.";
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: aiError.message,
          suggestion:
            "Try with a smaller dataset or simpler spreadsheet format",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in convert-spreadsheet API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
