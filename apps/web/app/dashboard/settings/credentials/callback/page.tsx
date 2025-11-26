"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@kianax/ui/components/card";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const exchangeCode = useAction(api.oauth.exchangeCode);
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [error, setError] = useState("");
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state"); // credentialId
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setStatus("error");
      setError(errorParam);
      processedRef.current = true;
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setError("Missing code or state parameter");
      processedRef.current = true;
      return;
    }

    processedRef.current = true;

    const redirectUri = `${window.location.origin}/dashboard/settings/credentials/callback`;

    exchangeCode({
      code,
      credentialId: state as any,
      redirectUri,
    })
      .then(() => {
        setStatus("success");
        setTimeout(() => {
          router.push("/dashboard/settings/credentials");
        }, 2000);
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, [searchParams, exchangeCode, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>Connecting Service...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {status === "processing" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Exchanging tokens...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="font-medium text-green-600">
                Success! Redirecting...
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-destructive">{error}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
