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
    *   **Object Context:** The object is a "${objectType}". This context is CRITICAL for realistic placement. A "${objectType}" belongs in a logical location (e.g., a chair on the floor, a lamp on a table). Ensure the placement is physically plausible and respects gravity.`;

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

${sceneInstruction}

${inspirationInstruction}

---

**PHOTOREALISM CHECKLIST:**
Apply these techniques to achieve a flawless, professional result.
${photorealismChecklist}

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
    if (retryCount < maxRetries && (
      error.status === 429 || 
      error.message?.includes('429') ||
      error.message?.includes('rate limit') ||
      error.message?.includes('quota')
    )) {
      const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000; // Exponential backoff with jitter
      console.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
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
    console.log("Generating single scene...");
    const result = await callApi(ai, imageParts, { text: textPrompt });

    if (!result) {
      throw new Error(
        "The AI failed to generate an image. This might be due to server issues or invalid input."
      );
    }

    console.log("Successfully generated single scene");
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
  const angleNames = ["Front", "Front Right", "Front Left"];
  const allScenes: string[] = [];

  // First, send all images together to get context and consistency guidelines
  const contextPrompt = `You are analyzing ${base64Images.length} different camera angles of the same product: ${angleNames.slice(0, base64Images.length).join(", ")}. 

Please provide detailed analysis of:
1. **SHAPE ANALYSIS (CRITICAL):** 
   - **Frame Shape:** Exact frame outline, curves, and geometric proportions
   - **Lens Details:** Precise lens shape, size, positioning, and curvature
   - **Bridge Geometry:** Exact bridge width, height, curvature, and angle
   - **Temple Design:** Precise temple length, angle, design, and attachment points
   - **Edge Details:** Frame thickness, beveled edges, and transition points
   - **Symmetry/Asymmetry:** Any unique geometric features or asymmetries
   - **Proportional Ratios:** Precise measurements and ratios between all elements
   - **3D Structure:** How the frame curves and sits in 3D space

2. **VISUAL CHARACTERISTICS:**
   - Exact colors, materials, and textures
   - Surface finishes (matte, glossy, metallic, etc.)
   - Transparency levels and reflections
   - Edge details and transitions

3. **CONSISTENCY REQUIREMENTS:**
   - Recommended background environment and lighting setup
   - Key details that MUST remain identical across all angles
   - Critical shape elements that cannot vary
   - Material properties that must be consistent

This detailed analysis will be used to generate perfectly consistent scenes for each angle.`;

  const contextImageParts = base64Images.map((base64Image) => ({
    inlineData: {
      mimeType: "image/png",
      data: base64Image,
    },
  }));

  if (inspirationImage) {
    contextImageParts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: inspirationImage,
      },
    });
  }

  let contextAnalysis = "";
  try {
    console.log(
      `🔍 Analyzing product consistency across ${base64Images.length} angles...`
    );
    const contextResult = await callApi(ai, contextImageParts, {
      text: contextPrompt,
    });
    contextAnalysis = contextResult || "";
    console.log(`✅ Context analysis completed`);
  } catch (error) {
    console.warn(
      "Context analysis failed, proceeding with individual generation:",
      error
    );
  }

  // Now generate each scene individually with enhanced consistency prompts
  for (let i = 0; i < base64Images.length; i++) {
    const base64Image = base64Images[i];
    const angleName = angleNames[i] || `Angle ${i + 1}`;

    console.log(
      `🎨 Generating scene for ${angleName} (${i + 1}/${base64Images.length}) with consistency context`
    );

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

    // Enhanced prompt with consistency context
    const enhancedPrompt = `You are an elite virtual product photographer, an expert in photorealistic compositing.

**CORE DIRECTIVES (NON-NEGOTIABLE):**
1. **MODEL INTEGRITY (ABSOLUTE PRIORITY):** You are forbidden from altering the primary product image. Do not redraw, re-render, distort, warp, or change its shape, color, texture, or proportions in any way. Treat it as a perfect, untouchable photograph that you are compositing into a background. Your ONLY job is to create the background scene *behind* it. This is the most important rule; violating it results in failure.

2. **MULTI-ANGLE CONSISTENCY (CRITICAL):** This is angle ${i + 1} of ${base64Images.length} (${angleName}). You must maintain PERFECT consistency with the other angles:
   - **SHAPE PRECISION:** The product's exact shape, curves, proportions, and geometric features must be IDENTICAL to other angles
   - **DETAILED CONSISTENCY:** Every frame detail, lens curve, bridge shape, temple angle must match exactly
   - **PROPORTIONAL ACCURACY:** All measurements, ratios, and spatial relationships must be consistent
   - **MATERIAL FIDELITY:** Colors, textures, finishes, and material properties must be identical
   - **SCENE CONSISTENCY:** Use the same background environment and lighting setup as other angles
   - **QUALITY STANDARD:** This image must have the same professional quality and style as other angles
   - **ANGLE-SPECIFIC VIEW:** Show the product from this unique perspective while maintaining perfect consistency

${contextAnalysis ? `**CONSISTENCY CONTEXT:** ${contextAnalysis}` : ""}

3. **PHYSICAL ACCURACY:**
   - **Scaling Reference:** The product's real-world dimensions are: ${objectSize}. Use this data to render the scene to a perfectly realistic scale.
   - **CRITICAL: Do NOT Render Dimensions:** Under no circumstances should you draw or write these dimensions, measurement lines, or any related text onto the final image. This data is for your internal scaling calculations ONLY.
   - **Object Context:** The object is a "${objectType}". This context is CRITICAL for realistic placement. A "${objectType}" belongs in a logical location (e.g., a chair on the floor, a lamp on a table). Ensure the placement is physically plausible and respects gravity.

**CREATIVE TASK:**
Your task is to create a photorealistic background scene and composite the provided product image into it, following all directives. This scene should be consistent with the other angles while showcasing the product from this unique perspective.

${scene}

${
  inspirationImage
    ? `
**Inspiration Photo Guidance:**
You have an additional "inspiration" image.
- **Analyze:** Study its style, mood, lighting, and color palette.
- **Synthesize:** Create a NEW, UNIQUE scene that captures the *essence* of the inspiration.
- **Constraint:** DO NOT copy the inspiration photo. Your task is to be *inspired* by it, not to replicate it.
`
    : ""
}

**PHOTOREALISM CHECKLIST:**
Apply these techniques to achieve a flawless, professional result:

- **SHAPE FIDELITY (CRITICAL):** Pay extreme attention to the product's exact shape details:
  - **Frame Geometry:** Preserve every curve, angle, and proportion exactly as shown
  - **Lens Shape:** Maintain precise lens curves, size, and positioning
  - **Bridge Details:** Keep exact bridge width, height, and curvature
  - **Temple Design:** Preserve temple length, angle, and design elements
  - **Edge Transitions:** Maintain smooth, consistent edge details and transitions
  - **Proportional Accuracy:** Ensure all elements maintain their exact size relationships

- **Integrated Lighting:** The product must be lit by the scene's light sources. The direction, color, and softness of the light must match the environment perfectly and be consistent with other angles.
- **Accurate Shadows:** Generate soft, realistic shadows cast by the product onto the environment. Include subtle contact shadows where it touches a surface to ground it.
- **Material Interaction:** This is crucial for realism. Light must interact believably with the product's surfaces.
  - **Shiny/Metallic:** Must show clear, distorted reflections of the new scene.
  - **Matte/Diffuse:** Must absorb light with soft, non-reflective highlights.
  - **Transparent/Glass:** Must realistically refract and distort the background seen through it.
- **Subtle Depth of Field:** Use a shallow depth of field to keep the product sharp while gently blurring the distant background, enhancing focus.
- **Ambient Occlusion:** Ensure soft, subtle shading appears in crevices and where objects meet, adding depth and realism.

**Final Output:** Your output must be ONLY the final composited image. No text, no watermarks, no additional content.`;

    try {
      const result = await callApi(ai, imageParts, { text: enhancedPrompt });

      if (!result) {
        throw new Error(
          "The AI failed to generate an image. This might be due to server issues or invalid input."
        );
      }

      allScenes.push(result);
      console.log(`✅ Successfully generated scene for ${angleName}`);
    } catch (error) {
      console.error(`Error generating scene for ${angleName}:`, error);
      throw error;
    }
  }

  console.log(
    `🎉 Completed generation of ${allScenes.length} consistent scenes`
  );
  return allScenes;
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
        console.log(`Generating scene ${i + 1}/${textPrompts.length}...`);
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

    console.log(
      `Successfully generated ${successfulResults.length}/${textPrompts.length} scenes`
    );
    return successfulResults;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes("400")) {
      throw new Error(
        "The request was invalid. The uploaded image might be unsupported. Please try another file."
      );
    }
    if (error instanceof Error && (error.message.includes("429") || error.message.includes("rate limit"))) {
      throw new Error(
        "Rate limit exceeded. Please wait a moment and try again."
      );
    }
    throw new Error(
      "Failed to generate scenes with AI. Please check the console for details."
    );
  }
}
