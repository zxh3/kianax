"use client";

import { Button } from "@kianax/ui/components/button";
import { authClient } from "@kianax/web/lib/auth-client";
import { LogOut } from "lucide-react";

interface SignOutProps {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function SignOut({
  variant = "ghost",
  size = "default",
  showIcon = true,
  children,
}: SignOutProps) {
  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  return (
    <Button onClick={handleSignOut} variant={variant} size={size}>
      {showIcon && <LogOut className="h-4 w-4" />}
      {children || "Sign out"}
    </Button>
  );
}
