"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  ClockAlert,
  ClipboardCheck,
  FileSpreadsheet,
  Building2,
  Settings,
  Tablet,
  Clock,
  UserCheck,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { RotaBeatLogo, RotaBeatIcon } from "@/components/brand/rotabeat-logo"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/rota", label: "Rota", icon: CalendarRange },
  { href: "/attendance", label: "Attendance", icon: ClockAlert },
  { href: "/approval", label: "Weekly Approval", icon: ClipboardCheck },
  { href: "/payroll", label: "Payroll Exports", icon: FileSpreadsheet },
] as const

const HEAD_OFFICE_ITEMS = [
  { href: "/sites", label: "Manage Locations", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

const EMPLOYEE_ITEMS = [
  { href: "/attendance/clock", label: "My Shift & Attendance", icon: UserCheck },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useAppStore()
  const exceptionCount = state.attendance.filter((a) => a.status === "exception").length

  const isOwner = state.role === "business_owner" || state.role === "head_office"
  const isEmployee = state.role === "employee"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 min-h-8">
          <Link
            href={isEmployee ? "/attendance/clock" : "/dashboard"}
            className="flex items-center gap-2 group-data-[collapsible=icon]:hidden hover:opacity-90 transition-opacity"
          >
            <RotaBeatLogo size="sm" priority />
          </Link>
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
            <Link
              href={isEmployee ? "/attendance/clock" : "/dashboard"}
              className="flex items-center justify-center hover:opacity-90 transition-opacity"
              title="RotaBeat"
            >
              <RotaBeatIcon size={24} />
            </Link>
          </div>
        </div>
        <div className="flex flex-col pt-1 px-0.5 group-data-[collapsible=icon]:hidden">
          <span className="text-[11px] font-medium text-muted-foreground truncate">
            {isEmployee ? "Employee Portal" : ""}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isEmployee ? (
          <SidebarGroup>
            <SidebarGroupLabel>Employee Access</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {EMPLOYEE_ITEMS.map((item) => {
                  const active = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.label}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => {
                    const active = pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/attendance")
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.label}>
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {item.href === "/attendance" && exceptionCount > 0 ? (
                          <SidebarMenuBadge className={cn(active && "text-sidebar-primary-foreground")}>
                            {exceptionCount}
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isOwner && (
              <SidebarGroup>
                <SidebarGroupLabel>Organisation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {HEAD_OFFICE_ITEMS.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href + "/")
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton render={<Link href={item.href} />} isActive={active} tooltip={item.label}>
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      {!isEmployee && (
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/kiosk" />} tooltip="Open kiosk">
                <Tablet />
                <span>Open Kiosk</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
