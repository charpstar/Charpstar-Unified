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
  const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

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
    // Check if it's a retryable error (5xx server errors)
    const isRetryable = error.status >= 500 || error.code === 500;

    if (isRetryable && retryCount < maxRetries) {
      console.warn(
        `Gemini API error (attempt ${retryCount + 1}/${maxRetries + 1}):`,
        error.message
      );
      console.log(`Retrying in ${retryDelay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return callApi(ai, imageParts, textPart, retryCount + 1);
    }

    // If it's a 400 error, don't retry
    if (error.status === 400 || error.code === 400) {
      throw new Error(
        "The request was invalid. The uploaded image might be unsupported. Please try another file."
      );
    }

    // For other errors or max retries reached
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
    throw new Error(
      "Failed to generate scenes with AI. Please check the console for details."
    );
  }
}
