"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";
import { TableCell } from "@/components/ui/table";
import { TableBody } from "@/components/ui/table";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Loader2 } from "lucide-react";
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

  const PAGE_LABELS: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/admin/permissions": "Permissions",
    "/settings": "Settings",
    "/users": "Users",
    // ...add more as needed
  };

  const FEATURE_LABELS: Record<string, string> = {
    export_data: "Export Data",
    invite_user: "Invite User",
    // ...add more as needed
  };

  function formatLabel(str: string) {
    return str
      .replace(/^\//, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

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

  const isInitialLoading = permissionLoading || loading || !userRole;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header - Always visible */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Role Permissions</h1>
        <p className="text-muted-foreground max-w-2xl">
          Manage access permissions for different roles. Click on a switch to
          allow or disallow access to a page or feature for each role.
        </p>
      </div>

      {/* Show loading state while checking permissions or loading data */}
      {isInitialLoading && (
        <div className="space-y-8">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-muted-foreground">
                  Loading permissions...
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show error message if permission check failed */}
      {!isInitialLoading && permissionError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              An error occurred while checking permissions: {permissionError}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Show access denied if no permission *after* loading is complete */}
      {!isInitialLoading && !hasAccess && !permissionError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardDescription>
              You don't have permission to access the permissions page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Main content - only show when loaded and has access */}
      {!isInitialLoading && hasAccess && !permissionError && (
        <>
          {/* Page Access */}
          <Card className="rounded-xl shadow-sm border border-border">
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
                    <TableHead className="text-left font-bold text-foreground bg-muted">
                      Role
                    </TableHead>
                    {pageResources.map((res) => (
                      <TableHead
                        className="text-center font-bold text-foreground bg-muted"
                        key={res}
                      >
                        {FEATURE_LABELS[res] || formatLabel(res)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={pageResources.length + 1}
                        className="text-center py-8 bg-card"
                      >
                        <Alert
                          variant="default"
                          className="my-6 flex items-center justify-center"
                        >
                          <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                          <div>
                            <AlertTitle>No Roles Found</AlertTitle>
                            <AlertDescription>
                              There are no roles to display.
                            </AlertDescription>
                          </div>
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRoles.map((role, i) => (
                      <TableRow
                        key={role}
                        className={cn(
                          i % 2 === 0 ? "bg-card" : "bg-muted",
                          "hover:bg-muted transition-colors"
                        )}
                      >
                        <TableCell className="font-medium text-foreground pl-4">
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
                                 data-[state=checked]:bg-green-600
                                 dark:data-[state=checked]:bg-green-400
                                 data-[state=unchecked]:bg-red-500
                                 dark:data-[state=unchecked]:bg-red-400
                                 border border-border
                                 shadow
                                 relative
                                 transition-colors
                                 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                                 dark:focus-visible:ring-offset-background
                                 [&>span]:bg-white
                                 dark:[&>span]:bg-zinc-700
                                 [&>span]:shadow-lg
                                 [&>span]:size-5
                                 [&>span]:transition-all
                                 [&>span]:duration-200
                               "
                                />
                              ) : (
                                <span className="text-muted-foreground select-none">
                                  –
                                </span>
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
          <Card className="rounded-xl shadow-sm border border-border mt-8">
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
                    <TableHead className="text-left font-bold text-foreground bg-muted">
                      Role
                    </TableHead>
                    {featureResources.map((res) => (
                      <TableHead
                        className="text-center font-bold text-foreground bg-muted"
                        key={res}
                      >
                        {FEATURE_LABELS[res] || formatLabel(res)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={featureResources.length + 1}
                        className="text-center py-8 bg-card"
                      >
                        <Alert
                          variant="default"
                          className="my-6 flex items-center justify-center"
                        >
                          <CheckCircle2 className="h-5 w-5 text-primary mr-2" />
                          <div>
                            <AlertTitle>No Roles Found</AlertTitle>
                            <AlertDescription>
                              There are no roles to display.
                            </AlertDescription>
                          </div>
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRoles.map((role, i) => (
                      <TableRow
                        key={role}
                        className={cn(
                          i % 2 === 0 ? "bg-card" : "bg-muted",
                          "hover:bg-muted transition-colors"
                        )}
                      >
                        <TableCell className="font-medium text-foreground pl-4">
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
                               data-[state=checked]:bg-green-600
                               dark:data-[state=checked]:bg-green-400
                               data-[state=unchecked]:bg-red-500
                               dark:data-[state=unchecked]:bg-red-400
                               border border-border
                               shadow
                               relative
                               transition-colors
                               focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                               dark:focus-visible:ring-offset-background
                               [&>span]:bg-white
                               dark:[&>span]:bg-zinc-700
                               [&>span]:shadow-lg
                               [&>span]:size-5
                               [&>span]:transition-all
                               [&>span]:duration-200
                             "
                                />
                              ) : (
                                <span className="text-muted-foreground select-none">
                                  –
                                </span>
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
        </>
      )}
    </div>
  );
}
