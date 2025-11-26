import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCredentialType } from "@kianax/plugins";

export const exchangeCode = action({
  args: {
    code: v.string(),
    credentialId: v.id("user_credentials"),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Fetch the pending credential to get client ID/secret
    const credential = await ctx.runQuery(internal.credentials.getInternal, {
      id: args.credentialId,
    });

    if (!credential) {
      throw new Error("Credential not found");
    }

    // Ensure we own this credential (although ID is unguessable, good practice)
    // But we are in an action, we can't check `requireAuthUser` easily against the credential's userId
    // without passing the user ID. But since `getInternal` returns it, we trust the query.
    // A robust check would be checking if ctx.auth.getUser() matches credential.userId.
    // For now, we assume possessing the unguessable credentialID (passed via state) is sufficient proof of flow ownership.

    const data = JSON.parse(credential.data); // Contains clientId, clientSecret

    // 2. Get the definition
    const typeDef = getCredentialType(credential.typeId);
    if (!typeDef || typeDef.type !== "oauth2" || !typeDef.oauthConfig) {
      throw new Error("Invalid credential type for OAuth exchange");
    }

    const { tokenUrl, authMethod } = typeDef.oauthConfig;

    // 3. Exchange code
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", args.code);
    body.append("redirect_uri", args.redirectUri);

    // Auth method
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    if (authMethod === "body") {
      body.append("client_id", data.clientId);
      body.append("client_secret", data.clientSecret);
    } else {
      // Header (Basic Auth)
      const auth = Buffer.from(
        `${data.clientId}:${data.clientSecret}`,
      ).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokens = await response.json();

    // 4. Update credential
    // Merge tokens into data
    const newData = {
      ...data,
      ...tokens,
      // Calculate expiry if provided (expires_in is usually seconds)
      expires_at: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    };

    await ctx.runMutation(internal.credentials.updateInternal, {
      id: args.credentialId,
      data: JSON.stringify(newData),
      metadata: { status: "active" }, // Clear pending status
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
    const { access_token, refresh_token, expires_at, clientId, clientSecret } =
      data;

    // If not OAuth or no expiry, just return what we have (or handle error)
    if (!refresh_token) {
      return access_token;
    }

    // Check if expired (buffer of 5 minutes)
    if (expires_at && Date.now() < expires_at - 5 * 60 * 1000) {
      return access_token;
    }

    console.log(`Refreshing token for credential ${args.credentialId}`);

    // Refresh needed
    const typeDef = getCredentialType(credential.typeId);
    if (!typeDef || !typeDef.oauthConfig) {
      throw new Error("Invalid credential type definition");
    }
    const { tokenUrl } = typeDef.oauthConfig;

    const body = new URLSearchParams();
    body.append("grant_type", "refresh_token");
    body.append("refresh_token", refresh_token);
    body.append("client_id", clientId);
    body.append("client_secret", clientSecret);

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const tokens = await response.json();

    // Update DB
    const newData = {
      ...data,
      ...tokens,
      // If refresh token is rotated, use new one, else keep old
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
