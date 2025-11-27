import { createPlugin, z } from "@kianax/plugin-sdk";
import { googleSheetsOAuth } from "../credentials/definitions/google-sheets";
import { GoogleSheetsConfigUI } from "./config-ui";

export const googleSheetsPlugin = createPlugin("google-sheets")
  .withMetadata({
    name: "Google Sheets",
    description: "Read, write, and modify Google Sheets.",
    version: "1.0.0",
    tags: ["api", "google", "sheets", "data"],
    icon: "📊",
  })
  .requireCredential(googleSheetsOAuth, "googleSheets")
  .withConfig(
    z.object({
      operation: z.enum(["read", "append", "clear"]).default("read"),
      spreadsheetId: z.string(),
      range: z.string(),
    }),
  )
  .withConfigUI(GoogleSheetsConfigUI)
  .withInput("data", {
    label: "Data",
    description:
      "Data to write/append (for write operations). Array of values.",
    schema: z.object({
      values: z.array(z.any()).optional(),
    }),
  })
  .withOutput("result", {
    label: "Result",
    schema: z.object({
      values: z.array(z.array(z.any())).optional(),
      updatedRange: z.string().optional(),
      updatedRows: z.number().optional(),
    }),
  })
  .execute(async ({ inputs, config, context }) => {
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
        values: [inputs.data.values || []],
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
        result: {
          values: result.values || [],
        },
      };
    } else if (operation === "append") {
      return {
        result: {
          updatedRange: result.updates?.updatedRange,
          updatedRows: result.updates?.updatedRows,
        },
      };
    }

    return { result: {} };
  })
  .build();
