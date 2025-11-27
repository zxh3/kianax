# OAuth2 Credential System Flow

This document outlines how OAuth2 credentials are configured, authorized, and used within the Kianax plugin system.

## Overview

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant F as Frontend
    participant C as Convex Backend
    participant P as OAuth Provider
    participant W as Temporal Worker

    Note over U,W: Phase 1: Configuration
    U->>F: Open "Add Credential"
    F->>C: getProviderConfig(typeId)
    C-->>F: {configured, clientId?}

    Note over U,W: Phase 2: Authorization
    U->>F: Click "Connect"
    F->>C: credentials.create (pending)
    C-->>F: credentialId
    F->>F: Build auth URL with state=credentialId
    F->>P: Redirect to authorization URL
    U->>P: Grant permission
    P->>F: Redirect to /api/auth/callback/google

    Note over U,W: Phase 3: Token Exchange
    F->>C: oauth.exchangeCode(code, credentialId)
    C->>C: Resolve clientId/secret (env > user)
    C->>P: POST /token (authorization_code)
    P-->>C: {access_token, refresh_token}
    C->>C: Store tokens, status=active
    C-->>F: Success
    F->>U: Redirect to credentials page

    Note over U,W: Phase 4: Runtime Execution
    W->>C: oauth.getAccessToken(credentialId)
    C->>C: Check token expiry
    alt Token expired
        C->>C: Resolve clientId/secret
        C->>P: POST /token (refresh_token)
        P-->>C: New access_token
        C->>C: Update stored tokens
    end
    C-->>W: access_token
    W->>W: Inject into plugin context
```

## Detailed Flow

### 1. Configuration Check

When a user opens the credential dialog, the frontend queries the server to check if OAuth client credentials are configured via environment variables.

```mermaid
flowchart LR
    A[User selects credential type] --> B{Server configured?}
    B -->|Yes| C[Show 'Sign in with Provider']
    B -->|No| D[Show error message]
    C --> E[User clicks button]
```

**Code path:** `credentials/page.tsx` → `api.oauth.getProviderConfig`

### 2. Authorization Flow

The frontend creates a pending credential record, then redirects the user to the OAuth provider with a specially crafted URL.

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `response_type` | `code` | Request authorization code |
| `client_id` | From server or user | Identify the application |
| `redirect_uri` | `/api/auth/callback/google` | Where to return after auth |
| `scope` | Defined per credential type | Requested permissions |
| `state` | `credentialId` | Link callback to pending record |
| `access_type` | `offline` | Request refresh token |
| `prompt` | `consent` | Force consent screen |

### 3. Token Exchange

After the user grants permission, the provider redirects back with an authorization code. The Next.js API route handles this callback server-side for security.

```mermaid
flowchart TD
    A[Callback received] --> B{Has error?}
    B -->|Yes| C[Redirect with error]
    B -->|No| D[Extract code + state]
    D --> E[Call oauth.exchangeCode]
    E --> F[Fetch pending credential]
    F --> G[Load client config from env vars]
    G --> H[POST to token endpoint]
    H --> I[Store tokens in DB]
    I --> J[Set status = active]
    J --> K[Redirect to settings]
```

**Code path:** `/api/auth/callback/google` → `api.oauth.exchangeCode` → `lib/oauth.ts`

### 4. Runtime Token Retrieval

When a workflow executes a plugin requiring OAuth credentials, the system automatically handles token refresh.

```mermaid
flowchart TD
    A[Plugin needs credential] --> B[getAccessToken]
    B --> C{Token valid?}
    C -->|Yes| D[Return access_token]
    C -->|No, expired| E{Has refresh_token?}
    E -->|No| F[Return stale token]
    E -->|Yes| G[Resolve client config]
    G --> H[POST refresh request]
    H --> I[Update DB with new tokens]
    I --> D
    D --> J[Inject into plugin context]
```

**Expiry buffer:** Tokens are refreshed 5 minutes before actual expiry to prevent mid-execution failures.

## Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `CreateCredentialDialog` | `apps/web/.../credentials/page.tsx` | UI for adding credentials, adapts based on server config |
| `/api/auth/callback/google` | `apps/web/app/api/auth/callback/google/route.ts` | Server-side OAuth callback handler |
| `oauth.exchangeCode` | `apps/server/convex/oauth.ts` | Exchanges auth code for tokens |
| `oauth.getAccessToken` | `apps/server/convex/oauth.ts` | Retrieves/refreshes tokens at runtime |
| `resolveOAuth2Config` | `apps/server/convex/lib/oauth.ts` | Loads client credentials from env vars |
| `fetchOAuth2Token` | `apps/server/convex/lib/oauth.ts` | Generic OAuth2 token endpoint caller |

## Configuration

OAuth client credentials must be configured via environment variables:

| Provider | Environment Variables |
|----------|----------------------|
| Google (Calendar, Sheets, etc.) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

If the required environment variables are not set, users will see an error message and cannot add OAuth credentials.

For self-hosted deployments, administrators must:
1. Create an OAuth app in the provider's developer console (e.g., Google Cloud Console)
2. Set the redirect URI to `https://your-domain.com/api/auth/callback/google`
3. Add the client credentials to the server environment variables
