// src/app/api/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import os from "os";
import https from "https";
import fs from "fs";
import { getDefaultClientName, fetchClientConfig } from "@/config/clientConfig";

const REGION = process.env.BUNNY_REGION || "";
const BASE_HOSTNAME = "storage.bunnycdn.com";
const HOSTNAME = REGION ? `${REGION}.${BASE_HOSTNAME}` : BASE_HOSTNAME;
const STORAGE_ZONE_PATH = process.env.BUNNY_STORAGE_ZONE_NAME || "";
const ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || "";
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || "";
const BUNNY_PULL_ZONE_URL =
  process.env.BUNNY_PULL_ZONE_URL || "cdn.charpstar.net";
const DEFAULT_CLIENT = getDefaultClientName();

// Helper to extract the zone name and base path from the environment variable
const getStorageZoneDetails = () => {
  const parts = STORAGE_ZONE_PATH.split("/");
  const zoneName = parts[0];
  const basePath = parts.slice(1).join("/");
  return { zoneName, basePath };
};

// Helper to save a file from FormData temporarily
async function saveFormFile(
  formData: FormData
): Promise<{ filepath: string; filename: string; contentType: string }> {
  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file provided");
  }

  // Check file type - only accept JPG files
  const contentType = file.type;
  const isJpg =
    contentType === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg");

  if (!isJpg) {
    throw new Error("Only JPG files are supported for texture uploads");
  }

  // Get filename from the FormData or use the file's name
  const suggestedFilename = formData.get("filename") as string;
  let filename = suggestedFilename || file.name;

  // Ensure the filename has a .jpg extension
  if (
    !filename.toLowerCase().endsWith(".jpg") &&
    !filename.toLowerCase().endsWith(".jpeg")
  ) {
    filename = filename.replace(/\.[^/.]+$/, "") + ".jpg";
  }

  // Create a temporary file path
  const tempDir = os.tmpdir();
  const filepath = path.join(tempDir, filename);

  // Convert file to buffer and save it
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(filepath, buffer);

  return { filepath, filename, contentType };
}

export async function POST(request: NextRequest) {
  try {
    // Parse the multipart form data
    const formData = await request.formData();

    try {
      // Save the file temporarily and validate it's a JPG
      const { filepath, filename } = await saveFormFile(formData);

      // Get storage zone details
      const { zoneName } = getStorageZoneDetails();

      // Get the client and target directory from the form data
      const clientName = (formData.get("client") as string) || DEFAULT_CLIENT;
      const targetDirectory = (formData.get("targetDirectory") as string) || "";

      // Get client-specific BunnyCDN configuration
      const clientConfig = await fetchClientConfig(clientName as string);

      // Construct the target path for the file in BunnyCDN
      let filePath = `${clientConfig.bunnyCdn.basePath}/${clientConfig.bunnyCdn.imagesFolder}/`;

      // Add the target directory if specified
      if (targetDirectory) {
        // Make sure there's no leading or trailing slashes
        const cleanDirectory = targetDirectory.replace(/^\/+|\/+$/g, "");
        filePath += `${cleanDirectory}/`;
      }

      // Add the filename
      filePath += filename;

      // Read the file from the temporary location
      const fileBuffer = fs.readFileSync(filepath);

      // Upload to BunnyCDN
      const uploadPromise = new Promise((resolve, reject) => {
        const options = {
          method: "PUT",
          host: HOSTNAME,
          path: `/${zoneName}/${filePath}`,
          headers: {
            AccessKey: ACCESS_KEY,
            "Content-Type": "image/jpeg",
            "Content-Length": fileBuffer.length,
          },
        };

        const req = https.request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve({ success: true });
            } else {
              reject(
                new Error(
                  `Upload failed with status ${res.statusCode}: ${data}`
                )
              );
            }
          });
        });

        req.on("error", (error) => {
          reject(error);
        });

        req.write(fileBuffer);
        req.end();
      });

      await uploadPromise;

      // Clean up the temporary file
      fs.unlinkSync(filepath);

      // Construct the CDN URL for the uploaded file
      const fileUrl = `https://${BUNNY_PULL_ZONE_URL}/${filePath}`;

      // Purge the cache for this file
      try {
        const purgeResponse = await fetch(
          "https://api.bunny.net/purge?async=false",
          {
            method: "POST",
            headers: {
              AccessKey: BUNNY_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls: [fileUrl] }),
          }
        );

        if (!purgeResponse.ok) {
          const errorText = await purgeResponse.text();
          console.warn(
            `Cache purge warning: ${purgeResponse.status} - ${errorText}`
          );
        } else {
        }
      } catch (purgeError) {
        console.error("Error purging cache:", purgeError);
      }

      return NextResponse.json({
        success: true,
        message: "JPG texture uploaded and cache purged",
        fileUrl,
        filename,
      });
    } catch (error: unknown) {
      // Properly type check the error
      if (error instanceof Error) {
        if (
          error.message === "Only JPG files are supported for texture uploads"
        ) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      // Re-throw for the outer catch block to handle
      throw error;
    }
  } catch (error: unknown) {
    console.error("Image upload error:", error);

    // Safely extract error message
    let errorMessage = "Failed to upload image";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
