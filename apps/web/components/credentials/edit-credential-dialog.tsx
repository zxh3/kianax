"use client";

import { useEffect } from "react";
import { getAllCredentialTypes } from "@kianax/plugins";
import { Button } from "@kianax/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kianax/ui/components/dialog";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import { toast } from "sonner";
import { Spinner } from "@kianax/ui/components/spinner";
import { useForm, useStore } from "@tanstack/react-form";
import type { Id } from "@kianax/server/convex/_generated/dataModel";

interface EditCredentialDialogProps {
  credential: {
    _id: Id<"user_credentials">;
    name: string;
    typeId: string;
  } | null;
  updateCredential: (args: {
    id: Id<"user_credentials">;
    name: string;
  }) => Promise<unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCredentialDialog({
  credential,
  updateCredential,
  open,
  onOpenChange,
}: EditCredentialDialogProps) {
  const credentialTypes = getAllCredentialTypes();
  const credentialType = credentialTypes.find(
    (t) => t.id === credential?.typeId,
  );

  const form = useForm({
    defaultValues: {
      name: credential?.name || "",
    },
    onSubmit: async ({ value }) => {
      if (!credential) return;

      try {
        await updateCredential({
          id: credential._id,
          name: value.name,
        });
        toast.success("Credential updated");
        onOpenChange(false);
      } catch (error: unknown) {
        if (error instanceof Error) {
          toast.error(`Failed to update credential: ${error.message}`);
        } else {
          toast.error("Failed to update credential");
        }
      }
    },
  });

  // Reset form when credential changes
  useEffect(() => {
    if (credential) {
      form.setFieldValue("name", credential.name);
    }
  }, [credential, form]);

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Credential</DialogTitle>
          <DialogDescription>
            Update the name for this{" "}
            {credentialType?.displayName || "credential"}.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Type</Label>
            <Input
              value={credentialType?.displayName || credential?.typeId || ""}
              disabled
              className="bg-muted"
            />
          </div>

          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="My API Key"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                />
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
