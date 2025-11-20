import { supabase } from "./supabaseClient";
import { emailService } from "./emailService";
// import { getBaseUrl } from "./urlUtils"; // TEMPORARILY DISABLED

export interface NotificationData {
  id?: string;
  recipient_id: string;
  recipient_email: string;
  type:
    | "asset_allocation"
    | "asset_completed"
    | "deadline_reminder"
    | "qa_review"
    | "status_change"
    | "budget_alert"
    | "product_submission"
    | "revision_required"
    | "asset_approved"
    | "client_review_ready"
    | "allocation_list_accepted"
    | "allocation_list_declined"
    | "comment_reply"
    | "annotation_reply"
    | "pending_reply"
    | "reply_approved"
    | "reply_rejected"
    | "subcategory_updated"
    | "invoice_deadline_reminder"
    | "client_list_progress"
    | "client_asset_update"
    | "internal_reminder"
    | "reminder_due"
    | "reminder_assigned"
    | "qa_deletion";
  title: string;
  message: string;
  metadata?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface AssetAllocationNotification {
  modelerId: string;
  modelerEmail: string;
  assetIds: string[];
  assetNames: string[];
  deadline: string;
  price: number;
  bonus: number;
  client: string;
}

export interface BudgetAlertNotification {
  totalSpent: number;
  threshold: number;
  alertLevel: "warning" | "critical" | "alert";
}

export interface ProductSubmissionNotification {
  client: string;
  batch: number;
  productCount: number;
  productNames: string[];
  submittedAt: string;
}

export interface AllocationListStatusNotification {
  modelerName: string;
  modelerEmail: string;
  allocationListName: string;
  allocationListNumber: number;
  assetCount: number;
  totalPrice: number;
  client: string;
  batch: number;
  status: "accepted" | "declined";
}

export interface PendingReplyNotification {
  recipientId: string;
  recipientEmail: string;
  assetId: string;
  pendingReplyId: string;
  qaName: string;
  replyPreview: string;
  parentCommentPreview: string;
}

export interface ReplyApprovedNotification {
  recipientId: string;
  recipientEmail: string;
  assetId: string;
  replyText: string;
}

export interface ReplyRejectedNotification {
  recipientId: string;
  recipientEmail: string;
  assetId: string;
  replyText: string;
}

export interface ClientAssetUpdateNotification {
  assetId: string;
  assetName: string;
  clientName: string;
  updateType: "measurements" | "images" | "files" | "references" | "other";
  updatedFields: string[];
  updatedBy: string;
  updatedAt: string;
}

class NotificationService {
  private async createNotification(
    notification: Omit<NotificationData, "created_at">
  ): Promise<void> {
    try {
      // Check for duplicate notifications within the last 5 minutes
      // This prevents duplicate notifications from being created
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: existingNotifications, error: checkError } = await supabase
        .from("notifications")
        .select("id")
        .eq("recipient_id", notification.recipient_id)
        .eq("type", notification.type)
        .eq("title", notification.title)
        .gte("created_at", fiveMinutesAgo)
        .limit(1);

      if (checkError) {
        console.error(
          "Error checking for duplicate notifications:",
          checkError
        );
        // Continue with creation even if check fails
      } else if (existingNotifications && existingNotifications.length > 0) {
        return; // Skip creating duplicate notification
      }

      const { error } = await supabase.from("notifications").insert({
        ...notification,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error creating notification:", error);
        console.error("Notification data that failed:", {
          type: notification.type,
          title: notification.title,
          recipient_id: notification.recipient_id,
        });
        throw error;
      }

      // Notify clients to refresh notification UIs immediately
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("notificationsUpdated"));
        } catch {}
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
      throw error;
    }
  }

  private async sendEmailNotification(): Promise<void> {
    // TODO: Implement email sending functionality
    // For now, this is a placeholder that does nothing
    try {
      // For now, we'll use a simple console log to simulate email sending
      // In production, you would integrate with a real email service like:
      // - Resend (resend.com)
      // - SendGrid
      // - AWS SES
      // - Nodemailer with SMTP
      // TODO: Replace with actual email service integration
      // Example with Resend:
      // const resend = new Resend(process.env.RESEND_API_KEY);
      // await resend.emails.send({
      //   from: 'noreply@yourdomain.com',
      //   to: recipientEmail,
      //   subject: subject,
      //   html: htmlContent,
      // });
    } catch (error) {
      console.error("Failed to send email notification:", error);
      // Don't throw here - email failure shouldn't break the allocation process
    }
  }

  async sendAssetAllocationNotification(
    data: AssetAllocationNotification
  ): Promise<void> {
    const {
      modelerId,
      modelerEmail,
      assetIds,
      assetNames,
      deadline,
      price,
      bonus,
      client,
    } = data;

    // Create notification record
    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "asset_allocation",
      title: `New Assets Assigned - ${client}`,
      message: `You have been assigned ${assetNames.length} new asset(s) with a deadline of ${new Date(deadline).toLocaleDateString()}.`,
      metadata: {
        assetIds,
        assetNames,
        deadline,
        price,
        bonus,
        client,
        totalAssets: assetNames.length,
      },
      read: false,
    };

    // Create notification in database
    await this.createNotification(notification);

    // TEMPORARILY DISABLED - No email notifications during bulk operations

    /* ORIGINAL EMAIL CODE - TEMPORARILY COMMENTED OUT
    // Fire-and-forget email (if provider configured)
    try {
      const baseUrl = getBaseUrl();
      const payload = {
        to: `${modelerEmail}`,
        client,
        allocationListName: "Allocation",
        assetNames,
        deadline,
        bonus,
      } as any;
      const res = await fetch(`${baseUrl}/api/email/asset-allocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn("[notify] email failed", res.status, txt);
      } else {
        const json = await res.json().catch(() => ({}) as any);
      }
    } catch (e) {
      // Non-blocking; log and continue
      console.warn("Email dispatch failed (allocation)", e);
    }
    */
  }

  async sendAssetCompletedNotification(
    assetId: string,
    modelerId: string,
    modelerEmail: string,
    assetName: string,
    client: string
  ): Promise<void> {
    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "asset_completed",
      title: `Asset Completed - ${assetName}`,
      message: `Your asset "${assetName}" for ${client} has been marked as completed.`,
      metadata: {
        assetId,
        assetName,
        client,
        assetIds: [assetId], // For navigation compatibility
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);

    // TODO: Email notification removed - will implement in later stage
  }

  async sendRevisionNotification(
    assetId: string,
    modelerId: string,
    modelerEmail: string,
    assetName: string,
    client: string,
    reviewerName: string
  ): Promise<void> {
    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "revision_required",
      title: `Revision Required - ${assetName}`,
      message: `${reviewerName} has requested revisions for "${assetName}" (${client}). Please review the feedback and update your work.`,
      metadata: {
        assetId,
        assetName,
        client,
        reviewerName,
        assetIds: [assetId], // For navigation compatibility
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);
  }

  async sendDeadlineReminderNotification(
    modelerId: string,
    modelerEmail: string,
    assetNames: string[],
    assetIds: string[],
    deadline: string,
    client: string,
    daysRemaining: number
  ): Promise<void> {
    const urgencyLevel =
      daysRemaining <= 1 ? "🚨" : daysRemaining <= 3 ? "⚠️" : "⏰";
    const urgencyText =
      daysRemaining <= 1 ? "URGENT" : daysRemaining <= 3 ? "SOON" : "";

    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "deadline_reminder",
      title: `${urgencyLevel} Deadline ${urgencyText} - ${client}`,
      message: `${assetNames.length} asset(s) are due ${daysRemaining === 0 ? "TODAY" : daysRemaining === 1 ? "TOMORROW" : `in ${daysRemaining} days`} (${new Date(deadline).toLocaleDateString()}).`,
      metadata: {
        assetNames,
        assetIds,
        deadline,
        client,
        daysRemaining,
        urgencyLevel:
          daysRemaining <= 1
            ? "critical"
            : daysRemaining <= 3
              ? "high"
              : "medium",
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);
  }

  /**
   * Send notification to modelers when their assets are approved
   */
  async sendAssetApprovedNotification(
    assetId: string,
    modelerId: string,
    modelerEmail: string,
    assetName: string,
    client: string,
    approverName: string,
    approvalType: "qa" | "client"
  ): Promise<void> {
    const typeText = approvalType === "qa" ? "QA" : "Client";
    const emoji = approvalType === "qa" ? "" : "";

    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "asset_approved",
      title: `${emoji} Asset Approved by ${typeText} - ${assetName}`,
      message: `${approverName} has approved "${assetName}" for ${client}. Great work!`,
      metadata: {
        assetId,
        assetName,
        client,
        approverName,
        approvalType,
        assetIds: [assetId], // For navigation compatibility
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);
  }

  /**
   * Send notification to clients when assets are ready for their review
   */
  async sendClientReviewReadyNotification(
    assetId: string,
    clientId: string,
    clientEmail: string,
    assetName: string,
    client: string,
    modelerName: string
  ): Promise<void> {
    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: clientId,
      recipient_email: clientEmail,
      type: "client_review_ready",
      title: `Asset Approved - ${assetName}`,
      message: `"${assetName}" has been completed and approved by our QA team. It's now ready for your review!`,
      metadata: {
        assetId,
        assetName,
        client,
        modelerName,
        assetIds: [assetId], // For navigation compatibility
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    // Create notification in database
    await this.createNotification(notification);

    if (typeof window !== "undefined") {
      console.log(
        "[NotificationService] Skipping client review email dispatch in browser runtime"
      );
      return;
    }

    // Send email notification
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const reviewLink = `${baseUrl}/client-review/${assetId}`;

      // Get batch information if available
      const { data: assetData } = await supabase
        .from("onboarding_assets")
        .select("batch, delivery_date")
        .eq("id", assetId)
        .single();

      await emailService.sendModelReadyForReview(
        {
          clientName: client,
          modelName: assetName,
          modelerName,
          reviewLink,
          batch: assetData?.batch,
          deadline: assetData?.delivery_date,
        },
        {
          from: process.env.EMAIL_FROM || "noreply@mail.charpstar.co",
          to: clientEmail,
          subject: `New Model Ready for Review - ${assetName}`,
        }
      );
    } catch (error) {
      console.error("Failed to send model ready for review email:", error);
      // Don't throw here - email failure shouldn't break the notification process
    }
  }

  /**
   * Send a warning notification to all admin users when an asset reaches its 3rd revision
   */
  async sendThirdRevisionWarningToAdmins(
    assetId: string,
    assetName: string,
    client: string,
    revisionNumber: number
  ): Promise<void> {
    try {
      const adminUserIds = await this.getProductionAdminUsers();
      if (adminUserIds.length === 0) {
        return;
      }

      for (const adminId of adminUserIds) {
        const notification: Omit<NotificationData, "created_at"> = {
          recipient_id: adminId,
          recipient_email: "",
          type: "revision_required",
          title: ` Third Revision Warning - ${client}`,
          message: `Asset "${assetName}" has reached revision R${revisionNumber}. Review scope and potential costs.`,
          metadata: {
            assetId,
            assetName,
            client,
            revisionNumber,
            severity: "warning",
            timestamp: new Date().toISOString(),
          },
          read: false,
        };

        await this.createNotification(notification);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error("Failed to send third revision warning to admins:", error);
    }
  }

  /**
   * Check for upcoming deadlines and send reminder notifications
   * This function should be called by a scheduled job (cron, etc.)
   */
  async sendDeadlineReminders(): Promise<void> {
    try {
      const today = new Date();
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(today.getDate() + 3);

      // Get assets with deadlines approaching in the next 3 days
      const { data: assets, error: assetsError } = await supabase
        .from("onboarding_assets")
        .select(
          `
          id,
          product_name,
          client,
          delivery_date,
          status
        `
        )
        .in("status", ["in_production", "revisions"]) // Only active assets
        .lte("delivery_date", threeDaysFromNow.toISOString())
        .gte("delivery_date", today.toISOString());

      if (assetsError) {
        console.error(
          "Error fetching assets with upcoming deadlines:",
          assetsError
        );
        return;
      }

      if (!assets || assets.length === 0) {
        return;
      }

      // Get asset assignments for these assets
      const assetIds = assets.map((asset) => asset.id);
      const { data: assignments, error: assignmentsError } = await supabase
        .from("asset_assignments")
        .select("asset_id, user_id")
        .in("asset_id", assetIds)
        .eq("role", "modeler");

      if (assignmentsError) {
        console.error("Error fetching asset assignments:", assignmentsError);
        return;
      }

      // Get unique modeler IDs and fetch their profiles
      const modelerIds = [...new Set(assignments?.map((a) => a.user_id) || [])];
      const { data: modelerProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .in("id", modelerIds);

      if (profilesError) {
        console.error("Error fetching modeler profiles:", profilesError);
        return;
      }

      // Create a map for quick profile lookup
      const profileMap = new Map(modelerProfiles?.map((p) => [p.id, p]) || []);

      // Group assets by modeler
      const modelerAssets = new Map<
        string,
        {
          modelerId: string;
          modelerEmail: string;
          assets: Array<{
            id: string;
            name: string;
            client: string;
            deadline: string;
            daysRemaining: number;
          }>;
        }
      >();

      assignments?.forEach((assignment) => {
        const asset = assets.find((a) => a.id === assignment.asset_id);
        const profile = profileMap.get(assignment.user_id);
        if (!asset || !profile?.email) return;

        const deadline = new Date(asset.delivery_date);
        const daysRemaining = Math.ceil(
          (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (!modelerAssets.has(assignment.user_id)) {
          modelerAssets.set(assignment.user_id, {
            modelerId: assignment.user_id,
            modelerEmail: profile.email || "",
            assets: [],
          });
        }

        modelerAssets.get(assignment.user_id)?.assets.push({
          id: asset.id,
          name: asset.product_name,
          client: asset.client,
          deadline: asset.delivery_date,
          daysRemaining,
        });
      });

      // Send notifications to each modeler
      for (const [modelerId, data] of modelerAssets) {
        try {
          // Group assets by client for cleaner notifications
          const clientGroups = data.assets.reduce(
            (groups, asset) => {
              if (!groups[asset.client]) {
                groups[asset.client] = [];
              }
              groups[asset.client].push(asset);
              return groups;
            },
            {} as Record<string, typeof data.assets>
          );

          // Send one notification per client
          for (const [client, clientAssets] of Object.entries(clientGroups)) {
            const assetNames = clientAssets.map((a) => a.name);
            const assetIds = clientAssets.map((a) => a.id);
            const deadline = clientAssets[0].deadline; // Assuming same deadline for grouped assets
            const daysRemaining = clientAssets[0].daysRemaining;

            await this.sendDeadlineReminderNotification(
              modelerId,
              data.modelerEmail,
              assetNames,
              assetIds,
              deadline,
              client,
              daysRemaining
            );
          }
        } catch (error) {
          console.error(
            `❌ Failed to send deadline reminder to modeler ${modelerId}:`,
            error
          );
        }
      }

      // Trigger global notification update
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error("Error in deadline reminder process:", error);
    }
  }

  /**
   * Send monthly invoice deadline reminders to modelers
   * This should be called on the 28th of each month
   */
  async sendMonthlyInvoiceDeadlineReminders(): Promise<void> {
    try {
      const today = new Date();

      // Check if today is the 28th of the month
      if (today.getDate() !== 28) {
        return;
      }

      // Get all active modelers
      const { data: modelers, error: modelersError } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "modeler");

      if (modelersError) {
        console.error("Error fetching modelers:", modelersError);
        return;
      }

      if (!modelers || modelers.length === 0) {
        return;
      }

      // Get current month's completed work for each modeler
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);

      for (const modeler of modelers) {
        try {
          // Get completed assets for this modeler in the current month
          const { data: completedAssets, error: assetsError } = await supabase
            .from("asset_assignments")
            .select(
              `
              id,
              price,
              onboarding_assets!inner(
                id,
                product_name,
                client,
                status,
                created_at
              )
            `
            )
            .eq("user_id", modeler.id)
            .eq("role", "modeler")
            .in("onboarding_assets.status", ["approved", "approved_by_client"])
            .gte("onboarding_assets.created_at", monthStart.toISOString())
            .lte("onboarding_assets.created_at", monthEnd.toISOString());

          if (assetsError) {
            console.error(
              `Error fetching completed assets for modeler ${modeler.id}:`,
              assetsError
            );
            continue;
          }

          if (!completedAssets || completedAssets.length === 0) {
            continue;
          }

          // Calculate total earnings for the month
          const totalEarnings = completedAssets.reduce((sum, assignment) => {
            return sum + (assignment.price || 0);
          }, 0);

          // Group by client for better organization
          const clientGroups = completedAssets.reduce(
            (groups, assignment) => {
              const client = (assignment.onboarding_assets as any).client;
              if (!groups[client]) {
                groups[client] = [];
              }
              groups[client].push(assignment);
              return groups;
            },
            {} as Record<string, any[]>
          );

          // Send invoice deadline reminder
          await this.sendInvoiceDeadlineReminderNotification(
            modeler.id,
            modeler.email,
            totalEarnings,
            clientGroups,
            currentMonth,
            currentYear
          );
        } catch (error) {
          console.error(
            `❌ Failed to send invoice deadline reminder to modeler ${modeler.id}:`,
            error
          );
        }
      }

      // Trigger global notification update
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error(
        "Error in monthly invoice deadline reminder process:",
        error
      );
    }
  }

  async sendBudgetAlertNotification(
    productionUserIds: string[],
    data: BudgetAlertNotification
  ): Promise<void> {
    const { totalSpent, threshold, alertLevel } = data;

    // Get production/admin user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", productionUserIds);

    if (profilesError) {
      console.error("Error fetching production user profiles:", profilesError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      return;
    }

    // Create notifications for each production/admin user
    for (const profile of profiles) {
      // Check if a budget alert for this threshold already exists for this user
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existingBudgetAlerts, error: checkError } = await supabase
        .from("notifications")
        .select("id")
        .eq("recipient_id", profile.id)
        .eq("type", "budget_alert")
        .eq("metadata->>threshold", threshold.toString())
        .gte("created_at", fiveMinutesAgo)
        .limit(1);

      if (checkError) {
        console.error("Error checking for existing budget alerts:", checkError);
        // Continue with creation even if check fails
      } else if (existingBudgetAlerts && existingBudgetAlerts.length > 0) {
        continue; // Skip creating duplicate budget alert
      }

      const notification: Omit<NotificationData, "created_at"> = {
        recipient_id: profile.id,
        recipient_email: profile.email,
        type: "budget_alert",
        title: this.getBudgetAlertTitle(alertLevel, threshold),
        message: this.getBudgetAlertMessage(alertLevel, totalSpent, threshold),
        metadata: {
          totalSpent,
          threshold,
          alertLevel,
          timestamp: new Date().toISOString(),
        },
        read: false,
      };

      // Create notification in database
      await this.createNotification(notification);

      // TODO: Email notification removed - will implement in later stage
    }
  }

  /**
   * Send notification to admin users when a client submits new products
   */
  async sendProductSubmissionNotification(
    data: ProductSubmissionNotification
  ): Promise<void> {
    const { client, batch, productCount, productNames, submittedAt } = data;

    try {
      // Get all admin users to send notifications to
      const adminUserIds = await this.getProductionAdminUsers();

      if (adminUserIds.length === 0) {
        return;
      }

      // Check for existing notifications for this batch/client combination
      // This prevents duplicate notifications across all admin users
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existingNotifications, error: checkError } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "product_submission")
        .eq("metadata->>client", client)
        .eq("metadata->>batch", batch.toString())
        .gte("created_at", fiveMinutesAgo)
        .limit(1);

      if (checkError) {
        console.error(
          "Error checking for existing product submission notifications:",
          checkError
        );
        // Continue with creation even if check fails
      } else if (existingNotifications && existingNotifications.length > 0) {
        return; // Skip creating duplicate notification
      }

      // Create notifications for each admin user
      for (const adminId of adminUserIds) {
        const notification: Omit<NotificationData, "created_at"> = {
          recipient_id: adminId,
          recipient_email: "", // Will be filled by createNotification
          type: "product_submission",
          title: `New Products Submitted - ${client}`,
          message: `${client} has submitted ${productCount} new product(s) for batch ${batch}.`,
          metadata: {
            client,
            batch,
            productCount,
            productNames: productNames.slice(0, 5), // Limit to first 5 names to avoid metadata bloat
            submittedAt,
            timestamp: new Date().toISOString(),
          },
          read: false,
        };

        // Create notification in database (without duplicate check since we already checked)
        try {
          const { error } = await supabase.from("notifications").insert({
            ...notification,
            created_at: new Date().toISOString(),
          });

          if (error) {
            console.error("Error creating notification:", error);
            throw error;
          }
        } catch (notificationError) {
          console.error(
            `❌ Failed to create notification for admin ${adminId}:`,
            notificationError
          );
          // Continue with other admins even if one fails
        }
      }

      // Trigger global notification update event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error(
        "❌ Error sending product submission notifications:",
        error
      );
    }
  }

  /**
   * Send notification to QA users when a modeler marks an asset as delivered
   * Only sends notifications to QAs who are connected to the modeler via qa_allocations
   */
  async sendQAReviewNotification(
    assetId: string,
    assetName: string,
    modelerName: string,
    client: string,
    modelerId: string
  ): Promise<void> {
    try {
      // Get QAs allocated to this modeler via qa_allocations
      const { data: qaAllocations, error: qaError } = await supabase
        .from("qa_allocations")
        .select("qa_id, profiles!qa_allocations_qa_id_fkey(id, email)")
        .eq("modeler_id", modelerId);

      if (qaError) {
        console.error("Error fetching QA allocations:", qaError);
        throw qaError;
      }

      if (!qaAllocations || qaAllocations.length === 0) {
        // No QAs allocated to this modeler, so no notifications to send
        return;
      }

      // Extract QA user IDs and emails from allocations
      const qaUsers = qaAllocations
        .map((allocation) => {
          const profile = allocation.profiles as any;
          if (profile && profile.id && profile.email) {
            return {
              id: profile.id,
              email: profile.email,
            };
          }
          return null;
        })
        .filter((user): user is { id: string; email: string } => user !== null);

      if (qaUsers.length === 0) {
        return;
      }

      // Create notifications for connected QA users only
      const notificationPromises = qaUsers.map(async (qaUser) => {
        const notification: Omit<NotificationData, "created_at"> = {
          recipient_id: qaUser.id,
          recipient_email: qaUser.email,
          type: "qa_review",
          title: `Asset Ready for QA Review - ${assetName}`,
          message: `${modelerName} has delivered "${assetName}" for ${client}. Ready for QA review.`,
          metadata: {
            assetId,
            assetName,
            modelerName,
            client,
            assetIds: [assetId], // For compatibility with existing navigation logic
            timestamp: new Date().toISOString(),
          },
          read: false,
        };

        await this.createNotification(notification);
      });

      await Promise.all(notificationPromises);

      // Dispatch global event to refresh notification bells
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error("Failed to send QA review notification:", error);
      throw error;
    }
  }

  /**
   * Notify a user when someone replies to their comment
   */
  async sendCommentReplyNotification(params: {
    recipientId: string;
    recipientEmail?: string;
    assetId: string;
    parentCommentId: string;
    replyPreview?: string;
  }): Promise<void> {
    const {
      recipientId,
      recipientEmail = "",
      assetId,
      parentCommentId,
      replyPreview,
    } = params;

    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: recipientId,
      recipient_email: recipientEmail,
      type: "comment_reply",
      title: "New reply to your comment",
      message: replyPreview
        ? `"${replyPreview.slice(0, 80)}"`
        : "You have a new reply to your comment.",
      metadata: {
        assetId,
        parentCommentId,
        preview: replyPreview || "",
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);
  }

  /**
   * Notify a user when someone replies to their annotation
   */
  async sendAnnotationReplyNotification(params: {
    recipientId: string;
    recipientEmail?: string;
    assetId: string;
    parentAnnotationId: string;
    replyPreview?: string;
  }): Promise<void> {
    const {
      recipientId,
      recipientEmail = "",
      assetId,
      parentAnnotationId,
      replyPreview,
    } = params;

    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: recipientId,
      recipient_email: recipientEmail,
      type: "annotation_reply",
      title: "New reply to your annotation",
      message: replyPreview
        ? `"${replyPreview.slice(0, 80)}"`
        : "You have a new reply to your annotation.",
      metadata: {
        assetId,
        parentAnnotationId,
        preview: replyPreview || "",
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);
  }

  /**
   * Get all users with admin role for budget notifications
   * @returns Array of user IDs
   */
  async getProductionAdminUsers(): Promise<string[]> {
    try {
      // Query for users with admin role (this is the only valid role available)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("role", "admin");

      if (error) {
        console.error("Error fetching admin users:", error);
        return [];
      }

      if (!profiles || profiles.length === 0) {
        // Fallback: Let's see what roles actually exist in the database
        const { data: allProfiles, error: allError } = await supabase
          .from("profiles")
          .select("id, email, role")
          .limit(10);

        if (!allError && allProfiles) {
        }

        return [];
      }

      const userIds = profiles.map((profile) => profile.id);

      return userIds;
    } catch (error) {
      console.error("Error in getProductionAdminUsers:", error);
      return [];
    }
  }

  /**
   * Send notification to admin users when a modeler accepts or declines an allocation list
   */
  async sendAllocationListStatusNotification(
    data: AllocationListStatusNotification
  ): Promise<void> {
    const {
      modelerName,
      modelerEmail,
      allocationListName,
      allocationListNumber,
      assetCount,
      totalPrice,
      client,
      batch,
      status,
    } = data;

    try {
      // Get all admin users to send notifications to
      const adminUserIds = await this.getProductionAdminUsers();

      if (adminUserIds.length === 0) {
        return;
      }

      const statusText = status === "accepted" ? "accepted" : "declined";
      const actionText = status === "accepted" ? "Accepted" : "Declined";

      // Create notifications for each admin user
      for (const adminId of adminUserIds) {
        const notification: Omit<NotificationData, "created_at"> = {
          recipient_id: adminId,
          recipient_email: "", // Will be filled by createNotification
          type:
            status === "accepted"
              ? "allocation_list_accepted"
              : "allocation_list_declined",
          title: `Allocation List ${actionText} - ${modelerName}`,
          message: `${modelerName} has ${statusText} allocation list "${allocationListName}" (#${allocationListNumber}) containing ${assetCount} assets (€${totalPrice.toFixed(2)}) for ${client} batch ${batch}.`,
          metadata: {
            modelerName,
            modelerEmail,
            allocationListName,
            allocationListNumber,
            assetCount,
            totalPrice,
            client,
            batch,
            status,
            timestamp: new Date().toISOString(),
          },
          read: false,
        };

        // Create notification in database

        try {
          await this.createNotification(notification);
        } catch (notificationError) {
          console.error(
            `❌ Failed to create notification for admin ${adminId}:`,
            notificationError
          );
          // Continue with other admins even if one fails
        }
      }

      // Trigger global notification update event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error(
        `Error sending allocation list ${status} notifications:`,
        error
      );
    }
  }

  private getBudgetAlertTitle(alertLevel: string, threshold: number): string {
    switch (alertLevel) {
      case "critical":
        return `🚨 CRITICAL: Budget Threshold €${threshold}`;
      case "warning":
        return ` WARNING: Budget Threshold €${threshold}`;
      case "alert":
        return ` ALERT: Budget Threshold €${threshold}`;
      default:
        return `Budget Alert - €${threshold}`;
    }
  }

  private getBudgetAlertMessage(
    alertLevel: string,
    totalSpent: number,
    threshold: number
  ): string {
    const remaining = 4500 - totalSpent;

    switch (alertLevel) {
      case "critical":
        return `Budget threshold of €${threshold} reached! Current spending: €${totalSpent.toFixed(2)}. Remaining budget: €${remaining.toFixed(2)}. Immediate action required.`;
      case "warning":
        return `Budget threshold of €${threshold} reached! Current spending: €${totalSpent.toFixed(2)}. Remaining budget: €${remaining.toFixed(2)}. Approaching critical limit.`;
      case "alert":
        return `Budget threshold of €${threshold} reached! Current spending: €${totalSpent.toFixed(2)}. Remaining budget: €${remaining.toFixed(2)}. Monitor spending closely.`;
      default:
        return `Budget alert triggered at €${threshold}. Current spending: €${totalSpent.toFixed(2)}.`;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) {
        console.error("Error marking notification as read:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  async markNotificationsAsRead(notificationIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", notificationIds);

      if (error) {
        console.error("Error marking notifications as read:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      throw error;
    }
  }

  async markNotificationAsUnread(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: false })
        .eq("id", notificationId);

      if (error) {
        console.error("Error marking notification as unread:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to mark notification as unread:", error);
      throw error;
    }
  }

  async markNotificationsAsUnread(notificationIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: false })
        .in("id", notificationIds);

      if (error) {
        console.error("Error marking notifications as unread:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to mark notifications as unread:", error);
      throw error;
    }
  }

  async deleteNotifications(notificationIds: string[]): Promise<void> {
    try {
      if (!notificationIds || notificationIds.length === 0) return;
      // Scope delete to current user to satisfy RLS
      let recipientId: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        recipientId = data?.user?.id ?? null;
      } catch {}

      let query = supabase
        .from("notifications")
        .delete()
        .in("id", notificationIds);
      if (recipientId) {
        query = query.eq("recipient_id", recipientId);
      }
      const { error } = await query.select("id");

      if (error) {
        console.error("Error deleting notifications:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to delete notifications:", error);
      throw error;
    }
  }

  async getUnreadNotifications(userId: string): Promise<NotificationData[]> {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching unread notifications:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch unread notifications:", error);
      throw error;
    }
  }

  async getAllNotifications(userId: string): Promise<NotificationData[]> {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notifications:", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      throw error;
    }
  }

  async sendPendingReplyNotification(
    data: PendingReplyNotification
  ): Promise<void> {
    try {
      await this.createNotification({
        recipient_id: data.recipientId,
        recipient_email: data.recipientEmail,
        type: "pending_reply",
        title: "QA Reply Requires Approval",
        message: `${data.qaName} replied to a client comment and needs admin approval. Reply: "${data.replyPreview.substring(0, 100)}${data.replyPreview.length > 100 ? "..." : ""}"`,
        metadata: {
          assetId: data.assetId,
          pendingReplyId: data.pendingReplyId,
          qaName: data.qaName,
          replyPreview: data.replyPreview,
          parentCommentPreview: data.parentCommentPreview,
        },
        read: false,
      });
    } catch (error) {
      console.error("Failed to send pending reply notification:", error);
      throw error;
    }
  }

  async sendReplyApprovedNotification(
    data: ReplyApprovedNotification
  ): Promise<void> {
    try {
      await this.createNotification({
        recipient_id: data.recipientId,
        recipient_email: data.recipientEmail,
        type: "reply_approved",
        title: "Reply Approved",
        message: `Your reply has been approved and posted. Reply: "${data.replyText.substring(0, 100)}${data.replyText.length > 100 ? "..." : ""}"`,
        metadata: {
          assetId: data.assetId,
          replyText: data.replyText,
        },
        read: false,
      });
    } catch (error) {
      console.error("Failed to send reply approved notification:", error);
      throw error;
    }
  }

  async sendReplyRejectedNotification(
    data: ReplyRejectedNotification
  ): Promise<void> {
    try {
      await this.createNotification({
        recipient_id: data.recipientId,
        recipient_email: data.recipientEmail,
        type: "reply_rejected",
        title: "Reply Rejected",
        message: `Your reply was rejected by an admin. Reply: "${data.replyText.substring(0, 100)}${data.replyText.length > 100 ? "..." : ""}"`,
        metadata: {
          assetId: data.assetId,
          replyText: data.replyText,
        },
        read: false,
      });
    } catch (error) {
      console.error("Failed to send reply rejected notification:", error);
      throw error;
    }
  }

  async sendSubcategoryUpdatedNotification(
    assetId: string,
    productName: string,
    client: string,
    updatedBy: string,
    previousSubcategory: string | null,
    newSubcategory: string
  ): Promise<void> {
    try {
      // Get all users who should be notified (modeler, QA, admin)
      const { data: assetAssignment } = await supabase
        .from("asset_assignments")
        .select("user_id")
        .eq("asset_id", assetId)
        .eq("role", "modeler")
        .single();

      if (!assetAssignment) {
        console.warn("No modeler assignment found for asset:", assetId);
        return;
      }

      // Get modeler profile
      const { data: modelerProfile } = await supabase
        .from("profiles")
        .select("email, title")
        .eq("id", assetAssignment.user_id)
        .single();

      if (!modelerProfile?.email) {
        console.warn("No modeler profile found for asset:", assetId);
        return;
      }

      // Get QA users assigned to this modeler
      const { data: qaAllocations } = await supabase
        .from("qa_allocations")
        .select("qa_id, profiles!qa_allocations_qa_id_fkey(email, title)")
        .eq("modeler_id", assetAssignment.user_id);

      // Get admin users
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, email, title")
        .eq("role", "admin");

      // Send notification to modeler
      await this.createNotification({
        recipient_id: assetAssignment.user_id,
        recipient_email: modelerProfile.email,
        type: "subcategory_updated",
        title: "Subcategory Updated",
        message: `The subcategory for "${productName}" has been updated from "${previousSubcategory || "empty"}" to "${newSubcategory}" by ${updatedBy}.`,
        metadata: {
          assetId,
          productName,
          client,
          updatedBy,
          previousSubcategory,
          newSubcategory,
        },
        read: false,
      });

      // Send notification to assigned QA users
      if (qaAllocations) {
        for (const allocation of qaAllocations) {
          const qaProfile = allocation.profiles as any;
          if (qaProfile?.email) {
            await this.createNotification({
              recipient_id: allocation.qa_id,
              recipient_email: qaProfile.email,
              type: "subcategory_updated",
              title: "Subcategory Updated",
              message: `The subcategory for "${productName}" has been updated from "${previousSubcategory || "empty"}" to "${newSubcategory}" by ${updatedBy}.`,
              metadata: {
                assetId,
                productName,
                client,
                updatedBy,
                previousSubcategory,
                newSubcategory,
              },
              read: false,
            });
          }
        }
      }

      // Send notification to admin users
      if (adminProfiles) {
        for (const admin of adminProfiles) {
          await this.createNotification({
            recipient_id: admin.id,
            recipient_email: admin.email,
            type: "subcategory_updated",
            title: "Subcategory Updated",
            message: `The subcategory for "${productName}" has been updated from "${previousSubcategory || "empty"}" to "${newSubcategory}" by ${updatedBy}.`,
            metadata: {
              assetId,
              productName,
              client,
              updatedBy,
              previousSubcategory,
              newSubcategory,
            },
            read: false,
          });
        }
      }
    } catch (error) {
      console.error("Failed to send subcategory updated notification:", error);
      throw error;
    }
  }

  async sendInvoiceDeadlineReminderNotification(
    modelerId: string,
    modelerEmail: string,
    totalEarnings: number,
    clientGroups: Record<string, any[]>,
    month: number,
    year: number
  ): Promise<void> {
    try {
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const monthName = monthNames[month];
      const clientCount = Object.keys(clientGroups).length;
      const assetCount = Object.values(clientGroups).reduce(
        (total, assets) => total + assets.length,
        0
      );

      const message = `Invoice deadline reminder: You have completed work worth €${totalEarnings.toFixed(2)} in ${monthName} ${year} (${assetCount} assets across ${clientCount} client${clientCount > 1 ? "s" : ""}). Please submit your invoice by the end of the month.`;

      await this.createNotification({
        recipient_id: modelerId,
        recipient_email: modelerEmail,
        type: "invoice_deadline_reminder",
        title: "Monthly Invoice Deadline Reminder",
        message,
        metadata: {
          totalEarnings,
          month,
          year,
          monthName,
          clientCount,
          assetCount,
          clientGroups: Object.keys(clientGroups),
        },
        read: false,
      });
    } catch (error) {
      console.error(
        "Failed to send invoice deadline reminder notification:",
        error
      );
      throw error;
    }
  }

  async sendClientListProgressNotification(
    _clientId: string,
    _clientEmail: string,
    _allocationListId: string,
    _allocationListName: string,
    _completionPercentage: number,
    _completedAssets: number,
    _totalAssets: number,
    _client: string,
    _batch: number
  ): Promise<void> {
    // TEMPORARILY DISABLED - No client notifications during bulk operations
    // Suppress unused parameter warnings
    void _clientId;
    void _clientEmail;
    void _allocationListId;
    void _allocationListName;
    void _completionPercentage;
    void _completedAssets;
    void _totalAssets;
    void _client;
    void _batch;
    return;

    /* ORIGINAL CODE - TEMPORARILY COMMENTED OUT
    try {
      const progressText =
        completionPercentage === 100
          ? "completed"
          : `${completionPercentage}% complete`;
      const message = `Your submitted list "${allocationListName}" is now ${progressText} (${completedAssets}/${totalAssets} assets approved) for ${client} batch ${batch}.`;

      await this.createNotification({
        recipient_id: clientId,
        recipient_email: clientEmail,
        type: "status_change",
        title: `List Progress Update - ${progressText}`,
        message,
        metadata: {
          allocationListId,
          allocationListName,
          completionPercentage,
          completedAssets,
          totalAssets,
          client,
          batch,
          timestamp: new Date().toISOString(),
        },
        read: false,
      });
    } catch (error) {
      console.error("Failed to send client list progress notification:", error);
      throw error;
    }
    */
  }

  /**
   * Send notification to QA users connected to modelers assigned to the asset and admin users when a client updates asset information
   */
  async sendClientAssetUpdateNotification(
    data: ClientAssetUpdateNotification
  ): Promise<void> {
    console.log(
      "🔔 [NotificationService] sendClientAssetUpdateNotification called with:",
      {
        assetId: data.assetId,
        assetName: data.assetName,
        clientName: data.clientName,
        updateType: data.updateType,
        updatedBy: data.updatedBy,
      }
    );

    try {
      // Get QAs connected to modelers who are assigned to this specific asset
      let qaUsers: any[] = [];

      // First, find which modelers are assigned to this asset
      const { data: assetAssignments, error: assignmentError } = await supabase
        .from("asset_assignments")
        .select("user_id")
        .eq("asset_id", data.assetId)
        .eq("role", "modeler");

      console.log(
        "📊 [NotificationService] Asset assignments for asset",
        data.assetId,
        ":",
        {
          count: assetAssignments?.length || 0,
          modelerIds: assetAssignments?.map((a) => a.user_id) || [],
          error: assignmentError,
        }
      );

      if (assignmentError) {
        console.error("❌ Error fetching asset assignments:", assignmentError);
        // Don't throw - we'll continue with admin notifications even if QA lookup fails
      } else if (assetAssignments && assetAssignments.length > 0) {
        const modelerIds = assetAssignments.map((a) => a.user_id);

        // Find QAs who are allocated to these modelers
        const { data: qaAllocations, error: qaAllocationError } = await supabase
          .from("qa_allocations")
          .select("qa_id")
          .in("modeler_id", modelerIds);

        console.log("📊 [NotificationService] QA allocations for modelers:", {
          count: qaAllocations?.length || 0,
          qaIds: qaAllocations?.map((a) => a.qa_id) || [],
          error: qaAllocationError,
        });

        if (qaAllocationError) {
          console.error("❌ Error fetching QA allocations:", qaAllocationError);
        } else if (qaAllocations && qaAllocations.length > 0) {
          const qaIds = qaAllocations.map((a) => a.qa_id);

          // Get QA user details
          const { data: allocatedQAUsers, error: qaError } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", qaIds)
            .eq("role", "qa");

          console.log("📊 [NotificationService] Allocated QA users:", {
            count: allocatedQAUsers?.length || 0,
            error: qaError,
          });

          if (qaError) {
            console.error("❌ Error fetching allocated QA users:", qaError);
          } else {
            qaUsers = allocatedQAUsers || [];
          }
        }
      }

      // Get all admin users
      const { data: adminUsers, error: adminError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("role", "admin");

      console.log("📊 [NotificationService] Admin users:", {
        count: adminUsers?.length || 0,
        error: adminError,
      });

      if (adminError) {
        console.error("❌ Error fetching admin users:", adminError);
        throw adminError;
      }

      // Combine QA and admin users
      const allUsers = [...(qaUsers || []), ...(adminUsers || [])];

      console.log(
        `📊 [NotificationService] Total users to notify: ${allUsers.length}`,
        {
          qa: qaUsers?.length || 0,
          admin: adminUsers?.length || 0,
        }
      );

      if (allUsers.length === 0) {
        console.warn("⚠️ [NotificationService] No users to notify!");
        return;
      }

      // Create appropriate title and message based on update type
      const updateTypeText = {
        measurements: "measurements",
        images: "images",
        files: "files",
        references: "reference images",
        other: "information",
      };

      const updateText = updateTypeText[data.updateType] || "information";
      const fieldsText =
        data.updatedFields.length > 0
          ? ` (${data.updatedFields.join(", ")})`
          : "";

      // Create notifications for allocated QA and admin users
      const notificationPromises = allUsers.map(async (user) => {
        const notification: Omit<NotificationData, "created_at"> = {
          recipient_id: user.id,
          recipient_email: user.email,
          type: "client_asset_update",
          title: `Asset Updated by Client - ${data.assetName}`,
          message: `${data.clientName} has updated ${updateText}${fieldsText} for "${data.assetName}".`,
          metadata: {
            assetId: data.assetId,
            assetName: data.assetName,
            clientName: data.clientName,
            updateType: data.updateType,
            updatedFields: data.updatedFields,
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt,
            timestamp: new Date().toISOString(),
          },
          read: false,
        };

        try {
          await this.createNotification(notification);
          console.log(
            `✅ Created client_asset_update notification for user: ${user.email}`
          );
        } catch (error) {
          console.error(
            `❌ Failed to create client_asset_update notification for user ${user.email}:`,
            error
          );
          throw error; // Re-throw to let the calling code handle it
        }
      });

      await Promise.all(notificationPromises);
      console.log(
        `✅ Successfully sent ${allUsers.length} client_asset_update notifications`
      );

      // Dispatch global event to refresh notification bells
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      }
    } catch (error) {
      console.error("Failed to send client asset update notification:", error);
      throw error;
    }
  }

  /**
   * Send notification when an internal reminder is created or becomes due
   */
  async sendReminderNotification(reminder: {
    id: string;
    title: string;
    description?: string;
    assigned_to?: string;
    priority?: string;
    due_date?: string;
    reminder_datetime?: string;
  }): Promise<void> {
    if (!reminder.assigned_to) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", reminder.assigned_to)
      .single();

    if (!profile) return;

    await this.createNotification({
      recipient_id: profile.id,
      recipient_email: profile.email,
      type: "internal_reminder",
      title: `Reminder: ${reminder.title}`,
      message: reminder.description || reminder.title,
      metadata: {
        reminder_id: reminder.id,
        priority: reminder.priority,
        due_date: reminder.due_date,
        reminder_datetime: reminder.reminder_datetime,
      },
      read: false,
    });
  }

  /**
   * Send notification when a reminder is assigned to a user
   */
  async sendReminderAssignedNotification(
    reminderId: string,
    reminderTitle: string,
    assignedToId: string,
    assignedToEmail: string,
    createdByEmail: string
  ): Promise<void> {
    await this.createNotification({
      recipient_id: assignedToId,
      recipient_email: assignedToEmail,
      type: "reminder_assigned",
      title: `New Reminder Assigned: ${reminderTitle}`,
      message: `${createdByEmail} has assigned you a reminder: "${reminderTitle}"`,
      metadata: {
        reminder_id: reminderId,
        created_by_email: createdByEmail,
      },
      read: false,
    });
  }
  async sendQADeletionNotification(params: {
    recipientId: string;
    recipientEmail?: string;
    assetId: string;
    assetName?: string;
    deletedBy: string;
    deletedByName?: string;
    itemType: "annotation" | "comment";
    itemPreview?: string;
  }): Promise<void> {
    const {
      recipientId,
      recipientEmail = "",
      assetId,
      assetName,
      deletedBy,
      deletedByName,
      itemType,
      itemPreview,
    } = params;

    const itemTypeText = itemType === "annotation" ? "annotation" : "comment";
    const itemTypeCapitalized =
      itemType === "annotation" ? "Annotation" : "Comment";

    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: recipientId,
      recipient_email: recipientEmail,
      type: "qa_deletion",
      title: `${itemTypeCapitalized} Deleted`,
      message: `${deletedByName || "A QA member"} deleted your ${itemTypeText}${assetName ? ` on "${assetName}"` : ""}${itemPreview ? `: "${itemPreview.slice(0, 80)}${itemPreview.length > 80 ? "..." : ""}"` : "."}`,
      metadata: {
        assetId,
        assetName: assetName || "",
        deletedBy,
        deletedByName: deletedByName || "",
        itemType,
        itemPreview: itemPreview || "",
        timestamp: new Date().toISOString(),
      },
      read: false,
    };

    await this.createNotification(notification);
  }
}

export const notificationService = new NotificationService();
