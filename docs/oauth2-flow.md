# OAuth2 Credential System Flow

This document outlines the end-to-end flow of how OAuth2 credentials are configured, authorized, and used within the Kianax plugin system.

```mermaid
flowchart TD
    subgraph Configuration [1. User Configuration]
        Start(User opens "Add Credential") --> FetchConfig[Frontend fetches Server Config]
        FetchConfig --> CheckConfig{Server Configured?}
        
        CheckConfig -- Yes --> ShowSignIn[Show "Sign in with Provider"]
        CheckConfig -- No --> ShowInputs[Show Client ID/Secret Inputs]
        
        ShowInputs --> UserInput[User Enters Credentials]
        UserInput --> ClickConnect[User Clicks "Connect"]
        ShowSignIn --> ClickConnect
    end

    subgraph Authorization [2. Authorization Flow]
        ClickConnect --> ConstructURL[Frontend Constructs Auth URL]
        ConstructURL --> Redirect[Redirect to Provider e.g. Google]
        Redirect --> UserAuth[User Grants Permission]
        UserAuth --> Callback[Redirect to /api/auth/callback/google]
    end

    subgraph Exchange [3. Token Exchange Backend]
        Callback --> ExchangeAction[Call api.oauth.exchangeCode]
        ExchangeAction --> ResolveConfig[Resolve Client ID/Secret]
        
        ResolveConfig -- Env Vars --> UseServerCreds[Use Server Env Vars]
        ResolveConfig -- User Input --> UseUserCreds[Use User Provided Creds]
        
        UseServerCreds --> TokenRequest[Request Tokens from Provider]
        UseUserCreds --> TokenRequest
        
        TokenRequest --> ReceiveTokens[Receive Access & Refresh Tokens]
        ReceiveTokens --> EncryptStore[Encrypt & Store in DB]
        EncryptStore --> RedirectSuccess[Redirect User to Settings]
    end

    subgraph Execution [4. Runtime Execution]
        Workflow[Workflow Execution] --> ExecuteActivity[Activity: executePlugin]
        ExecuteActivity --> CheckReqs[Check Credential Requirements]
        CheckReqs --> FetchCred[Call api.credentials.getForExecution]
        
        FetchCred --> Decrypt[Decrypt Stored Credential]
        Decrypt --> CheckExpiry{Token Expired?}
        
        CheckExpiry -- No --> ReturnToken[Return Access Token]
        CheckExpiry -- Yes --> RefreshFlow[Refresh Logic]
        
        RefreshFlow --> ResolveRefreshConfig[Resolve Client ID/Secret for Refresh]
        ResolveRefreshConfig --> RefreshRequest[Request New Token using Refresh Token]
        RefreshRequest --> UpdateDB[Update DB with New Token]
        UpdateDB --> ReturnToken
        
        ReturnToken --> Inject[Inject into Plugin Context]
        Inject --> PluginCode[Execute Plugin Logic]
    end
```

## Key Components

1.  **Frontend (`CreateCredentialDialog`)**: Handles the initial setup UI. It adapts based on whether the server has pre-configured environment variables (`GOOGLE_CLIENT_ID`, etc.).
2.  **Backend Callback (`/api/auth/callback/google`)**: A Next.js API route that bridges the gap between the OAuth provider redirect and the Convex backend.
3.  **Convex Actions (`api.oauth.exchangeCode`, `api.oauth.getAccessToken`)**: 
    *   `exchangeCode`: Swaps the temporary authorization code for persistent tokens.
    *   `getAccessToken`: Retrieves and *automatically refreshes* tokens at runtime, ensuring plugins always have valid access.
4.  **Worker Activity (`executePlugin`)**: The runtime component that orchestrates fetching the secure credential and passing it to the plugin code.
