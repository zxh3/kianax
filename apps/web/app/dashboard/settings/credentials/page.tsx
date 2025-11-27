"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import { Spinner } from "@kianax/ui/components/spinner";
import { toast } from "sonner";
import {
  CreateCredentialDialog,
  EditCredentialDialog,
  CredentialCard,
  EmptyCredentialsState,
} from "@/components/credentials";

export default function CredentialsPage() {
  const credentials = useQuery(api.credentials.list);
  const createCredential = useMutation(api.credentials.create);
  const updateCredential = useMutation(api.credentials.update);
  const removeCredential = useMutation(api.credentials.remove);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<{
    _id: Id<"user_credentials">;
    name: string;
    typeId: string;
  } | null>(null);

  const handleDelete = async (id: Id<"user_credentials">) => {
    try {
      await removeCredential({ id });
      toast.success("Credential removed");
    } catch (_error) {
      toast.error("Failed to remove credential");
    }
  };

  const handleEdit = (id: Id<"user_credentials">) => {
    const credential = credentials?.find((c) => c._id === id);
    if (credential) {
      setEditingCredential(credential);
    }
  };

  if (credentials === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credentials</h1>
          <p className="text-muted-foreground">
            Manage your API keys and connections.
          </p>
        </div>
        <CreateCredentialDialog
          createCredential={createCredential}
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {credentials.length === 0 ? (
          <EmptyCredentialsState
            onAddClick={() => setIsCreateDialogOpen(true)}
          />
        ) : (
          credentials.map((cred) => (
            <CredentialCard
              key={cred._id}
              credential={cred}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>

      <EditCredentialDialog
        credential={editingCredential}
        updateCredential={updateCredential}
        open={editingCredential !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCredential(null);
        }}
      />
    </div>
  );
}
