import { supabase } from "@/lib/supabaseClient";

interface ActivityLogData {
  action: string;
  description?: string;
  type:
    | "upload"
    | "create"
    | "update"
    | "delete"
    | "view"
    | "settings"
    | "login"
    | "logout"
    | "download"
    | "share"
    | "export"
    | "import"
    | "general";
  resource_type?:
    | "asset"
    | "user"
    | "project"
    | "analytics"
    | "model"
    | "material"
    | "texture"
    | "scene"
    | "layout"
    | "profile";
  resource_id?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    // Get current user information from session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Add user information to the activity data
    const activityData = {
      ...data,
      // Add user context to metadata
      metadata: {
        ...data.metadata,
        user_email: session?.user?.email || null,
        user_id: session?.user?.id || null,
      },
    };

    const response = await fetch("/api/activity/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
      body: JSON.stringify(activityData),
    });

    if (!response.ok) {
      console.error("Failed to log activity:", await response.text());
    }
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// Convenience functions for common activities
export const ActivityLogger = {
  // Asset related activities
  assetUploaded: (assetName: string, assetId?: string) =>
    logActivity({
      action: `Uploaded asset: ${assetName}`,
      type: "upload",
      resource_type: "asset",
      resource_id: assetId,
      metadata: { asset_name: assetName },
    }),

  assetDeleted: (assetName: string, assetId?: string) =>
    logActivity({
      action: `Deleted asset: ${assetName}`,
      type: "delete",
      resource_type: "asset",
      resource_id: assetId,
      metadata: { asset_name: assetName },
    }),

  // User related activities
  profileUpdated: (field?: string) =>
    logActivity({
      action: field ? `Updated profile ${field}` : "Updated profile",
      type: "update",
      resource_type: "profile",
      metadata: { field },
    }),

  avatarChanged: () =>
    logActivity({
      action: "Changed avatar",
      type: "update",
      resource_type: "profile",
      metadata: { field: "avatar" },
    }),

  // Dashboard related activities
  layoutSaved: () =>
    logActivity({
      action: "Saved dashboard layout",
      type: "update",
      resource_type: "layout",
      metadata: { component: "dashboard" },
    }),

  layoutLoaded: () =>
    logActivity({
      action: "Loaded dashboard layout",
      type: "view",
      resource_type: "layout",
      metadata: { component: "dashboard" },
    }),

  // 3D Editor related activities
  modelCreated: (modelName?: string, modelId?: string) =>
    logActivity({
      action: modelName ? `Created 3D model: ${modelName}` : "Created 3D model",
      type: "create",
      resource_type: "model",
      resource_id: modelId,
      metadata: { model_name: modelName },
    }),

  modelSaved: (modelName?: string, modelId?: string) =>
    logActivity({
      action: modelName ? `Saved 3D model: ${modelName}` : "Saved 3D model",
      type: "update",
      resource_type: "model",
      resource_id: modelId,
      metadata: { model_name: modelName },
    }),

  // User management activities (admin only)
  userCreated: (userEmail?: string) =>
    logActivity({
      action: userEmail ? `Created user: ${userEmail}` : "Created user",
      type: "create",
      resource_type: "user",
      metadata: { user_email: userEmail },
    }),

  userUpdated: (userEmail?: string) =>
    logActivity({
      action: userEmail ? `Updated user: ${userEmail}` : "Updated user",
      type: "update",
      resource_type: "user",
      metadata: { user_email: userEmail },
    }),

  userDeleted: (userEmail?: string) =>
    logActivity({
      action: userEmail ? `Deleted user: ${userEmail}` : "Deleted user",
      type: "delete",
      resource_type: "user",
      metadata: { user_email: userEmail },
    }),

  // Custom activity
  custom: (
    action: string,
    type: ActivityLogData["type"],
    resource_type?: ActivityLogData["resource_type"],
    metadata?: Record<string, any>
  ) =>
    logActivity({
      action,
      type,
      resource_type,
      metadata,
    }),
};
