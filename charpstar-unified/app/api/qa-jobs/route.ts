import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Type definitions
type SystemMessage = {
  role: "system";
  content: string;
};

type UserMessage = {
  role: "user";
  content: Array<{
    type: "text" | "image_url";
    text?: string;
    image_url?: { url: string };
  }>;
};

type Message = SystemMessage | UserMessage;

type ModelStats = {
  meshCount: number;
  materialCount: number;
  vertices: number;
  triangles: number;
  doubleSidedCount: number;
  doubleSidedMaterials: string[];
  fileSize: number;
  requirements?: {
    maxTriangles: number;
    maxMaterials: number;
    maxFileSize: number;
  };
};

type QAResults = {
  differences: Array<{
    renderIndex: number;
    referenceIndex: number;
    issues: string[];
    bbox: number[];
    severity: string;
  }>;
  summary: string;
  status: string;
  similarityScores?: {
    silhouette?: number;
    proportion?: number;
    colorMaterial?: number;
    overall?: number;
  };
};

// Job Queue Implementation
class QAJobQueue {
  private static instance: QAJobQueue;
  private queue: Array<{
    jobId: string;
    renders: string[];
    references: string[];
    modelStats?: ModelStats;
    retryCount: number;
  }> = [];
  private processing = false;
  private maxConcurrentJobs = parseInt(
    process.env.MAX_CONCURRENT_QA_JOBS || "3"
  );
  private maxQueueSize = parseInt(process.env.MAX_QUEUE_SIZE || "20");
  private activeJobs = new Set<string>();
  private maxRetries = 2;

  static getInstance() {
    if (!QAJobQueue.instance) {
      QAJobQueue.instance = new QAJobQueue();
    }
    return QAJobQueue.instance;
  }

  async addJob(
    jobId: string,
    renders: string[],
    references: string[],
    modelStats?: ModelStats
  ) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(
        `Queue is full. Maximum ${this.maxQueueSize} jobs can be queued. Please try again later.`
      );
    }

    console.log(
      `Adding job ${jobId} to queue. Queue length: ${this.queue.length}/${this.maxQueueSize}`
    );

    this.queue.push({
      jobId,
      renders,
      references,
      modelStats,
      retryCount: 0,
    });

    await supabaseAdmin
      .from("qa_jobs")
      .update({ status: "queued" })
      .eq("id", jobId)
      .select();
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing || this.activeJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    this.processing = true;

    while (
      this.queue.length > 0 &&
      this.activeJobs.size < this.maxConcurrentJobs
    ) {
      const job = this.queue.shift();
      if (!job) break;

      console.log(
        `Starting job ${job.jobId}. Active jobs: ${this.activeJobs.size + 1}/${
          this.maxConcurrentJobs
        }`
      );

      this.activeJobs.add(job.jobId);

      this.processJob(job).finally(() => {
        this.activeJobs.delete(job.jobId);
        console.log(
          `Completed job ${job.jobId}. Active jobs: ${this.activeJobs.size}/${this.maxConcurrentJobs}`
        );

        setTimeout(() => this.processQueue(), 100);
      });
    }

    this.processing = false;
  }

  private async processJob(job: {
    jobId: string;
    renders: string[];
    references: string[];
    modelStats?: ModelStats;
    retryCount: number;
  }) {
    try {
      await processQAJob(
        job.jobId,
        job.renders,
        job.references,
        job.modelStats
      );
    } catch (error: any) {
      console.error(
        `Job ${job.jobId} failed (attempt ${job.retryCount + 1}):`,
        error.message
      );

      if (job.retryCount < this.maxRetries) {
        job.retryCount++;
        console.log(
          `Retrying job ${job.jobId} (attempt ${job.retryCount + 1}/${
            this.maxRetries + 1
          })`
        );

        setTimeout(() => {
          this.queue.unshift(job);
          this.processQueue();
        }, 5000 * job.retryCount);
      } else {
        console.error(
          `Job ${job.jobId} failed permanently after ${
            this.maxRetries + 1
          } attempts`
        );

        await supabaseAdmin
          .from("qa_jobs")
          .update({
            status: "failed",
            error: `Failed after ${this.maxRetries + 1} attempts: ${
              error.message
            }`,
            end_time: new Date(),
          })
          .eq("id", job.jobId);
      }
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      processing: this.processing,
      queueFull: this.queue.length >= this.maxQueueSize,
    };
  }

  getJobPosition(jobId: string): number {
    const position = this.queue.findIndex((job) => job.jobId === jobId);
    return position === -1 ? -1 : position + 1;
  }
}

// Rate limiting
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes window
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per 5 minutes

function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const key = ip || "unknown";

  let limiter = rateLimiter.get(key);

  if (!limiter || now > limiter.resetTime) {
    limiter = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
  }

  const allowed = limiter.count < RATE_LIMIT_MAX_REQUESTS;

  if (allowed) {
    limiter.count++;
  }

  rateLimiter.set(key, limiter);

  return {
    allowed,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - limiter.count),
    resetTime: limiter.resetTime,
  };
}

// Helper functions
function extractSimilarityScores(summary: string) {
  const scores: any = {};

  const patterns: Record<string, RegExp> = {
    silhouette: /silhouette[:\s]*(\d+)%/i,
    proportion: /proportion[:\s]*(\d+)%/i,
    colorMaterial: /(?:color[\/\-\s]*material|color|material)[:\s]*(\d+)%/i,
    overall: /overall[:\s]*(\d+)%/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = summary.match(pattern);
    if (match) {
      scores[key] = parseInt(match[1]);
    }
  }

  return scores;
}

function cleanSummary(summary: string): string {
  const cleanedSummary = summary
    .replace(/\.?\s*Similarity scores:.*$/i, "")
    .trim();

  return cleanedSummary.endsWith(".") ? cleanedSummary : cleanedSummary + ".";
}

// Process QA job function
async function processQAJob(
  jobId: string,
  renders: string[],
  references: string[],
  modelStats?: ModelStats
) {
  try {
    const { error: statusError } = await supabaseAdmin
      .from("qa_jobs")
      .update({ status: "processing" })
      .eq("id", jobId);

    if (statusError) {
      throw new Error(`Failed to update job status: ${statusError.message}`);
    }

    // Technical requirements check
    if (modelStats?.requirements) {
      const issues: string[] = [];

      if (
        modelStats.triangles &&
        modelStats.triangles > modelStats.requirements.maxTriangles
      ) {
        issues.push(
          `Triangle count: ${modelStats.triangles.toLocaleString()} exceeds maximum ${modelStats.requirements.maxTriangles.toLocaleString()}`
        );
      }

      if (modelStats.materialCount > modelStats.requirements.maxMaterials) {
        issues.push(
          `Material count: ${modelStats.materialCount} exceeds maximum ${modelStats.requirements.maxMaterials}`
        );
      }

      if (modelStats.fileSize > modelStats.requirements.maxFileSize) {
        const actualMB = (modelStats.fileSize / (1024 * 1024)).toFixed(1);
        const maxMB = (
          modelStats.requirements.maxFileSize /
          (1024 * 1024)
        ).toFixed(0);
        issues.push(`File size: ${actualMB}MB exceeds maximum ${maxMB}MB`);
      }

      if (modelStats.doubleSidedCount > 0) {
        issues.push("Double sided material found");
      }

      if (issues.length > 0) {
        const technicalFailureResult: QAResults = {
          differences: issues.map((issue) => ({
            renderIndex: 0,
            referenceIndex: 0,
            issues: [issue],
            bbox: [0, 0, 100, 100],
            severity: "high" as const,
          })),
          summary: `${issues.join("; ")}.`,
          status: "Not Approved",
          similarityScores: {
            silhouette: 0,
            proportion: 0,
            colorMaterial: 0,
            overall: 0,
          },
        };

        await supabaseAdmin
          .from("qa_jobs")
          .update({
            status: "complete",
            qa_results: JSON.stringify(technicalFailureResult),
            end_time: new Date(),
          })
          .eq("id", jobId);

        return;
      }
    }

    // If no renders provided, we need to capture screenshots first
    if (renders.length === 0) {
      // For now, we'll analyze references only since screenshot capture requires frontend
      // In a full implementation, this would trigger screenshot capture
      const systemMessage = {
        role: "system",
        content: `You are a 3D model visual QA specialist. Analyze the reference images for quality and completeness.

Guidelines:
1. Analyze the reference images for clarity, completeness, and quality
2. Check if the references show all necessary angles and details
3. Assess if the references are sufficient for 3D modeling
4. Provide similarity scores: Silhouette X%, Proportion X%, Color/Material X%, Overall X%
5. If overall score ≥ 70% → status = "Approved", otherwise "Not Approved"

Output JSON with: differences[], summary, status`,
      };

      const messages: Message[] = [systemMessage as SystemMessage];

      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Please analyze these reference images for 3D modeling quality and completeness:",
          },
        ],
      } as const);

      references.forEach((url, i) => {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: `Reference image ${i + 1}:` },
            { type: "image_url", image_url: { url } },
          ],
        } as const);
      });

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          stream: false,
          messages,
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        throw new Error(
          `OpenAI API error: ${aiRes.status} ${aiRes.statusText}`
        );
      }

      const aiJson = await aiRes.json();
      const raw = (aiJson.choices?.[0]?.message?.content || "").trim();

      let qaResults: QAResults;
      try {
        qaResults = JSON.parse(raw);
      } catch (parseError) {
        // Attempt to salvage JSON block
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            qaResults = JSON.parse(match[0]);
          } catch (e) {
            throw new Error(`Failed to parse GPT response: ${parseError}`);
          }
        } else {
          throw new Error(`Failed to parse GPT response: ${parseError}`);
        }
      }

      qaResults.similarityScores = extractSimilarityScores(qaResults.summary);
      qaResults.summary = cleanSummary(qaResults.summary);

      await supabaseAdmin
        .from("qa_jobs")
        .update({
          status: "complete",
          end_time: new Date().toISOString(),
          qa_results: JSON.stringify(qaResults),
        })
        .eq("id", jobId);

      console.log(
        `Job ${jobId} completed successfully (reference analysis only)`
      );
      return;
    }

    // AI Analysis for renders vs references comparison
    const systemMessage = {
      role: "system",
      content: `You are a 3D model visual QA specialist. The model has already passed technical requirements validation.

Compare the 3D model renders against reference images for visual accuracy.

‼️ CRITICAL - READ CAREFULLY ‼️
PERSPECTIVE & VIEW MATCHING:
• ONLY compare views showing the SAME PERSPECTIVE and ANGLE of the product
• If the render shows a different side or angle than the reference, DO NOT compare them at all
• Different sides of the product should NEVER be compared (e.g., front view vs. side view)

‼️ NO DUPLICATE COMMENTS ‼️
• If you find the same issue visible in multiple views, mention it ONLY ONCE
• Choose the clearest/best view to report the issue, not every view where it's visible

Guidelines:
1. 3D Model come from <model-viewer>—perfect fidelity is not expected.
2. References are human-crafted—focus on real discrepancies.
3. Analyze geometry, proportions, textures, and material colors for each pairing.
4. Be extremely specific with differences.
5. Each issue must state: what's in the 3D Model, what's in the reference, the exact difference.

SCORING - BE PRECISE:
• SILHOUETTE: Compare overall shape, outline, and form. Ignore color/texture. Perfect match = 100%
• PROPORTION: Compare relative sizes of parts. Be strict - even 5% size differences should reduce score
• COLOR/MATERIAL: Compare exact colors, textures, materials. Small color shifts should impact score significantly
• OVERALL: Weighted average considering all factors. Be conservative

SCORING SCALE: 
• 90-100% = excellent match with minimal differences
• 75-89% = good match but clear differences visible
• 60-74% = acceptable match with moderate differences  
• 40-59% = poor match with significant differences
• 0-39% = unacceptable match with major differences

APPROVAL CRITERIA:
- If overall score ≥ 70% → status = "Approved"
- If overall score < 70% → status = "Not Approved"

Output exactly one JSON object with these keys:

"differences": [
  {
    "renderIndex": <integer>,
    "referenceIndex": <integer>,
    "issues": [<string>],
    "bbox": [<integer>,<integer>,<integer>,<integer>],
    "severity": "low"|"medium"|"high"
  }
],
"summary": <string ending with "Similarity scores: Silhouette X%, Proportion X%, Color/Material X%, Overall X%.">,
"status": "Approved"|"Not Approved"

Do not output anything else—no markdown, no code fences, no extra keys, no comments.`,
    };

    const messages: Message[] = [systemMessage as SystemMessage];

    // Add renders to the message
    renders.forEach((url, i) => {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Rendered screenshot ${i + 1}:` },
          { type: "image_url", image_url: { url } },
        ],
      } as const);
    });

    references.forEach((url, i) => {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Reference image ${i + 1}:` },
          { type: "image_url", image_url: { url } },
        ],
      } as const);
    });

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: false,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`OpenAI API error: ${aiRes.status} ${aiRes.statusText}`);
    }

    const aiJson = await aiRes.json();
    const raw = (aiJson.choices?.[0]?.message?.content || "").trim();

    let qaResults: QAResults;
    try {
      qaResults = JSON.parse(raw);
    } catch (parseError) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          qaResults = JSON.parse(match[0]);
        } catch (e) {
          throw new Error(`Failed to parse GPT response: ${parseError}`);
        }
      } else {
        throw new Error(`Failed to parse GPT response: ${parseError}`);
      }
    }

    qaResults.similarityScores = extractSimilarityScores(qaResults.summary);
    qaResults.summary = cleanSummary(qaResults.summary);

    await supabaseAdmin
      .from("qa_jobs")
      .update({
        status: "complete",
        end_time: new Date().toISOString(),
        qa_results: JSON.stringify(qaResults),
      })
      .eq("id", jobId);

    console.log(`Job ${jobId} completed successfully`);
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);

    await supabaseAdmin
      .from("qa_jobs")
      .update({
        status: "failed",
        error: error.message,
        end_time: new Date(),
      })
      .eq("id", jobId);

    throw error;
  }
}

// POST endpoint to create a new QA job
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    const { renders, references, modelStats } = await request.json();

    if (!Array.isArray(renders)) {
      return NextResponse.json(
        { error: "Renders must be an array" },
        { status: 400 }
      );
    }

    // Allow empty renders array - they will be captured by the QA system
    if (renders.length > 0 && renders.length !== 4) {
      return NextResponse.json(
        {
          error: "Must send exactly 4 renders or empty array for auto-capture",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(references) ||
      references.length < 1 ||
      references.length > 5
    ) {
      return NextResponse.json(
        { error: "Must send 1-5 reference images" },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("qa_jobs")
      .insert([
        {
          id: jobId,
          status: "pending",
          start_time: new Date().toISOString(),
        },
      ])
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create job: ${insertError.message}` },
        { status: 500 }
      );
    }

    const queue = QAJobQueue.getInstance();
    await queue.addJob(jobId, renders, references, modelStats);

    const queueStatus = queue.getQueueStatus();
    const position = queue.getJobPosition(jobId);

    return NextResponse.json(
      {
        jobId,
        status: "queued",
        queuePosition: position,
        estimatedWaitTime: position * 2,
        queueInfo: {
          position: position,
          totalInQueue: queueStatus.queueLength,
          activeJobs: queueStatus.activeJobs,
          maxConcurrent: queueStatus.maxConcurrentJobs,
        },
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("POST /api/qa-jobs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET endpoint to check job status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabaseAdmin
      .from("qa_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let qaResults = null;
    if (job.qa_results) {
      try {
        qaResults = JSON.parse(job.qa_results);
      } catch (e) {
        console.error("Failed to parse QA results:", e);
      }
    }

    let queueInfo = null;
    if (job.status === "queued" || job.status === "pending") {
      const queue = QAJobQueue.getInstance();
      const position = queue.getJobPosition(jobId);
      const queueStatus = queue.getQueueStatus();

      queueInfo = {
        position: position > 0 ? position : null,
        totalInQueue: queueStatus.queueLength,
        activeJobs: queueStatus.activeJobs,
        maxConcurrent: queueStatus.maxConcurrentJobs,
        estimatedWaitTime: position > 0 ? position * 2 : 0,
      };
    }

    return NextResponse.json({
      jobId,
      status: job.status,
      error: job.error,
      startTime: job.start_time,
      endTime: job.end_time,
      qaResults,
      queueInfo,
    });
  } catch (err: any) {
    console.error("GET /api/qa-jobs error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
