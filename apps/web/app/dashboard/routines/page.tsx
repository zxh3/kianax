"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import { Button } from "@kianax/ui/components/button";
import { Input } from "@kianax/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@kianax/ui/components/tabs";
import { IconSearch } from "@tabler/icons-react";
import { Skeleton } from "@kianax/ui/components/skeleton";
import { RoutinesTable } from "@kianax/web/components/routines/routines-table";
import { CreateRoutineWizard } from "@kianax/web/components/routines/create-routine-wizard";
import { EditRoutineModal } from "@kianax/web/components/routines/edit-routine-modal";
import { ExecutionHistoryDrawer } from "@kianax/web/components/routines/execution-history-drawer";
import { toast } from "sonner";

type RoutineStatus = "draft" | "active" | "paused" | "archived";

export default function RoutinesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoutineStatus | "all">(
    "all",
  );
  const [selectedRoutine, setSelectedRoutine] = useState<any>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [_routineToDelete, _setRoutineToDelete] =
    useState<Id<"routines"> | null>(null);

  // Fetch all routines (filter client-side to avoid loading flash on filter change)
  const allRoutines = useQuery(api.routines.listByUser, {});

  // Mutations
  const deleteRoutine = useMutation(api.routines.deleteRoutine);

  // Filter and search routines
  const filteredRoutines = useMemo(() => {
    if (!allRoutines) return [];

    let filtered = allRoutines;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Search by name or description
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [allRoutines, statusFilter, searchQuery]);

  // Count by status
  const statusCounts = useMemo(() => {
    if (!allRoutines)
      return { all: 0, draft: 0, active: 0, paused: 0, archived: 0 };

    return {
      all: allRoutines.length,
      draft: allRoutines.filter((r) => r.status === "draft").length,
      active: allRoutines.filter((r) => r.status === "active").length,
      paused: allRoutines.filter((r) => r.status === "paused").length,
      archived: allRoutines.filter((r) => r.status === "archived").length,
    };
  }, [allRoutines]);

  // Handlers
  const handleEdit = (routine: any) => {
    setSelectedRoutine(routine);
    setShowEditModal(true);
  };

  const handleDelete = async (routineId: Id<"routines">) => {
    if (
      !confirm(
        "Are you sure you want to delete this routine? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await deleteRoutine({ id: routineId });
      toast.success("Routine deleted successfully");
    } catch (error) {
      toast.error("Failed to delete routine");
      console.error(error);
    }
  };

  const handleViewHistory = (routine: any) => {
    setSelectedRoutine(routine);
    setShowHistoryDrawer(true);
  };

  const handleRunNow = async (_routineId: Id<"routines">) => {
    toast.info("Manual execution will be implemented in the next phase");
    // TODO: Implement Temporal workflow trigger
  };

  // Loading state
  const isLoading = allRoutines === undefined;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Routines</h1>
          <p className="text-muted-foreground">
            Manage and monitor your automation routines
          </p>
        </div>
        <Button onClick={() => setShowCreateWizard(true)}>
          Create Routine
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as RoutineStatus | "all")
          }
        >
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="draft">
              Draft ({statusCounts.draft})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({statusCounts.active})
            </TabsTrigger>
            <TabsTrigger value="paused">
              Paused ({statusCounts.paused})
            </TabsTrigger>
            <TabsTrigger value="archived">
              Archived ({statusCounts.archived})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search routines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Routines Table */}
      {isLoading ? (
        <div className="rounded-md border">
          <Skeleton className="h-10 w-full rounded-b-none" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-none border-t" />
          ))}
        </div>
      ) : (
        <RoutinesTable
          routines={filteredRoutines}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewHistory={handleViewHistory}
          onRunNow={handleRunNow}
        />
      )}

      {/* Create Routine Wizard */}
      <CreateRoutineWizard
        open={showCreateWizard}
        onOpenChange={setShowCreateWizard}
      />

      {/* Edit Routine Modal */}
      <EditRoutineModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        routine={selectedRoutine}
      />

      {/* Execution History Drawer */}
      <ExecutionHistoryDrawer
        open={showHistoryDrawer}
        onOpenChange={setShowHistoryDrawer}
        routineId={selectedRoutine?._id || null}
        routineName={selectedRoutine?.name || ""}
      />
    </div>
  );
}
