// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { IconArrowUp, IconRobot, IconUser } from "@tabler/icons-react";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@kianax/ui/components/badge";

export function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: "/api/chat",
      maxSteps: 5,
    });

  const chatBubbles = useMemo(() => {
    return messages.map((m) => (
      <div key={m.id} className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          {m.role === "user" ? (
            <IconUser className="size-6 text-primary flex-shrink-0 mt-1" />
          ) : (
            <IconRobot className="size-6 text-muted-foreground flex-shrink-0 mt-1" />
          )}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <p className="font-semibold text-sm">
              {m.role === "user" ? "You" : "AI"}
            </p>
            {m.content && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {m.content}
              </p>
            )}

            {/* Tool Invocations */}
            {m.toolInvocations?.map((toolInvocation) => {
              const { toolName, toolCallId, state } = toolInvocation;

              if (state === "result") {
                const { result } = toolInvocation;

                if (toolName === "createRoutine") {
                  return (
                    <div
                      key={toolCallId}
                      className="p-3 border border-border rounded-md bg-muted/30 mt-2"
                    >
                      <p className="text-sm font-medium mb-2">
                        {result.message}
                      </p>
                      {result.routineId && (
                        <Link
                          href={`/dashboard/routines/${result.routineId}/edit`}
                        >
                          <Button variant="outline" size="sm">
                            Open Routine Editor
                          </Button>
                        </Link>
                      )}
                    </div>
                  );
                }

                if (toolName === "searchRoutines") {
                  return (
                    <div
                      key={toolCallId}
                      className="p-3 border border-border rounded-md bg-muted/30 mt-2"
                    >
                      <p className="text-sm font-medium mb-2">
                        Found Routines:
                      </p>
                      <div className="flex flex-col gap-2">
                        {result.routines?.length > 0 ? (
                          result.routines.map((r: any) => (
                            <Link
                              key={r.id}
                              href={`/dashboard/routines/${r.id}/edit`}
                              className="text-sm text-primary hover:underline block truncate"
                            >
                              {r.name}
                            </Link>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No routines found.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                // Generic feedback for other tools
                return (
                  <div
                    key={toolCallId}
                    className="p-2 border border-border rounded-md bg-muted/30 mt-1 text-xs text-muted-foreground flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Action: {toolName} completed.
                  </div>
                );
              } else {
                return (
                  <div
                    key={toolCallId}
                    className="p-2 border border-border rounded-md bg-muted/30 mt-1 text-xs text-muted-foreground flex items-center gap-2 animate-pulse"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Running {toolName}...
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>
    ));
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col h-full bg-background">
      <ScrollArea className="flex-1 p-6">
        <div className="flex flex-col gap-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center py-12">
              <IconRobot className="size-12 mb-4" />
              <p className="text-lg font-medium">
                How can I help you build a routine today?
              </p>
              <p className="text-sm">
                Try: "Create a routine to monitor BTC price every hour and email
                me if it drops 5%."
              </p>
            </div>
          )}
          {chatBubbles}
          {isLoading && (
            <div className="flex items-center gap-3">
              <IconRobot className="size-6 text-muted-foreground flex-shrink-0" />
              <div className="flex flex-col">
                <p className="font-semibold text-sm">AI</p>
                <Badge variant="outline" className="animate-pulse">
                  Typing...
                </Badge>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-3 text-destructive">
              <IconRobot className="size-6 flex-shrink-0" />
              <div className="flex flex-col">
                <p className="font-semibold text-sm">AI Error</p>
                <p className="text-sm">{error.message}</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t bg-card flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Describe your routine..."
          className="flex-1"
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading}>
          <IconArrowUp className="size-4 mr-2" />
          Send
        </Button>
      </form>
    </div>
  );
}
