/**
 * HTTP Request Plugin (Flow-Based)
 *
 * Make HTTP requests to external APIs and services.
 * All request parameters come through config expressions.
 *
 * Control flow node with success/error routing:
 * - Success: 2xx responses route to "success" handle
 * - Error: 4xx, 5xx, network errors route to "error" handle
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import { HttpRequestConfigUI } from "./config-ui";

/**
 * HTTP methods enum
 */
const HttpMethod = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]);

/**
 * Success response schema
 */
const SuccessResponseSchema = z.object({
  status: z.number().describe("HTTP status code (200-299)"),
  statusText: z.string().describe("HTTP status text"),
  data: z.unknown().describe("Response data (parsed JSON or raw text)"),
  headers: z.record(z.string(), z.string()).describe("Response headers"),
});

/**
 * Error response schema
 */
const ErrorResponseSchema = z.object({
  status: z.number().describe("HTTP status code"),
  statusText: z.string().describe("HTTP status text"),
  message: z.string().describe("Error message"),
  data: z.unknown().optional().describe("Response body if available"),
});

export const httpRequestPlugin = createPlugin("http-request")
  .withMetadata({
    name: "HTTP Request",
    description:
      "Make HTTP requests to external APIs with support for all standard methods, custom headers, query parameters, and request bodies.",
    version: "3.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["action", "data-source"],
    icon: "🌐",
  })
  .withConfig(
    z.object({
      // Request parameters (can be expressions)
      url: z.string().describe("The URL to send the request to"),
      method: HttpMethod.default("GET").describe("HTTP method"),
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe("Request headers (key-value pairs)"),
      body: z
        .unknown()
        .optional()
        .describe("Request body (auto-serialized to JSON for POST/PUT/PATCH)"),
      queryParams: z
        .record(z.string(), z.string())
        .optional()
        .describe("URL query parameters (key-value pairs)"),

      // Behavior config
      timeout: z
        .number()
        .min(100)
        .max(300000)
        .default(30000)
        .describe("Request timeout in milliseconds (100ms - 5min)"),
      retries: z
        .number()
        .min(0)
        .max(5)
        .default(0)
        .describe("Number of retry attempts on failure (0-5)"),
      retryDelay: z
        .number()
        .min(0)
        .max(10000)
        .default(1000)
        .describe("Delay between retries in milliseconds"),
      followRedirects: z
        .boolean()
        .default(true)
        .describe("Automatically follow HTTP 3xx redirects"),
    }),
  )
  // Control flow handles for routing
  .withOutputHandles([
    {
      name: "success",
      label: "Success",
      description: "Successful response (2xx status codes)",
    },
    {
      name: "error",
      label: "Error",
      description: "Error response (4xx, 5xx, network errors, timeouts)",
    },
  ])
  .withOutput("success", {
    label: "Success",
    description: "Successful response (2xx status codes)",
    schema: SuccessResponseSchema,
  })
  .withOutput("error", {
    label: "Error",
    description: "Error response (4xx, 5xx, network errors, timeouts)",
    schema: ErrorResponseSchema,
  })
  .withConfigUI(HttpRequestConfigUI)
  .execute(async ({ config }) => {
    const { url: baseUrl, method, headers, body, queryParams } = config;

    try {
      // Build URL with query parameters
      const url = new URL(baseUrl);
      if (queryParams) {
        for (const [key, value] of Object.entries(queryParams)) {
          url.searchParams.append(key, String(value));
        }
      }

      // Build request headers
      const requestHeaders: Record<string, string> = {
        ...(body && method !== "GET" && method !== "HEAD"
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers,
      };

      // Build fetch options
      const options: RequestInit = {
        method,
        headers: requestHeaders,
        redirect: config.followRedirects ? "follow" : "manual",
      };

      // Add body for methods that support it
      if (body && method !== "GET" && method !== "HEAD") {
        options.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      // Retry logic with exponential backoff
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= config.retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        try {
          const response = await fetch(url.toString(), {
            ...options,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Parse response body
          let data: unknown;
          const contentType = response.headers.get("content-type");

          if (contentType?.includes("application/json")) {
            data = await response.json();
          } else if (contentType?.includes("text/")) {
            data = await response.text();
          } else {
            data = await response.text(); // Fallback to text
          }

          // Build response headers map
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          // Return based on HTTP status
          if (response.ok) {
            return {
              success: {
                status: response.status,
                statusText: response.statusText,
                data,
                headers: responseHeaders,
              },
            };
          }

          // Non-2xx response (don't retry client errors)
          if (response.status >= 400 && response.status < 500) {
            return {
              error: {
                status: response.status,
                statusText: response.statusText,
                message: `HTTP ${response.status}: ${response.statusText}`,
                data,
              },
            };
          }

          // 5xx server error - will retry if configured
          lastError = new Error(
            `HTTP ${response.status}: ${response.statusText}`,
          );
        } catch (err) {
          clearTimeout(timeoutId);
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        // Wait before retry (exponential backoff)
        if (attempt < config.retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, config.retryDelay * 2 ** attempt),
          );
        }
      }

      // All retries exhausted
      throw (
        lastError ||
        new Error(`Request failed after ${config.retries + 1} attempts`)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout = message.includes("aborted");

      return {
        error: {
          status: 0,
          statusText: isTimeout ? "Timeout" : "Error",
          message: isTimeout
            ? `Request timed out after ${config.timeout}ms`
            : `Request failed: ${message}`,
        },
      };
    }
  })
  .build();
