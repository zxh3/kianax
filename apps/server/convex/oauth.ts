import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCredentialType } from "@kianax/plugins";
import { resolveOAuth2Config, fetchOAuth2Token } from "./lib/oauth";

/**
 * Get provider configuration status.
 * Checks if the server has environment variables configured for this credential type.
 */
export const getProviderConfig = query({
  args: { typeId: v.string() },
  handler: async (_ctx, { typeId }) => {
    try {
      const config = resolveOAuth2Config(typeId);
      return {
        configured: true,
        clientId: config.clientId,
      };
    } catch {
      return { configured: false };
    }
  },
});

export const exchangeCode = action({
  args: {
    code: v.string(),
    credentialId: v.id("user_credentials"),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch the pending credential
    const credential = await ctx.runQuery(internal.credentials.getInternal, {
      id: args.credentialId,
    });

    if (!credential) {
      throw new Error("Credential not found");
    }

    const data = JSON.parse(credential.data);

    // 2. Get the definition
    const typeDef = getCredentialType(credential.typeId);
    if (!typeDef || typeDef.type !== "oauth2" || !typeDef.oauthConfig) {
      throw new Error("Invalid credential type for OAuth exchange");
    }

    // 3. Resolve Config from environment variables
    const { clientId, clientSecret } = resolveOAuth2Config(credential.typeId);

    const { tokenUrl, authMethod } = typeDef.oauthConfig;

    // 4. Exchange code
    const tokens = await fetchOAuth2Token({
      tokenUrl,
      authMethod,
      clientId,
      clientSecret,
      bodyParams: {
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: args.redirectUri,
      },
    });

    // 5. Update credential
    const newData = {
      ...data,
      ...tokens,
      refresh_token: tokens.refresh_token || data.refresh_token,
      expires_at: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    };

    await ctx.runMutation(internal.credentials.updateInternal, {
      id: args.credentialId,
      data: JSON.stringify(newData),
      metadata: { status: "active" },
    });

    return { success: true };
  },
});

/**
 * Get a valid access token for a credential.
 * Refreshes the token if it is expired.
 */
export const getAccessToken = action({
  args: {
    credentialId: v.id("user_credentials"),
  },
  handler: async (ctx, args) => {
    const credential = await ctx.runQuery(internal.credentials.getInternal, {
      id: args.credentialId,
    });

    if (!credential) {
      throw new Error("Credential not found");
    }

    const data = JSON.parse(credential.data);
    const { access_token, refresh_token, expires_at } = data;

    // If valid, return immediately
    if (
      access_token &&
      (!expires_at || Date.now() < expires_at - 5 * 60 * 1000)
    ) {
      return access_token;
    }

    if (!refresh_token) {
      // Can't refresh, just return what we have (or could throw)
      return access_token;
    }

    console.log(`Refreshing token for credential ${args.credentialId}`);

    // Refresh needed
    const typeDef = getCredentialType(credential.typeId);
    if (!typeDef || !typeDef.oauthConfig) {
      throw new Error("Invalid credential type definition");
    }

    // Resolve Config from environment variables
    const { clientId, clientSecret } = resolveOAuth2Config(credential.typeId);

    // Perform Refresh
    const tokens = await fetchOAuth2Token({
      tokenUrl: typeDef.oauthConfig.tokenUrl,
      authMethod: typeDef.oauthConfig.authMethod,
      clientId,
      clientSecret,
      bodyParams: {
        grant_type: "refresh_token",
        refresh_token,
      },
    });

    // Update DB
    const newData = {
      ...data,
      ...tokens,
      refresh_token: tokens.refresh_token || refresh_token,
      expires_at: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    };

    await ctx.runMutation(internal.credentials.updateInternal, {
      id: args.credentialId,
      data: JSON.stringify(newData),
    });

    return tokens.access_token;
  },
});
