interface UploadProgress {
  current: number;
  total: number;
  fileName: string;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
}

interface UploadResult {
  success: boolean;
  cdnUrl?: string;
  error?: string;
}

export class LargeFileUploader {
  private onProgress?: (progress: UploadProgress) => void;

  constructor(onProgress?: (progress: UploadProgress) => void) {
    this.onProgress = onProgress;
  }

  async uploadFile(
    file: File,
    assetId: string,
    fileType: "glb" | "reference" | "asset"
  ): Promise<UploadResult> {
    try {
      // Step 1: Generate upload URL
      this.updateProgress({
        current: 0,
        total: 100,
        fileName: file.name,
        status: "uploading",
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

      const { uploadUrl, cdnUrl, storagePath } = await urlResponse.json();

      // Step 2: Upload file directly to BunnyCDN
      this.updateProgress({
        current: 25,
        total: 100,
        fileName: file.name,
        status: "uploading",
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      // Step 3: Process the upload
      this.updateProgress({
        current: 75,
        total: 100,
        fileName: file.name,
        status: "processing",
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
      });

      return {
        success: true,
        cdnUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      this.updateProgress({
        current: 0,
        total: 100,
        fileName: file.name,
        status: "error",
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private updateProgress(progress: UploadProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
}

// Utility function to check if file is too large for regular upload
export function isFileTooLarge(file: File): boolean {
  const maxRegularSize = 3.5 * 1024 * 1024; // 3.5MB safety threshold (Vercel limit is ~4MB)
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
