"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PageAccessSkeleton = () => {
  const pageResources = [
    "/dashboard",
    "/users",
    "/settings",
    "/admin/permissions",
  ];
  const roles = ["admin", "client", "user"];

  return (
    <Card className="rounded-xl shadow-sm border border-border">
      <CardHeader>
        <CardTitle>Page Access</CardTitle>
        <CardDescription>
          Control which roles can access each page of your app.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left font-bold text-foreground bg-muted">
                  Role
                </TableHead>
                {pageResources.map((res) => (
                  <TableHead
                    key={res}
                    className="text-center font-bold text-foreground bg-muted"
                  >
                    {res}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role, i) => (
                <TableRow
                  key={role}
                  className={i % 2 === 0 ? "bg-card" : "bg-muted"}
                >
                  <TableCell className="font-medium text-foreground pl-4">
                    {role}
                  </TableCell>
                  {pageResources.map((res) => (
                    <TableCell key={`${role}-${res}`} className="text-center">
                      <div className="inline-flex mx-auto h-6 w-11 items-center rounded-full border bg-muted animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

const FeatureAccessSkeleton = () => {
  const featureResources = [
    "export_data",
    "invite_user",
    "edit_user",
    "delete_user",
    "view_user_details",
  ];
  const roles = ["admin", "client", "user"];

  return (
    <Card className="rounded-xl shadow-sm border border-border">
      <CardHeader>
        <CardTitle>Feature Access</CardTitle>
        <CardDescription>
          Fine-tune access to app features by role.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left font-bold text-foreground bg-muted">
                  Role
                </TableHead>
                {featureResources.map((res) => (
                  <TableHead
                    key={res}
                    className="text-center font-bold text-foreground bg-muted"
                  >
                    {res
                      .split("_")
                      .map(
                        (word) => word.charAt(0).toUpperCase() + word.slice(1)
                      )
                      .join(" ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role, i) => (
                <TableRow
                  key={role}
                  className={i % 2 === 0 ? "bg-card" : "bg-muted"}
                >
                  <TableCell className="font-medium text-foreground pl-4">
                    {role}
                  </TableCell>
                  {featureResources.map((res) => (
                    <TableCell key={`${role}-${res}`} className="text-center">
                      <div className="inline-flex mx-auto h-6 w-11 items-center rounded-full border bg-muted animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default function PermissionsLoading() {
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

      {/* Page Access Skeleton */}
      <PageAccessSkeleton />

      {/* Feature Access Skeleton */}
      <FeatureAccessSkeleton />
    </div>
  );
}
