declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NEXTAUTH_SECRET: string;
    NEXTAUTH_URL: string;
  }
}
