"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@kianax/ui/components/dialog";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { Label } from "@kianax/ui/components/label";
import { Textarea } from "@kianax/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kianax/ui/components/select";
import { toast } from "sonner";

interface Routine {
  _id: Id<"routines">;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "archived";
  tags?: string[];
}

interface EditRoutineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine | null;
}

export function EditRoutineModal({
  open,
  onOpenChange,
  routine,
}: EditRoutineModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<
    "draft" | "active" | "paused" | "archived"
  >("draft");
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const updateRoutine = useMutation(api.routines.update);

  // Populate form when routine changes
  useEffect(() => {
    if (routine) {
      setName(routine.name);
      setDescription(routine.description || "");
      setStatus(routine.status);
      setTags(routine.tags || []);
    }
  }, [routine]);

  const handleSave = async () => {
    if (!routine) return;

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      await updateRoutine({
        id: routine._id,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        tags: tags.length > 0 ? tags : undefined,
      });

      toast.success("Routine updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update routine");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSaving) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Routine</DialogTitle>
          <DialogDescription>
            Update the basic information for this routine
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Routine name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this routine do?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value: any) => setStatus(value)}
            >
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tags">Tags (comma separated)</Label>
            <Input
              id="edit-tags"
              value={tags.join(", ")}
              onChange={(e) =>
                setTags(
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
              placeholder="tag1, tag2, tag3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
