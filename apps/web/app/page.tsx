"use client";

import { SignIn } from "@kianax/web/components/auth/sign-in";
import { authClient } from "@kianax/web/lib/auth-client";
import { Redirect } from "@kianax/web/components/redirect";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: user, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <SignIn />;
}
