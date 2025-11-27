import type { CredentialType } from "@kianax/plugin-sdk";

const credentials = new Map<string, CredentialType>();

export function registerCredential(credential: CredentialType) {
  if (credentials.has(credential.id)) {
    throw new Error(
      `Credential type with ID '${credential.id}' already registered.`,
    );
  }
  credentials.set(credential.id, credential);
}

export function getCredentialType(id: string): CredentialType | undefined {
  return credentials.get(id);
}

export function getAllCredentialTypes(): CredentialType[] {
  return Array.from(credentials.values());
}

import { openaiApi } from "./definitions/openai-api";
import { googleCalendarOAuth } from "./definitions/google-calendar";
import { googleSheetsOAuth } from "./definitions/google-sheets";

registerCredential(openaiApi);
registerCredential(googleCalendarOAuth);
registerCredential(googleSheetsOAuth);
