import { supabase } from "./supabaseClient";
import { emailService } from "./emailService";

export interface NotificationData {
  id?: string;
  recipient_id: string;
  recipient_email: string;
  type:
    | "asset_allocation"
    | "asset_completed"
    | "deadline_reminder"
    | "qa_review"
    | "status_change";
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

class NotificationService {
  private async createNotification(
    notification: Omit<NotificationData, "created_at">
  ): Promise<void> {
    try {
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

    // Send email notification
    try {
      await emailService.sendAssetAllocationEmail(
        modelerEmail,
        assetNames,
        client,
        deadline,
        price,
        bonus
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't throw - email failure shouldn't break the notification process
    }
  }

  private generateAssetAllocationEmailHTML(
    data: AssetAllocationNotification
  ): string {
    const { assetNames, deadline, price, bonus, client } = data;
    const totalAssets = assetNames.length;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Assets Assigned</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: white; padding: 20px; border-radius: 8px; }
          .asset-list { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .asset-item { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
          .asset-item:last-child { border-bottom: none; }
          .highlight { background: #e3f2fd; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #007bff;">🎯 New Assets Assigned</h1>
            <p style="margin: 10px 0 0 0; color: #6c757d;">You have new assets to work on!</p>
          </div>
          
          <div class="content">
            <h2>Hello!</h2>
            <p>You have been assigned <strong>${totalAssets} new asset(s)</strong> for <strong>${client}</strong>.</p>
            
            <div class="highlight">
              <h3 style="margin: 0 0 10px 0;">📋 Assignment Details</h3>
              <p><strong>Client:</strong> ${client}</p>
              <p><strong>Deadline:</strong> ${new Date(deadline).toLocaleDateString()}</p>
              <p><strong>Price per Asset:</strong> $${price}</p>
              ${bonus > 0 ? `<p><strong>Bonus:</strong> ${bonus}%</p>` : ""}
            </div>
            
            <h3>📦 Assigned Assets:</h3>
            <div class="asset-list">
              ${assetNames.map((name) => `<div class="asset-item">• ${name}</div>`).join("")}
            </div>
            
            <p>Please review the assets and begin work as soon as possible to meet the deadline.</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/my-assignments" class="button">
              View My Assignments
            </a>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from Charpstar Unified.</p>
            <p>If you have any questions, please contact your project manager.</p>
          </div>
        </div>
      </body>
      </html>
    `;
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

    // Send email notification
    try {
      await emailService.sendAssetCompletedEmail(
        modelerEmail,
        assetName,
        client
      );
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't throw - email failure shouldn't break the notification process
    }
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

    // Send email notification
    try {
      await emailService.sendRevisionEmail(modelerEmail, assetName, client);
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't throw - email failure shouldn't break the notification process
    }
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
