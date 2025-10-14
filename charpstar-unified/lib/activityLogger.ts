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

  // Asset approval and revision activities
  assetApproved: (
    assetId: string,
    assetName?: string,
    approvedBy?: string,
    revisionNumber?: number
  ) =>
    logActivity({
      action: `Approved asset${assetName ? `: ${assetName}` : ""}`,
      description: revisionNumber
        ? `Approved revision #${revisionNumber}`
        : "Asset approved",
      type: "update",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        new_status: "approved",
        asset_name: assetName,
        approved_by: approvedBy,
        revision_number: revisionNumber,
        approval_type: "qa_approval",
      },
    }),

  assetApprovedByClient: (
    assetId: string,
    assetName?: string,
    revisionNumber?: number
  ) =>
    logActivity({
      action: `Approved by client${assetName ? `: ${assetName}` : ""}`,
      description: revisionNumber
        ? `Client approved revision #${revisionNumber}`
        : "Client approved asset",
      type: "update",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        new_status: "approved_by_client",
        asset_name: assetName,
        revision_number: revisionNumber,
        approval_type: "client_approval",
      },
    }),

  assetSentForRevision: (
    assetId: string,
    assetName?: string,
    revisionNumber?: number,
    reason?: string
  ) =>
    logActivity({
      action: `Sent for revision${assetName ? `: ${assetName}` : ""}`,
      description: revisionNumber
        ? `Revision #${revisionNumber} requested`
        : "Asset sent for revision",
      type: "update",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        new_status: "revisions",
        asset_name: assetName,
        revision_number: revisionNumber,
        revision_reason: reason,
        revision_type: "qa_revision",
      },
    }),

  assetClientRevision: (
    assetId: string,
    assetName?: string,
    revisionNumber?: number,
    reason?: string
  ) =>
    logActivity({
      action: `Client revision requested${assetName ? `: ${assetName}` : ""}`,
      description: revisionNumber
        ? `Client revision #${revisionNumber} requested`
        : "Client requested revision",
      type: "update",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        new_status: "client_revision",
        asset_name: assetName,
        revision_number: revisionNumber,
        revision_reason: reason,
        revision_type: "client_revision",
      },
    }),

  assetStatusChanged: (
    assetId: string,
    oldStatus: string,
    newStatus: string,
    assetName?: string
  ) =>
    logActivity({
      action: `Updated asset status${assetName ? `: ${assetName}` : ""}`,
      description: `Status changed from ${oldStatus} to ${newStatus}`,
      type: "update",
      resource_type: "asset",
      resource_id: assetId,
      metadata: {
        prev_status: oldStatus,
        new_status: newStatus,
        asset_name: assetName,
        status_change_type: "general",
      },
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
