"use client";

import { Button } from "@kianax/ui/components/button";
import { Key } from "lucide-react";

interface EmptyCredentialsStateProps {
  onAddClick: () => void;
}

export function EmptyCredentialsState({
  onAddClick,
}: EmptyCredentialsStateProps) {
  return (
    <div className="lg:col-span-3 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <Key className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No credentials yet</h3>
      <p className="text-sm text-muted-foreground">
        Add your first credential to start using integrations.
      </p>
      <Button className="mt-4" onClick={onAddClick}>
        Add Credential
      </Button>
    </div>
  );
}
