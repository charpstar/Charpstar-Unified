import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
  QA: "QA",
  QAmanager: "QAmanager",
  Modeler: "Modeler",
  ModelerManager: "Modelermanager",
  Client: "Client",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Helper to check if a role has sufficient permissions
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  const roleHierarchy = {
    [ROLES.ADMIN]: 3,
    [ROLES.MANAGER]: 2,
    [ROLES.USER]: 1,
    [ROLES.QA]: 1,
    [ROLES.QAmanager]: 2,
    [ROLES.Modeler]: 1,
    [ROLES.ModelerManager]: 2,
    [ROLES.Client]: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Middleware to protect API routes based on role
export async function withRoleProtection(
  handler: Function,
  requiredRole: Role
) {
  return async function (req: NextRequest) {
    const session = await getServerSession();

    if (!session?.user) {
      return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      });
    }

    if (!hasPermission(session.user.role as Role, requiredRole)) {
      return new NextResponse(
        JSON.stringify({ message: "Insufficient permissions" }),
        { status: 403 }
      );
    }

    return handler(req);
  };
}

// React hook for role-based rendering
export function useHasPermission(requiredRole: Role) {
  const session = useSession();
  const userRole = session?.data?.user?.role as Role | undefined;

  if (!userRole) return false;
  return hasPermission(userRole, requiredRole);
}
