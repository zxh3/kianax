import { z } from "zod";
import type { CredentialType } from "@kianax/plugin-sdk";

export const googleSheetsOAuth = {
  id: "google-sheets-oauth",
  displayName: "Google Sheets",
  type: "oauth2",
  documentationUrl:
    "https://developers.google.com/sheets/api/guides/authorizing",
  schema: z.object({
    clientId: z
      .string()
      .describe("Client ID from Google Cloud Console")
      .optional(),
    clientSecret: z
      .string()
      .describe("Client Secret from Google Cloud Console")
      .optional(),
  }),
  runtimeSchema: z.object({
    access_token: z.string(),
  }),
  maskedFields: ["clientSecret"],
  oauthConfig: {
    grantType: "authorization_code",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    authMethod: "body",
  },
} satisfies CredentialType;
