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

export interface GoogleSheetsConfig {
  operation: "read" | "append" | "clear";
  spreadsheetId: string;
  range: string;
}

interface GoogleSheetsConfigUIProps {
  value?: GoogleSheetsConfig;
  onChange: (value: GoogleSheetsConfig) => void;
}

export function GoogleSheetsConfigUI({
  value,
  onChange,
}: GoogleSheetsConfigUIProps) {
  const defaultConfig: GoogleSheetsConfig = {
    operation: "read",
    spreadsheetId: "",
    range: "Sheet1!A1:B10",
  };

  const [config, setConfig] = useState<GoogleSheetsConfig>(
    value || defaultConfig,
  );

  const handleChange = (updates: Partial<GoogleSheetsConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <BaseConfigUI>
      <ConfigSection
        label="Operation"
        description="Select the operation to perform."
      >
        <Select
          value={config.operation}
          onValueChange={(val) =>
            handleChange({ operation: val as GoogleSheetsConfig["operation"] })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select operation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="read">Read Range</SelectItem>
            <SelectItem value="append">Append Row</SelectItem>
            <SelectItem value="clear">Clear Range</SelectItem>
          </SelectContent>
        </Select>
      </ConfigSection>

      <ConfigSection
        label="Spreadsheet ID"
        description="The ID of the spreadsheet (from the URL)."
      >
        <Input
          value={config.spreadsheetId}
          onChange={(e) => handleChange({ spreadsheetId: e.target.value })}
          placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
        />
      </ConfigSection>

      <ConfigSection
        label="Range"
        description="The A1 notation of the range (e.g., Sheet1!A1:B2)."
      >
        <Input
          value={config.range}
          onChange={(e) => handleChange({ range: e.target.value })}
          placeholder="Sheet1!A1"
        />
      </ConfigSection>

      <InfoCard title="Credential Required" variant="warning">
        <p>
          This plugin requires a <strong>Google Sheets</strong> credential.
          Ensure you have connected your Google account in the settings.
        </p>
      </InfoCard>
    </BaseConfigUI>
  );
}
