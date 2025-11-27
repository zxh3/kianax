"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { getAllCredentialTypes, type CredentialType } from "@kianax/plugins";
import { useState } from "react";
import { Button } from "@kianax/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@kianax/ui/components/sheet";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@kianax/ui/components/card";
import { Loader2, Plus, Trash2, Key } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

export default function CredentialsPage() {
  const credentials = useQuery(api.credentials.list);
  const createCredential = useMutation(api.credentials.create);
  const removeCredential = useMutation(api.credentials.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await removeCredential({ id: id as any });
      toast.success("Credential removed");
    } catch (_error) {
      toast.error("Failed to remove credential");
    }
  };

  if (credentials === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {credentials.length === 0 ? (
          <div className="lg:col-span-3 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No credentials yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first credential to start using integrations.
            </p>
            <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Credential
            </Button>
          </div>
        ) : (
          credentials.map((cred: any) => {
            const credentialType = getAllCredentialTypes().find(
              (t) => t.id === cred.typeId,
            );
            const Icon = credentialType?.type === "oauth2" ? Key : Key; // More specific icons can be added to CredentialType later

            return (
              <Card key={cred._id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span>{cred.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {credentialType?.displayName || cred.typeId}
                  </CardDescription>
                  <CardAction>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {/* <Edit className="h-4 w-4" /> */}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/90"
                        onClick={() => handleDelete(cred._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    ID: {cred._id}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function CreateCredentialDialog({
  createCredential,
  open,
  onOpenChange,
}: {
  createCredential: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const credentialTypes = getAllCredentialTypes();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [name, setName] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = credentialTypes.find((t) => t.id === selectedTypeId);

  // Fetch provider config (e.g. Google Client ID) from server
  const providerConfig = useQuery(
    api.oauth.getProviderConfig,
    selectedTypeId ? { typeId: selectedTypeId } : "skip",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;

    setIsSubmitting(true);
    try {
      // Validate using Zod
      const validData = selectedType.schema.parse(formData);

      if (selectedType.type === "oauth2" && selectedType.oauthConfig) {
        // 1. Create PENDING credential with user inputs (Client ID/Secret)
        const credentialId = await createCredential({
          typeId: selectedType.id,
          name: name || selectedType.displayName,
          data: JSON.stringify(validData),
          metadata: { status: "pending_oauth" },
        });

        // 2. Construct Auth URL
        // Note: We use the current origin for the callback
        const redirectUri = `${window.location.origin}/api/auth/callback/google`;
        const authUrl = new URL(
          selectedType.oauthConfig.authorizationUrl || "",
        );

        authUrl.searchParams.set("response_type", "code");

        // Map known fields or expect strict naming in schema
        // Cast validData to any to access potential clientId property
        const data = validData as any;

        // Use server-provided Client ID if available, otherwise use user input
        const clientId =
          providerConfig?.configured && providerConfig?.clientId
            ? providerConfig.clientId
            : data.clientId;

        if (clientId) {
          authUrl.searchParams.set("client_id", clientId as string);
        } else {
          throw new Error(
            "Client ID is missing. Please provide it or configure it on the server.",
          );
        }

        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set(
          "scope",
          selectedType.oauthConfig.scopes.join(" "),
        );

        // State carries the credential ID to update later
        authUrl.searchParams.set("state", credentialId);

        // Force offline access to get refresh token
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        // 3. Redirect
        window.location.href = authUrl.toString();
        return;
      }

      await createCredential({
        typeId: selectedType.id,
        name: name || selectedType.displayName,
        data: JSON.stringify(validData),
        metadata: {},
      });
      toast.success("Credential created");
      onOpenChange(false);
      // Reset form
      setName("");
      setFormData({});
      setSelectedTypeId("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(
          `Validation failed: ${error.issues?.[0]?.message || error.message}`,
        );
      } else {
        toast.error(`Failed to create credential: ${error.message}`);
      }
    } finally {
      // Only stop submitting if we didn't redirect (which returns early)
      if (selectedType.type !== "oauth2") {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Credential
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto overflow-x-auto">
        <SheetHeader>
          <SheetTitle>Add Credential</SheetTitle>
          <SheetDescription>Connect a new service to Kianax.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={selectedTypeId}
              onValueChange={(v) => {
                setSelectedTypeId(v);
                setFormData({});
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

          {selectedType && (
            <>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="My API Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Dynamic Form Fields */}
              {generateFormFields(
                selectedType,
                formData,
                setFormData,
                providerConfig,
              )}
            </>
          )}

          <SheetFooter>
            <Button type="submit" disabled={isSubmitting || !selectedType}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {selectedType?.type === "oauth2"
                ? providerConfig?.configured
                  ? "Sign in with Provider"
                  : "Connect"
                : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function generateFormFields(
  type: CredentialType,
  formData: Record<string, string>,
  setFormData: (data: Record<string, string>) => void,
  providerConfig?: { configured: boolean; clientId?: string } | null,
) {
  // Introspect Zod schema to generate inputs

  if (!(type.schema instanceof z.ZodObject)) {
    return (
      <p className="text-destructive">
        Unsupported schema type (must be ZodObject)
      </p>
    );
  }

  const shape = type.schema.shape;

  // If configured by server, skip rendering Client ID/Secret inputs
  const isConfigured = providerConfig?.configured;

  if (isConfigured && type.type === "oauth2") {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-sm text-muted-foreground text-center">
        <p>Configuration provided by server.</p>
        <p>Click below to authenticate.</p>
      </div>
    );
  }

  return Object.entries(shape).map(([key, schema]: [string, any]) => {
    const isPassword = type.maskedFields?.includes(key);
    // Basic Label derivation
    const label =
      key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          type={isPassword ? "password" : "text"}
          value={formData[key] || ""}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          required={!schema.isOptional()}
        />
      </div>
    );
  });
}
