"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";
import { TableCell } from "@/components/ui/table";
import { TableBody } from "@/components/ui/table";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Permission {
  role: string;
  resource: string;
  can_access: boolean;
  permission_type: "page" | "feature";
}

// Group permissions by role for better organization
type GroupedPermissions = {
  [role: string]: Permission[];
};

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | undefined>();

  const pagePermissions = permissions.filter((p) => p.resource.startsWith("/"));
  const featurePermissions = permissions.filter(
    (p) => !p.resource.startsWith("/")
  );

  // Create grouped versions
  const groupByRole = (permList: Permission[]) =>
    permList.reduce((acc: GroupedPermissions, perm) => {
      if (!acc[perm.role]) acc[perm.role] = [];
      acc[perm.role].push(perm);
      return acc;
    }, {});

  const groupedPagePermissions = groupByRole(pagePermissions);
  const groupedFeaturePermissions = groupByRole(featurePermissions);

  const pageResources = [
    ...new Set(pagePermissions.map((p) => p.resource)),
  ].sort();
  const featureResources = [
    ...new Set(featurePermissions.map((p) => p.resource)),
  ].sort();

  // Add permission check
  const {
    hasAccess,
    loading: permissionLoading,
    error: permissionError,
  } = usePagePermission(userRole, "/admin/permissions");

  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserRole(profile.role);
      }
    };

    fetchUserRole();
  }, [router]);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await fetch("/api/permissions");
        const data = await res.json();
        setPermissions(data);
      } catch (err) {
        console.error("Failed to fetch permissions", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  const handleToggle = async (perm: Permission) => {
    setUpdating(true);

    const updated = {
      ...perm,
      can_access: !perm.can_access,
    };

    setPermissions((prev) =>
      prev.map((p) =>
        p.role === perm.role &&
        p.resource === perm.resource &&
        p.permission_type === perm.permission_type
          ? updated
          : p
      )
    );

    try {
      const res = await fetch("/api/permissions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        throw new Error("Failed to update permission");
      }
    } catch (error) {
      // Show error toast instead of alert
      alert("Failed to update permission");
      // revert on failure
      setPermissions((prev) =>
        prev.map((p) =>
          p.role === perm.role &&
          p.resource === perm.resource &&
          p.permission_type === perm.permission_type
            ? perm
            : p
        )
      );
    } finally {
      setUpdating(false);
    }
  };

  // Group permissions by role
  const groupedPermissions = permissions.reduce(
    (acc: GroupedPermissions, perm) => {
      if (!acc[perm.role]) {
        acc[perm.role] = [];
      }
      acc[perm.role].push(perm);
      return acc;
    },
    {}
  );

  // Filter permissions based on search
  const filteredRoles = Object.keys(groupedPermissions).filter(
    (role) =>
      role.toLowerCase().includes(search.toLowerCase()) ||
      groupedPermissions[role].some(
        (perm) =>
          perm.resource.toLowerCase().includes(search.toLowerCase()) ||
          perm.permission_type.toLowerCase().includes(search.toLowerCase())
      )
  );

  // Show loading state while checking permissions or loading data
  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error message if permission check failed
  if (permissionError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">
          Error checking permissions: {permissionError}
        </p>
      </div>
    );
  }

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-600">
          You don't have permission to access the permissions page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Role Permissions</h1>
        <p className="text-muted-foreground max-w-2xl">
          Manage access permissions for different roles. Click on a switch to
          allow or disallow access to a page or feature for each role.
        </p>
      </div>

      {/* Page Access */}
      <Card>
        <CardHeader>
          <CardTitle>Page Access</CardTitle>
          <CardDescription>
            Control which roles can access each page of your app.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Role</TableHead>
                {pageResources.map((res) => (
                  <TableHead className="text-center" key={res}>
                    {res}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={pageResources.length + 1}
                    className="text-center"
                  >
                    <Alert variant="default" className="my-6">
                      <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                      <AlertTitle>No Roles Found</AlertTitle>
                      <AlertDescription>
                        There are no roles to display.
                      </AlertDescription>
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role, i) => (
                  <TableRow
                    key={role}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted"}
                  >
                    <TableCell className="font-medium text-foreground">
                      {role}
                    </TableCell>
                    {pageResources.map((res) => {
                      const perm = groupedPagePermissions[role]?.find(
                        (p) => p.resource === res
                      );
                      return (
                        <TableCell
                          key={`${role}-${res}`}
                          className="text-center"
                        >
                          {perm ? (
                            <Switch
                              checked={perm.can_access}
                              onCheckedChange={() => handleToggle(perm)}
                              disabled={updating}
                              aria-label={
                                perm.can_access
                                  ? `Disable ${role} access to ${res}`
                                  : `Enable ${role} access to ${res}`
                              }
                              className="
   data-[state=checked]:bg-[oklch(var(--green))]
   data-[state=unchecked]:bg-[oklch(var(--destructive))]
 "
                            />
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feature Access */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Access</CardTitle>
          <CardDescription>
            Fine-tune access to app features by role.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Role</TableHead>
                {featureResources.map((res) => (
                  <TableHead className="text-center" key={res}>
                    {res}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={featureResources.length + 1}
                    className="text-center"
                  >
                    <Alert variant="default" className="my-6">
                      <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                      <AlertTitle>No Roles Found</AlertTitle>
                      <AlertDescription>
                        There are no roles to display.
                      </AlertDescription>
                    </Alert>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role, i) => (
                  <TableRow
                    key={role}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted"}
                  >
                    <TableCell className="font-medium text-foreground">
                      {role}
                    </TableCell>
                    {featureResources.map((res) => {
                      const perm = groupedFeaturePermissions[role]?.find(
                        (p) => p.resource === res
                      );
                      return (
                        <TableCell
                          key={`${role}-${res}`}
                          className="text-center"
                        >
                          {perm ? (
                            <Switch
                              checked={perm.can_access}
                              onCheckedChange={() => handleToggle(perm)}
                              disabled={updating}
                              aria-label={
                                perm.can_access
                                  ? `Disable ${role} access to ${res}`
                                  : `Enable ${role} access to ${res}`
                              }
                              className="
    data-[state=checked]:bg-[oklch(var(--green))]
    data-[state=unchecked]:bg-[oklch(var(--destructive))]
  "
                            />
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
