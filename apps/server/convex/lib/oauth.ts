/**
 * Resolves OAuth2 client configuration from environment variables.
 * Throws if the required environment variables are not configured.
 */
export function resolveOAuth2Config(typeId: string) {
  const isGoogle = typeId.startsWith("google-");

  let clientId: string | undefined;
  let clientSecret: string | undefined;

  if (isGoogle) {
    clientId = process.env.GOOGLE_CLIENT_ID;
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      `OAuth not configured for '${typeId}'. ` +
        "Please set the required environment variables (e.g., GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).",
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
