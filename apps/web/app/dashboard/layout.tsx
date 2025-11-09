"use client";
import { ConvexClientProvider } from "@kianax/web/components/providers/ConvexClientProvider";
import withProvider from "@kianax/web/components/providers/with-provider";
import { authClient } from "@kianax/web/lib/auth-client";
import { Redirect } from "@kianax/web/components/redirect";
import { Loader2 } from "lucide-react";

const DashboardLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const { data: user, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
};

export default withProvider(ConvexClientProvider)(DashboardLayout);
