/**
 * Email Plugin (SendGrid) - Builder Pattern
 *
 * Send emails using SendGrid API.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";

const emailDataSchema = z.object({
  to: z
    .union([z.string().email(), z.array(z.string().email())])
    .describe("Recipient email address(es)"),
  from: z
    .string()
    .email()
    .optional()
    .describe("Sender email address (uses default if not provided)"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text content"),
  html: z.string().optional().describe("HTML content"),
  cc: z
    .union([z.string().email(), z.array(z.string().email())])
    .optional()
    .describe("CC recipients"),
  bcc: z
    .union([z.string().email(), z.array(z.string().email())])
    .optional()
    .describe("BCC recipients"),
  replyTo: z.string().email().optional().describe("Reply-to email address"),
});

const successSchema = z.object({
  success: z.boolean().describe("Whether the email was sent successfully"),
  messageId: z.string().optional().describe("SendGrid message ID"),
});

const errorSchema = z.object({
  success: z.boolean().describe("Whether the email was sent successfully"),
  error: z.string().describe("Error message"),
});

// Helper function to normalize email addresses to SendGrid format
function normalizeEmailAddresses(
  emails: string | string[],
): Array<{ email: string }> {
  const emailArray = Array.isArray(emails) ? emails : [emails];
  return emailArray.map((email) => ({ email }));
}

export const emailPlugin = createPlugin("email-sendgrid")
  .withMetadata({
    name: "Email (SendGrid)",
    description:
      "Send emails using SendGrid API with support for HTML content, attachments, and templates",
    version: "1.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["action"],
    icon: "📧",
  })
  .withCredentials([
    {
      key: "sendgridApiKey",
      label: "SendGrid API Key",
      description: "Your SendGrid API key (starts with SG.)",
      type: "password",
      required: true,
    },
  ])
  .withInput("email", {
    label: "Email Data",
    description: "Email content and recipients",
    schema: emailDataSchema,
  })
  .withOutput("success", {
    label: "Success",
    description: "Executed when email is sent successfully",
    schema: successSchema,
  })
  .withOutput("error", {
    label: "Error",
    description: "Executed when email sending fails",
    schema: errorSchema,
  })
  .withConfig(
    z.object({
      fromName: z.string().optional().describe("Default sender name"),
      defaultFrom: z
        .string()
        .email()
        .optional()
        .describe("Default from email address"),
    }),
  )
  .execute(async ({ inputs, config, context }) => {
    const input = inputs.email;
    const apiKey = context.credentials?.sendgridApiKey;

    if (!apiKey) {
      throw new Error(
        "SendGrid API key not found. Please configure your credentials.",
      );
    }

    // Validate content
    if (!input.text && !input.html) {
      throw new Error("Either text or html content is required");
    }

    // Determine from address
    const from = input.from || config.defaultFrom;
    if (!from) {
      throw new Error(
        "From address is required. Provide it in input or config.defaultFrom",
      );
    }

    try {
      // Build SendGrid request
      const personalizations = [
        {
          to: normalizeEmailAddresses(input.to),
          ...(input.cc && { cc: normalizeEmailAddresses(input.cc) }),
          ...(input.bcc && { bcc: normalizeEmailAddresses(input.bcc) }),
        },
      ];

      const mail = {
        personalizations,
        from: {
          email: from,
          ...(config.fromName && { name: config.fromName }),
        },
        subject: input.subject,
        content: [
          ...(input.text ? [{ type: "text/plain", value: input.text }] : []),
          ...(input.html ? [{ type: "text/html", value: input.html }] : []),
        ],
        ...(input.replyTo && {
          reply_to: {
            email: input.replyTo,
          },
        }),
      };

      // Send email via SendGrid API
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mail),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `SendGrid API error: ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.errors && errorJson.errors.length > 0) {
            errorMessage = errorJson.errors
              .map((e: any) => e.message)
              .join(", ");
          }
        } catch {
          // If error parsing fails, use the full error text
          errorMessage = errorText;
        }

        throw new Error(errorMessage);
      }

      // SendGrid returns 202 Accepted with message ID in headers
      const messageId = response.headers.get("x-message-id");

      return {
        success: {
          success: true,
          messageId: messageId || undefined,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return {
        error: {
          success: false,
          error: `Email send failed: ${errorMessage}`,
        },
      };
    }
  })
  .build();
