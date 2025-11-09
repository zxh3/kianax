import { AppSidebar } from "./nav/app-sidebar";
import { SiteHeader } from "./nav/side-header";
import { SidebarInset, SidebarProvider } from "@kianax/ui/components/sidebar";

export default function Dashboard() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col p-2">Content</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
