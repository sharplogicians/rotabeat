"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Building2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppStore, useCurrentSite } from "@/lib/store"

interface InactiveLocationBannerProps {
  siteName?: string
  isInactive?: boolean
  className?: string
}

export function InactiveLocationBanner({
  siteName: propSiteName,
  isInactive: propIsInactive,
  className = "",
}: InactiveLocationBannerProps) {
  const { state } = useAppStore()
  const currentSite = useCurrentSite()

  const site = currentSite
  const isInactive = propIsInactive !== undefined ? propIsInactive : site?.status === "inactive"
  const locationName = propSiteName || site?.name || "This location"

  if (!isInactive) {
    return null
  }

  const isOwner = state.role === "business_owner" || state.role === "head_office"

  return (
    <div
      role="alert"
      className={`relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200 shadow-xs transition-all ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4.5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Location Deactivated: {locationName}
              </span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Inactive
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              This location has been deactivated. Daily shifts, rotas, and live attendance tracking are currently paused.
            </p>
          </div>
        </div>

        {isOwner ? (
          <div className="flex items-center gap-2 sm:self-center shrink-0">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs text-xs h-8 gap-1.5"
              render={<Link href="/sites" />}
            >
              <Building2 className="size-3.5 mr-1" />
              <span>Manage Location</span>
            </Button>
          </div>
        ) : (
          <div className="sm:self-center shrink-0 text-[11px] text-muted-foreground font-medium italic">
            Location management access is reserved for Business Owners.
          </div>
        )}
      </div>
    </div>
  )
}
