"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { usePagePermission } from "@/lib/usePagePermission";

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto dark:bg-gray-900">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Role Permissions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage access permissions for different roles. Click on a role to view
          and modify its permissions.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Page Access
        </h2>
        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Role
                </th>
                {pageResources.map((res) => (
                  <th
                    key={res}
                    className="px-4 py-2 text-center font-semibold text-gray-700 dark:text-gray-300"
                  >
                    {res}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role, i) => (
                <tr
                  key={role}
                  className={
                    i % 2 === 0
                      ? "bg-white dark:bg-gray-900"
                      : "bg-gray-50 dark:bg-gray-800"
                  }
                >
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-300">
                    {role}
                  </td>
                  {pageResources.map((res) => {
                    const perm = groupedPagePermissions[role]?.find(
                      (p) => p.resource === res
                    );
                    return (
                      <td
                        key={`${role}-${res}`}
                        className="px-4 py-2 text-center"
                      >
                        {perm ? (
                          <input
                            type="checkbox"
                            checked={perm.can_access}
                            onChange={() => handleToggle(perm)}
                            disabled={updating}
                            className="w-4 h-4 accent-primary"
                          />
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">
                            –
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Feature Access
        </h2>
        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Role
                </th>
                {featureResources.map((res) => (
                  <th
                    key={res}
                    className="px-4 py-2 text-center font-semibold text-gray-700 dark:text-gray-300"
                  >
                    {res}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role, i) => (
                <tr
                  key={role}
                  className={
                    i % 2 === 0
                      ? "bg-white dark:bg-gray-900"
                      : "bg-gray-50 dark:bg-gray-800"
                  }
                >
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-300">
                    {role}
                  </td>
                  {featureResources.map((res) => {
                    const perm = groupedFeaturePermissions[role]?.find(
                      (p) => p.resource === res
                    );
                    return (
                      <td
                        key={`${role}-${res}`}
                        className="px-4 py-2 text-center"
                      >
                        {perm ? (
                          <input
                            type="checkbox"
                            checked={perm.can_access}
                            onChange={() => handleToggle(perm)}
                            disabled={updating}
                            className="w-4 h-4 accent-primary"
                          />
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">
                            –
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
