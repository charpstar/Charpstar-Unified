import { supabase } from "./supabaseClient";

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
    | "product_submission";
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
        console.log("Duplicate notification detected, skipping creation:", {
          recipient_id: notification.recipient_id,
          type: notification.type,
          title: notification.title,
        });
        return; // Skip creating duplicate notification
      }

      const { error } = await supabase.from("notifications").insert({
        ...notification,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Error creating notification:", error);
        throw error;
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

    // TODO: Email notification removed - will implement in later stage
    console.log("📧 Email notification would be sent for asset allocation:", {
      to: modelerEmail,
      assetNames,
      client,
      deadline,
      price,
      bonus,
    });
  }

  async sendAssetCompletedNotification(
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
        assetName,
        client,
      },
      read: false,
    };

    await this.createNotification(notification);

    // TODO: Email notification removed - will implement in later stage
    console.log("📧 Email notification would be sent for asset completion:", {
      to: modelerEmail,
      assetName,
      client,
    });
  }

  async sendRevisionNotification(
    modelerId: string,
    modelerEmail: string,
    assetName: string,
    client: string
  ): Promise<void> {
    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "status_change",
      title: `Revision Required - ${assetName}`,
      message: `Your asset "${assetName}" for ${client} requires revisions. Please review the feedback and update your work.`,
      metadata: {
        assetName,
        client,
        revisionType: "required",
      },
      read: false,
    };

    await this.createNotification(notification);

    // TODO: Email notification removed - will implement in later stage
    console.log("📧 Email notification would be sent for revision request:", {
      to: modelerEmail,
      assetName,
      client,
    });
  }

  async sendDeadlineReminderNotification(
    modelerId: string,
    modelerEmail: string,
    assetNames: string[],
    deadline: string,
    client: string
  ): Promise<void> {
    const notification: Omit<NotificationData, "created_at"> = {
      recipient_id: modelerId,
      recipient_email: modelerEmail,
      type: "deadline_reminder",
      title: `Deadline Reminder - ${client}`,
      message: `Reminder: ${assetNames.length} asset(s) are due on ${new Date(deadline).toLocaleDateString()}.`,
      metadata: {
        assetNames,
        deadline,
        client,
      },
      read: false,
    };

    await this.createNotification(notification);
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
      console.log("No production users found for budget notifications");
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
        console.log(
          "Budget alert for threshold €" +
            threshold +
            " already exists for user " +
            profile.email +
            ", skipping creation"
        );
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
      console.log("📧 Budget alert email would be sent:", {
        to: profile.email,
        alertLevel,
        totalSpent,
        threshold,
      });
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
        console.log(
          "❌ No admin users found for product submission notifications"
        );
        return;
      }

      console.log(
        `📦 Sending product submission notifications to ${adminUserIds.length} admin users`
      );

      // Create notifications for each admin user
      for (const adminId of adminUserIds) {
        // Check if a notification for this batch already exists for this user
        const fiveMinutesAgo = new Date(
          Date.now() - 5 * 60 * 1000
        ).toISOString();
        const { data: existingNotifications, error: checkError } =
          await supabase
            .from("notifications")
            .select("id")
            .eq("recipient_id", adminId)
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
          console.log(
            `Product submission notification for ${client} batch ${batch} already exists for admin user, skipping creation`
          );
          continue; // Skip creating duplicate notification
        }

        const notification: Omit<NotificationData, "created_at"> = {
          recipient_id: adminId,
          recipient_email: "", // Will be filled by createNotification
          type: "product_submission",
          title: `📦 New Products Submitted - ${client}`,
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

        // Create notification in database
        await this.createNotification(notification);

        console.log(
          `✅ Product submission notification sent to admin user ${adminId}`
        );
      }

      // Trigger global notification update event
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
    } catch (error) {
      console.error(
        "❌ Error sending product submission notifications:",
        error
      );
    }
  }

  /**
   * Get all users with admin role for budget notifications
   * @returns Array of user IDs
   */
  async getProductionAdminUsers(): Promise<string[]> {
    try {
      console.log("🔍 Fetching admin users...");

      // Query for users with admin role (this is the only valid role available)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("role", "admin");

      if (error) {
        console.error("❌ Error fetching admin users:", error);
        return [];
      }

      console.log("👥 Raw profiles query result:", profiles);

      if (!profiles || profiles.length === 0) {
        console.log("⚠️ No profiles found with admin role");

        // Fallback: Let's see what roles actually exist in the database
        const { data: allProfiles, error: allError } = await supabase
          .from("profiles")
          .select("id, email, role")
          .limit(10);

        if (!allError && allProfiles) {
          console.log(
            "🔍 Sample profiles to check available roles:",
            allProfiles
          );
          const availableRoles = [...new Set(allProfiles.map((p) => p.role))];
          console.log("📋 Available roles in database:", availableRoles);
        }

        return [];
      }

      const userIds = profiles.map((profile) => profile.id);
      console.log("✅ Admin user IDs found:", userIds);

      return userIds;
    } catch (error) {
      console.error("❌ Error in getProductionAdminUsers:", error);
      return [];
    }
  }

  private getBudgetAlertTitle(alertLevel: string, threshold: number): string {
    switch (alertLevel) {
      case "critical":
        return `🚨 CRITICAL: Budget Exceeded €${threshold}`;
      case "warning":
        return `⚠️ WARNING: Budget Exceeded €${threshold}`;
      case "alert":
        return `🔶 ALERT: Budget Exceeded €${threshold}`;
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
        return `Budget has exceeded €${threshold}! Current spending: €${totalSpent.toFixed(2)}. Remaining budget: €${remaining.toFixed(2)}. Immediate action required.`;
      case "warning":
        return `Budget has exceeded €${threshold}! Current spending: €${totalSpent.toFixed(2)}. Remaining budget: €${remaining.toFixed(2)}. Approaching critical limit.`;
      case "alert":
        return `Budget has exceeded €${threshold}! Current spending: €${totalSpent.toFixed(2)}. Remaining budget: €${remaining.toFixed(2)}. Monitor spending closely.`;
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
}

export const notificationService = new NotificationService();
