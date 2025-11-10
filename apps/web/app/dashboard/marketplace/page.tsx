export default function MarketplacePage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <p className="text-muted-foreground">
        Browse and install plugins to extend your workflows.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Stock Price</h3>
          <p className="text-sm text-muted-foreground">
            Get real-time stock data
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Twitter Feed</h3>
          <p className="text-sm text-muted-foreground">Monitor Twitter feeds</p>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Email Sender</h3>
          <p className="text-sm text-muted-foreground">Send automated emails</p>
        </div>
      </div>
    </div>
  );
}
