"use client";

import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { getAllCredentialTypes, type CredentialType } from "@kianax/plugins";
import { Button } from "@kianax/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@kianax/ui/components/dialog";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { z } from "zod";
import { toast } from "sonner";
import { Spinner } from "@kianax/ui/components/spinner";
import { useForm, useStore } from "@tanstack/react-form";

interface CreateCredentialDialogProps {
  createCredential: (args: {
    typeId: string;
    name: string;
    data: string;
    metadata: Record<string, unknown>;
  }) => Promise<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormValues {
  typeId: string;
  name: string;
  data: Record<string, string>;
}

export function CreateCredentialDialog({
  createCredential,
  open,
  onOpenChange,
}: CreateCredentialDialogProps) {
  const credentialTypes = getAllCredentialTypes();

  const form = useForm({
    defaultValues: {
      typeId: "",
      name: "",
      data: {},
    } as FormValues,
    onSubmit: async ({ value }) => {
      const selectedType = credentialTypes.find((t) => t.id === value.typeId);
      if (!selectedType) return;

      try {
        // Validate using Zod
        const validData = selectedType.schema.parse(value.data);

        if (selectedType.type === "oauth2" && selectedType.oauthConfig) {
          // 1. Create PENDING credential with user inputs
          const credentialId = await createCredential({
            typeId: selectedType.id,
            name: value.name || selectedType.displayName,
            data: JSON.stringify(validData),
            metadata: { status: "pending_oauth" },
          });

          // 2. Construct Auth URL
          const redirectUri = `${window.location.origin}/api/auth/callback/google`;
          const authUrl = new URL(
            selectedType.oauthConfig.authorizationUrl || "",
          );

          authUrl.searchParams.set("response_type", "code");

          // Use server-provided Client ID (validated in UI)
          const providerConfigValue = providerConfig;
          if (
            !providerConfigValue?.configured ||
            !providerConfigValue?.clientId
          ) {
            throw new Error(
              "OAuth not configured. Please contact your administrator.",
            );
          }

          authUrl.searchParams.set("client_id", providerConfigValue.clientId);
          authUrl.searchParams.set("redirect_uri", redirectUri);
          authUrl.searchParams.set(
            "scope",
            selectedType.oauthConfig.scopes.join(" "),
          );
          authUrl.searchParams.set("state", credentialId);
          authUrl.searchParams.set("access_type", "offline");
          authUrl.searchParams.set("prompt", "consent");

          // 3. Redirect
          window.location.href = authUrl.toString();
          return;
        }

        await createCredential({
          typeId: selectedType.id,
          name: value.name || selectedType.displayName,
          data: JSON.stringify(validData),
          metadata: {},
        });
        toast.success("Credential created");
        onOpenChange(false);
        form.reset();
      } catch (error: unknown) {
        if (error instanceof z.ZodError) {
          toast.error(
            `Validation failed: ${error.issues?.[0]?.message || error.message}`,
          );
        } else if (error instanceof Error) {
          toast.error(`Failed to create credential: ${error.message}`);
        } else {
          toast.error("Failed to create credential");
        }
      }
    },
    validators: {
      onChange: z.object({
        typeId: z.string().min(1, "Type is required"),
        name: z.string().min(1, "Name is required"),
        data: z.record(z.string(), z.string()),
      }),
    },
    onSubmitInvalid: (errors) => {
      console.log(errors);
    },
  });

  const selectedTypeId = useStore(form.store, (state) => state.values.typeId);
  const formData = useStore(form.store, (state) => state.values.data);
  const selectedType = credentialTypes.find((t) => t.id === selectedTypeId);

  // Fetch provider config (e.g. Google Client ID) from server
  const providerConfig = useQuery(
    api.oauth.getProviderConfig,
    selectedTypeId ? { typeId: selectedTypeId } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Credential</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Credential</DialogTitle>
          <DialogDescription>
            Connect a new service to Kianax.
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
          <form.Field name="typeId">
            {(field) => (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => {
                    field.handleChange(v);
                    // Reset data when type changes
                    form.setFieldValue("data", {});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {credentialTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          {selectedType && (
            <>
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

              <DynamicCredentialFields
                type={selectedType}
                providerConfig={providerConfig}
                formData={formData}
                onFieldChange={(key, value) => {
                  form.setFieldValue("data", (prev) => ({
                    ...prev,
                    [key]: value,
                  }));
                }}
              />
            </>
          )}

          <DialogFooter>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !selectedType ||
                    (selectedType?.type === "oauth2" &&
                      !providerConfig?.configured)
                  }
                >
                  {isSubmitting && <Spinner className="size-4" />}
                  {selectedType?.type === "oauth2"
                    ? `Sign in with ${selectedType.displayName}`
                    : "Save"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DynamicCredentialFieldsProps {
  type: CredentialType;
  providerConfig?: { configured: boolean; clientId?: string } | null;
  formData: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
}

function DynamicCredentialFields({
  type,
  providerConfig,
  formData,
  onFieldChange,
}: DynamicCredentialFieldsProps) {
  if (providerConfig === undefined) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-sm text-muted-foreground text-center">
        <Spinner className="mx-auto" />
      </div>
    );
  }

  // For OAuth2 types, no form fields needed - just show sign-in prompt
  if (type.type === "oauth2") {
    if (providerConfig?.configured) {
      return (
        <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-sm text-muted-foreground text-center">
          <p>Click below to sign in with {type.displayName}.</p>
        </div>
      );
    }
    return (
      <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30 text-sm text-destructive text-center">
        <p>OAuth not configured.</p>
        <p>Please contact your administrator.</p>
      </div>
    );
  }

  // For non-OAuth types, introspect Zod schema to generate form inputs
  // Check if schema has a shape property (indicating it's a ZodObject)
  const schemaAny = type.schema as unknown as {
    shape?: Record<string, unknown>;
  };
  if (!schemaAny.shape || typeof schemaAny.shape !== "object") {
    return (
      <p className="text-destructive">
        Unsupported schema type (must be ZodObject)
      </p>
    );
  }

  const shape = schemaAny.shape;

  return (
    <>
      {Object.entries(shape).map(([key, schema]: [string, unknown]) => {
        const isPassword = type.maskedFields?.includes(key);
        const label =
          key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
        const isRequired =
          typeof (schema as { isOptional?: () => boolean }).isOptional ===
          "function"
            ? !(schema as { isOptional: () => boolean }).isOptional()
            : true;

        return (
          <div key={key} className="space-y-2">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              type={isPassword ? "password" : "text"}
              value={formData[key] || ""}
              onChange={(e) => onFieldChange(key, e.target.value)}
              required={isRequired}
            />
          </div>
        );
      })}
    </>
  );
}
