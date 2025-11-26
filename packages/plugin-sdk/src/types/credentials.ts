import type { z } from "zod";

/**
 * Configuration for OAuth2 authentication flow.
 */
export interface OAuth2Config {
  /** The OAuth2 grant type */
  grantType: "authorization_code" | "client_credentials";

  /** URL to redirect the user to for authorization (required for authorization_code) */
  authorizationUrl?: string;

  /** URL to exchange the code for a token */
  tokenUrl: string;

  /** Scopes to request */
  scopes: string[];

  /**
   * How to authenticate with the token endpoint.
   * Defaults to 'header' (Basic Auth with Client ID/Secret).
   * 'body' sends client_id/secret in the POST body.
   */
  authMethod?: "header" | "body";
}

/**
 * Definition of a Credential Type.
 * This defines the shape of the data required for authentication.
 */
export interface CredentialType<TSchema extends z.ZodType = z.ZodType> {
  /** Unique identifier for this credential type (e.g. "openai-api") */
  id: string;

  /** Human-readable name (e.g. "OpenAI API") */
  displayName: string;

  /** Documentation URL */
  documentationUrl?: string;

  /**
   * The authentication flow type.
   * - 'simple': User manually enters all data defined in 'schema'.
   * - 'oauth2': User enters setup data (clientId, secret) from 'schema', then goes through OAuth flow.
   * Defaults to 'simple' if undefined.
   */
  type?: "simple" | "oauth2";

  /**
   * Zod schema defining the fields required from the user.
   * For 'simple': apiKey, username/password, etc.
   * For 'oauth2': clientId, clientSecret, etc. (The tokens are stored separately).
   */
  schema: TSchema;

  /**
   * Optional: Fields to mask in the UI (passwords, tokens).
   * These keys usually correspond to fields in the schema.
   */
  maskedFields?: string[];

  /** Configuration for OAuth2 flow. Required if type is 'oauth2'. */
  oauthConfig?: OAuth2Config;
}

/**
 * A request for a credential by a plugin.
 */
export interface CredentialRequest {
  /** The ID of the CredentialType required */
  id: string;

  /** Optional: If the plugin needs to rename/alias the credential in its context */
  alias?: string;

  /** Whether this credential is strictly required for the plugin to function. Defaults to true. */
  required?: boolean;
}
