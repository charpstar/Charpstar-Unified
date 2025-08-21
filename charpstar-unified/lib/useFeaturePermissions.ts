import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "@/components/ui/utilities";

export interface FeaturePermission {
  role: string;
  resource: string;
  can_access: boolean;
  permission_type: "feature";
}

type GroupedPermissions = {
  [feature: string]: {
    [role: string]: FeaturePermission;
  };
};

export function useFeaturePermissions(enabled: boolean) {
  const [permissions, setPermissions] = useState<FeaturePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Memoize grouped permissions
  const groupedPermissions = useMemo(
    () =>
      permissions.reduce((acc, perm) => {
        if (!acc[perm.resource]) {
          acc[perm.resource] = {};
        }
        acc[perm.resource][perm.role] = perm;
        return acc;
      }, {} as GroupedPermissions),
    [permissions]
  );

  // Memoize unique features and roles for performance
  const features = useMemo(
    () => [...new Set(permissions.map((p) => p.resource))].sort(),
    [permissions]
  );
  const roles = useMemo(
    () => [...new Set(permissions.map((p) => p.role))].sort(),
    [permissions]
  );

  // Helper to check if a role has access to a specific feature
  const hasFeatureAccess = useCallback(
    (role: string | undefined, featureName: string): boolean => {
      if (!role) return false;
      return groupedPermissions[featureName]?.[role]?.can_access ?? false;
    },
    [groupedPermissions]
  );

  // Helper to check multiple feature permissions at once
  const getFeaturePermissions = useCallback(
    (
      role: string | undefined,
      featureNames: string[]
    ): Record<string, boolean> => {
      return featureNames.reduce(
        (acc, feature) => {
          acc[feature] = hasFeatureAccess(role, feature);
          return acc;
        },
        {} as Record<string, boolean>
      );
    },
    [hasFeatureAccess]
  );

  // Fetch feature permissions
  const fetchPermissions = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/permissions");
      if (!response.ok) {
        throw new Error("Failed to fetch feature permissions");
      }
      const data = await response.json();
      // Filter only feature permissions
      const featurePerms = data.filter(
        (p: FeaturePermission) => p.permission_type === "feature"
      );
      setPermissions(featurePerms);
    } catch (err: unknown) {
      console.error("Error fetching feature permissions:", err);
      let msg = "Failed to load feature permissions";
      if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Fetch on mount or when enabled
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Update a single permission
  const updatePermission = useCallback(
    async (feature: string, role: string, updates: { can_access: boolean }) => {
      const permission = groupedPermissions[feature]?.[role];
      if (!permission) {
        toast({
          title: "Error",
          description: "Permission not found",
          variant: "destructive",
        });
        return;
      }

      // Optimistic update
      setPermissions((prev) =>
        prev.map((p) =>
          p.resource === feature && p.role === role
            ? { ...p, can_access: updates.can_access }
            : p
        )
      );

      try {
        const response = await fetch("/api/permissions/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            resource: feature,
            permission_type: "feature",
            can_access: updates.can_access,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update feature permission");
        }

        toast({
          title: "Success",
          description: "Feature permission updated successfully",
        });
      } catch (err: unknown) {
        // Revert the optimistic update on error
        setPermissions((prev) =>
          prev.map((p) =>
            p.resource === feature && p.role === role
              ? { ...p, can_access: !updates.can_access }
              : p
          )
        );
        console.error("Error updating feature permission:", err);
        let msg = "Failed to update feature permission";
        if (err instanceof Error) {
          msg = err.message;
        }
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      }
    },
    [groupedPermissions]
  );

  // Create a new feature permission
  const createPermission = useCallback(
    async (newPermission: {
      feature_name: string;
      role: string;
      can_access: boolean;
    }) => {
      setIsUpdating(true);

      // Check if permission already exists
      if (
        groupedPermissions[newPermission.feature_name]?.[newPermission.role]
      ) {
        toast({
          title: "Error",
          description: "Permission already exists for this role and feature",
          variant: "destructive",
        });
        setIsUpdating(false);
        return;
      }

      // Optimistically add the new permission
      const optimisticPermission: FeaturePermission = {
        role: newPermission.role,
        resource: newPermission.feature_name,
        can_access: newPermission.can_access,
        permission_type: "feature",
      };

      setPermissions((prev) => [...prev, optimisticPermission]);

      try {
        const response = await fetch("/api/permissions/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: newPermission.role,
            resource: newPermission.feature_name,
            permission_type: "feature",
            can_access: newPermission.can_access,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create feature permission");
        }

        toast({
          title: "Success",
          description: "Feature permission created successfully",
        });
      } catch (err: unknown) {
        // Remove the optimistic permission on error
        setPermissions((prev) =>
          prev.filter(
            (p) =>
              !(
                p.role === newPermission.role &&
                p.resource === newPermission.feature_name
              )
          )
        );
        console.error("Error creating feature permission:", err);
        let msg = "Failed to create feature permission";
        if (err instanceof Error) {
          msg = err.message;
        }
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [groupedPermissions]
  );

  return {
    permissions,
    groupedPermissions,
    features,
    roles,
    loading,
    error,
    isUpdating,
    fetchPermissions,
    updatePermission,
    createPermission,
    hasFeatureAccess,
    getFeaturePermissions,
  };
}
