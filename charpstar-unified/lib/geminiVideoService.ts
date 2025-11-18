import { GoogleAuth } from "google-auth-library";

interface GenerateVideoOptions {
  base64Images: string[];
  objectSize: string;
  objectType: string;
  sceneDescription: string;
  inspirationImage: string | null;
  resolution: string;
  durationSeconds: string;
}

export interface VideoGenerationResult {
  videoBase64: string;
  mimeType: string;
  posterBase64?: string;
}

const buildVideoPrompt = ({
  objectSize,
  objectType,
  sceneDescription,
  resolution,
  durationSeconds,
}: {
  objectSize: string;
  objectType: string;
  sceneDescription: string;
  resolution: string;
  durationSeconds: string;
}) => {
  return `You are a cinematic product director. Create a ${resolution.toUpperCase()} video clip approximately ${durationSeconds} seconds long featuring the provided ${objectType}. Adhere to these rules:

1. Preserve the product exactly as provided in the reference renders. Do NOT alter shape, color, size, or materials.
2. Use the object dimensions for scale: ${objectSize}.
3. Camera should move slowly and elegantly, highlighting craftsmanship and premium appeal.
4. Lighting must feel realistic and physically accurate. Apply reflections, shadows, and global illumination consistent with the scene.
5. Incorporate cinematic depth-of-field and subtle parallax to keep the focus on the product.
6. Scene brief: ${sceneDescription || "Create a premium studio environment with soft cinematic lighting."}
7. Output must be ready-to-use video content. Do not include logos, text overlays, or watermarks.`;
};

function getCredentialsFromEnv() {
  const rawCredentials = process.env.VEO_GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!rawCredentials) {
    return undefined;
  }

  try {
    return JSON.parse(rawCredentials);
  } catch (error) {
    console.error("Failed to parse VEO_GOOGLE_APPLICATION_CREDENTIALS_JSON:", error);
    throw new Error("Invalid VEO Google credentials JSON in env variable.");
  }
}

async function getAccessToken(): Promise<string> {
  const credentials = getCredentialsFromEnv();
  
  if (credentials) {
    // Use service account credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error("Failed to obtain access token from service account");
    }
    return tokenResponse.token;
  }
  
  // Fallback: try Application Default Credentials (for local dev with gcloud)
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain access token. Ensure GCP credentials are configured.");
  }
  return tokenResponse.token;
}

async function pollOperation(
  operationName: string,
  projectId: string,
  location: string,
  modelId: string,
  accessToken: string,
  maxAttempts = 60,
  delayMs = 5000
): Promise<any> {
  const pollUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pollResponse = await fetch(pollUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationName }),
    });

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      throw new Error(`Failed to poll operation: ${errorText}`);
    }

    const pollData = await pollResponse.json();

    if (pollData.done) {
      if (pollData.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(pollData.error)}`);
      }
      return pollData;
    }

    console.log(`Video generation in progress... (attempt ${attempt + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Video generation timed out after polling");
}

export async function generateVideoScene({
  base64Images,
  objectSize,
  objectType,
  sceneDescription,
  inspirationImage,
  resolution,
  durationSeconds,
}: GenerateVideoOptions): Promise<VideoGenerationResult> {
  const credentials = getCredentialsFromEnv();
  
  if (!credentials || !credentials.project_id) {
    throw new Error("VEO_GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set or missing project_id.");
  }

  const projectId = credentials.project_id;
  const location = "us-central1"; // VEO models are only available in US regions
  const modelId = "veo-3.1-generate-preview"; // Supports referenceImages

  const accessToken = await getAccessToken();

  // Map resolution to aspect ratio
  const aspectRatio = "16:9";
  const durationSecondsInt = parseInt(durationSeconds, 10) || 5;

  const prompt = buildVideoPrompt({
    objectSize,
    objectType,
    sceneDescription,
    resolution,
    durationSeconds,
  });

  const requestBody: any = {
    instances: [
      {
        prompt,
      },
    ],
    parameters: {
      aspectRatio,
      durationSeconds: durationSecondsInt,
      sampleCount: 1,
      resolution: resolution === "1080p" ? "1080p" : "720p",
      generateAudio: false,
    },
  };

  // Add all model snapshots as reference images (up to 3 for VEO)
  // veo-3.1-generate-preview supports referenceImages
  if (base64Images && base64Images.length > 0) {
    const referenceImages = [];
    
    // Add up to 3 model snapshots as asset references
    const maxAssets = Math.min(base64Images.length, 3);
    for (let i = 0; i < maxAssets; i++) {
      referenceImages.push({
        image: {
          bytesBase64Encoded: base64Images[i],
          mimeType: "image/png",
        },
        referenceType: "asset",
      });
    }

    // Add inspiration image if provided (as additional asset)
    if (inspirationImage) {
      referenceImages.push({
        image: {
          bytesBase64Encoded: inspirationImage,
          mimeType: "image/jpeg",
        },
        referenceType: "asset",
      });
    }

    requestBody.instances[0].referenceImages = referenceImages;
  }

  try {
    console.log("Calling Vertex AI VEO for video generation...");
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI VEO request failed: ${errorText}`);
    }

    const data = await response.json();
    const operationName = data.name;

    if (!operationName) {
      throw new Error("No operation name returned from Vertex AI VEO");
    }

    console.log("Video generation started, polling for completion...");
    const pollResult = await pollOperation(
      operationName,
      projectId,
      location,
      modelId,
      accessToken
    );

    // Extract video from response
    if (
      pollResult.response &&
      pollResult.response.videos &&
      pollResult.response.videos.length > 0
    ) {
      const video = pollResult.response.videos[0];

      // If video is in GCS, fetch it
      if (video.gcsUri) {
        console.log("Video stored in GCS:", video.gcsUri);
        // Download from GCS and convert to base64
        const gcsResponse = await fetch(video.gcsUri, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!gcsResponse.ok) {
          throw new Error(`Failed to fetch video from GCS: ${video.gcsUri}`);
        }

        const videoBuffer = await gcsResponse.arrayBuffer();
        const videoBase64 = Buffer.from(videoBuffer).toString("base64");

        return {
          videoBase64,
          mimeType: video.mimeType || "video/mp4",
        };
      }

      // If video is returned as base64
      if (video.bytesBase64Encoded) {
        return {
          videoBase64: video.bytesBase64Encoded,
          mimeType: video.mimeType || "video/mp4",
        };
      }
    }

    throw new Error("No video data returned from Vertex AI VEO");
  } catch (error) {
    console.error("Vertex AI VEO error:", error);
    throw error;
  }
}
