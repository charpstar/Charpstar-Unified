// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import https from "https";
import fetch from "node-fetch";
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

export async function POST(request: NextRequest) {
  try {
    // Log request information for debugging
    console.log("Received upload request");
    console.log(
      "Request headers:",
      Object.fromEntries(request.headers.entries())
    );
    console.log("Request content type:", request.headers.get("content-type"));

    // Parse the JSON body
    let requestBody;
    try {
      requestBody = await request.json();
      console.log("Request body parsed successfully");
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (!requestBody || !requestBody.data || !requestBody.filename) {
      console.error("Missing required fields in request body");
      return NextResponse.json(
        { error: "Invalid request data - missing data or filename" },
        { status: 400 }
      );
    }

    // Extract the data and filename
    const resourceData = requestBody.data;
    const filename = requestBody.filename;

    // Log what we're trying to process
    console.log(
      `Processing upload for ${filename} with data of type ${typeof resourceData}`
    );

    // Validate the filename is one of our expected types
    const validFilenames = ["materials.json", "textures.json", "images.json"];
    if (!validFilenames.includes(filename)) {
      console.error(`Invalid filename: ${filename}`);
      return NextResponse.json(
        {
          error:
            "Invalid filename. Must be one of: " + validFilenames.join(", "),
        },
        { status: 400 }
      );
    }

    let jsonString;
    try {
      jsonString = JSON.stringify(resourceData, null, 2);
      console.log(
        `Successfully stringified ${filename} data, length: ${jsonString.length}`
      );
    } catch (stringifyError) {
      console.error(`Error stringifying ${filename} data:`, stringifyError);
      return NextResponse.json(
        { error: "Failed to stringify JSON data" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(jsonString);

    // Get storage zone details
    const { zoneName, basePath } = getStorageZoneDetails();
    console.log(`Storage zone: ${zoneName}, base path: ${basePath}`);

    // Get client name from request or use default
    const clientName = requestBody.client || DEFAULT_CLIENT;

    // Get client-specific BunnyCDN configuration
    const clientConfig = await fetchClientConfig(clientName as string);

    // Determine the appropriate folder based on file type
    const targetFolder = clientConfig.bunnyCdn.resourcesFolder;

    // Construct the path for the file in BunnyCDN using client-specific paths
    const filePath = `${clientConfig.bunnyCdn.basePath}/${targetFolder}/${filename}`;
    console.log(`Full file path for upload: ${filePath}`);

    // Upload to BunnyCDN
    const uploadPromise = new Promise((resolve, reject) => {
      const options = {
        method: "PUT",
        host: HOSTNAME,
        path: `/${zoneName}/${filePath}`,
        headers: {
          AccessKey: ACCESS_KEY,
          "Content-Type": "application/json",
          "Content-Length": buffer.length,
        },
      };

      console.log(`Uploading to: ${options.host}${options.path}`);

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          console.log(`Upload response status: ${res.statusCode}`);
          console.log(`Upload response data: ${data}`);

          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ success: true });
          } else {
            reject(
              new Error(`Upload failed with status ${res.statusCode}: ${data}`)
            );
          }
        });
      });

      req.on("error", (error) => {
        console.error(`Request error during upload: ${error.message}`);
        reject(error);
      });

      // Log right before writing data
      console.log(`Writing ${buffer.length} bytes of data to request`);
      req.write(buffer);
      req.end();
      console.log("Request ended");
    });

    try {
      await uploadPromise;
      console.log("Upload completed successfully");
    } catch (uploadError: unknown) {
      console.error("Error during upload:", uploadError);

      // Handle the unknown error type properly
      let errorMessage = "Unknown error";
      if (uploadError instanceof Error) {
        errorMessage = uploadError.message;
      } else if (typeof uploadError === "string") {
        errorMessage = uploadError;
      } else if (
        uploadError &&
        typeof uploadError === "object" &&
        "message" in uploadError
      ) {
        errorMessage = String(uploadError.message);
      }

      return NextResponse.json(
        { error: "Failed to upload file: " + errorMessage },
        { status: 500 }
      );
    }

    // Construct the CDN URL for the uploaded file
    const fileUrl = `https://${BUNNY_PULL_ZONE_URL}/${filePath}`;

    // Purge the cache for this file
    console.log(`Purging cache for: ${fileUrl}`);
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
        console.log("Cache purge successful");
      }
    } catch (purgeError) {
      console.error("Error purging cache:", purgeError);
      // Continue even if purge fails
    }

    console.log("Successfully completed entire upload process");
    return NextResponse.json({
      success: true,
      message: `File ${filename} uploaded and cache purged`,
      fileUrl: fileUrl,
      resourceType: filename.split(".")[0],
    });
  } catch (error: unknown) {
    console.error("Uncaught error in upload route:", error);

    // Handle the unknown error type properly
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error && typeof error === "object" && "message" in error) {
      errorMessage = String(error.message);
    }

    return NextResponse.json(
      { error: "Failed to upload file: " + errorMessage },
      { status: 500 }
    );
  }
}
