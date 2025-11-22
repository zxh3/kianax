/**
 * HTTP Request Plugin (Builder Pattern)
 *
 * Make HTTP requests to any API or webhook endpoint.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";

const requestSchema = z.object({
  url: z.string().url().describe("The URL to send the request to"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .optional()
    .default("GET")
    .describe("HTTP method"),
  headers: z
    .record(z.string())
    .optional()
    .describe("Custom headers (key-value pairs)"),
  body: z
    .unknown()
    .optional()
    .describe("Request body (will be JSON stringified for POST/PUT/PATCH)"),
  queryParams: z
    .record(z.string())
    .optional()
    .describe("Query parameters (key-value pairs)"),
});

const responseSchema = z.object({
  success: z.boolean().describe("Whether the request succeeded"),
  status: z.number().describe("HTTP status code"),
  statusText: z.string().describe("HTTP status text"),
  data: z.unknown().optional().describe("Response data"),
  headers: z.record(z.string()).optional().describe("Response headers"),
});

const errorSchema = z.object({
  success: z.boolean().describe("Whether the request succeeded"),
  status: z.number().describe("HTTP status code"),
  statusText: z.string().describe("HTTP status text"),
  error: z.string().describe("Error message"),
});

export const httpRequestPlugin = createPlugin("http-request")
  .withMetadata({
    name: "HTTP Request",
    description:
      "Make HTTP requests (GET, POST, PUT, DELETE) to any API endpoint with custom headers, body, and authentication",
    version: "1.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["action", "data-source"],
    icon: "🌐",
  })
  .withInput("request", {
    label: "Request",
    description: "HTTP request parameters",
    schema: requestSchema,
  })
  .withOutput("success", {
    label: "Success",
    description: "Executed when request succeeds",
    schema: responseSchema,
  })
  .withOutput("error", {
    label: "Error",
    description: "Executed when request fails",
    schema: errorSchema,
  })
  .withConfig(
    z.object({
      timeout: z
        .number()
        .optional()
        .default(30000)
        .describe("Request timeout in milliseconds"),
      retries: z
        .number()
        .optional()
        .default(0)
        .describe("Number of retries on failure"),
      followRedirects: z
        .boolean()
        .optional()
        .default(true)
        .describe("Follow HTTP redirects"),
    }),
  )
  .execute(async ({ inputs, config }) => {
    const input = inputs.request;

    try {
      // Build URL with query parameters
      const url = new URL(input.url);
      if (input.queryParams) {
        Object.entries(input.queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value as string);
        });
      }

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...input.headers,
      };

      // Build fetch options
      const options: RequestInit = {
        method: input.method,
        headers,
        redirect: config.followRedirects ? "follow" : "manual",
      };

      // Add body for POST/PUT/PATCH
      if (
        input.body &&
        (input.method === "POST" ||
          input.method === "PUT" ||
          input.method === "PATCH")
      ) {
        options.body =
          typeof input.body === "string"
            ? input.body
            : JSON.stringify(input.body);
      }

      // Make request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        let response: Response;
        let lastError: Error | undefined;

        // Retry logic
        for (let attempt = 0; attempt <= config.retries; attempt++) {
          try {
            response = await fetch(url.toString(), {
              ...options,
              signal: controller.signal,
            });

            // If successful or non-retryable status, break
            if (response.ok || response.status < 500) {
              clearTimeout(timeoutId);

              // Parse response
              let data: unknown;
              const contentType = response.headers.get("content-type");

              if (contentType?.includes("application/json")) {
                data = await response.json();
              } else {
                data = await response.text();
              }

              // Build response headers object
              const responseHeaders: Record<string, string> = {};
              response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
              });

              if (response.ok) {
                return {
                  success: {
                    success: true,
                    status: response.status,
                    statusText: response.statusText,
                    data,
                    headers: responseHeaders,
                  },
                };
              } else {
                return {
                  error: {
                    success: false,
                    status: response.status,
                    statusText: response.statusText,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                  },
                };
              }
            }

            lastError = new Error(
              `HTTP ${response.status}: ${response.statusText}`,
            );
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            // If not the last attempt, wait before retry
            if (attempt < config.retries) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (attempt + 1)),
              );
            }
          }
        }

        // All retries failed
        throw lastError || new Error("Request failed after all retries");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        error: {
          success: false,
          status: 0,
          statusText: "Error",
          error: `HTTP Request failed: ${errorMessage}`,
        },
      };
    }
  })
  .build();
