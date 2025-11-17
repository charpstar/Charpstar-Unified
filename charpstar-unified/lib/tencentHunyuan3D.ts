import crypto from "crypto";

// Official configuration from API documentation:
// Endpoint: hunyuan.intl.tencentcloudapi.com
// Service: MUST MATCH endpoint domain name for signature
// Version: 2023-09-01 (CORRECT VERSION - not 2025-05-13!)
// Region: ap-singapore (only supported region)
const endpoint = "https://hunyuan.intl.tencentcloudapi.com";
const host = "hunyuan.intl.tencentcloudapi.com";
const service = "hunyuan"; // MUST match endpoint domain for signature to work
const region = "ap-singapore";
const version = "2023-09-01"; // CORRECTED from 2025-05-13

export type TencentRequestPayload = Record<string, unknown>;

export interface TencentApiResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  rawText: string;
}

export class TencentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TencentConfigError";
  }
}

const getCredentials = () => {
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new TencentConfigError(
      "Tencent Cloud credentials are missing. Please set TENCENT_SECRET_ID and TENCENT_SECRET_KEY."
    );
  }

  return { secretId, secretKey };
};

const getUtcDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sha256 = (
  data: string | Buffer,
  encoding: crypto.BinaryToTextEncoding = "hex"
) => crypto.createHash("sha256").update(data).digest(encoding);

const hmac256 = (key: crypto.BinaryLike, msg: string | Buffer) =>
  crypto.createHmac("sha256", key).update(msg).digest();

export async function callTencentHunyuan3D<T = unknown>(
  action:
    | "SubmitTextTo3DJob"
    | "QueryTextTo3DJob"
    | "SubmitHunyuanTo3DProJob"
    | "QueryHunyuanTo3DProJob",
  payload: TencentRequestPayload
): Promise<TencentApiResult<T>> {
  console.log("=== TENCENT API CALL DEBUG ===");
  console.log("Action:", action);
  console.log("Payload keys:", Object.keys(payload));

  // Debug multi-view specifically
  if (payload.MultiViewImages) {
    const mvImages = payload.MultiViewImages as any[];
    console.log(`MultiViewImages array length: ${mvImages.length}`);
    mvImages.forEach((img, i) => {
      console.log(`  Image ${i}:`, {
        ViewType: img.ViewType,
        hasViewImageBase64: !!img.ViewImageBase64,
        viewImageBase64Length: img.ViewImageBase64?.length || 0,
        base64Preview: img.ViewImageBase64?.substring(0, 50) + "...",
      });
    });
  }

  // Log the full payload structure (without base64 data for readability)
  const payloadForLogging = { ...payload };
  if (payloadForLogging.MultiViewImages) {
    payloadForLogging.MultiViewImages = (
      payloadForLogging.MultiViewImages as any[]
    ).map((img: any) => ({
      ViewType: img.ViewType,
      ViewImageBase64: `[${img.ViewImageBase64?.length || 0} bytes]`,
    }));
  }
  if (payloadForLogging.ImageBase64) {
    payloadForLogging.ImageBase64 = `[${(payloadForLogging.ImageBase64 as string).length} bytes]`;
  }
  console.log(
    "Full payload structure:",
    JSON.stringify(payloadForLogging, null, 2)
  );

  const { secretId, secretKey } = getCredentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getUtcDate(timestamp);
  const body = JSON.stringify(payload);

  console.log("Request body size:", (body.length / 1024).toFixed(2), "KB");

  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = "content-type;host";
  const hashedRequestPayload = sha256(body);

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join("\n");

  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = sha256(canonicalRequest);
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest,
  ].join("\n");

  const secretDate = hmac256(`TC3${secretKey}`, date);
  const secretService = hmac256(secretDate, service);
  const secretSigning = hmac256(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");

  const authorization = [
    "TC3-HMAC-SHA256 Credential=",
    `${secretId}/${credentialScope}`,
    ", SignedHeaders=",
    signedHeaders,
    ", Signature=",
    signature,
  ].join("");

  console.log("Sending request to:", endpoint);
  console.log("Headers:", {
    "X-TC-Action": action,
    "X-TC-Region": region,
    "X-TC-Version": version,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-TC-Action": action,
      "X-TC-Region": region,
      "X-TC-Version": version,
      "X-TC-Timestamp": String(timestamp),
      Authorization: authorization,
    },
    body,
  });

  console.log("Response status:", response.status);

  const rawText = await response.text();
  let data: T;

  try {
    data = JSON.parse(rawText) as T;
    console.log("Parsed response:", JSON.stringify(data, null, 2));

    // Check for errors in the response
    const responseData = data as any;
    if (responseData?.Response?.Error) {
      console.error("❌ Tencent API Error:", {
        Code: responseData.Response.Error.Code,
        Message: responseData.Response.Error.Message,
      });
    } else {
      console.log("✓ Request successful");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.error("❌ Failed to parse response:", rawText);
    throw new Error(
      `Unexpected response format from Tencent API. Status: ${response.status}, Body: ${rawText}`
    );
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    rawText,
  };
}

export { region as TENCENT_REGION, version as TENCENT_VERSION };
