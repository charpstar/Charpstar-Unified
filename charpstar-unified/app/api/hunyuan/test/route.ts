import { NextResponse } from "next/server";

export async function GET() {
  try {
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;

    const hasSecretId = !!secretId;
    const hasSecretKey = !!secretKey;

    return NextResponse.json({
      configured: hasSecretId && hasSecretKey,
      secretIdPresent: hasSecretId,
      secretKeyPresent: hasSecretKey,
      secretIdLength: secretId?.length || 0,
      secretKeyLength: secretKey?.length || 0,
      message:
        hasSecretId && hasSecretKey
          ? "Credentials are configured"
          : "Credentials are missing",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
