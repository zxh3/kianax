"use client";

import { useState, useId } from "react";
import { useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { IconArrowLeft, IconArrowRight, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";

interface CreateRoutineWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TriggerType = "manual" | "cron" | "webhook" | "event";
type RoutineStatus = "draft" | "active";

interface RoutineFormData {
  name: string;
  description: string;
  tags: string[];
  status: RoutineStatus;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  selectedPlugins: string[];
}

const STEPS = [
  { id: 1, title: "Basic Info", description: "Name and description" },
  { id: 2, title: "Trigger", description: "How to run this routine" },
  { id: 3, title: "Plugins", description: "Select plugins (optional)" },
  { id: 4, title: "Review", description: "Review and create" },
];

export function CreateRoutineWizard({
  open,
  onOpenChange,
}: CreateRoutineWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  // Generate unique IDs for form fields
  const nameId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const statusId = useId();
  const triggerId = useId();
  const cronScheduleId = useId();

  const [formData, setFormData] = useState<RoutineFormData>({
    name: "",
    description: "",
    tags: [],
    status: "draft",
    triggerType: "manual",
    triggerConfig: {},
    selectedPlugins: [],
  });

  const createRoutine = useMutation(api.routines.create);

  const updateField = <K extends keyof RoutineFormData>(
    field: K,
    value: RoutineFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return formData.triggerType !== null;
      case 3:
        return true; // Plugins are optional
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // Create minimal routine (nodes will be added later via visual editor)
      const _routineId = await createRoutine({
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status,
        triggerType: formData.triggerType,
        triggerConfig: formData.triggerConfig,
        nodes: [], // Empty for now
        connections: [], // Empty for now
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      });

      toast.success("Routine created successfully!");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to create routine");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      name: "",
      description: "",
      tags: [],
      status: "draft",
      triggerType: "manual",
      triggerConfig: {},
      selectedPlugins: [],
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Routine</DialogTitle>
          <DialogDescription>
            {STEPS[currentStep - 1]?.description ||
              "Create a new automation routine"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full border-2 ${
                      currentStep > step.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : currentStep === step.id
                          ? "border-primary bg-background text-primary"
                          : "border-muted bg-background text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <IconCheck className="size-4" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  <span className="mt-2 text-xs font-medium">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] space-y-4">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={nameId}>
                  Routine Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={nameId}
                  placeholder="e.g., Daily Stock Monitor"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={descriptionId}>Description</Label>
                <Textarea
                  id={descriptionId}
                  placeholder="What does this routine do?"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={tagsId}>Tags (comma separated)</Label>
                <Input
                  id={tagsId}
                  placeholder="stocks, monitoring, daily"
                  value={formData.tags.join(", ")}
                  onChange={(e) =>
                    updateField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={statusId}>Initial Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    updateField("status", value as RoutineStatus)
                  }
                >
                  <SelectTrigger id={statusId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Draft routines won't run until activated
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Trigger Configuration */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={triggerId}>Trigger Type</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) =>
                    updateField("triggerType", value as TriggerType)
                  }
                >
                  <SelectTrigger id={triggerId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      Manual - Run manually
                    </SelectItem>
                    <SelectItem value="cron">
                      Cron - Time-based schedule
                    </SelectItem>
                    <SelectItem value="webhook">
                      Webhook - HTTP trigger
                    </SelectItem>
                    <SelectItem value="event">
                      Event - Platform event
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Trigger-specific configuration */}
              {formData.triggerType === "cron" && (
                <div className="space-y-2">
                  <Label htmlFor={cronScheduleId}>Cron Schedule</Label>
                  <Input
                    id={cronScheduleId}
                    placeholder="0 9 * * * (every day at 9 AM)"
                    value={(formData.triggerConfig.schedule as string) || ""}
                    onChange={(e) =>
                      updateField("triggerConfig", { schedule: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Use cron syntax. Example: "0 */6 * * *" for every 6 hours
                  </p>
                </div>
              )}

              {formData.triggerType === "webhook" && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    A webhook URL will be generated after creating the routine.
                    You'll be able to configure authentication and validation
                    rules.
                  </p>
                </div>
              )}

              {formData.triggerType === "event" && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    Event triggers will be configured after creating the
                    routine. You'll be able to select from platform events.
                  </p>
                </div>
              )}

              {formData.triggerType === "manual" && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    This routine will only run when you manually trigger it from
                    the dashboard or via API.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Plugin Selection */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Plugin selection and workflow building will be available after
                  creating the routine. You'll use the visual workflow editor to
                  add nodes and configure connections.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Name
                  </p>
                  <p className="text-base font-semibold">{formData.name}</p>
                </div>

                {formData.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Description
                    </p>
                    <p className="text-sm">{formData.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Trigger Type
                    </p>
                    <p className="text-sm capitalize">{formData.triggerType}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Status
                    </p>
                    <p className="text-sm capitalize">{formData.status}</p>
                  </div>
                </div>

                {formData.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Tags
                    </p>
                    <p className="text-sm">{formData.tags.join(", ")}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  After creating the routine, you'll be able to add workflow
                  nodes and configure connections using the visual editor.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isCreating}
          >
            <IconArrowLeft className="mr-2 size-4" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>

            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <IconArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={!canProceed() || isCreating}
              >
                {isCreating ? "Creating..." : "Create Routine"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
