import { createPlugin, z } from "@kianax/plugin-sdk";
import OpenAI from "openai";
import { openaiApi } from "../credentials/definitions/openai-api";
import { OpenAIConfigUI } from "./config-ui";

export const openaiMessagePlugin = createPlugin("openai-message")
  .withMetadata({
    name: "OpenAI Chat",
    description: "Generate a chat completion using OpenAI GPT models.",
    version: "1.0.0",
    tags: ["llm"],
    icon: "🤖",
  })
  .requireCredential(openaiApi)
  .withConfig(
    z.object({
      model: z.string().default("gpt-4o"),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().optional(),
    }),
  )
  .withConfigUI(OpenAIConfigUI)
  .withInput("prompt", {
    label: "Prompt",
    description: "The user message to send to the model.",
    schema: z.object({
      message: z.string(),
      systemPrompt: z.string().optional(),
    }),
  })
  .withOutput("response", {
    label: "Response",
    description: "The generated text response.",
    schema: z.object({
      text: z.string(),
      usage: z
        .object({
          prompt_tokens: z.number(),
          completion_tokens: z.number(),
          total_tokens: z.number(),
        })
        .optional(),
    }),
  })
  .execute(async ({ inputs, config, context }) => {
    // Access the resolved credential
    // The key matches the credential ID passed to requireCredential
    const credential = context.credentials?.["openai-api"]; // Now strongly typed!

    if (!credential?.apiKey) {
      throw new Error(
        "OpenAI API Key is missing. Please check your credential configuration.",
      );
    }

    const openai = new OpenAI({
      apiKey: credential.apiKey,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (inputs.prompt.systemPrompt) {
      messages.push({ role: "system", content: inputs.prompt.systemPrompt });
    }

    messages.push({ role: "user", content: inputs.prompt.message });

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
      response: {
        text: choice.message.content || "",
        usage: completion.usage,
      },
    };
  })
  .build();
