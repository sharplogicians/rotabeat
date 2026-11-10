"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import { toast } from "sonner"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SiteFormSheet } from "@/components/sites/site-form-sheet"
import { Building2, MapPin, Pencil, Plus, UserCog, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Site, User } from "@/lib/types"

export default function SitesPage() {
  const { state, dispatch } = useAppStore()

  const [siteSheetOpen, setSiteSheetOpen] = React.useState(false)
  const [editingSite, setEditingSite] = React.useState<Site | undefined>(undefined)
  const [siteToDelete, setSiteToDelete] = React.useState<Site | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  async function handleDeleteSite(site: Site) {
    setDeleting(true)
    try {
      const res = await fetch(apiUrl(`/api/locations?id=${site.id}`), {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to delete location.")
        setDeleting(false)
        return
      }
      dispatch({ type: "DELETE_SITE", siteId: site.id })
      toast.success(data.message || `Deleted ${site.name} and all associated data.`)
      setSiteToDelete(null)
    } catch {
      toast.error("Network error while deleting location.")
    } finally {
      setDeleting(false)
    }
  }

  const isOwner = state.role === "business_owner" || state.role === "head_office"

  if (!isOwner) {
    return (
      <AdminShell crumbs={[{ label: "Locations" }]}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Business Owner access required</EmptyTitle>
            <EmptyDescription>Only Business Owners and admin users can manage locations.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AdminShell>
    )
  }

  async function handleToggleStatus(site: Site) {
    const updatedStatus = site.status === "active" ? "inactive" : "active"
    try {
      const res = await fetch(apiUrl("/api/locations"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: site.id, status: updatedStatus }),
      })
      const data = await res.json()
      if (data.success) {
        dispatch({ type: "UPDATE_SITE", site: { ...site, status: updatedStatus } })
        toast.success(`${site.name} marked as ${updatedStatus}`)
      } else {
        toast.error(data.message || "Failed to update location status.")
      }
    } catch {
      toast.error("Failed to update status.")
    }
  }

  return (
    <AdminShell crumbs={[{ label: "Manage Locations" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Manage Locations</h1>
            <p className="text-sm text-muted-foreground">
              View, edit, activate, deactivate, and add business locations assigned to your account.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingSite(undefined)
              setSiteSheetOpen(true)
            }}
          >
            <Plus data-icon="inline-start" />
            Add new location
          </Button>
        </div>

        {state.sites.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>No locations added yet</EmptyTitle>
              <EmptyDescription>
                Get started by adding your first business location. Once created, you will be able to add employees, build rotas, and track attendance.
              </EmptyDescription>
              <div className="pt-2">
                <Button
                  onClick={() => {
                    setEditingSite(undefined)
                    setSiteSheetOpen(true)
                  }}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  Add your first location
                </Button>
              </div>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {state.sites.map((site) => {
              return (
                <Card key={site.id} className="flex flex-col justify-between">
                  <CardHeader className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="size-5" />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="font-heading text-base font-semibold">{site.name}</h2>
                          <span className="text-xs text-muted-foreground">{site.town}</span>
                        </div>
                      </div>
                      <Badge variant={site.status === "active" ? "default" : "secondary"} className="font-normal">
                        {site.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground pt-1">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        {site.address}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 flex items-center gap-2 border-t border-border mt-3 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingSite(site)
                        setSiteSheetOpen(true)
                      }}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit Location
                    </Button>
                    <Button
                      variant={site.status === "active" ? "ghost" : "secondary"}
                      size="sm"
                      onClick={() => handleToggleStatus(site)}
                    >
                      {site.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                      onClick={() => setSiteToDelete(site)}
                      title="Delete location"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <SiteFormSheet
        open={siteSheetOpen}
        onOpenChange={setSiteSheetOpen}
        site={editingSite}
      />

      <AlertDialog open={Boolean(siteToDelete)} onOpenChange={(open) => !open && setSiteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete {siteToDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription render={<div />} className="space-y-2">
              <p>
                Are you sure you want to delete <strong>{siteToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20">
                ⚠️ <strong>Warning:</strong> This action is permanent and cannot be undone. All data belonging to this location will be permanently deleted:
              </p>
              <ul className="text-xs list-disc pl-5 text-muted-foreground space-y-1">
                <li>All employees assigned to this location</li>
                <li>All scheduled shifts and published rotas</li>
                <li>All attendance records and clock events</li>
                <li>All weekly approvals and unresolved exceptions</li>
                <li>All registered tablet kiosk devices</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (siteToDelete) handleDeleteSite(siteToDelete)
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting location & all data…" : "Yes, delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}
