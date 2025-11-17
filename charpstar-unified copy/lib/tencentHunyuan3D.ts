import crypto from "crypto";

const endpoint = "https://hunyuan.intl.tencentcloudapi.com";
const host = "hunyuan.intl.tencentcloudapi.com";
const service = "ai3d";
const region = "ap-singapore";
const version = "2025-09-01";

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
  action: "SubmitHunyuanTo3DProJob" | "QueryHunyuanTo3DProJob",
  payload: TencentRequestPayload
): Promise<TencentApiResult<T>> {
  const { secretId, secretKey } = getCredentials();
  const timestamp = Math.floor(Date.now() / 1000);
  const date = getUtcDate(timestamp);
  const body = JSON.stringify(payload);

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

  const rawText = await response.text();
  let data: T;

  try {
    data = JSON.parse(rawText) as T;
  } catch (error) {
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
