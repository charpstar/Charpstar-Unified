import { NextRequest, NextResponse } from "next/server";
import { callTencentHunyuan3D } from "@/lib/tencentHunyuan3D";

export const maxDuration = 60;

interface File3D {
  Type: string;
  Url: string;
  PreviewImageUrl: string;
}

interface QueryJobResponse {
  Response: {
    Status: "WAIT" | "RUN" | "FAIL" | "DONE";
    ErrorCode?: string;
    ErrorMessage?: string;
    ResultFile3Ds?: File3D[];
    RequestId: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { JobId } = await request.json();

    if (!JobId) {
      return NextResponse.json(
        { error: "JobId is required" },
        { status: 400 }
      );
    }

    // Call the Tencent Hunyuan 3D API
    const result = await callTencentHunyuan3D<QueryJobResponse>(
      "QueryHunyuanTo3DProJob",
      { JobId }
    );

    if (!result.ok) {
      console.error("Tencent API error:", result.rawText);
      return NextResponse.json(
        { error: "Failed to query job status", details: result.rawText },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error("Query job error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to query job status" },
      { status: 500 }
    );
  }
}

