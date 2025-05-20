import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
  QA: "qa",
  QA_MANAGER: "qamanager",
  MODELER: "modeler",
  MODELER_MANAGER: "modelermanager",
  CLIENT: "client",
} as const;

export async function withRoleProtection(
  handler: Function,
  requiredRole: string
) {
  return async function protectedHandler(request: Request) {
    try {
      return handler(request);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
