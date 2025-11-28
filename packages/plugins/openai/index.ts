/**
 * OpenAI Chat Plugin (Flow-Based)
 *
 * Generate chat completions using OpenAI GPT models.
 * All inputs come through config expressions.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import OpenAI from "openai";
import { openaiApi } from "../credentials/definitions/openai-api";
import { OpenAIConfigUI } from "./config-ui";

/**
 * Output schema for OpenAI response
 */
const OutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional()
    .describe("Token usage statistics"),
});

export const openaiMessagePlugin = createPlugin("openai-message")
  .withMetadata({
    name: "OpenAI Chat",
    description: "Generate a chat completion using OpenAI GPT models.",
    version: "2.0.0",
    tags: ["llm"],
    icon: "🤖",
  })
  .requireCredential(openaiApi)
  .withConfig(
    z.object({
      // Model configuration
      model: z.string().default("gpt-4o").describe("OpenAI model to use"),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .default(0.7)
        .describe("Sampling temperature (0-2)"),
      maxTokens: z.number().optional().describe("Maximum tokens to generate"),

      // Runtime data (via expressions)
      message: z.string().describe("The user message to send to the model"),
      systemPrompt: z
        .string()
        .optional()
        .describe("Optional system prompt for context"),
    }),
  )
  .withOutputSchema(OutputSchema)
  .withConfigUI(OpenAIConfigUI)
  .execute(async ({ config, context }) => {
    // Access the resolved credential
    const credential = context.credentials?.["openai-api"];

    if (!credential?.apiKey) {
      throw new Error(
        "OpenAI API Key is missing. Please check your credential configuration.",
      );
    }

    const openai = new OpenAI({
      apiKey: credential.apiKey,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // System prompt from config (may be from expression)
    if (config.systemPrompt) {
      messages.push({ role: "system", content: config.systemPrompt });
    }

    // User message from config (from expression: {{ nodes.upstream.output }})
    messages.push({ role: "user", content: config.message });

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    const choice = completion.choices[0];

    if (!choice) {
      throw new Error("No completion choice returned from OpenAI.");
    }

    return {
      output: {
        text: choice.message.content || "",
        usage: completion.usage,
      },
    };
  })
  .build();
