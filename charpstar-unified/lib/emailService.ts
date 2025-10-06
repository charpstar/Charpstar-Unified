import { Resend } from "resend";
import { render } from "@react-email/render";
import ModelReadyForReviewEmail from "@/components/emails/ModelReadyForReviewEmail";
import WeeklyStatusSummaryEmail from "@/components/emails/WeeklyStatusSummaryEmail";
import BatchCompletionEmail from "@/components/emails/BatchCompletionEmail";
import StaleModelReminderEmail from "@/components/emails/StaleModelReminderEmail";

export interface EmailConfig {
  from: string;
  to: string;
  subject: string;
}

export interface ModelReadyForReviewData {
  clientName: string;
  modelName: string;
  modelerName: string;
  reviewLink: string;
  batch?: number;
  deadline?: string;
}

export interface WeeklyStatusSummaryData {
  clientName: string;
  summaryData: {
    totalModels: number;
    completedModels: number;
    inProgressModels: number;
    pendingModels: number;
    revisionModels: number;
    completionPercentage: number;
    batches: Array<{
      batchNumber: number;
      totalModels: number;
      completedModels: number;
      completionPercentage: number;
      status: "in_progress" | "completed" | "pending";
    }>;
  };
  dashboardLink: string;
  weekRange: string;
}

export interface BatchCompletionData {
  clientName: string;
  batchNumber: number;
  completedModels: Array<{
    name: string;
    modelerName: string;
    completedAt: string;
  }>;
  totalModels: number;
  completionDate: string;
  dashboardLink: string;
  nextBatchInfo?: {
    batchNumber: number;
    totalModels: number;
    estimatedCompletion?: string;
  };
}

export interface StaleModelReminderData {
  clientName: string;
  staleModels: Array<{
    name: string;
    modelerName: string;
    status: string;
    lastUpdated: string;
    daysPending: number;
    deadline?: string;
    reviewLink: string;
  }>;
  dashboardLink: string;
}

class EmailService {
  private fromEmail: string;
  private isDevelopmentMode: boolean;
  private resend: Resend | null;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || "noreply@mail.charpstar.co";
    this.isDevelopmentMode =
      process.env.NODE_ENV === "development" ||
      process.env.EMAIL_DEV_MODE === "true";

    // Initialize Resend only if we have an API key and not in development mode
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && !this.isDevelopmentMode) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      if (!apiKey) {
        console.warn(
          "⚠️ RESEND_API_KEY not found - email service will run in development mode"
        );
      }
    }
  }

  /**
   * Send email notification when a new model is ready for client review
   */
  async sendModelReadyForReview(
    data: ModelReadyForReviewData,
    config: EmailConfig
  ) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Email would be sent to",
        config.to,
        "for model",
        data.modelName
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [config.to],
        subject:
          config.subject || `New Model Ready for Review - ${data.modelName}`,
        html: await render(ModelReadyForReviewEmail(data)),
      });

      if (error) {
        console.error("Failed to send model ready for review email:", error);
        throw error;
      }

      console.log(
        "Model ready for review email sent successfully:",
        result?.id
      );
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error sending model ready for review email:", error);
      throw error;
    }
  }

  /**
   * Send weekly status summary email to clients
   */
  async sendWeeklyStatusSummary(
    data: WeeklyStatusSummaryData,
    config: EmailConfig
  ) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Weekly summary would be sent to",
        config.to,
        "for client",
        data.clientName
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [config.to],
        subject: config.subject || `Weekly Status Summary - ${data.weekRange}`,
        html: await render(WeeklyStatusSummaryEmail(data)),
      });

      if (error) {
        console.error("Failed to send weekly status summary email:", error);
        throw error;
      }

      console.log("Weekly status summary email sent successfully:", result?.id);
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error sending weekly status summary email:", error);
      throw error;
    }
  }

  /**
   * Send batch completion notification email
   */
  async sendBatchCompletion(data: BatchCompletionData, config: EmailConfig) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Batch completion would be sent to",
        config.to,
        "for batch",
        data.batchNumber
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [config.to],
        subject:
          config.subject ||
          `Batch ${data.batchNumber} Complete - ${data.clientName}`,
        html: await render(BatchCompletionEmail(data)),
      });

      if (error) {
        console.error("Failed to send batch completion email:", error);
        throw error;
      }

      console.log("Batch completion email sent successfully:", result?.id);
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error sending batch completion email:", error);
      throw error;
    }
  }

  /**
   * Send stale model reminder email
   */
  async sendStaleModelReminder(
    data: StaleModelReminderData,
    config: EmailConfig
  ) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Stale model reminder would be sent to",
        config.to,
        "for",
        data.staleModels.length,
        "models"
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [config.to],
        subject:
          config.subject ||
          `Stale Model Reminder - ${data.staleModels.length} Models Need Attention`,
        html: await render(StaleModelReminderEmail(data)),
      });

      if (error) {
        console.error("Failed to send stale model reminder email:", error);
        throw error;
      }

      console.log("Stale model reminder email sent successfully:", result?.id);
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error sending stale model reminder email:", error);
      throw error;
    }
  }

  /**
   * Send a simple text email (fallback for basic notifications)
   */
  async sendSimpleEmail(
    config: EmailConfig & { html?: string; text?: string }
  ) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Simple email would be sent to",
        config.to,
        "with subject",
        config.subject
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      // Ensure we have either html or text content
      if (!config.html && !config.text) {
        throw new Error("Either html or text content must be provided");
      }

      const emailOptions: any = {
        from: this.fromEmail,
        to: [config.to],
        subject: config.subject,
      };

      if (config.html) {
        emailOptions.html = config.html;
      }
      if (config.text) {
        emailOptions.text = config.text;
      }

      const { data: result, error } =
        await this.resend.emails.send(emailOptions);

      if (error) {
        console.error("Failed to send simple email:", error);
        throw error;
      }

      console.log("Simple email sent successfully:", result?.id);
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error sending simple email:", error);
      throw error;
    }
  }

  /**
   * Send email to multiple recipients
   */
  async sendBulkEmail(
    config: Omit<EmailConfig, "to"> & {
      to: string[];
      html?: string;
      text?: string;
      react?: React.ReactElement;
    }
  ) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Bulk email would be sent to",
        config.to.length,
        "recipients with subject",
        config.subject
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      // Ensure we have content to send
      if (!config.html && !config.text && !config.react) {
        throw new Error("Either html, text, or react content must be provided");
      }

      const emailOptions: any = {
        from: this.fromEmail,
        to: config.to,
        subject: config.subject,
      };

      if (config.html) {
        emailOptions.html = config.html;
      }
      if (config.text) {
        emailOptions.text = config.text;
      }
      if (config.react) {
        emailOptions.react = config.react;
      }

      const { data: result, error } =
        await this.resend.emails.send(emailOptions);

      if (error) {
        console.error("Failed to send bulk email:", error);
        throw error;
      }

      console.log("Bulk email sent successfully:", result?.id);
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error sending bulk email:", error);
      throw error;
    }
  }

  /**
   * Test email service configuration
   */
  async testEmailService(testEmail: string) {
    if (this.isDevelopmentMode || !this.resend) {
      console.log(
        "🚧 DEVELOPMENT MODE: Test email would be sent to",
        testEmail
      );
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [testEmail],
        subject: "CharpstAR Email Service Test",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Email Service Test</h1>
            <p>This is a test email to verify that the CharpstAR email service is working correctly.</p>
            <p>If you received this email, the service is configured properly!</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        `,
      });

      if (error) {
        console.error("Email service test failed:", error);
        throw error;
      }

      console.log("Email service test successful:", result?.id);
      return { success: true, messageId: result?.id };
    } catch (error) {
      console.error("Error testing email service:", error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
