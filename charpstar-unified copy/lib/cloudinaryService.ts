import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UpscaleOptions {
  width?: number;
  height?: number;
  quality?: "auto" | "auto:best" | "auto:good" | "auto:eco" | number;
  format?: "auto" | "jpg" | "png" | "webp" | "avif";
}

/**
 * Upload a base64 image to Cloudinary and return the public URL
 */
export async function uploadBase64Image(
  base64Data: string,
  folder: string = "scene-render"
): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64WithoutPrefix = base64Data.replace(
      /^data:image\/[a-z]+;base64,/,
      ""
    );

    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${base64WithoutPrefix}`,
      {
        folder,
        resource_type: "image",
        format: "png",
        quality: "auto:best",
      }
    );

    return result.secure_url;
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
}

/**
 * Upscale an image using Cloudinary's AI upscaling
 */
export async function upscaleImage(
  publicId: string,
  options: UpscaleOptions = {}
): Promise<string> {
  try {
    const { width = 4096, height = 2048 } = options;

    // Use Cloudinary's AI enhancement and upscaling
    const upscaledUrl = cloudinary.url(publicId, {
      transformation: [
        { effect: "upscale" },
        {
          width: width,
          height: height,
          crop: "fill",
          quality: "auto:best",
          format: "auto",
          gravity: "center",
        },
      ],
    });

    return upscaledUrl;
  } catch (error) {
    console.error("Error upscaling image:", error);
    throw new Error("Failed to upscale image");
  }
}

/**
 * Upload base64 image and immediately upscale it
 */
export async function uploadAndUpscaleImage(
  base64Data: string,
  options: UpscaleOptions = {},
  folder: string = "scene-render"
): Promise<string> {
  try {
    // First upload the image
    const uploadedUrl = await uploadBase64Image(base64Data, folder);

    // Extract public ID from the URL
    const urlParts = uploadedUrl.split("/");
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split(".")[0];

    // Upscale the uploaded image and return the Cloudinary URL
    const upscaledUrl = await upscaleImage(`${folder}/${publicId}`, options);

    return upscaledUrl;
  } catch (error) {
    console.error("Error uploading and upscaling image:", error);
    throw new Error("Failed to upload and upscale image");
  }
}

/**
 * Process multiple base64 images: upload and upscale each one
 */
export async function processMultipleImages(
  base64Images: string[],
  options: UpscaleOptions = {},
  folder: string = "scene-render"
): Promise<string[]> {
  try {
    const promises = base64Images.map((base64Data, index) =>
      uploadAndUpscaleImage(
        base64Data,
        options,
        `${folder}/batch-${Date.now()}-${index}`
      )
    );

    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error("Error processing multiple images:", error);
    throw new Error("Failed to process multiple images");
  }
}
