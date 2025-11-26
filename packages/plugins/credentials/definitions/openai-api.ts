import { z } from "zod";
import type { CredentialType } from "@kianax/plugin-sdk";

export const openaiApi = {
  id: "openai-api",
  displayName: "OpenAI API",
  type: "simple",
  documentationUrl:
    "https://platform.openai.com/docs/api-reference/authentication",
  schema: z.object({
    apiKey: z.string().min(1, "API Key is required"),
  }),
  maskedFields: ["apiKey"],
} satisfies CredentialType;
