"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle, Building2, Plus, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"

interface LocationRequiredBannerProps {
  className?: string
  onAddLocationClick?: () => void
}

export function LocationRequiredBanner({
  className = "",
  onAddLocationClick,
}: LocationRequiredBannerProps) {
  const { state } = useAppStore()
  const pathname = usePathname()
  const isOwner = state.role === "business_owner" || state.role === "head_office"
  const isSitesPage = pathname === "/sites" || pathname.startsWith("/sites/")

  // Only display when no locations exist
  if (state.sites.length > 0) {
    return null
  }

  return (
    <div
      role="alert"
      className={`relative overflow-hidden rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive-foreground dark:border-destructive/40 dark:bg-destructive/15 shadow-sm transition-all ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/20 text-destructive dark:bg-destructive/30">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Location Required
              </span>
              <span className="rounded-md border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                Action Required
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              No business location has been added yet. You must add a location first before adding employees, creating rotas, or tracking attendance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center shrink-0">
          {isOwner ? (
            onAddLocationClick ? (
              <Button
                size="sm"
                variant="destructive"
                className="font-medium shadow-xs text-xs h-8 gap-1.5"
                onClick={onAddLocationClick}
              >
                <Plus className="size-3.5" />
                <span>Add Location First</span>
              </Button>
            ) : isSitesPage ? (
              <span className="text-xs font-medium text-destructive">
                Use the button below to add your first location
              </span>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="font-medium shadow-xs text-xs h-8 gap-1.5"
                render={<Link href="/sites" />}
              >
                <Building2 className="size-3.5" />
                <span>Add a Location First</span>
                <ArrowRight className="size-3" />
              </Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground font-medium italic">
              Please contact your Business Owner to add a location.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

