/**
 * resolving OAuth2 client configuration.
 *
 * Prioritizes environment variables (server-managed) over user-provided values.
 */
export function resolveOAuth2Config(
  typeId: string,
  userData: { clientId?: string; clientSecret?: string } = {},
) {
  const isGoogle = typeId.startsWith("google-");

  let clientId = userData.clientId;
  let clientSecret = userData.clientSecret;

  // Fallback to environment variables for known providers
  if (isGoogle && (!clientId || !clientSecret)) {
    clientId = process.env.GOOGLE_CLIENT_ID || clientId;
    clientSecret = process.env.GOOGLE_CLIENT_SECRET || clientSecret;
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing Client ID or Client Secret for credential type '${typeId}'. ` +
        "These must be provided either by the user or configured in server environment variables.",
    );
  }

  return { clientId, clientSecret };
}

/**
 * Helper to perform a standard OAuth2 Token Request.
 * Handles the fetch call, header construction, and error parsing.
 */
export async function fetchOAuth2Token(params: {
  tokenUrl: string;
  authMethod?: "header" | "body";
  clientId: string;
  clientSecret: string;
  bodyParams: Record<string, string>;
}) {
  const {
    tokenUrl,
    authMethod = "header",
    clientId,
    clientSecret,
    bodyParams,
  } = params;

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  const body = new URLSearchParams(bodyParams);

  if (authMethod === "body") {
    body.append("client_id", clientId);
    body.append("client_secret", clientSecret);
  } else {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${auth}`;
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth2 token request failed: ${text}`);
  }

  return await response.json();
}
