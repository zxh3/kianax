"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@kianax/ui/components/card";
import { Input } from "@kianax/ui/components/input";
import { Button } from "@kianax/ui/components/button";
import { Avatar, AvatarFallback } from "@kianax/ui/components/avatar";
import { Badge } from "@kianax/ui/components/badge";
import { Send, Loader2 } from "lucide-react";

export default function Chat() {
  const [userName, setUserName] = useState("Guest");
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messages = useQuery(api.messages.getMessages);
  const sendMessage = useMutation(api.messages.sendMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  // biome-ignore lint: expected use of dependency
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({
        user: userName,
        body: messageBody,
      });
      setMessageBody("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="w-full flex flex-col p-6">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold">Welcome, {userName}!</h1>
        <p className="text-muted-foreground">
          Chat with your team in real-time
        </p>
        <div className="mt-4 flex gap-2 items-center">
          <Input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name..."
            className="max-w-xs"
          />
        </div>
      </div>

      <Card className="h-[600px] flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            {messages ? `${messages.length} messages` : "Loading..."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          <div className="flex-1 overflow-y-auto px-4" ref={scrollRef}>
            <div className="space-y-4 py-4">
              {messages ? (
                [...messages].reverse().map((msg) => {
                  const isMyMessage = msg.user === userName;
                  return (
                    <div
                      key={msg._id}
                      className={`flex gap-3 items-start ${isMyMessage ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {msg.user.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`flex-1 space-y-1 min-w-0 ${isMyMessage ? "items-end" : ""}`}
                      >
                        <div
                          className={`flex items-center gap-2 ${isMyMessage ? "flex-row-reverse" : ""}`}
                        >
                          <Badge
                            variant={isMyMessage ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {msg.user}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg._creationTime).toLocaleTimeString()}
                          </span>
                        </div>
                        <p
                          className={`text-sm break-words ${isMyMessage ? "text-right" : ""}`}
                        >
                          {msg.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading messages...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t flex-shrink-0"
          >
            <div className="flex gap-2">
              <Input
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isSending}
                className="flex-1"
              />
              <Button type="submit" disabled={isSending || !messageBody.trim()}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
