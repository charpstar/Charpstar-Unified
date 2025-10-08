import { Resend } from "resend";
import { render } from "@react-email/render";
import ModelReadyForReviewEmail from "@/components/emails/ModelReadyForReviewEmail";
import WeeklyStatusSummaryEmail from "@/components/emails/WeeklyStatusSummaryEmail";
import BatchCompletionEmail from "@/components/emails/BatchCompletionEmail";
import StaleModelReminderEmail from "@/components/emails/StaleModelReminderEmail";
import QaApprovalEmail from "@/components/emails/QaApprovalEmail";

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
    readyForReviewModels: number;
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

export interface QaApprovalData {
  clientName: string;
  modelName: string;
  approverName: string;
  approverRole: "QA Team" | "Admin Team";
  reviewLink: string;
  batch?: number;
  deadline?: string;
}

class EmailService {
  private fromEmail: string;
  private isDevelopmentMode: boolean;
  private resend: Resend | null;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || "noreply@mail.charpstar.co";
    // TODO: Change to false when ready to send real emails
    this.isDevelopmentMode = true; // Disabled - no emails will be sent

    // Always initialize Resend with the API key
    const apiKey =
      process.env.RESEND_API_KEY || "re_hZJVmsBL_ENod2pFAoB1W6jvFXCqGdBJT";
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send batch completion notification email
   */
  async sendBatchCompletion(data: BatchCompletionData, config: EmailConfig) {
    if (this.isDevelopmentMode || !this.resend) {
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send QA/Admin approval notification email to client
   */
  async sendQaApprovalNotification(data: QaApprovalData, config: EmailConfig) {
    if (this.isDevelopmentMode) {
      return { success: true, messageId: "dev-mode-simulated", devMode: true };
    }

    if (!this.resend) {
      return {
        success: false,
        messageId: null,
        error: "Resend client not initialized",
      };
    }

    try {
      const { data: result, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [config.to],
        subject:
          config.subject || `Model Approved for Review - ${data.modelName}`,
        html: await render(QaApprovalEmail(data)),
      });

      if (error) {
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test email service configuration
   */
  async testEmailService(testEmail: string) {
    if (this.isDevelopmentMode || !this.resend) {
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
        throw error;
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      throw error;
    }
  }
}

export const emailService = new EmailService();
