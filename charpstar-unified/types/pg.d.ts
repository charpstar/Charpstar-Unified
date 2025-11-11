declare module "pg" {
  interface QueryResult<T = unknown> {
    rows: T[];
    rowCount: number;
  }

  interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: {
      rejectUnauthorized?: boolean;
    };
    application_name?: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = unknown>(
      text: string,
      params?: unknown[]
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }
}
