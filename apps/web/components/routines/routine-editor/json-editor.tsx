"use client";

import { Textarea } from "@kianax/ui/components/textarea";
import type { ReactNode } from "react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}

export function JsonEditor({ value, onChange, children }: JsonEditorProps) {
  return (
    <div className="relative flex flex-col h-[calc(100vh-100px)] w-full">
      {children}
      <div className="flex flex-col h-full p-4 pt-16">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-sm"
          placeholder="Edit workflow JSON here..."
        />
      </div>
    </div>
  );
}
