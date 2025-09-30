interface DirectUploadProgress {
  current: number;
  total: number;
  fileName: string;
  status: "preparing" | "uploading" | "processing" | "complete" | "error";
  error?: string;
  progress: number; // 0-100
}

interface DirectUploadResult {
  success: boolean;
  cdnUrl?: string;
  error?: string;
}

export class DirectFileUploader {
  private onProgress?: (progress: DirectUploadProgress) => void;

  constructor(onProgress?: (progress: DirectUploadProgress) => void) {
    this.onProgress = onProgress;
  }

  async uploadFile(
    file: File,
    assetId: string,
    fileType: "glb" | "reference" | "asset"
  ): Promise<DirectUploadResult> {
    try {
      // Step 1: Get direct upload URL from our API (this stays under 4.5MB)
      this.updateProgress({
        current: 0,
        total: 100,
        fileName: file.name,
        status: "preparing",
        progress: 10,
      });

      const urlResponse = await fetch("/api/assets/generate-upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType,
          assetId,
        }),
      });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json();
        throw new Error(errorData.error || "Failed to generate upload URL");
      }

      const { uploadUrl, cdnUrl, storagePath, accessKey } =
        await urlResponse.json();

      // Step 2: Upload directly to BunnyCDN (bypasses Vercel completely)
      this.updateProgress({
        current: 0,
        total: 100,
        fileName: file.name,
        status: "uploading",
        progress: 20,
      });

      // Create a progress tracking fetch
      const uploadResponse = await this.uploadWithProgress(
        file,
        uploadUrl,
        accessKey,
        (progress) => {
          this.updateProgress({
            current: Math.round(20 + progress * 0.6), // 20-80% for upload
            total: 100,
            fileName: file.name,
            status: "uploading",
            progress: Math.round(20 + progress * 0.6),
          });
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(
          `Direct upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      // Step 3: Process the upload (update database)
      this.updateProgress({
        current: 80,
        total: 100,
        fileName: file.name,
        status: "processing",
        progress: 80,
      });

      const processResponse = await fetch("/api/assets/upload-large-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId,
          fileName: file.name,
          cdnUrl,
          storagePath,
          fileType,
          fileSize: file.size,
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || "Failed to process upload");
      }

      this.updateProgress({
        current: 100,
        total: 100,
        fileName: file.name,
        status: "complete",
        progress: 100,
      });

      return {
        success: true,
        cdnUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Direct upload failed";

      this.updateProgress({
        current: 0,
        total: 100,
        fileName: file.name,
        status: "error",
        error: errorMessage,
        progress: 0,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async uploadWithProgress(
    file: File,
    uploadUrl: string,
    accessKey: string,
    onProgress: (progress: number) => void
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(
            new Response(xhr.response, {
              status: xhr.status,
              statusText: xhr.statusText,
            })
          );
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed: Network error"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.setRequestHeader("AccessKey", accessKey); // BunnyCDN authentication
      xhr.send(file);
    });
  }

  private updateProgress(progress: DirectUploadProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
}

// Utility function to check if file needs direct upload
export function needsDirectUpload(file: File): boolean {
  const maxRegularSize = 4 * 1024 * 1024; // 4MB (safe margin)
  return file.size > maxRegularSize;
}

// Utility function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
