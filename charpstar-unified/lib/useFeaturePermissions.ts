import { useState, useCallback, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

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

  // Group permissions by feature and role for easier access
  const groupedPermissions: GroupedPermissions = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = {};
      }
      acc[perm.resource][perm.role] = perm;
      return acc;
    },
    {} as GroupedPermissions
  );

  // Get unique features and roles
  const features = [...new Set(permissions.map((p) => p.resource))].sort();
  const roles = [...new Set(permissions.map((p) => p.role))].sort();

  // Helper function to check if a role has access to a specific feature
  const hasFeatureAccess = useCallback(
    (role: string | undefined, featureName: string): boolean => {
      if (!role) return false;
      return groupedPermissions[featureName]?.[role]?.can_access ?? false;
    },
    [groupedPermissions]
  );

  // Helper function to check multiple feature permissions at once
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
        (p: any) => p.permission_type === "feature"
      );

      setPermissions(featurePerms);
    } catch (err: any) {
      console.error("Error fetching feature permissions:", err);
      setError(err.message || "Failed to load feature permissions");
      toast({
        title: "Error",
        description: err.message || "Failed to load feature permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Fetch permissions on mount
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const updatePermission = useCallback(
    async (feature: string, role: string, updates: { can_access: boolean }) => {
      // Find the specific permission
      const permission = groupedPermissions[feature]?.[role];
      if (!permission) {
        toast({
          title: "Error",
          description: "Permission not found",
          variant: "destructive",
        });
        return;
      }

      // Optimistically update the UI
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
          headers: {
            "Content-Type": "application/json",
          },
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
      } catch (err: any) {
        // Revert the optimistic update on error
        setPermissions((prev) =>
          prev.map((p) =>
            p.resource === feature && p.role === role
              ? { ...p, can_access: !updates.can_access }
              : p
          )
        );

        console.error("Error updating feature permission:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to update feature permission",
          variant: "destructive",
        });
      }
    },
    [permissions, groupedPermissions]
  );

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
      } catch (err: any) {
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
        toast({
          title: "Error",
          description: err.message || "Failed to create feature permission",
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
