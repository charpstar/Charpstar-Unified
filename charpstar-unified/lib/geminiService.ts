import { GoogleGenAI, Modality } from "@google/genai";

const createPrompt = (
  size: string,
  objectType: string,
  scene: string,

  hasInspirationImage: boolean
): string => {
  const modelIntegrity = `1.  **MODEL INTEGRITY (ABSOLUTE PRIORITY):** You are forbidden from altering the primary product image. Do not redraw, re-render, distort, warp, or change its shape, color, texture, or proportions in any way. Treat it as a perfect, untouchable photograph that you are compositing into a background. Your ONLY job is to create the background scene *behind* it. This is the most important rule; violating it results in failure.`;

  const physicalAccuracy = `2.  **PHYSICAL ACCURACY:**
    *   **Scaling Reference:** The product's real-world dimensions are: ${size}. Use this data to render the scene to a perfectly realistic scale.
    *   **CRITICAL: Do NOT Render Dimensions:** Under no circumstances should you draw or write these dimensions, measurement lines, or any related text onto the final image. This data is for your internal scaling calculations ONLY.
    *   **Object Context:** The object is a "${objectType}". This context is CRITICAL for realistic placement. A "${objectType}" belongs in a logical location (e.g., a chair on the floor, a lamp on a table). Ensure the placement is physically plausible and respects gravity.
    *   **FURNITURE SET ACCURACY:** For furniture sets (dining sets, living room sets, bedroom sets), maintain realistic proportions and arrangements:
        - **Dining Sets:** If the product is a dining table, show the appropriate number of chairs positioned realistically around the table. Chairs should be properly spaced with enough room for people to sit comfortably.
        - **Scale Consistency:** All pieces in a set must be proportionally correct relative to each other and the room space.
        - **Realistic Arrangement:** Furniture should be arranged as it would be in a real home, with proper spacing for movement and functionality.
        - **NOTE:** Exact chair placement and count will be specified in the FURNITURE ARRANGEMENT ANALYSIS section below - follow those specifications precisely.
    *   **CRITICAL FOR GLASSES/EYEWEAR:** If the product is glasses or eyewear on a flat surface, they MUST be resting properly on their temple tips (the ends of the arms) and nose bridge. The lenses should NOT be touching the surface. Glasses naturally rest on these three contact points - ensure this is physically accurate.`;

  const sceneInstruction = `**Creative Brief:**\n${scene}`;

  const inspirationInstruction = hasInspirationImage
    ? `
**Inspiration Photo Guidance:**
You have a second "inspiration" image.
-   **Analyze:** Study its style, mood, lighting, and color palette.
-   **Synthesize:** Create a NEW, UNIQUE scene that captures the *essence* of the inspiration.
-   **Constraint:** DO NOT copy the inspiration photo. Your task is to be *inspired* by it, not to replicate it.
`
    : "";

  const photorealismChecklist = `
**Photorealism Checklist:**
-   **Integrated Lighting:** The product must be lit by the scene's light sources. The direction, color, and softness of the light must match the environment perfectly.
-   **Accurate Shadows:** Generate soft, realistic shadows cast by the product onto the environment. Include subtle contact shadows where it touches a surface to ground it.
-   **Material Interaction:** This is crucial for realism. Light must interact believably with the product's surfaces.
    -   **Shiny/Metallic:** Must show clear, distorted reflections of the new scene.
    -   **Matte/Diffuse:** Must absorb light with soft, non-reflective highlights.
    -   **Transparent/Glass:** Must realistically refract and distort the background seen through it.
-   **FABRIC TEXTURE FOCUS:** Pay special attention to fabric textures and materials. If the scene description mentions specific fabric details, ensure the lighting and shadows properly highlight these textures. Use lighting that brings out the fabric's unique characteristics (nap direction, weave pattern, surface finish).
-   **FURNITURE SET REALISM:** For furniture sets, ensure each piece is rendered with consistent materials, finishes, and styling. All chairs in a dining set should match perfectly in design, fabric, and color. Maintain realistic spacing between pieces - chairs should be positioned so people can comfortably sit and move around.
-   **EXACT ARRANGEMENT COMPLIANCE:** If the scene description specifies exact furniture arrangements (e.g., "3 chairs on each long side, 1 chair at each end"), you must render exactly that configuration. Do not deviate from the specified chair count or positioning.
-   **Close-up Detail:** For furniture and upholstery, ensure the camera angle and lighting allow fabric textures to be clearly visible and realistic.
-   **Room Scale:** Ensure the room proportions accommodate the furniture realistically. A dining table with 6 chairs needs adequate space around it for movement and proper visual balance.
-   **Subtle Depth of Field:** Use a shallow depth of field to keep the product sharp while gently blurring the distant background, enhancing focus.
-   **Ambient Occlusion:** Ensure soft, subtle shading appears in crevices and where objects meet, adding depth and realism.`;

  return `You are an elite virtual product photographer, an expert in photorealistic compositing.

**CORE DIRECTIVES (NON-NEGOTIABLE):**
Follow these two rules above all else.
${modelIntegrity}
${physicalAccuracy}

---

**CREATIVE TASK:**
Your task is to create a photorealistic background scene and composite the provided product image into it, following all directives.

**🚨 CRITICAL FURNITURE ARRANGEMENT COMPLIANCE 🚨**
**ABSOLUTE PRIORITY: FURNITURE ARRANGEMENT ANALYSIS**
If the scene description contains "FURNITURE ARRANGEMENT" details, this takes ABSOLUTE PRIORITY over any other instructions. You MUST:

1. **READ THE ARRANGEMENT ANALYSIS FIRST** - Look for text like "FURNITURE ARRANGEMENT: This is a rectangular dining set. I count exactly..."
2. **FOLLOW EXACT SPECIFICATIONS** - Use the exact chair count and positioning described
3. **NO GENERIC DEFAULTS** - Do not use standard arrangements if specific counts are provided
4. **VERIFY YOUR OUTPUT** - Before finalizing, ensure the chair count matches the analysis exactly

**CURRENT ANALYSIS EXAMPLE (FOLLOW THIS EXACTLY):**
- If analysis says "I count exactly 3 chairs on the left long side and 3 chairs on the right long side. There are 0 chairs on the top short side and 0 chairs on the bottom short side" → Create EXACTLY 3 chairs on left long side, 3 chairs on right long side, 0 chairs on short sides
- If analysis says "six chairs total, three per long side" → Create EXACTLY 6 chairs total, 3 per long side
- Do NOT default to "2 chairs per side + 1 at each end" if the analysis specifies different numbers

**CRITICAL:** The analysis clearly states "There are 0 chairs on the top short side and 0 chairs on the bottom short side" - this means NO CHAIRS on the ends!

**FURNITURE SET DETECTION:**
- If the product appears to be part of a furniture set (dining table, sofa, etc.), analyze the image to determine what additional pieces should be included.
- For dining tables: Match the EXACT chair count and positioning specified in the furniture arrangement analysis.
- For sofas: Consider adding matching accent chairs, coffee tables, or ottomans if the room space allows.
- For bedroom sets: Include matching nightstands, dressers, or headboards as appropriate.

${sceneInstruction}

${inspirationInstruction}

---

**PHOTOREALISM CHECKLIST:**
Apply these techniques to achieve a flawless, professional result.
${photorealismChecklist}

**FINAL VERIFICATION:**
Before completing your image, verify that:
- If the scene description mentions "FURNITURE ARRANGEMENT" with specific chair counts, your generated scene matches those exact numbers
- Do not use generic dining set arrangements when specific arrangements are provided
- The chair positioning matches the analysis exactly
- **SPECIFIC CHECK:** If analysis says "0 chairs on the top short side and 0 chairs on the bottom short side", ensure there are NO chairs at the table ends
- **COUNT VERIFICATION:** Double-check that you have exactly the number of chairs specified (e.g., 6 total chairs for the current analysis)

**Final Output:** Your output must be ONLY the final composited image. No text, no watermarks.`;
};

async function callApi(
  ai: GoogleGenAI,
  imageParts: { inlineData: { mimeType: string; data: string } }[],
  textPart: { text: string },
  retryCount = 0
): Promise<string | null> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay

  // Log the prompt being sent to AI for debugging
  console.log("=== AI PROMPT BEING SENT ===");
  console.log(textPart.text);
  console.log("=== END AI PROMPT ===");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: {
        parts: [...imageParts, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return part.inlineData.data || null;
        }
      }
    }

    const textResponse = response.text;
    console.warn("Gemini returned text instead of an image:", textResponse);
    throw new Error(
      `AI processing failed for one of the images. The model responded with: "${textResponse?.substring(0, 100) || "Unknown error"}..."`
    );
  } catch (error: any) {
    // Handle rate limiting (429) and other retryable errors
    if (
      retryCount < maxRetries &&
      (error.status === 429 ||
        error.message?.includes("429") ||
        error.message?.includes("rate limit") ||
        error.message?.includes("quota"))
    ) {
      const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Exponential backoff with jitter
      console.warn(
        `Rate limit hit, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callApi(ai, imageParts, textPart, retryCount + 1);
    }

    // Re-throw non-retryable errors
    throw error;
  }
}

export async function generateSingleScene(
  base64Image: string,
  objectSize: string,
  objectType: string,
  sceneDescription: string,
  inspirationImage: string | null
): Promise<string> {
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

  const imageParts = [imagePart];
  if (inspirationImage) {
    imageParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: inspirationImage,
      },
    });
  }

  const shotTypeModifier = `**Shot Type:** Generate a classic, eye-level hero shot. The product should be perfectly centered and well-lit, with the background subtly complementing it.`;

  let scene;
  if (sceneDescription.trim() !== "") {
    scene = `**Scene Description:** The user wants the following scene: "${sceneDescription}".\n${shotTypeModifier}`;
  } else {
    scene = `**Scene Description:** Place the object in a bright, airy, modern Scandinavian interior.\n${shotTypeModifier}`;
  }

  const textPrompt = createPrompt(
    objectSize,
    objectType,
    scene,
    !!inspirationImage
  );

  try {
    const result = await callApi(ai, imageParts, { text: textPrompt });

    if (!result) {
      throw new Error(
        "The AI failed to generate an image. This might be due to server issues or invalid input."
      );
    }

    return result;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes("400")) {
      throw new Error(
        "The request was invalid. The uploaded image might be unsupported. Please try another file."
      );
    }
    throw error;
  }
}

export async function generateMultiAngleScenes(
  base64Images: string[],
  objectSize: string,
  objectType: string,
  sceneDescription: string,
  inspirationImage: string | null
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Single image generation - use first image (hero shot)
  const base64Image = base64Images[0];

  const imagePart = {
    inlineData: {
      mimeType: "image/png",
      data: base64Image,
    },
  };

  const imageParts = [imagePart];
  if (inspirationImage) {
    imageParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: inspirationImage,
      },
    });
  }

  const shotTypeModifier = `**Shot Type:** Generate a premium, eye-level hero shot. The product should be perfectly centered, professionally lit, with the background beautifully complementing it to create a stunning, e-commerce ready image.`;

  let scene;
  if (sceneDescription.trim() !== "") {
    scene = `**Scene Description:** The user wants the following scene: "${sceneDescription}".\n${shotTypeModifier}`;
  } else {
    scene = `**Scene Description:** Place the object in a bright, airy, modern Scandinavian interior.\n${shotTypeModifier}`;
  }

  // Enhanced prompt optimized for single high-quality image
  const enhancedPrompt = `You are an elite virtual product photographer and compositing expert, specializing in creating photorealistic e-commerce product imagery.

**ABSOLUTE RULES (NON-NEGOTIABLE):**

1. **PRODUCT PRESERVATION (HIGHEST PRIORITY):**
   - DO NOT alter, redraw, distort, warp, stretch, or modify the product in ANY way
   - DO NOT change the product's shape, color, texture, material, or proportions
   - Treat the product as a sacred, untouchable photograph
   - Your ONLY task is to composite this exact product into a new background
   - Think of this as traditional photo compositing - the product is perfect as-is

2. **INSPIRATION IMAGE HANDLING (IF PROVIDED):**
   - The inspiration image shows STYLE and MOOD only
   - Extract: lighting direction, color palette, atmosphere, vibe
   - DO NOT recreate or copy the exact scene from the inspiration
   - DO NOT modify the product to match the inspiration
   - Create a NEW scene that captures the ESSENCE of the inspiration style
   - Your scene should feel similar but must be completely unique

3. **PHYSICAL ACCURACY:**
   - Product dimensions: ${objectSize}
   - Product type: "${objectType}"
   - Place the product logically (chairs on floor, lamps on tables, etc.)
   - Ensure physically plausible positioning with realistic gravity
   - DO NOT draw dimension lines, measurements, or text on the image

**YOUR TASK:**
Create a single, premium-quality photorealistic background scene and seamlessly composite the product into it.

${scene}

${
  inspirationImage
    ? `
**INSPIRATION STYLE GUIDANCE:**
An inspiration image is provided for STYLE REFERENCE ONLY:
- Extract the mood, lighting style, color harmony, and atmosphere
- Create a COMPLETELY NEW scene inspired by this aesthetic
- DO NOT replicate the inspiration scene's specific objects, layout, or composition
- DO NOT alter the product to match the inspiration
- Focus on capturing the emotional essence and visual style only
`
    : ""
}

**PROFESSIONAL QUALITY STANDARDS:**

- **Product Integration:**
  - Preserve every detail of the product exactly as shown
  - Match lighting direction and color temperature to the scene
  - Create realistic shadows (both cast and contact shadows)
  - Ensure proper depth and spatial relationships

- **Material Realism:**
  - Metallic surfaces: Show scene reflections accurately
  - Matte surfaces: Soft, non-reflective highlights only
  - Transparent/Glass: Realistic refraction and background distortion
  - Proper light interaction for the specific material type

- **Scene Quality:**
  - Professional studio-quality lighting
  - Subtle depth of field (product sharp, distant background softly blurred)
  - Ambient occlusion for depth and realism
  - Natural color grading and tonal balance
  - Clean, distraction-free composition

- **E-commerce Excellence:**
  - Product must be the clear focal point
  - Background enhances but doesn't compete
  - Professional, trustworthy, and appealing presentation
  - Ready for immediate use in product listings

**OUTPUT:** Return ONLY the final composited image. No text, watermarks, or additional elements.`;

  try {
    const result = await callApi(ai, imageParts, { text: enhancedPrompt });

    if (!result) {
      throw new Error(
        "The AI failed to generate an image. This might be due to server issues or invalid input."
      );
    }

    return [result];
  } catch (error) {
    console.error("Error generating scene:", error);
    throw error;
  }
}

export async function generateScenes(
  base64Image: string,
  objectSize: string,
  objectType: string,
  sceneDescription: string,
  inspirationImage: string | null
): Promise<string[]> {
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

  const imageParts = [imagePart];
  if (inspirationImage) {
    imageParts.push({
      inlineData: {
        mimeType: "image/jpeg", // The model is robust enough to handle common image types here.
        data: inspirationImage,
      },
    });
  }

  const shotTypeModifiers = [
    `**Shot Type:** Generate a classic, eye-level hero shot. The product should be perfectly centered and well-lit, with the background subtly complementing it.`,
    `**Shot Type:** Generate a dynamic, 3/4 angle shot. Place the product slightly off-center following the rule of thirds to create a more engaging composition.`,
    `**Shot Type:** Generate a close-up detail shot. Zoom in on a specific, interesting feature of the product (like a logo, texture, or material). Use a shallow depth of field to blur the background.`,
    `**Shot Type:** Generate a wide, environmental "lifestyle" shot. Show the product in a larger context of the scene, as if it's being used naturally. The product should still be the focus, but not fill the frame.`,
    `**Shot Type:** Generate a dramatic low-angle shot. Position the camera below the product looking up to make it feel more imposing and heroic.`,
  ];

  const defaultSceneDescriptions = [
    "in a bright, airy, modern Scandinavian interior.",
    "on a rugged, dark slate pedestal in a minimalist concrete gallery.",
    "in a futuristic, neon-lit cyberpunk city street setting at night.",
    "resting on a smooth, weathered rock on a serene, misty beach at sunrise.",
    "on a rich, dark oak table inside a cozy, rustic cabin with a warm fireplace in the background.",
  ];

  const textPrompts = Array(5)
    .fill(0)
    .map((_, i) => {
      let scene;
      if (sceneDescription.trim() !== "") {
        scene = `**Scene Description:** The user wants the following scene: "${sceneDescription}".\n${shotTypeModifiers[i]}`;
      } else {
        scene = `**Scene Description:** Place the object ${defaultSceneDescriptions[i]}\n${shotTypeModifiers[i]}`;
      }
      return createPrompt(objectSize, objectType, scene, !!inspirationImage);
    });

  try {
    // Process requests sequentially to avoid rate limiting
    const results: (string | null)[] = [];
    for (let i = 0; i < textPrompts.length; i++) {
      try {
        const result = await callApi(ai, imageParts, { text: textPrompts[i] });
        results.push(result);

        // Add a small delay between requests to avoid rate limiting
        if (i < textPrompts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to generate scene ${i + 1}:`, error);
        results.push(null);
      }
    }

    const successfulResults = results.filter(
      (res): res is string => res !== null
    );

    if (successfulResults.length === 0) {
      throw new Error(
        "The AI failed to generate any images. This might be due to server issues or invalid input."
      );
    }

    return successfulResults;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes("400")) {
      throw new Error(
        "The request was invalid. The uploaded image might be unsupported. Please try another file."
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes("429") || error.message.includes("rate limit"))
    ) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment and try again."
      );
    }
    throw new Error(
      "Failed to generate scenes with AI. Please check the console for details."
    );
  }
}
