import { NextResponse } from "next/server";

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

// Accept a typed handler and (optionally) a requiredRole, which you could use in the future
export function withRoleProtection(
  handler: (request: Request) => Promise<Response> | Response
  // requiredRole?: string   // Uncomment if/when you actually use this
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
