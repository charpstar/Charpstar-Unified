import { GoogleGenAI, Modality } from "@google/genai";

// Helper function to get aspect ratio instructions for AI
const getAspectRatioInstructions = (format: string): string => {
  const formatMap: Record<string, string> = {
    square:
      "**CRITICAL ASPECT RATIO:** Generate a SQUARE image (1:1 ratio) - perfect for Instagram feed posts and Facebook posts. The image should be exactly as wide as it is tall.",
    instagram_story:
      "**CRITICAL ASPECT RATIO:** Generate a VERTICAL image (9:16 ratio) - perfect for Instagram Stories and TikTok. The image should be much taller than it is wide, like a phone screen.",
    instagram_reel:
      "**CRITICAL ASPECT RATIO:** Generate a VERTICAL image (9:16 ratio) - perfect for Instagram Reels and YouTube Shorts. The image should be much taller than it is wide, like a phone screen.",
    facebook_cover:
      "**CRITICAL ASPECT RATIO:** Generate a WIDE image (16:9 ratio) - perfect for Facebook covers and YouTube thumbnails. The image should be much wider than it is tall.",
    pinterest:
      "**CRITICAL ASPECT RATIO:** Generate a VERTICAL image (2:3 ratio) - perfect for Pinterest pins. The image should be taller than it is wide, but not as extreme as Instagram Stories.",
    linkedin:
      "**CRITICAL ASPECT RATIO:** Generate a WIDE image (1.91:1 ratio) - perfect for LinkedIn posts. The image should be wider than it is tall.",
    twitter:
      "**CRITICAL ASPECT RATIO:** Generate a WIDE image (16:9 ratio) - perfect for Twitter posts. The image should be much wider than it is tall.",
    custom:
      "**CRITICAL ASPECT RATIO:** Generate a SQUARE image (1:1 ratio) - standard format. The image should be exactly as wide as it is tall.",
  };

  return formatMap[format] || formatMap.square;
};

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
  inspirationImage: string | null,
  imageFormat: string = "square"
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Create image parts for ALL products
  const productImageParts = base64Images.map((base64Image) => ({
    inlineData: {
      mimeType: "image/png",
      data: base64Image,
    },
  }));

  console.log(`🎨 Multi-Asset Scene Generation:`);
  console.log(`   - Number of product images: ${base64Images.length}`);
  console.log(`   - Has inspiration image: ${!!inspirationImage}`);
  console.log(
    `   - Total images being sent to AI: ${base64Images.length + (inspirationImage ? 1 : 0)}`
  );

  const imageParts = [...productImageParts];

  // Add inspiration image AFTER all product images
  if (inspirationImage) {
    imageParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: inspirationImage,
      },
    });
  }

  const isMultiAsset = base64Images.length > 1;

  const shotTypeModifier = isMultiAsset
    ? `**Shot Type:** Generate a premium, eye-level room shot that shows ALL ${base64Images.length} products arranged naturally in the space. Each product should be clearly visible and professionally lit, creating a cohesive, e-commerce ready scene.`
    : `**Shot Type:** Generate a premium, eye-level hero shot. The product should be perfectly centered, professionally lit, with the background beautifully complementing it to create a stunning, e-commerce ready image.`;

  let scene;
  if (sceneDescription.trim() !== "") {
    scene = `**Scene Description:** The user wants the following scene: "${sceneDescription}".\n${shotTypeModifier}`;
  } else {
    scene = isMultiAsset
      ? `**Scene Description:** Create a bright, airy, modern Scandinavian interior that accommodates ALL ${base64Images.length} products. Arrange them naturally in the space based on their types.\n${shotTypeModifier}`
      : `**Scene Description:** Place the object in a bright, airy, modern Scandinavian interior.\n${shotTypeModifier}`;
  }

  // Count how many product images we have
  const productCount = base64Images.length;
  const isMultiProduct = productCount > 1;

  // Get aspect ratio instructions
  const aspectRatioInstructions = getAspectRatioInstructions(imageFormat);

  // Enhanced prompt optimized for single or multi-product scenes
  const enhancedPrompt = `You are an elite virtual product photographer and compositing expert, specializing in creating photorealistic e-commerce product imagery.

${aspectRatioInstructions}

**🚨 CRITICAL: ${isMultiProduct ? `MULTIPLE SEPARATE PRODUCTS (${productCount} PRODUCTS)` : "SINGLE PRODUCT"} 🚨**
${
  isMultiProduct
    ? `
**IMAGE ORDER:** The first ${productCount} images you received are SEPARATE product images. ${inspirationImage ? "The last image is an inspiration/style reference (NOT a product)." : ""}

You have been provided with ${productCount} SEPARATE product images. Each image shows a DIFFERENT, DISTINCT product.

**ABSOLUTE REQUIREMENT:** You MUST composite ALL ${productCount} products into the scene. Each product must:
- Remain completely separate and distinct - DO NOT MERGE THEM
- NOT be merged, combined, or blended with other products
- Keep its exact shape, color, texture, and materials unchanged
- Be placed in an appropriate location in the scene based on its type
- Each product should look EXACTLY as it appears in its source image

**COMMON MISTAKE TO AVOID:**
❌ DO NOT combine all products into a single merged/blended object
❌ DO NOT redraw the products to make them match each other
✅ KEEP each product as a separate, distinct object in the scene
✅ Think of it like placing real furniture in a real room - each piece stays separate

**MULTI-PRODUCT ARRANGEMENT:**
- Analyze each product type (chair, table, lamp, sofa, etc.)
- Place each product in its logical position:
  * Floor lamps → Standing on the floor
  * Table lamps → On tables or desks  
  * Wall lamps → Mounted on walls at appropriate height
  * Pendant lamps → Hanging from ceiling
  * Chairs → Around tables or in seating areas
  * Tables → On the floor as focal furniture pieces
  * Sofas → Against walls or as room centerpieces
  * Dining sets → Table with chairs around it (keep all pieces separate)
- Create a cohesive scene where ALL products work together
- Maintain proper spacing and realistic room proportions
- DO NOT leave any product out of the scene
- Each product must be clearly visible and identifiable
`
    : ""
}

**ABSOLUTE RULES (NON-NEGOTIABLE):**

1. **PRODUCT PRESERVATION (HIGHEST PRIORITY):**
   - DO NOT alter, redraw, distort, warp, stretch, or modify ${isMultiProduct ? "ANY of the products" : "the product"} in ANY way
   - DO NOT change the product's shape, color, texture, material, or proportions
   - Treat ${isMultiProduct ? "each product" : "the product"} as a sacred, untouchable photograph
   - Your ONLY task is to composite ${isMultiProduct ? "these exact products" : "this exact product"} into a new background
   - Think of this as traditional photo compositing - the products are perfect as-is
   ${isMultiProduct ? "- DO NOT merge multiple products into one - keep them SEPARATE" : ""}

2. **INSPIRATION IMAGE HANDLING (IF PROVIDED):**
   - The inspiration image shows STYLE and MOOD only
   - Extract: lighting direction, color palette, atmosphere, vibe
   - DO NOT recreate or copy the exact scene from the inspiration
   - DO NOT modify ${isMultiProduct ? "any products" : "the product"} to match the inspiration
   - Create a NEW scene that captures the ESSENCE of the inspiration style
   - Your scene should feel similar but must be completely unique

3. **PHYSICAL ACCURACY:**
   - Product dimensions: ${objectSize}
   - Product type: "${objectType}"
   ${isMultiProduct ? `- You have ${productCount} different products - place EACH ONE appropriately` : "- Place the product logically (chairs on floor, lamps on tables, etc.)"}
   - Ensure physically plausible positioning with realistic gravity
   - DO NOT draw dimension lines, measurements, or text on the image
   ${
     isMultiProduct && objectSize.includes("Asset")
       ? `
   **CRITICAL SIZE ACCURACY FOR MULTIPLE ASSETS:**
   - Each asset has specific dimensions listed above - use these EXACT measurements
   - Scale each product according to its individual size specifications
   - Maintain proper proportional relationships between all products
   - A small lamp should appear small, a large dining table should appear large
   - The room must accommodate all products at their correct relative sizes`
       : ""
   }

**YOUR TASK:**
Create a single, premium-quality photorealistic background scene and seamlessly composite ${isMultiProduct ? `ALL ${productCount} products` : "the product"} into it.

${scene}

${
  inspirationImage
    ? `
**INSPIRATION STYLE GUIDANCE:**
An inspiration image is provided for STYLE REFERENCE ONLY:
- Extract the mood, lighting style, color harmony, and atmosphere
- Create a COMPLETELY NEW scene inspired by this aesthetic
- DO NOT replicate the inspiration scene's specific objects, layout, or composition
- DO NOT alter ${isMultiProduct ? "any of the products" : "the product"} to match the inspiration
- Focus on capturing the emotional essence and visual style only
`
    : ""
}

**PROFESSIONAL QUALITY STANDARDS:**

- **Product Integration:**
  - Preserve every detail of ${isMultiProduct ? "EACH product" : "the product"} exactly as shown
  ${isMultiProduct ? `- Ensure ALL ${productCount} products are visible in the final image` : ""}
  ${isMultiProduct ? "- Keep products SEPARATE - do not merge or blend them together" : ""}
  - Match lighting direction and color temperature to the scene
  - Create realistic shadows (both cast and contact shadows) for ${isMultiProduct ? "each product" : "the product"}
  - Ensure proper depth and spatial relationships

- **Material Realism:**
  - Metallic surfaces: Show scene reflections accurately
  - Matte surfaces: Soft, non-reflective highlights only
  - Transparent/Glass: Realistic refraction and background distortion
  - Proper light interaction for the specific material type

- **Scene Quality:**
  - Professional studio-quality lighting
  - Subtle depth of field (products sharp, distant background softly blurred)
  - Ambient occlusion for depth and realism
  - Natural color grading and tonal balance
  - Clean, distraction-free composition
  ${isMultiProduct ? `- Room must be large enough to accommodate ALL ${productCount} products comfortably` : ""}

- **E-commerce Excellence:**
  - ${isMultiProduct ? "All products must" : "Product must"} be clearly visible
  - Background enhances but doesn't compete
  - Professional, trustworthy, and appealing presentation
  - Ready for immediate use in product listings

${
  isMultiProduct
    ? `
**FINAL VERIFICATION FOR MULTI-PRODUCT SCENES:**
Before completing the image, verify that:
1. You can see ALL ${productCount} separate products in the scene
2. Each product maintains its original appearance (not merged or modified)
3. Each product is positioned logically based on its type
4. The room/scene is proportioned to show all products clearly
5. Lighting and shadows work for all products consistently
${
  objectSize.includes("Asset")
    ? `
6. **SIZE VERIFICATION:** Each product appears at the correct relative size based on the dimensions provided:
   - Small items (lamps, accessories) should appear appropriately small
   - Large items (tables, sofas) should appear appropriately large
   - All products should be proportionally correct relative to each other
   - The scene should accommodate all products at their proper scales`
    : ""
}
`
    : ""
}

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

export async function editImageWithAI(
  base64Image: string,
  editPrompt: string
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

  const editPromptText = `You are an expert image editor specializing in product photography edits. Your task is to make the requested changes to the provided image while maintaining professional quality.

**CRITICAL REQUIREMENTS:**
1. **Preserve Image Quality:** Maintain the same resolution, sharpness, and professional quality as the original
2. **Natural Integration:** Any changes should look completely natural and realistic
3. **Professional Standards:** The result should be suitable for e-commerce and marketing use
4. **Consistent Lighting:** Maintain consistent lighting and shadows throughout the image
5. **Material Accuracy:** If changing materials, ensure they look realistic and properly lit

**SPECIAL INSTRUCTIONS FOR COLOR CHANGES:**
- When changing colors (especially furniture, fabrics, or materials), ensure the new color looks natural and realistic
- Maintain proper material properties - leather should look like leather, fabric should look like fabric
- Preserve texture details and surface characteristics
- Ensure the new color works well with the existing lighting and environment
- For furniture color changes, maintain realistic wear patterns and material properties

**EDIT REQUEST:**
The user wants to: ${editPrompt}

**YOUR TASK:**
Apply the requested changes to the image while ensuring:
- The edit looks completely natural and realistic
- Professional quality is maintained throughout
- Lighting and shadows remain consistent
- Material properties are preserved (texture, finish, etc.)
- The result is ready for commercial use
- No artifacts, distortions, or quality degradation

**OUTPUT:** Return ONLY the edited image. No text, watermarks, or additional elements.`;

  try {
    const result = await callApi(ai, [imagePart], { text: editPromptText });

    if (!result) {
      throw new Error(
        "The AI failed to edit the image. This might be due to server issues or invalid input."
      );
    }

    return result;
  } catch (error) {
    console.error("Error calling Gemini API for image editing:", error);
    if (error instanceof Error && error.message.includes("400")) {
      throw new Error(
        "The edit request was invalid. Please try a different edit description."
      );
    }
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
