"use client";

import { getAllCredentialTypes } from "@kianax/plugins";
import { Button } from "@kianax/ui/components/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@kianax/ui/components/card";
import { Key, Pencil, Trash2 } from "lucide-react";
import type { Id } from "@kianax/server/convex/_generated/dataModel";

interface CredentialCardProps {
  credential: {
    _id: Id<"user_credentials">;
    name: string;
    typeId: string;
  };
  onDelete: (id: Id<"user_credentials">) => void;
  onEdit?: (id: Id<"user_credentials">) => void;
}

export function CredentialCard({
  credential,
  onDelete,
  onEdit,
}: CredentialCardProps) {
  const credentialType = getAllCredentialTypes().find(
    (t) => t.id === credential.typeId,
  );
  const Icon = credentialType?.type === "oauth2" ? Key : Key;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <span>{credential.name}</span>
        </CardTitle>
        <CardDescription>
          {credentialType?.displayName || credential.typeId}
        </CardDescription>
        <CardAction>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onEdit?.(credential._id)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive/90"
              onClick={() => onDelete(credential._id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
