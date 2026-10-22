"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"

interface KioskRegisterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId: string
  siteName: string
}

function generateRegistrationCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function KioskRegisterDialog({ open, onOpenChange, siteId, siteName }: KioskRegisterDialogProps) {
  const { dispatch } = useAppStore()
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setName("")
      setError("")
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Give this kiosk device a name.")
      return
    }

    const now = new Date().toISOString()
    dispatch({
      type: "REGISTER_KIOSK",
      siteId,
      kiosk: {
        id: `kiosk-${Math.random().toString(36).slice(2, 8)}`,
        siteId,
        name: name.trim(),
        registeredAt: now,
        lastActiveAt: null,
        status: "pending",
        registrationCode: generateRegistrationCode(),
        codeExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    })
    toast.success(`Kiosk device registered for ${siteName}`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Register kiosk device</DialogTitle>
          <DialogDescription>
            Add a new clock-in device for {siteName}. It will be pending until an admin enters the code on the
            device.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="kiosk-name">Device name</FieldLabel>
              <Input
                id="kiosk-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Front counter tablet"
                aria-invalid={Boolean(error)}
                autoFocus
              />
              {error && <FieldDescription>{error}</FieldDescription>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Register device</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
