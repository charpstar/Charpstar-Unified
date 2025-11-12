import { NextRequest, NextResponse } from "next/server";
import {
  callTencentHunyuan3D,
  TencentConfigError,
  TencentRequestPayload,
} from "@/lib/tencentHunyuan3D";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QueryResponse = {
  Response?: {
    Status?: string;
    ResultFile3Ds?: Array<{
      Type?: string;
      Url?: string;
    }>;
    JobId?: string;
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body as { jobId?: string };

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { error: "Missing required field: jobId" },
        { status: 400 }
      );
    }

    const payload: TencentRequestPayload = {
      JobId: jobId,
    };

    const tencentResponse = await callTencentHunyuan3D<QueryResponse>(
      "QueryHunyuanTo3DProJob",
      payload
    );

    const responseBody = tencentResponse.data;
    const error = responseBody?.Response?.Error;

    const statusCode = error
      ? 400
      : tencentResponse.ok
        ? 200
        : tencentResponse.status;

    return NextResponse.json(
      {
        upstreamStatus: tencentResponse.status,
        response: responseBody,
      },
      { status: statusCode }
    );
  } catch (error) {
    if (error instanceof TencentConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    console.error("QueryHunyuanTo3DProJob error:", error);
    return NextResponse.json(
      { error: "Failed to query Tencent Hunyuan 3D job" },
      { status: 502 }
    );
  }
}
