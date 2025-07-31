// Email Service using Supabase SMTP
import { supabase } from "./supabaseClient";

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // Use Supabase's built-in email functionality
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        },
      });

      if (error) {
        console.error("Supabase email function error:", error);
        return false;
      }

      console.log("Email sent successfully via Supabase to:", emailData.to);
      return true;
    } catch (error) {
      console.error("Failed to send email via Supabase:", error);
      return false;
    }
  }

  async sendAssetAllocationEmail(
    to: string,
    assetNames: string[],
    client: string,
    deadline: string,
    price: number,
    bonus: number
  ): Promise<boolean> {
    const subject = `New Assets Assigned - ${client}`;

    const html = `
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
            <p>You have been assigned <strong>${assetNames.length} new asset(s)</strong> for <strong>${client}</strong>.</p>
            
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

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  async sendAssetCompletedEmail(
    to: string,
    assetName: string,
    client: string
  ): Promise<boolean> {
    const subject = `Asset Approved - ${assetName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Asset Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: white; padding: 20px; border-radius: 8px; }
          .highlight { background: #d1ecf1; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #155724;">✅ Asset Approved!</h1>
            <p style="margin: 10px 0 0 0; color: #6c757d;">Great work! Your asset has been approved.</p>
          </div>
          
          <div class="content">
            <h2>Congratulations!</h2>
            <p>Your asset <strong>"${assetName}"</strong> for <strong>${client}</strong> has been approved!</p>
            
            <div class="highlight">
              <h3 style="margin: 0 0 10px 0;">🎉 Approval Details</h3>
              <p><strong>Asset:</strong> ${assetName}</p>
              <p><strong>Client:</strong> ${client}</p>
              <p><strong>Status:</strong> Approved ✅</p>
              <p><strong>Approved Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>This approval will be reflected in your earnings and completion statistics. Keep up the excellent work!</p>
            
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

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  async sendRevisionEmail(
    to: string,
    assetName: string,
    client: string
  ): Promise<boolean> {
    const subject = `Revision Required - ${assetName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Revision Required</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: white; padding: 20px; border-radius: 8px; }
          .highlight { background: #f8d7da; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #856404;">⚠️ Revision Required</h1>
            <p style="margin: 10px 0 0 0; color: #6c757d;">Your asset needs some updates.</p>
          </div>
          
          <div class="content">
            <h2>Revision Request</h2>
            <p>Your asset <strong>"${assetName}"</strong> for <strong>${client}</strong> requires revisions.</p>
            
            <div class="highlight">
              <h3 style="margin: 0 0 10px 0;">📝 Revision Details</h3>
              <p><strong>Asset:</strong> ${assetName}</p>
              <p><strong>Client:</strong> ${client}</p>
              <p><strong>Status:</strong> Ready for Revision ⚠️</p>
              <p><strong>Revision Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>Please review the feedback provided and make the necessary updates to your work. Once you've completed the revisions, you can resubmit the asset for review.</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/my-assignments" class="button">
              View My Assignments
            </a>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from Charpstar Unified.</p>
            <p>If you have any questions about the revision requirements, please contact your project manager.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();
