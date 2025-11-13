import { NextRequest, NextResponse } from "next/server";
import {
  callTencentHunyuan3D,
  TencentConfigError,
  TencentRequestPayload,
} from "@/lib/tencentHunyuan3D";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SubmitResponse = {
  Response?: {
    JobId?: string;
    RequestId?: string;
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, imageUrl } = body as {
      prompt?: string;
      imageUrl?: string;
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

    const payload: TencentRequestPayload = {
      Prompt: prompt,
    };

    if (
      imageUrl &&
      typeof imageUrl === "string" &&
      imageUrl.trim().length > 0
    ) {
      payload.ImageUrl = imageUrl;
    }

    const tencentResponse = await callTencentHunyuan3D<SubmitResponse>(
      "SubmitHunyuanTo3DProJob",
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

    console.error("SubmitHunyuanTo3DProJob error:", error);
    return NextResponse.json(
      { error: "Failed to submit Tencent Hunyuan 3D job" },
      { status: 502 }
    );
  }
}
