import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
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
    maxMeshes: number;
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
  summary: string[];
  status: string;
  similarityScores?: {
    silhouette?: number;
    proportion?: number;
    colorMaterial?: number;
    overall?: number;
  };
  warnings?: string[];
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

      this.activeJobs.add(job.jobId);

      this.processJob(job).finally(() => {
        this.activeJobs.delete(job.jobId);

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
    const warnings: string[] = [];
    if (modelStats?.requirements) {
      const rejections: string[] = [];

      // Check for warnings (non-blocking issues)
      if (
        modelStats.triangles &&
        modelStats.triangles > modelStats.requirements.maxTriangles
      ) {
        warnings.push(
          `Triangle count: ${modelStats.triangles.toLocaleString()} exceeds maximum ${modelStats.requirements.maxTriangles.toLocaleString()}`
        );
      }

      if (modelStats.materialCount > modelStats.requirements.maxMaterials) {
        warnings.push(
          `Material count: ${modelStats.materialCount} exceeds maximum ${modelStats.requirements.maxMaterials}`
        );
      }

      if (modelStats.meshCount > modelStats.requirements.maxMeshes) {
        warnings.push(
          `Mesh count: ${modelStats.meshCount} exceeds maximum ${modelStats.requirements.maxMeshes}`
        );
      }

      if (modelStats.fileSize > modelStats.requirements.maxFileSize + 1024) {
        // Add 1KB tolerance
        const actualMB = (modelStats.fileSize / (1024 * 1024)).toFixed(1);
        const maxMB = (
          modelStats.requirements.maxFileSize /
          (1024 * 1024)
        ).toFixed(1);
        warnings.push(`File size: ${actualMB}MB exceeds maximum ${maxMB}MB`);
      }

      // Check for rejections (blocking issues)
      if (modelStats.doubleSidedCount > 0) {
        rejections.push("Double sided material found");
      }

      // Only reject if there are blocking issues (double-sided materials)
      if (rejections.length > 0) {
        const technicalFailureResult: QAResults = {
          differences: rejections.map((issue) => ({
            renderIndex: 0,
            referenceIndex: 0,
            issues: [issue],
            bbox: [0, 0, 100, 100],
            severity: "high" as const,
          })),
          summary: [`${rejections.join("; ")}.`],
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

    let qaResults: QAResults;

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
   
IMPORTANT: Be very tolerant and lenient across all aspects. Account for lighting/exposure/white‑balance and shadow differences between renders and references. Be very tolerant of transparency, reflections, finish, and minor color shifts. Lens decals/branding (e.g., small logos on lenses) may vary—do not penalize unless clearly wrong or missing where critical. Focus primarily on shape and proportions; only penalize materials for major, obvious mismatches. Approve models that are generally correct, even with minor variations.

SUMMARY PHRASING:
- If status is "Approved", phrase the summary as a list of constructive feedback points. Start with a positive statement as the first item in the list.
- If status is "Not Approved", the summary should be a list of the critical issues.

SCORING SYSTEM:
- Silhouette: How well the overall shape matches (0-100%)
- Proportion: Accuracy of relative sizes and dimensions (0-100%)
- Color/Material: Color accuracy, material appearance, textures (0-100%)
- Overall: Weighted average considering all factors (0-100%)

APPROVAL CRITERIA - SIMPLIFIED AND LENIENT:
- If overall score ≥ 50% AND no individual score < 40% → status = "Approved"
- Only reject if overall score < 50% OR any individual score < 40% → status = "Not Approved"
- Be generous - approve models that are generally correct even with minor issues
- Only reject for major problems like completely wrong shapes, significantly incorrect proportions, or completely missing/incorrect materials

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
  "summary": ["Overall assessment point 1", "Overall assessment point 2"],
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
            parts: [{ text: msg.content }],
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

                if (imageUrl.startsWith("data:")) {
                  // Already base64 encoded
                  const [header, data] = imageUrl.split(",");
                  base64Data = data;
                  const mimeMatch = header.match(/data:([^;]+)/);
                  if (mimeMatch) {
                    mimeType = mimeMatch[1];
                  }
                } else {
                  // Fetch image from URL
                  const response = await fetch(imageUrl);
                  if (!response.ok) {
                    throw new Error(
                      `Failed to fetch image: ${response.statusText}`
                    );
                  }
                  const arrayBuffer = await response.arrayBuffer();
                  base64Data = Buffer.from(arrayBuffer).toString("base64");

                  // Determine MIME type from URL or response
                  const contentType = response.headers.get("content-type");
                  if (contentType) {
                    mimeType = contentType;
                  } else if (imageUrl.includes(".png")) {
                    mimeType = "image/png";
                  } else if (
                    imageUrl.includes(".jpg") ||
                    imageUrl.includes(".jpeg")
                  ) {
                    mimeType = "image/jpeg";
                  } else if (imageUrl.includes(".avif")) {
                    mimeType = "image/avif";
                  } else if (imageUrl.includes(".webp")) {
                    mimeType = "image/webp";
                  }
                }

                parts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                });
              } catch (error) {
                console.error("Error processing image:", error);
                // Skip this image if there's an error
                continue;
              }
            }
          }
          geminiContents.push({
            role: "user",
            parts: parts,
          });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: geminiContents,
        config: {
          temperature: 0, // Force determinism
          topP: 0,
          topK: 1,
          thinkingConfig: {
            thinkingBudget: 0, // Disables thinking
          },
        },
      });

      const raw = response.text || "";

      try {
        qaResults = JSON.parse(raw);
      } catch {
        // Attempt to extract JSON from markdown code blocks
        let jsonText = raw;

        // Remove markdown code block markers
        jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");

        // Try to find JSON object in the text
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            qaResults = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("Raw response:", raw);
            console.error("Cleaned response:", jsonText);
            console.error("JSON match:", jsonMatch[0]);
            throw new Error(
              `Failed to parse Gemini response: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        } else {
          console.error("Raw response:", raw);
          throw new Error(
            `Failed to parse Gemini response: No JSON found in response`
          );
        }
      }

      // Prefer model-provided scores; fallback to parsing summary (no post-adjustments)
      {
        const provided: any = (qaResults as any).similarityScores;
        if (provided && typeof provided === "object") {
          qaResults.similarityScores = provided as any;
        } else {
          qaResults.similarityScores = extractSimilarityScores(
            qaResults.summary.join(" ")
          );
        }
      }

      // Stabilize scores to reduce jitter and be slightly more lenient on color
      try {
        const s: any = qaResults.similarityScores || {};
        const r = (n: any) =>
          Math.max(0, Math.min(100, Math.round(Number(n || 0))));
        const silhouette = r(s.silhouette);
        const proportion = r(s.proportion);
        // Slight color leniency: small uplift and minimum floor
        const colorMaterial = r(Math.max(Number(s.colorMaterial || 0) + 3, 51));
        // Reduce color weight a bit versus shape
        const overall = Math.round(
          silhouette * 0.5 + proportion * 0.3 + colorMaterial * 0.2
        );
        qaResults.similarityScores = {
          silhouette,
          proportion,
          colorMaterial,
          overall,
        } as any;
      } catch {}

      // Log similarity scores for debugging/visibility
      try {
        console.log("Similarity scores:", qaResults.similarityScores);
      } catch {}

      await supabaseAdmin
        .from("qa_jobs")
        .update({
          status: "complete",
          end_time: new Date().toISOString(),
          qa_results: JSON.stringify(qaResults),
        })
        .eq("id", jobId);

      return;
    } else {
      // AI Analysis for renders vs references comparison
      const systemPrompt = `You are a highly analytical and deterministic 3D model visual QA specialist. Your task is to compare render screenshots of a 3D model against reference images and output a precise, structured JSON report. The model has passed all blocking technical requirements.

INTELLIGENT COMPARISON APPROACH:
1.  **Smart View Matching**: Match each render screenshot to the most relevant reference image(s) based on camera angle and perspective.
2.  **Adaptive Analysis**: ONLY compare views showing the *SAME PERSPECTIVE and ANGLE* of the product. If a render angle has no match in the references, SKIP that render.
3.  **Comprehensive Assessment**: Analyze geometry, proportions, colors, materials, textures, and branding elements for each matched pair.

CRITICAL RULES:
* **NO DUPLICATE ISSUES**: Report each unique issue **ONLY ONCE**. Choose the clearest view to report it in.
* **SPECIFICITY**: Each issue must state: what's in the 3D Model, what's in the reference, and the exact difference.
* **HIGH TOLERANCE**: Be very tolerant and lenient. Accept minor differences in **transparency, reflections, metallic finishes, gloss levels, lighting, shadows, and color variations**. Only flag major issues like completely wrong shapes, significantly incorrect proportions, or completely missing/incorrect materials. Be very forgiving of minor variations - focus on approving models that are generally correct rather than finding small issues.

**SUMMARY PHRASING**:
*   If status is "Approved", phrase the summary as a list of constructive feedback points. Start with a positive statement as the first item in the list.
*   If status is "Not Approved", the summary should be a list of the critical issues.

SCORING - BE GENEROUS AND LENIENT:
* **SILHOUETTE**: Compare overall shape, outline, and form. Be generous - only deduct for major shape errors. (0-100%)
* **PROPORTION**: Compare relative sizes and dimensions of parts. Accept minor proportion differences. (0-100%)
* **COLOR/MATERIAL**: Compare base colors and primary textures. Be very tolerant - only deduct for completely wrong colors or missing major materials. (0-100%)
* **OVERALL**: Must be the weighted average of the other scores.

**CRITICAL CALCULATION RULE:**
The \`overall\` score must be calculated exactly as:
\`\`\`
ROUND(Silhouette * 0.5 + Proportion * 0.3 + Color/Material * 0.2)
\`\`\`

CONSISTENCY RULE: For identical inputs, always provide identical scores and issues. Adhere strictly to the required output format.

OUTPUT FORMAT:
Output exactly one JSON object with the following structure:

{
  "differences": [
    {
      "renderIndex": <integer, starting at 0>,
      "referenceIndex": <integer, starting at 0>,
      "view": <string describing the view angle, e.g., "Front View">,
      "issues": [<string>],
      "bbox": [<integer>,<integer>,<integer>,<integer>],
      "severity": "low"|"medium"|"high"
    }
  ],
  "summary": ["Detailed overall assessment point 1", "Detailed overall assessment point 2"],
  "status": "Approved"|"Not Approved",
  "similarityScores": {
    "silhouette": <integer 0-100>,
    "proportion": <integer 0-100>,
    "colorMaterial": <integer 0-100>,
    "overall": <integer 0-100> (Calculated using the CRITICAL CALCULATION RULE)
  }
}

CRITICAL: Output **ONLY** valid JSON. Do not wrap in markdown code blocks. Do not include any text before or after the JSON object. Start with \`{\` and end with \`}\`.`;

      const messages: Message[] = [{ role: "system", content: systemPrompt }];

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
            parts: [{ text: msg.content }],
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

                if (imageUrl.startsWith("data:")) {
                  // Already base64 encoded
                  const [header, data] = imageUrl.split(",");
                  base64Data = data;
                  const mimeMatch = header.match(/data:([^;]+)/);
                  if (mimeMatch) {
                    mimeType = mimeMatch[1];
                  }
                } else {
                  // Fetch image from URL
                  const response = await fetch(imageUrl);
                  if (!response.ok) {
                    throw new Error(
                      `Failed to fetch image: ${response.statusText}`
                    );
                  }
                  const arrayBuffer = await response.arrayBuffer();
                  base64Data = Buffer.from(arrayBuffer).toString("base64");

                  // Determine MIME type from URL or response
                  const contentType = response.headers.get("content-type");
                  if (contentType) {
                    mimeType = contentType;
                  } else if (imageUrl.includes(".png")) {
                    mimeType = "image/png";
                  } else if (
                    imageUrl.includes(".jpg") ||
                    imageUrl.includes(".jpeg")
                  ) {
                    mimeType = "image/jpeg";
                  } else if (imageUrl.includes(".avif")) {
                    mimeType = "image/avif";
                  } else if (imageUrl.includes(".webp")) {
                    mimeType = "image/webp";
                  }
                }

                parts.push({
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                });
              } catch (error) {
                console.error("Error processing image:", error);
                // Skip this image if there's an error
                continue;
              }
            }
          }
          geminiContents.push({
            role: "user",
            parts: parts,
          });
        }
      }

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: geminiContents,
          config: {
            temperature: 0,
            topP: 0,
            topK: 1,
            thinkingConfig: {
              thinkingBudget: 0, // Disables thinking
            },
          },
        });
      } catch (apiError: any) {
        console.error("Gemini API error:", apiError);
        throw new Error(
          `Failed to call Gemini API: ${apiError?.message || apiError?.toString() || "Unknown error"}. Please check your GEMINI_API_KEY and network connection.`
        );
      }

      const raw = response.text || "";

      try {
        qaResults = JSON.parse(raw);
      } catch {
        // Attempt to extract JSON from markdown code blocks
        let jsonText = raw;

        // Remove markdown code block markers
        jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");

        // Try to find JSON object in the text
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            qaResults = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("Raw response:", raw);
            console.error("Cleaned response:", jsonText);
            console.error("JSON match:", jsonMatch[0]);
            throw new Error(
              `Failed to parse Gemini response: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        } else {
          console.error("Raw response:", raw);
          throw new Error(
            `Failed to parse Gemini response: No JSON found in response`
          );
        }
      }
    }

    // Ensure scores are present (even if 0 if the model fails, but Gemini should provide them)
    if (!qaResults.similarityScores) {
      throw new Error("Gemini response is missing similarityScores.");
    }
    const s: any = qaResults.similarityScores;
    const r = (n: any) =>
      Math.max(0, Math.min(100, Math.round(Number(n || 0))));

    // 1. DETERMINE INDIVIDUAL SCORES (Normalize model's raw score)
    const silhouette = r(s.silhouette);
    const proportion = r(s.proportion);
    const colorMaterial = r(s.colorMaterial);

    // 2. CALCULATE DETERMINISTIC OVERALL SCORE (using the fixed weights)
    const overall = Math.round(
      silhouette * 0.5 + proportion * 0.3 + colorMaterial * 0.2
    );

    qaResults.similarityScores = {
      silhouette,
      proportion,
      colorMaterial,
      overall,
    } as any;

    // 3. CALCULATE DETERMINISTIC STATUS (Overwriting the model's suggested status)
    let finalStatus = "Not Approved";

    // Simplified and more lenient approval criteria
    // Approve if overall score is reasonable, with lower individual thresholds
    const isApproved =
      overall >= 50 &&
      silhouette >= 45 &&
      proportion >= 45 &&
      colorMaterial >= 40;

    if (isApproved) {
      finalStatus = "Approved";
    }

    qaResults.status = finalStatus;

    // Add technical warnings (size, polycount, material count, mesh count) to results
    // These are non-blocking - model continues to Gemini QA analysis
    if (warnings.length > 0) {
      qaResults.warnings = warnings;
    }

    await supabaseAdmin
      .from("qa_jobs")
      .update({
        status: "complete",
        end_time: new Date().toISOString(),
        qa_results: JSON.stringify(qaResults),
      })
      .eq("id", jobId);
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

    if (!Array.isArray(references) || references.length < 1) {
      return NextResponse.json(
        { error: "Must send at least 1 reference image" },
        { status: 400 }
      );
    }

    // If more than 5 images, use only the first 5
    const validReferences = references.slice(0, 5);

    const jobId = uuidv4();
    const { error: insertError } = await supabaseAdmin
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
    await queue.addJob(jobId, renders, validReferences, modelStats);

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
