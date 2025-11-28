/**
 * Google Sheets Plugin (Flow-Based)
 *
 * Read, write, and modify Google Sheets.
 * All inputs come through config expressions.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import { googleSheetsOAuth } from "../credentials/definitions/google-sheets";
import { GoogleSheetsConfigUI } from "./config-ui";

/**
 * Output schema for Google Sheets operations
 */
const OutputSchema = z.object({
  values: z
    .array(z.array(z.any()))
    .optional()
    .describe("Cell values (for read operations)"),
  updatedRange: z.string().optional().describe("Updated range (for write ops)"),
  updatedRows: z.number().optional().describe("Number of updated rows"),
});

export const googleSheetsPlugin = createPlugin("google-sheets")
  .withMetadata({
    name: "Google Sheets",
    description: "Read, write, and modify Google Sheets.",
    version: "2.0.0",
    tags: ["api", "google", "sheets", "data"],
    icon: "📊",
  })
  .requireCredential(googleSheetsOAuth, "googleSheets")
  .withConfig(
    z.object({
      // Operation config
      operation: z
        .enum(["read", "append", "clear"])
        .default("read")
        .describe("Operation to perform"),
      spreadsheetId: z.string().describe("Google Sheets spreadsheet ID"),
      range: z.string().describe("Cell range (e.g., 'Sheet1!A1:B10')"),

      // Runtime data (via expressions) - for append operation
      values: z
        .array(z.any())
        .optional()
        .describe("Values to append (for append operation)"),
    }),
  )
  .withOutputSchema(OutputSchema)
  .withConfigUI(GoogleSheetsConfigUI)
  .execute(async ({ config, context }) => {
    const token = context.credentials?.googleSheets?.access_token;

    if (!token) {
      throw new Error("Missing Google Sheets access token");
    }

    const baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
    const { spreadsheetId, range, operation } = config;

    let url = `${baseUrl}/${spreadsheetId}/values/${range}`;
    let method = "GET";
    let body: string | undefined;

    if (operation === "read") {
      // Default GET
    } else if (operation === "append") {
      url = `${baseUrl}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
      method = "POST";
      body = JSON.stringify({
        values: [config.values || []],
      });
    } else if (operation === "clear") {
      url = `${baseUrl}/${spreadsheetId}/values/${range}:clear`;
      method = "POST";
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Sheets API error: ${error}`);
    }

    const result = await response.json();

    if (operation === "read") {
      return {
        output: {
          values: result.values || [],
        },
      };
    } else if (operation === "append") {
      return {
        output: {
          updatedRange: result.updates?.updatedRange,
          updatedRows: result.updates?.updatedRows,
        },
      };
    }

    return { output: {} };
  })
  .build();
