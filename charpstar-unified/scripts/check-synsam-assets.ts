/*
  Script: Check Synsam assets product_link via HEAD and export CSV
  How to run:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/check-synsam-assets.ts \
      --concurrency 20 --timeout 5000 --retries 2 --limit 0

  Defaults (can be overridden via flags):
    concurrency=20, timeoutMs=5000, retries=2, limit=0 (no limit)
  Output:
    reports/synsam-asset-head-check-YYYYMMDD-HHmmss.csv
*/

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

type AssetRow = {
  id: string;
  client: string | null;
  product_name?: string | null;
  product_link?: string | null;
};

type CheckResult = {
  asset_id: string;
  client: string;
  product_name: string;
  product_link: string;
  status: number | "ERR";
  ok: boolean;
  redirected: boolean;
  content_length: string | "";
  time_ms: number;
  error: string | "";
};

const SUPABASE_URL = "";
const SUPABASE_SERVICE_ROLE_KEY = "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

// Simple CLI flags
const argv = process.argv.slice(2);
const getFlag = (name: string, def: number): number => {
  const idx = argv.indexOf(`--${name}`);
  if (idx >= 0 && argv[idx + 1]) {
    const n = Number(argv[idx + 1]);
    return Number.isFinite(n) ? n : def;
  }
  return def;
};

const concurrency = getFlag("concurrency", 20);
const timeoutMs = getFlag("timeout", 5000);
const retries = getFlag("retries", 2);
const limit = getFlag("limit", 0); // 0 = no limit

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function csvEscape(value: string): string {
  const needsQuotes = /[",\n]/.test(value);
  let v = value.replace(/"/g, '""');
  return needsQuotes ? `"${v}"` : v;
}

function toCsvLine(obj: CheckResult): string {
  const cols = [
    obj.asset_id,
    obj.client,
    obj.product_name,
    obj.product_link,
    String(obj.status),
    String(obj.ok),
    String(obj.redirected),
    obj.content_length,
    String(obj.time_ms),
    obj.error,
  ].map((v) => csvEscape(v ?? ""));
  return cols.join(",") + "\n";
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const SS = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}-${HH}${MM}${SS}`;
}

async function fetchAllSynsamAssets(): Promise<AssetRow[]> {
  const pageSize = 1000;
  let from = 0;
  let to = pageSize - 1;
  const all: AssetRow[] = [];

  // We only include assets where client = 'Synsam' and product_link is not null
  // and not empty.
  while (true) {
    const query = supabase
      .from("assets")
      .select("id, client, product_name, product_link")
      .eq("client", "Synsam")
      .not("product_link", "is", null)
      .range(from, to);

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []).filter(
      (r) =>
        typeof r.product_link === "string" &&
        (r.product_link as string).trim() !== ""
    ) as AssetRow[];
    all.push(...batch);

    if (!data || data.length < pageSize) break;
    from += pageSize;
    to += pageSize;
  }

  return limit > 0 ? all.slice(0, limit) : all;
}

async function headWithTimeout(
  url: string,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    } as RequestInit);
    return res as Response;
  } finally {
    clearTimeout(id);
  }
}

async function checkUrl(
  url: string
): Promise<{ res?: Response; err?: Error; durationMs: number }> {
  const start = Date.now();
  try {
    const res = await headWithTimeout(url, timeoutMs);
    return { res, durationMs: Date.now() - start };
  } catch (err: any) {
    return { err, durationMs: Date.now() - start };
  }
}

async function checkWithRetry(
  url: string
): Promise<{ res?: Response; err?: Error; durationMs: number }> {
  let attempt = 0;
  let last: { res?: Response; err?: Error; durationMs: number } | null = null;
  while (attempt <= retries) {
    last = await checkUrl(url);
    if (last.res) return last;
    attempt++;
  }
  return last || { err: new Error("Unknown error"), durationMs: 0 };
}

async function run() {
  console.log(
    `[start] Fetching Synsam assets (client='Synsam'), concurrency=${concurrency}, timeoutMs=${timeoutMs}, retries=${retries}, limit=${limit}`
  );
  const assets = await fetchAllSynsamAssets();
  console.log(`[info] Found ${assets.length} assets to check.`);

  const outDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `synsam-asset-head-check-${nowStamp()}.csv`
  );
  const out = fs.createWriteStream(outPath, { encoding: "utf8" });
  out.write(
    [
      "asset_id",
      "client",
      "product_name",
      "product_link",
      "status",
      "ok",
      "redirected",
      "content_length",
      "time_ms",
      "error",
    ].join(",") + "\n"
  );

  let completed = 0;
  let okCount = 0;
  let failCount = 0;

  function logProgress() {
    const pct =
      assets.length === 0 ? 100 : Math.floor((completed / assets.length) * 100);
    const barWidth = 20;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = "#".repeat(filled) + "-".repeat(barWidth - filled);
    process.stdout.write(
      `\r[${bar}] ${pct}% | ${completed}/${assets.length} | ok=${okCount} fail=${failCount}`
    );
  }

  const queue: Promise<void>[] = [];
  let idx = 0;

  async function worker() {
    while (true) {
      const myIndex = idx++;
      if (myIndex >= assets.length) return;
      const a = assets[myIndex];
      const url = (a.product_link || "").trim();
      let result: CheckResult;
      try {
        const checked = await checkWithRetry(url);
        if (checked.res) {
          const status = checked.res.status;
          const ok = checked.res.ok;
          const redirected =
            checked.res.status >= 300 && checked.res.status < 400;
          const content_length =
            checked.res.headers.get("content-length") || "";
          result = {
            asset_id: a.id,
            client: a.client || "",
            product_name: a.product_name || "",
            product_link: url,
            status,
            ok,
            redirected,
            content_length,
            time_ms: checked.durationMs,
            error: "",
          };
          ok ? okCount++ : failCount++;
        } else {
          result = {
            asset_id: a.id,
            client: a.client || "",
            product_name: a.product_name || "",
            product_link: url,
            status: "ERR",
            ok: false,
            redirected: false,
            content_length: "",
            time_ms: checked.durationMs,
            error: String(
              checked.err?.message || checked.err || "Unknown error"
            ),
          };
          failCount++;
        }
      } catch (e: any) {
        result = {
          asset_id: a.id,
          client: a.client || "",
          product_name: a.product_name || "",
          product_link: url,
          status: "ERR",
          ok: false,
          redirected: false,
          content_length: "",
          time_ms: 0,
          error: String(e?.message || e || "Unknown error"),
        };
        failCount++;
      }

      out.write(toCsvLine(result));
      completed++;
      if (completed % 5 === 0 || completed === assets.length) {
        logProgress();
      }
    }
  }

  const workerCount = Math.max(1, concurrency);
  for (let i = 0; i < workerCount; i++) {
    queue.push(worker());
  }
  await Promise.all(queue);
  out.end();
  process.stdout.write("\n");
  console.log(
    `[done] ok=${okCount}, fail=${failCount}, total=${assets.length}`
  );
  console.log(`[csv] ${outPath}`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
