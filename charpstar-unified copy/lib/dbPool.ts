import { Pool } from "pg";

const rawConnectionString = process.env.SUPABASE_POOLED_DB_URL;

if (!rawConnectionString) {
  throw new Error("Missing env.SUPABASE_POOLED_DB_URL");
}

const applicationName = process.env.DB_POOL_APP_NAME?.trim();
let connectionString = rawConnectionString;

if (applicationName) {
  try {
    const url = new URL(rawConnectionString);
    url.searchParams.set("application_name", applicationName);
    connectionString = url.toString();
  } catch (error) {
    console.warn(
      "[dbPool] Unable to append application_name to connection string",
      error
    );
  }
}

type GlobalWithPgPool = typeof globalThis & {
  __charpstarPgPool?: Pool;
};

const globalForPool = globalThis as GlobalWithPgPool;
const shouldLogPool =
  process.env.DB_POOL_DEBUG === "true" ||
  process.env.NODE_ENV === "development";

const poolConfig = {
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10_000),
  connectionTimeoutMillis: Number(
    process.env.DB_CONNECTION_TIMEOUT_MS ?? 5_000
  ),
  ssl: {
    rejectUnauthorized: false,
  },
};

export const pgPool = globalForPool.__charpstarPgPool ?? new Pool(poolConfig);

if (shouldLogPool) {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname;
    const database = parsed.pathname.replace(/^\//, "") || "postgres";
    console.info(
      `[dbPool] Initialised -> host=${host} database=${database} max=${process.env.DB_POOL_MAX ?? 10}`
    );
  } catch (error) {
    console.warn("[dbPool] Unable to parse SUPABASE_POOLED_DB_URL", error);
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForPool.__charpstarPgPool = pgPool;
}

export const runQuery = async <T = unknown>(
  text: string,
  params?: unknown[]
) => {
  const start = Date.now();
  const result = await pgPool.query<T>(text, params);
  if (shouldLogPool) {
    const duration = Date.now() - start;
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 80);
    console.info(
      `[dbPool] query="${preview}${preview.length === 80 ? "…" : ""}" duration=${duration}ms total=${pgPool.totalCount} idle=${pgPool.idleCount} waiting=${pgPool.waitingCount}`
    );
  }
  return result;
};
