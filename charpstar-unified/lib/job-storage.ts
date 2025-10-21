// Shared job storage for the product render system
// In production, this would be replaced with a database

interface Job {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  products?: any[];
  settings?: any;
  createdAt: string;
  downloadUrl?: string;
  file_path?: string;
  is_preview?: boolean;
  preview_for?: string;
  product_name?: string;
}

class JobStorage {
  private jobs = new Map<string, Job>();

  set(jobId: string, job: Job) {
    this.jobs.set(jobId, job);
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }

  delete(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  findByPreviewId(previewId: string): Job | undefined {
    for (const job of this.jobs.values()) {
      if (job.preview_for === previewId) {
        return job;
      }
    }
    return undefined;
  }
}

// Use a global variable to ensure the same instance across all API routes
declare global {
  // eslint-disable-next-line no-var
  var __jobStorage: JobStorage | undefined;
}

// Export a singleton instance - ensure it's properly shared
if (!globalThis.__jobStorage) {
  globalThis.__jobStorage = new JobStorage();
}
export const jobStorage = globalThis.__jobStorage;
export type { Job };
