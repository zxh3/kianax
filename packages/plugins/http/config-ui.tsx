"use client";

import { useState } from "react";
import { Input } from "@kianax/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { BaseConfigUI, ConfigSection, InfoCard } from "../ui";

export interface HttpRequestConfig {
  // Request parameters (via expressions in flow-based system)
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;

  // Behavior config
  timeout: number;
  retries: number;
  retryDelay: number;
  followRedirects: boolean;
}

interface HttpRequestConfigUIProps {
  value?: HttpRequestConfig;
  onChange: (value: HttpRequestConfig) => void;
}

/**
 * Configuration UI for HTTP Request Plugin
 *
 * Configures request behavior: timeouts, retries, and redirect handling.
 * Note: The actual request parameters (URL, method, headers, body) are
 * provided as inputs at runtime, not configured here.
 */
export function HttpRequestConfigUI({
  value,
  onChange,
}: HttpRequestConfigUIProps) {
  const defaultConfig: HttpRequestConfig = {
    // Request parameters - typically set via expressions in NodeConfigDrawer
    url: "",
    method: "GET",
    headers: undefined,
    body: undefined,
    queryParams: undefined,
    // Behavior config
    timeout: 30000,
    retries: 0,
    retryDelay: 1000,
    followRedirects: true,
  };

  const [config, setConfig] = useState<HttpRequestConfig>(
    value || defaultConfig,
  );

  const handleChange = (updates: Partial<HttpRequestConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  // Validation helpers
  const timeoutError =
    config.timeout < 100 || config.timeout > 300000
      ? "Timeout must be between 100ms and 300000ms (5 minutes)"
      : undefined;

  const retriesError =
    config.retries < 0 || config.retries > 5
      ? "Retries must be between 0 and 5"
      : undefined;

  const retryDelayError =
    config.retryDelay < 0 || config.retryDelay > 10000
      ? "Retry delay must be between 0ms and 10000ms"
      : undefined;

  return (
    <BaseConfigUI>
      <ConfigSection
        label="Timeout"
        description="Maximum time to wait for a response (milliseconds)"
        error={timeoutError}
      >
        <Input
          type="number"
          value={String(config.timeout)}
          onChange={(e) => handleChange({ timeout: Number(e.target.value) })}
          placeholder="30000"
          min={100}
          max={300000}
          step={1000}
        />
      </ConfigSection>

      <ConfigSection
        label="Retries"
        description="Number of retry attempts on failure (0-5)"
        error={retriesError}
      >
        <Input
          type="number"
          value={String(config.retries)}
          onChange={(e) => handleChange({ retries: Number(e.target.value) })}
          placeholder="0"
          min={0}
          max={5}
          step={1}
        />
      </ConfigSection>

      {config.retries > 0 && (
        <ConfigSection
          label="Retry Delay"
          description="Delay between retries in milliseconds (exponential backoff applied)"
          error={retryDelayError}
        >
          <Input
            type="number"
            value={String(config.retryDelay)}
            onChange={(e) =>
              handleChange({ retryDelay: Number(e.target.value) })
            }
            placeholder="1000"
            min={0}
            max={10000}
            step={100}
          />
        </ConfigSection>
      )}

      <ConfigSection
        label="Follow Redirects"
        description="Automatically follow HTTP 3xx redirects"
      >
        <Select
          value={String(config.followRedirects)}
          onValueChange={(val) =>
            handleChange({ followRedirects: val === "true" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes, follow redirects</SelectItem>
            <SelectItem value="false">No, return redirect response</SelectItem>
          </SelectContent>
        </Select>
      </ConfigSection>

      <InfoCard title="How It Works">
        <div className="space-y-2">
          <p>
            This plugin makes HTTP requests to external APIs. The request
            parameters (URL, method, headers, body) are provided by upstream
            nodes at runtime.
          </p>
          <p>
            These settings control{" "}
            <strong className="text-foreground">how</strong> requests are made
            (timeouts, retries, redirects).
          </p>
        </div>
      </InfoCard>

      {config.retries > 0 && (
        <InfoCard title="Retry Behavior" variant="warning">
          <div className="space-y-2">
            <p>
              <strong className="text-foreground">Exponential Backoff:</strong>{" "}
              Retry delays double with each attempt ({config.retryDelay}ms,{" "}
              {config.retryDelay * 2}ms, {config.retryDelay * 4}ms, ...)
            </p>
            <p>
              <strong className="text-foreground">Client Errors:</strong> 4xx
              responses are NOT retried (only 5xx server errors)
            </p>
          </div>
        </InfoCard>
      )}

      <InfoCard title="Output Ports" variant="success">
        <div className="space-y-1">
          <p>
            <strong className="text-emerald-600 dark:text-emerald-400">
              Success:
            </strong>{" "}
            2xx responses with status, data, and headers
          </p>
          <p>
            <strong className="text-destructive">Error:</strong> 4xx/5xx
            responses, network errors, or timeouts
          </p>
        </div>
      </InfoCard>
    </BaseConfigUI>
  );
}
