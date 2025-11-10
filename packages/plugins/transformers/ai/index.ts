/**
 * AI Transform Plugin
 *
 * Universal data transformer powered by OpenAI.
 * Transforms any input data according to natural language instructions.
 */

import { definePlugin, z } from "@kianax/plugin-sdk";
import OpenAI from "openai";

export const aiTransform = definePlugin({
  id: "ai-transform",
  name: "AI Transform",
  description:
    "Transform data using AI. Provide instructions in natural language and AI will transform the input accordingly.",
  version: "1.0.0",
  type: "processor",

  author: {
    name: "Kianax",
    url: "https://kianax.com",
  },

  inputSchema: z.object({
    data: z.unknown().describe("The data to transform"),
    instruction: z
      .string()
      .describe(
        "Natural language instruction for how to transform the data (e.g., 'Extract the email addresses', 'Summarize in bullet points')",
      ),
    outputFormat: z
      .enum(["json", "text", "array"])
      .optional()
      .default("json")
      .describe("Expected output format"),
  }),

  outputSchema: z.object({
    result: z.unknown().describe("The transformed data"),
    reasoning: z.string().optional().describe("AI's reasoning (if applicable)"),
  }),

  configSchema: z.object({
    model: z
      .enum(["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"])
      .optional()
      .default("gpt-3.5-turbo")
      .describe("OpenAI model to use"),
    temperature: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .default(0.7)
      .describe("Creativity level (0-2)"),
    maxTokens: z
      .number()
      .optional()
      .default(1000)
      .describe("Maximum response tokens"),
  }),

  credentials: [
    {
      key: "openaiApiKey",
      label: "OpenAI API Key",
      description: "Your OpenAI API key (starts with sk-)",
      type: "password",
      required: true,
    },
  ],

  tags: ["ai", "transform", "openai", "processor"],
  icon: "🤖",

  async execute(input, config, context) {
    const apiKey = context.credentials?.openaiApiKey;

    if (!apiKey) {
      throw new Error(
        "OpenAI API key not found. Please configure your credentials.",
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey,
    });

    // Build the prompt
    const systemPrompt = buildSystemPrompt(input.outputFormat);
    const userPrompt = buildUserPrompt(input.data, input.instruction);

    try {
      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No response from OpenAI");
      }

      // Parse response based on output format
      let result: unknown;

      if (input.outputFormat === "json") {
        try {
          result = JSON.parse(content);
        } catch (e) {
          // If JSON parsing fails, return as text
          result = content;
        }
      } else if (input.outputFormat === "array") {
        // Try to parse as JSON array, fallback to splitting lines
        try {
          const parsed = JSON.parse(content);
          result = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          result = content.split("\n").filter((line) => line.trim());
        }
      } else {
        result = content;
      }

      return {
        result,
        reasoning: response.choices[0]?.message?.content || undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI Transform failed: ${error.message}`);
      }
      throw error;
    }
  },
});

function buildSystemPrompt(outputFormat: string): string {
  const basePrompt =
    "You are a data transformation assistant. Your job is to transform input data according to the user's instructions.";

  switch (outputFormat) {
    case "json":
      return `${basePrompt} Return your response as valid JSON only, with no additional text or markdown formatting.`;
    case "array":
      return `${basePrompt} Return your response as a JSON array only, with no additional text or markdown formatting.`;
    case "text":
      return `${basePrompt} Return your response as plain text.`;
    default:
      return basePrompt;
  }
}

function buildUserPrompt(data: unknown, instruction: string): string {
  const dataStr =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return `Input data:\n${dataStr}\n\nInstruction: ${instruction}\n\nTransform the input data according to the instruction above.`;
}
