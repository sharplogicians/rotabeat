"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { AppHeader } from "@/components/shell/app-header"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { useAppStore } from "@/lib/store"
import { canAccessRoute } from "@/lib/auth-guard"
import { LocationRequiredBanner } from "@/components/shell/location-required-banner"
import { toast } from "sonner"
import Link from "next/link"

export interface Crumb {
  label: string
  href?: string
}

export function AdminShell({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  const { state } = useAppStore()
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    if (!canAccessRoute(state.role, pathname)) {
      toast.error("Access Locked: Employees can only access their attendance portal.")
      router.replace("/attendance/clock")
    }
  }, [state.role, pathname, router])

  const hasNoLocations = state.sessionReady && state.sites.length === 0
  const isSitesPage = pathname === "/sites" || pathname.startsWith("/sites/")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
        <AppHeader
          breadcrumb={
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((c, i) => (
                  <React.Fragment key={c.label}>
                    <BreadcrumbItem>
                      {c.href ? (
                        <BreadcrumbLink render={<Link href={c.href} />}>{c.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{c.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {i < crumbs.length - 1 && <BreadcrumbSeparator />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          }
        />
        <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:gap-6 md:p-6 min-w-0 max-w-full overflow-x-hidden">
          {hasNoLocations && !isSitesPage && <LocationRequiredBanner />}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
