"use client";

import { Textarea } from "@kianax/ui/components/textarea";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  return (
    <div className="flex flex-col h-[calc(80vh)] p-4 pt-16">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 font-mono text-sm"
        placeholder="Edit workflow JSON here..."
      />
    </div>
  );
}
