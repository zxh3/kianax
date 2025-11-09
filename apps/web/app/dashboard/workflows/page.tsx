export default function WorkflowsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <p className="text-muted-foreground">
        Manage your automation workflows here.
      </p>
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">No workflows yet</p>
      </div>
    </div>
  );
}
