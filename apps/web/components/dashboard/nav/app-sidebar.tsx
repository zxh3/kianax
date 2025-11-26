"use client";

import * as React from "react";
import { IconFolder, IconInnerShadowTop, IconKey } from "@tabler/icons-react";

import { NavPlugins } from "./nav-plugins";
import { NavMain } from "./nav-main";

import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@kianax/ui/components/sidebar";
import Link from "next/link";

const data = {
  navMain: [
    {
      title: "Routines",
      url: "/dashboard/routines",
      icon: IconFolder,
    },
    {
      title: "Credentials",
      url: "/dashboard/settings/credentials",
      icon: IconKey,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Kiana X</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavPlugins />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
