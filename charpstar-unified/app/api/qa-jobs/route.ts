import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GoogleGenAI } from "@google/genai";

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
        content: `You are a 3D model visual QA specialist. Compare the 3D model screenshots against the reference images to assess accuracy and quality.

ANALYSIS APPROACH:
1. **Intelligent View Matching**: Match each screenshot to the most relevant reference image(s) based on camera angle and view
2. **Adaptive Comparison**: If reference images are limited (e.g., only front view), only compare the corresponding screenshot views
3. **Comprehensive Analysis**: For each matched pair, analyze:
   - Silhouette/Shape accuracy
   - Proportions and dimensions
   - Color scheme and materials
   - Textures and surface details
   - Branding elements (logos, text)
   - Overall visual fidelity

SCORING SYSTEM:
- Silhouette: How well the overall shape matches (0-100%)
- Proportion: Accuracy of relative sizes and dimensions (0-100%)
- Color/Material: Color accuracy, material appearance, textures (0-100%)
- Overall: Weighted average considering all factors (0-100%)

APPROVAL CRITERIA - BE STRICT:
- If overall score ≥ 65% AND no individual score < 60% → status = "Approved"
- If overall score < 65% OR any individual score < 60% → status = "Not Approved"
- If you mention "significant discrepancies" in your summary → status = "Not Approved"
- If Color/Material score < 50% → status = "Not Approved" (color accuracy is critical)
- If critical branding elements are missing → status = "Not Approved"

OUTPUT FORMAT:
{
  "differences": [
    {
      "renderIndex": 0,
      "referenceIndex": 0,
      "view": "Front View",
      "issues": ["Specific issue 1", "Specific issue 2"],
      "bbox": [x1, y1, x2, y2],
      "severity": "high|medium|low"
    }
  ],
  "summary": "Overall assessment of the 3D model accuracy",
  "status": "Approved|Not Approved",
  "similarityScores": {
    "silhouette": 85,
    "proportion": 90,
    "colorMaterial": 70,
    "overall": 82
  }
}

CRITICAL: Output ONLY valid JSON. Do not wrap in markdown code blocks. Do not include any text before or after the JSON object. Start with { and end with }.`,
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

      // Initialize Gemini for reference-only analysis
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable not set");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Convert messages to Gemini format
      const geminiContents: any[] = [];
      
      for (const msg of messages) {
        if (msg.role === "system") {
          geminiContents.push({
            role: "user",
            parts: [{ text: msg.content }]
          });
        } else if (msg.role === "user") {
          const parts: any[] = [];
          for (const content of msg.content) {
            if (content.type === "text") {
              parts.push({ text: content.text });
            } else if (content.type === "image_url" && content.image_url) {
              // Fetch image and convert to base64
              try {
                const imageUrl = content.image_url.url;
                let base64Data: string;
                let mimeType = "image/jpeg";
                
                if (imageUrl.startsWith('data:')) {
                  // Already base64 encoded
                  const [header, data] = imageUrl.split(',');
                  base64Data = data;
                  const mimeMatch = header.match(/data:([^;]+)/);
                  if (mimeMatch) {
                    mimeType = mimeMatch[1];
                  }
                } else {
                  // Fetch image from URL
                  const response = await fetch(imageUrl);
                  if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                  }
                  const arrayBuffer = await response.arrayBuffer();
                  base64Data = Buffer.from(arrayBuffer).toString('base64');
                  
                  // Determine MIME type from URL or response
                  const contentType = response.headers.get('content-type');
                  if (contentType) {
                    mimeType = contentType;
                  } else if (imageUrl.includes('.png')) {
                    mimeType = "image/png";
                  } else if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
                    mimeType = "image/jpeg";
                  }
                }
                
                parts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                });
              } catch (error) {
                console.error('Error processing image:', error);
                // Skip this image if there's an error
                continue;
              }
            }
          }
          geminiContents.push({
            role: "user",
            parts: parts
          });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: geminiContents,
        config: {
          thinkingConfig: {
            thinkingBudget: 0, // Disables thinking
          },
        }
      });

      const raw = response.text || "";

      let qaResults: QAResults;
      try {
        qaResults = JSON.parse(raw);
      } catch (parseError) {
        // Attempt to extract JSON from markdown code blocks
        let jsonText = raw;
        
        // Remove markdown code block markers
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Try to find JSON object in the text
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            qaResults = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Raw response:', raw);
            console.error('Cleaned response:', jsonText);
            console.error('JSON match:', jsonMatch[0]);
            throw new Error(`Failed to parse Gemini response: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          console.error('Raw response:', raw);
          throw new Error(`Failed to parse Gemini response: No JSON found in response`);
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

INTELLIGENT COMPARISON APPROACH:
1. **Smart View Matching**: Match each render screenshot to the most relevant reference image(s) based on camera angle and perspective
2. **Adaptive Analysis**: If reference images are limited (e.g., only front view available), only compare the corresponding render views
3. **Comprehensive Assessment**: For each matched pair, analyze silhouette, proportions, colors, materials, textures, and branding elements

‼️ CRITICAL RULES ‼️
PERSPECTIVE MATCHING:
• ONLY compare views showing the SAME PERSPECTIVE and ANGLE of the product
• If a render shows a different side/angle than available references, skip that render
• Different sides should NEVER be compared (e.g., front view vs. side view)
• If only front references exist, only analyze front renders

NO DUPLICATE ISSUES:
• If the same issue appears in multiple views, report it ONLY ONCE
• Choose the clearest view to report each issue
• Focus on unique problems per perspective

Guidelines:
1. 3D Model come from <model-viewer>—perfect fidelity is not expected.
2. References are human-crafted—focus on real discrepancies.
3. Analyze geometry, proportions, textures, and material colors for each pairing.
4. Be extremely specific with differences.
5. Each issue must state: what's in the 3D Model, what's in the reference, the exact difference.

SCORING - BE PRECISE:
• SILHOUETTE: Compare overall shape, outline, and form. Ignore color/texture. Perfect match = 100%
• PROPORTION: Compare relative sizes of parts. 
• COLOR/MATERIAL: Compare exact colors, textures, materials. Small color shifts should impact score significantly
• OVERALL: Weighted average considering all factors. Be conservative

SCORING SCALE: 
• 90-100% = excellent match with minimal differences
• 75-89% = good match but clear differences visible
• 60-74% = acceptable match with moderate differences  
• 40-59% = poor match with significant differences
• 0-39% = unacceptable match with major differences

APPROVAL CRITERIA :
- If overall score ≥ 75% AND no individual score < 60% → status = "Approved"
- If overall score < 75% OR any individual score < 60% → status = "Not Approved"
- If you mention "significant discrepancies" in your summary → status = "Not Approved"
- If Color/Material score < 50% → status = "Not Approved" (color accuracy is critical)

Output exactly one JSON object with these keys:

"differences": [
  {
    "renderIndex": <integer>,
    "referenceIndex": <integer>,
    "view": <string describing the view angle>,
    "issues": [<string>],
    "bbox": [<integer>,<integer>,<integer>,<integer>],
    "severity": "low"|"medium"|"high"
  }
],
"summary": <string ending with "Similarity scores: Silhouette X%, Proportion X%, Color/Material X%, Overall X%.">,
"status": "Approved"|"Not Approved"

CRITICAL: Output ONLY valid JSON. Do not wrap in markdown code blocks. Do not include any text before or after the JSON object. Start with { and end with }.`,
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

    // Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable not set");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert messages to Gemini format
    const geminiContents: any[] = [];
    
    for (const msg of messages) {
      if (msg.role === "system") {
        geminiContents.push({
          role: "user",
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === "user") {
        const parts: any[] = [];
        for (const content of msg.content) {
          if (content.type === "text") {
            parts.push({ text: content.text });
          } else if (content.type === "image_url" && content.image_url) {
            // Fetch image and convert to base64
            try {
              const imageUrl = content.image_url.url;
              let base64Data: string;
              let mimeType = "image/jpeg";
              
              if (imageUrl.startsWith('data:')) {
                // Already base64 encoded
                const [header, data] = imageUrl.split(',');
                base64Data = data;
                const mimeMatch = header.match(/data:([^;]+)/);
                if (mimeMatch) {
                  mimeType = mimeMatch[1];
                }
              } else {
                // Fetch image from URL
                const response = await fetch(imageUrl);
                if (!response.ok) {
                  throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                base64Data = Buffer.from(arrayBuffer).toString('base64');
                
                // Determine MIME type from URL or response
                const contentType = response.headers.get('content-type');
                if (contentType) {
                  mimeType = contentType;
                } else if (imageUrl.includes('.png')) {
                  mimeType = "image/png";
                } else if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
                  mimeType = "image/jpeg";
                }
              }
              
              parts.push({
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              });
            } catch (error) {
              console.error('Error processing image:', error);
              // Skip this image if there's an error
              continue;
            }
          }
        }
        geminiContents.push({
          role: "user",
          parts: parts
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: geminiContents,
      config: {
        thinkingConfig: {
          thinkingBudget: 0, // Disables thinking
        },
      }
    });

    const raw = response.text || "";

    let qaResults: QAResults;
    try {
      qaResults = JSON.parse(raw);
    } catch (parseError) {
      // Attempt to extract JSON from markdown code blocks
      let jsonText = raw;
      
      // Remove markdown code block markers
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Try to find JSON object in the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          qaResults = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Raw response:', raw);
          console.error('Cleaned response:', jsonText);
          console.error('JSON match:', jsonMatch[0]);
          throw new Error(`Failed to parse Gemini response: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        console.error('Raw response:', raw);
        throw new Error(`Failed to parse Gemini response: No JSON found in response`);
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
    if (renders.length > 0 && renders.length !== 5) {
      return NextResponse.json(
        {
          error: "Must send exactly 5 renders or empty array for auto-capture",
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

