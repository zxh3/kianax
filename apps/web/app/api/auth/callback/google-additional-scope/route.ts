import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@kianax/server/convex/_generated/api";
import { ConvexError } from "convex/values";
import { Id } from "@kianax/server/convex/_generated/dataModel";

// TODO: Fix this route for accessing additional scopes for plugins
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // This is our credentialId
  const errorParam = searchParams.get("error");

  const redirectBase = `${request.nextUrl.origin}/dashboard/settings/credentials`;

  if (errorParam) {
    console.error("OAuth error received:", errorParam);
    return NextResponse.redirect(
      `${redirectBase}?status=error&message=${errorParam}`,
    );
  }

  if (!code || !state) {
    console.error("Missing code or state in OAuth callback");
    return NextResponse.redirect(
      `${redirectBase}?status=error&message=Missing OAuth code or state`,
    );
  }

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("Convex URL not configured");
    }
    const convex = new ConvexHttpClient(convexUrl);

    // Call the backend action to exchange the code for tokens
    await convex.action(api.oauth.exchangeCode, {
      code,
      credentialId: state as Id<"user_credentials">,
      redirectUri: `${request.nextUrl.origin}/api/auth/callback/google`, // Must match what was sent
    });

    console.log(`Successfully exchanged code for credential: ${state}`);
    return NextResponse.redirect(`${redirectBase}?status=success`);
  } catch (error: any) {
    console.error("Error exchanging OAuth code:", error);
    let message = "Unknown error during OAuth exchange";
    if (error instanceof ConvexError) {
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.redirect(
      `${redirectBase}?status=error&message=${encodeURIComponent(message)}`,
    );
  }
}
