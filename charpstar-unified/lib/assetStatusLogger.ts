import { supabase } from "@/lib/supabaseClient";

interface StatusChangeData {
  assetId: string;
  previousStatus?: string;
  newStatus: string;
  actionType: string;
  revisionNumber?: number;
  revisionReason?: string;
  comments?: string;
  metadata?: Record<string, any>;
}

/**
 * Manually log an asset status change to the asset_status_history table
 * This is useful for status changes that don't go through the normal update flow
 */
export async function logAssetStatusChange(
  data: StatusChangeData
): Promise<void> {
  try {
    const { error } = await supabase.from("asset_status_history").insert({
      asset_id: data.assetId,
      previous_status: data.previousStatus,
      new_status: data.newStatus,
      action_type: data.actionType,
      revision_number: data.revisionNumber,
      revision_reason: data.revisionReason,
      comments: data.comments,
      metadata: data.metadata || {},
      // User information will be automatically populated by the trigger
    });

    if (error) {
      console.error("Error logging asset status change:", error);
      throw error;
    }
  } catch (error) {
    console.error("Failed to log asset status change:", error);
    // Don't throw - logging shouldn't break the main functionality
  }
}

/**
 * Convenience functions for common status changes
 */
export const AssetStatusLogger = {
  // QA Actions
  qaApproved: (
    assetId: string,
    previousStatus?: string,
    revisionNumber?: number
  ) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "approved",
      actionType: "qa_approved",
      revisionNumber,
    }),

  qaSentForRevision: (
    assetId: string,
    previousStatus?: string,
    revisionNumber?: number,
    reason?: string
  ) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "revisions",
      actionType: "sent_for_revision",
      revisionNumber,
      revisionReason: reason,
    }),

  // Client Actions
  clientApproved: (
    assetId: string,
    previousStatus?: string,
    revisionNumber?: number
  ) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "approved_by_client",
      actionType: "client_approved",
      revisionNumber,
    }),

  clientRequestedRevision: (
    assetId: string,
    previousStatus?: string,
    revisionNumber?: number,
    reason?: string
  ) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "client_revision",
      actionType: "client_revision_requested",
      revisionNumber,
      revisionReason: reason,
    }),

  // Modeler/Artist Actions
  deliveredByArtist: (assetId: string, previousStatus?: string) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "delivered_by_artist",
      actionType: "delivered_by_artist",
    }),

  workStarted: (assetId: string, previousStatus?: string) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "in_progress",
      actionType: "work_started",
    }),

  // System/Admin Actions
  movedToProduction: (assetId: string, previousStatus?: string) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "in_production",
      actionType: "moved_to_production",
    }),

  statusReset: (assetId: string, previousStatus?: string) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus: "not_started",
      actionType: "status_reset",
    }),

  // Generic status change
  statusChanged: (
    assetId: string,
    previousStatus: string,
    newStatus: string,
    reason?: string
  ) =>
    logAssetStatusChange({
      assetId,
      previousStatus,
      newStatus,
      actionType: "status_changed",
      comments: reason,
    }),
};

export default AssetStatusLogger;
