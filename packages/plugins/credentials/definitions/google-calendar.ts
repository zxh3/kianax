import { z } from "zod";
import type { CredentialType } from "@kianax/plugin-sdk";

export const googleCalendarOAuth = {
  id: "google-calendar-oauth",
  displayName: "Google Calendar",
  type: "oauth2",
  documentationUrl: "https://developers.google.com/calendar/api/guides/auth",
  schema: z.object({
    clientId: z.string().describe("Client ID from Google Cloud Console"),
    clientSecret: z
      .string()
      .describe("Client Secret from Google Cloud Console"),
  }),
  maskedFields: ["clientSecret"],
  oauthConfig: {
    grantType: "authorization_code",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar"],
    authMethod: "body",
  },
} satisfies CredentialType;
