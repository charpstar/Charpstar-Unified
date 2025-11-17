/**
 * Tencent Hunyuan 3D API Configuration and Parameter Specifications
 *
 * Official API Documentation Reference
 * Based on: Tencent Hunyuan 3D (Professional) International API
 */

// ============================================================================
// OFFICIAL API CONFIGURATION (from SDK examples)
// ============================================================================

export const OFFICIAL_CONFIG = {
  endpoint: "https://hunyuan.intl.tencentcloudapi.com",
  host: "hunyuan.intl.tencentcloudapi.com",
  service: "ai3d",
  region: "ap-singapore", // Only ap-singapore is supported
  version: "2023-09-01", // CORRECT VERSION (not 2025-05-13)
  submitAction: "SubmitHunyuanTo3DProJob",
  queryAction: "QueryHunyuanTo3DProJob",
} as const;

// ============================================================================
// API PARAMETER SPECIFICATIONS
// ============================================================================

/**
 * Submit API Parameters
 * Action: SubmitHunyuanTo3DProJob
 */
export interface SubmitHunyuanTo3DProJobParams {
  // ===== Input Methods (one required) =====
  /** Text description for Text-to-3D generation (up to 1024 UTF-8 chars) */
  Prompt?: string;

  /** Base64 encoded image. Cannot coexist with Prompt or ImageUrl */
  ImageBase64?: string;

  /** Image URL. Cannot coexist with Prompt or ImageBase64 */
  ImageUrl?: string;

  /** Multi-view images for better quality */
  MultiViewImages?: Array<{
    /** View type: "front", "back", "left", "right" */
    ViewType: string;
    /** Base64 encoded image for this view */
    ViewImageBase64?: string;
    /** URL to image for this view */
    ViewImageUrl?: string;
  }>;

  // ===== Generation Settings =====
  /** Enable PBR (Physically Based Rendering) materials. Default: false */
  EnablePBR?: boolean;

  /** Face count for the 3D model. Default: 500000. Range: 40000-1500000 */
  FaceCount?: number;

  /**
   * Generation type. Default: "Normal"
   * - "Normal": Textured geometry model
   * - "LowPoly": Smart polygon reduction
   * - "Geometry": White model without texture (EnablePBR ignored)
   * - "Sketch": Sketch/line art to 3D (can combine with Prompt)
   */
  GenerateType?: "Normal" | "LowPoly" | "Geometry" | "Sketch";

  /**
   * Polygon type (only for LowPoly mode)
   * - "triangle": Triangle faces (default)
   * - "quadrilateral": Mix of quad and triangle faces
   */
  PolygonType?: "triangle" | "quadrilateral";
}

/**
 * Submit API Response
 */
export interface SubmitHunyuanTo3DProJobResponse {
  Response: {
    /** Task ID (valid for 24 hours) */
    JobId: string;
    /** Unique request ID */
    RequestId: string;
  };
}

/**
 * Query API Parameters
 * Action: QueryHunyuanTo3DProJob
 */
export interface QueryHunyuanTo3DProJobParams {
  /** Task ID from submit response */
  JobId: string;
}

/**
 * Query API Response
 */
export interface QueryHunyuanTo3DProJobResponse {
  Response: {
    /**
     * Task status indicating processing state:
     * - WAIT: Job is queued, waiting to start
     * - RUN: Job is actively processing
     * - FAIL: Job failed (check ErrorCode and ErrorMessage)
     * - DONE: Job completed successfully (check ResultFile3Ds)
     */
    Status: "WAIT" | "RUN" | "FAIL" | "DONE";

    /** Error code (present when Status is FAIL) */
    ErrorCode?: string;

    /** Error message (present when Status is FAIL) */
    ErrorMessage?: string;

    /**
     * Result files (present when Status is DONE)
     * Contains the generated 3D model file(s)
     */
    ResultFile3Ds?: Array<{
      /** File type (typically "GLB" for 3D models) */
      Type: string;
      /** Direct download URL for the 3D model file */
      Url: string;
      /** URL to a preview/thumbnail image of the model */
      PreviewImageUrl: string;
    }>;

    /** Unique request ID for this query */
    RequestId: string;
  };
}

// ============================================================================
// POLLING WORKFLOW
// ============================================================================

/**
 * Status Workflow Guide
 *
 * When polling for job completion using QueryHunyuanTo3DProJob:
 *
 * 1. TERMINAL STATES (stop polling):
 *    - DONE: Task completed successfully
 *      → Access ResultFile3Ds to get model URL
 *      → Download and display the model
 *
 *    - FAIL: Task failed
 *      → Check ErrorCode and ErrorMessage
 *      → Display error to user
 *
 * 2. PROCESSING STATES (continue polling):
 *    - WAIT: Job is queued, not yet started
 *      → Keep polling (typically 1-30 seconds)
 *
 *    - RUN: Job is actively processing
 *      → Keep polling (typically 1-5 minutes)
 *      → Update progress indicator
 *
 * 3. RECOMMENDED POLLING STRATEGY:
 *    - Poll every 2 seconds (SERVICE_LIMITS.pollingIntervalMs)
 *    - Maximum duration: 5-10 minutes
 *    - After 5 minutes, consider timeout
 *
 * 4. TYPICAL TIMING:
 *    - Simple models: 30-60 seconds
 *    - Normal complexity: 1-3 minutes
 *    - High complexity: 3-5 minutes
 *    - Face count 1M+: 4-6 minutes
 */
export const POLLING_STRATEGY = {
  /** Recommended interval between poll requests (ms) */
  intervalMs: 2000,

  /** Maximum polling duration before timeout (ms) */
  maxDurationMs: 300000, // 5 minutes

  /** Maximum number of poll attempts */
  maxAttempts: 150, // 5 minutes at 2-second intervals

  /** States that indicate task is complete (stop polling) */
  terminalStates: ["DONE", "FAIL"] as const,

  /** States that indicate task is still processing (continue polling) */
  processingStates: ["WAIT", "RUN"] as const,
} as const;

// ============================================================================
// IMAGE REQUIREMENTS
// ============================================================================

export const IMAGE_REQUIREMENTS = {
  formats: ["jpg", "png", "jpeg", "webp"],
  maxSizeBytes: 8 * 1024 * 1024, // 8MB after base64 encoding
  recommendedMaxSizeBytes: 6 * 1024 * 1024, // 6MB before encoding (grows ~30%)
  minResolution: 128,
  maxResolution: 5000,
} as const;

// ============================================================================
// SERVICE LIMITS
// ============================================================================

export const SERVICE_LIMITS = {
  /** Default concurrent task limit */
  maxConcurrentTasks: 3,
  /** Task ID valid period */
  jobIdValidHours: 24,
  /** Recommended polling interval (milliseconds) */
  pollingIntervalMs: 2000,
  /** Maximum text prompt length (UTF-8 characters) */
  maxPromptLength: 1024,
} as const;

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Validation rules based on official documentation
 */
export const VALIDATION_RULES = {
  /** At least one input is required */
  requireOneOf: ["Prompt", "ImageBase64", "ImageUrl", "MultiViewImages"],

  /** These combinations are not allowed */
  mutuallyExclusive: [
    ["Prompt", "ImageBase64"],
    ["Prompt", "ImageUrl"],
    ["ImageBase64", "ImageUrl"],
  ],

  /** FaceCount range */
  faceCountRange: { min: 40000, max: 1500000 },

  /** MultiViewImages requirements */
  multiViewRules: {
    supportedViews: ["front", "back", "left", "right"],
    maxImagesPerView: 1,
  },
} as const;
