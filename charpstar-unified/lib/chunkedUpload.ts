interface ChunkUploadProgress {
  currentChunk: number;
  totalChunks: number;
  fileName: string;
  status: "uploading" | "processing" | "complete" | "error";
  error?: string;
  progress: number; // 0-100
}

interface ChunkUploadResult {
  success: boolean;
  cdnUrl?: string;
  error?: string;
}

export class ChunkedFileUploader {
  private onProgress?: (progress: ChunkUploadProgress) => void;
  private chunkSize: number;

  constructor(
    onProgress?: (progress: ChunkUploadProgress) => void,
    chunkSize: number = 3 * 1024 * 1024 // 3MB chunks (safe for Vercel)
  ) {
    this.onProgress = onProgress;
    this.chunkSize = chunkSize;
  }

  async uploadFile(
    file: File,
    assetId: string,
    fileType: "glb" | "reference" | "asset"
  ): Promise<ChunkUploadResult> {
    try {
      // Calculate chunks
      const totalChunks = Math.ceil(file.size / this.chunkSize);

      console.log(
        `📦 Splitting ${file.name} into ${totalChunks} chunks of ${this.chunkSize / 1024 / 1024}MB each`
      );

      // Step 1: Initialize chunked upload
      this.updateProgress({
        currentChunk: 0,
        totalChunks,
        fileName: file.name,
        status: "uploading",
        progress: 0,
      });

      const initResponse = await fetch("/api/assets/init-chunked-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType,
          assetId,
          totalChunks,
          fileSize: file.size,
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(
          errorData.error || "Failed to initialize chunked upload"
        );
      }

      const { uploadId, chunkUrls } = await initResponse.json();

      // Step 2: Upload chunks
      const uploadPromises = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);

        const chunkPromise = this.uploadChunk(
          chunk,
          chunkUrls[i],
          i + 1,
          totalChunks
        );
        uploadPromises.push(chunkPromise);
      }

      // Upload chunks in parallel (but limit concurrency)
      const concurrency = 3; // Upload 3 chunks at a time
      for (let i = 0; i < uploadPromises.length; i += concurrency) {
        const batch = uploadPromises.slice(i, i + concurrency);
        await Promise.all(batch);
      }

      // Step 3: Complete the upload
      this.updateProgress({
        currentChunk: totalChunks,
        totalChunks,
        fileName: file.name,
        status: "processing",
        progress: 90,
      });

      const completeResponse = await fetch(
        "/api/assets/complete-chunked-upload",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uploadId,
            assetId,
            fileType,
          }),
        }
      );

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        throw new Error(errorData.error || "Failed to complete chunked upload");
      }

      const result = await completeResponse.json();

      this.updateProgress({
        currentChunk: totalChunks,
        totalChunks,
        fileName: file.name,
        status: "complete",
        progress: 100,
      });

      return {
        success: true,
        cdnUrl: result.cdnUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Chunked upload failed";

      this.updateProgress({
        currentChunk: 0,
        totalChunks: 0,
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

  private async uploadChunk(
    chunk: Blob,
    chunkUrl: string,
    chunkNumber: number,
    totalChunks: number
  ): Promise<void> {
    try {
      const response = await fetch(chunkUrl, {
        method: "PUT",
        body: chunk,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Chunk ${chunkNumber} upload failed: ${response.status} ${response.statusText}`
        );
      }

      // Update progress
      const progress = Math.round((chunkNumber / totalChunks) * 80); // 80% for chunk uploads
      this.updateProgress({
        currentChunk: chunkNumber,
        totalChunks,
        fileName: "Uploading...",
        status: "uploading",
        progress,
      });

      console.log(
        `✅ Chunk ${chunkNumber}/${totalChunks} uploaded successfully`
      );
    } catch (error) {
      console.error(`❌ Chunk ${chunkNumber} upload failed:`, error);
      throw error;
    }
  }

  private updateProgress(progress: ChunkUploadProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
}

// Utility function to check if file needs chunked upload
export function needsChunkedUpload(file: File): boolean {
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
