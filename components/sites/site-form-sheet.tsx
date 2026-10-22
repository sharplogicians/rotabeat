"use client"
import { apiUrl } from '@/lib/api';

import * as React from "react"
import { toast } from "sonner"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAppStore, useCurrentUser } from "@/lib/store"
import type { Site, User } from "@/lib/types"
import { Trash2 } from "lucide-react"
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

interface SiteFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site?: Site
  onSuccess?: () => void
}

export function SiteFormSheet({ open, onOpenChange, site, onSuccess }: SiteFormSheetProps) {
  const { state, dispatch } = useAppStore()
  const actor = useCurrentUser()
  const isEdit = Boolean(site)

  const [name, setName] = React.useState(site?.name ?? "")
  const [town, setTown] = React.useState(site?.town ?? "")
  const [address, setAddress] = React.useState(site?.address ?? "")
  const [city, setCity] = React.useState(site?.city ?? "")
  const [postalCode, setPostalCode] = React.useState(site?.postalCode ?? "")
  const [phone, setPhone] = React.useState(site?.phone ?? "")
  const [email, setEmail] = React.useState(site?.email ?? "")
  const [status, setStatus] = React.useState<Site["status"]>(site?.status ?? "active")

  const [submitting, setSubmitting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setName(site?.name ?? "")
      setTown(site?.town ?? "")
      setAddress(site?.address ?? "")
      setCity(site?.city ?? "")
      setPostalCode(site?.postalCode ?? "")
      setPhone(site?.phone ?? "")
      setEmail(site?.email ?? "")
      setStatus(site?.status ?? "active")
      setErrors({})
    }
  }, [open, site])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) {
      next.name = "Location name is required."
    } else {
      const isNameDuplicate = state.sites.some(
        (s) => (!site || s.id !== site.id) && s.name.trim().toLowerCase() === name.trim().toLowerCase()
      )
      if (isNameDuplicate) {
        next.name = "A location with this name already exists."
      }
    }

    if (!town.trim()) next.town = "Town/City is required."
    if (!address.trim()) next.address = "Address is required."

    if (phone.trim()) {
      if (!/^\d+$/.test(phone.trim()) || phone.trim().length > 13) {
        next.phone = "Phone number must be digits only and cannot exceed 13 digits."
      } else {
        const isPhoneDuplicate = state.sites.some(
          (s) => (!site || s.id !== site.id) && s.phone && s.phone.trim() === phone.trim()
        )
        if (isPhoneDuplicate) {
          next.phone = "A location with this phone number already exists."
        }
      }
    }

    if (email.trim()) {
      if (!email.includes("@")) {
        next.email = "Enter a valid email address."
      } else {
        const isEmailDuplicate = state.sites.some(
          (s) => (!site || s.id !== site.id) && s.email && s.email.trim().toLowerCase() === email.trim().toLowerCase()
        )
        if (isEmailDuplicate) {
          next.email = "A location with this email address already exists."
        }
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)

    try {
      const payload = {
        id: site?.id,
        name: name.trim(),
        town: town.trim(),
        address: address.trim(),
        city: city.trim() || town.trim(),
        postalCode: postalCode.trim(),
        phone: phone.trim(),
        email: email.trim(),
        managerId: null,
        businessOwnerId: actor.id,
        status,
      }

      const res = await fetch(apiUrl("/api/locations"), {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to save location.")
        setSubmitting(false)
        return
      }

      // Sync local store
      const updatedSite: Site = {
        id: data.location?.id ?? site?.id ?? `site-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        town: town.trim(),
        address: address.trim(),
        city: city.trim() || town.trim(),
        postalCode: postalCode.trim(),
        country: "UK",
        phone: phone.trim(),
        email: email.trim(),
        managerId: "",
        businessOwnerId: actor.id,
        timeZone: site?.timeZone ?? "Europe/London",
        weekStart: "monday",
        status,
        kiosks: site?.kiosks ?? [],
      }

      if (isEdit) {
        dispatch({ type: "UPDATE_SITE", site: updatedSite })
        toast.success(`Updated ${updatedSite.name}`)
      } else {
        dispatch({ type: "ADD_SITE", site: updatedSite })
        toast.success(`Added ${updatedSite.name} to your locations`)
      }

      if (onSuccess) onSuccess()
      onOpenChange(false)
    } catch {
      toast.error("An error occurred while saving the location.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!site?.id) return
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
      setDeleteOpen(false)
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch {
      toast.error("Network error while deleting location.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit location" : "Add new location"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update details for this location."
              : "Add a new business location to your account."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="site-name">Location name *</FieldLabel>
              <Input
                id="site-name"
                placeholder="e.g. Bride Leeds Cafe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <FieldDescription>{errors.name}</FieldDescription>}
            </Field>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor="site-address">Street address *</FieldLabel>
              <Input
                id="site-address"
                placeholder="14 Boar Lane"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                aria-invalid={Boolean(errors.address)}
              />
              {errors.address && <FieldDescription>{errors.address}</FieldDescription>}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(errors.town)}>
                <FieldLabel htmlFor="site-town">City / Town *</FieldLabel>
                <Input
                  id="site-town"
                  placeholder="Leeds"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  aria-invalid={Boolean(errors.town)}
                />
                {errors.town && <FieldDescription>{errors.town}</FieldDescription>}
              </Field>

              <Field>
                <FieldLabel htmlFor="site-postcode">Postal code</FieldLabel>
                <Input
                  id="site-postcode"
                  placeholder="LS1 5EL"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="site-phone">Phone number</FieldLabel>
                <Input
                  id="site-phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={13}
                  placeholder="Numbers only"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && <FieldDescription className="text-destructive text-xs">{errors.phone}</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="site-email">Email address</FieldLabel>
                <Input
                  id="site-email"
                  type="email"
                  placeholder="leeds@northerntable.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && <FieldDescription className="text-destructive text-xs">{errors.email}</FieldDescription>}
              </Field>
            </div>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="site-status">Status</FieldLabel>
              <ToggleGroup
                id="site-status"
                value={[status]}
                onValueChange={(v) => v[0] && setStatus(v[0] as Site["status"])}
                spacing={2}
              >
                <ToggleGroupItem value="active">Active</ToggleGroupItem>
                <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>

          <SheetFooter className="flex flex-col gap-2 px-0 sm:flex-col">
            <Button type="submit" disabled={submitting || deleting} className="w-full">
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add location"}
            </Button>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                className="w-full gap-2 border border-destructive/20"
                disabled={submitting || deleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete Location
              </Button>
            )}
            <SheetClose render={<Button type="button" variant="outline" className="w-full" disabled={submitting || deleting} />}>
              Cancel
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Delete {site?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription render={<div />} className="space-y-2">
              <p>
                Are you sure you want to delete <strong>{site?.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20">
                ⚠️ <strong>Warning:</strong> This action cannot be undone. All data belonging to this location will be permanently deleted:
              </p>
              <ul className="text-xs list-disc pl-5 text-muted-foreground space-y-1">
                <li>All employees belonging to this location</li>
                <li>All shifts, rotas, and schedules</li>
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
                handleDelete()
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting location & all data…" : "Yes, delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
