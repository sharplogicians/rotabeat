"use client"
import { apiUrl } from '@/lib/api'

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
import { useAppStore } from "@/lib/store"
import { KeyRound, Lock, ChevronDown, ChevronUp } from "lucide-react"
import type { User, Site } from "@/lib/types"

interface ManagerFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  manager?: User & { locationId?: string | null; assignedLocation?: { id: string; name: string } | null }
  onSuccess: () => void
}

export function ManagerFormSheet({ open, onOpenChange, manager, onSuccess }: ManagerFormSheetProps) {
  const { state, dispatch } = useAppStore()
  const isEdit = Boolean(manager)

  const [firstName, setFirstName] = React.useState(manager?.firstName ?? manager?.name.split(" ")[0] ?? "")
  const [lastName, setLastName] = React.useState(manager?.lastName ?? manager?.name.split(" ").slice(1).join(" ") ?? "")
  const [email, setEmail] = React.useState(manager?.email ?? "")
  const [username, setUsername] = React.useState(manager?.username ?? "")

  // Password state
  const [isChangingPassword, setIsChangingPassword] = React.useState(false)
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  const [status, setStatus] = React.useState<"active" | "inactive">(manager?.status ?? "active")
  const [locationId, setLocationId] = React.useState<string>(manager?.locationId ?? "none")

  const [locations, setLocations] = React.useState<Site[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Load locations from API or store
  const fetchLocations = React.useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/locations"))
      const data = await res.json()
      if (data.success && Array.isArray(data.locations)) {
        setLocations(data.locations)
      } else {
        setLocations(state.sites)
      }
    } catch {
      setLocations(state.sites)
    }
  }, [state.sites])

  React.useEffect(() => {
    if (open) {
      setFirstName(manager?.firstName ?? manager?.name.split(" ")[0] ?? "")
      setLastName(manager?.lastName ?? manager?.name.split(" ").slice(1).join(" ") ?? "")
      setEmail(manager?.email ?? "")
      setUsername(manager?.username ?? "")
      setIsChangingPassword(false)
      setCurrentPassword("")
      setPassword("")
      setConfirmPassword("")
      setStatus(manager?.status ?? "active")
      setLocationId(manager?.locationId ?? "none")
      setErrors({})
      fetchLocations()
    }
  }, [open, manager, fetchLocations])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!firstName.trim()) next.firstName = "Please enter the Manager's first name."
    if (!lastName.trim()) next.lastName = "Please enter the Manager's last name."
    if (!email.trim()) next.email = "Please enter an email address."
    if (!username.trim()) next.username = "Please enter a username."

    if (!isEdit) {
      // Adding new manager -> Password is required
      if (!password) next.password = "Please enter a password."
      if (!confirmPassword) next.confirmPassword = "Please confirm the password."
      if (password && confirmPassword && password !== confirmPassword) {
        next.confirmPassword = "Passwords do not match."
      }
    } else if (isChangingPassword) {
      // Editing manager -> Verify current password first
      if (!currentPassword) next.currentPassword = "Please enter the current password."
      if (!password) next.password = "Please enter a new password."
      if (!confirmPassword) next.confirmPassword = "Please confirm the new password."
      if (password && confirmPassword && password !== confirmPassword) {
        next.confirmPassword = "Passwords do not match."
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
        id: manager?.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        username: username.trim(),
        isChangingPassword,
        currentPassword,
        previousPassword: currentPassword,
        password,
        confirmPassword,
        status,
        locationId: locationId === "none" ? null : locationId,
      }

      const res = await fetch(apiUrl("/api/managers"), {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.message.includes("Current password") || data.message.includes("Previous password")) {
          setErrors({ currentPassword: data.message })
        } else if (data.message.includes("email")) {
          setErrors({ email: data.message })
        } else if (data.message.includes("username")) {
          setErrors({ username: data.message })
        } else if (data.message.includes("match")) {
          setErrors({ confirmPassword: data.message })
        } else if (data.message.includes("location")) {
          setErrors({ locationId: data.message })
        } else {
          toast.error(data.message || "Failed to save Manager.")
        }
        setSubmitting(false)
        return
      }

      // Sync local store for site manager relationship
      const targetLocationId = locationId === "none" ? "" : locationId
      if (targetLocationId && data.manager?.id) {
        const siteToUpdate = state.sites.find((s) => s.id === targetLocationId)
        if (siteToUpdate) {
          dispatch({ type: "UPDATE_SITE", site: { ...siteToUpdate, managerId: data.manager.id } })
        }
      }

      toast.success(data.message || (isEdit ? (isChangingPassword ? "Password changed successfully." : "Manager updated successfully.") : "Manager created successfully."))
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error("An error occurred while saving the Manager.")
    } finally {
      setSubmitting(false)
    }
  }

  // Location dropdown options with availability status
  const locationOptions = React.useMemo(() => {
    return locations.map((loc) => {
      const assignedMgr = state.users.find((u) => u.id === loc.managerId)
      const isAssignedToOther = Boolean(loc.managerId && (!manager || loc.managerId !== manager.id))

      return {
        id: loc.id,
        name: loc.name,
        town: loc.town,
        isAssignedToOther,
        assignedManagerName: assignedMgr?.name,
      }
    })
  }, [locations, state.users, manager])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Manager" : "Add Manager"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update Manager account details and assigned Location."
              : "Create a new Manager account, set login credentials, and assign a Location."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={Boolean(errors.firstName)}>
                <FieldLabel htmlFor="mgr-firstname">First Name *</FieldLabel>
                <Input
                  id="mgr-firstname"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && <FieldDescription>{errors.firstName}</FieldDescription>}
              </Field>

              <Field data-invalid={Boolean(errors.lastName)}>
                <FieldLabel htmlFor="mgr-lastname">Last Name *</FieldLabel>
                <Input
                  id="mgr-lastname"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && <FieldDescription>{errors.lastName}</FieldDescription>}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="mgr-email">Email Address *</FieldLabel>
              <Input
                id="mgr-email"
                type="email"
                placeholder="john@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <FieldDescription>{errors.email}</FieldDescription>}
            </Field>

            <Field data-invalid={Boolean(errors.username)}>
              <FieldLabel htmlFor="mgr-username">Username *</FieldLabel>
              <Input
                id="mgr-username"
                placeholder="johnsmith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={Boolean(errors.username)}
              />
              {errors.username && <FieldDescription>{errors.username}</FieldDescription>}
            </Field>

            <Field data-invalid={Boolean(errors.locationId)}>
              <FieldLabel htmlFor="mgr-location">Assigned Location</FieldLabel>
              <Select
                items={[
                  { value: "none", label: "Unassigned (No Location)" },
                  ...locationOptions.map((loc) => ({
                    value: loc.id,
                    label: loc.isAssignedToOther
                      ? `${loc.name} (Assigned to ${loc.assignedManagerName})`
                      : `${loc.name} — ${loc.town}`,
                    disabled: loc.isAssignedToOther,
                  })),
                ]}
                value={locationId}
                onValueChange={(v) => v && setLocationId(v)}
              >
                <SelectTrigger id="mgr-location" aria-invalid={Boolean(errors.locationId)}>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Unassigned (No Location)</SelectItem>
                    {locationOptions.map((loc) => (
                      <SelectItem
                        key={loc.id}
                        value={loc.id}
                        disabled={loc.isAssignedToOther}
                        className={loc.isAssignedToOther ? "opacity-50" : ""}
                      >
                        {loc.name} — {loc.town} {loc.isAssignedToOther ? `(Assigned to ${loc.assignedManagerName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.locationId ? (
                <FieldDescription>{errors.locationId}</FieldDescription>
              ) : (
                <FieldDescription className="text-xs text-muted-foreground">
                  Each Manager can be assigned to only 1 Location.
                </FieldDescription>
              )}
            </Field>

            {/* Password Section */}
            {!isEdit ? (
              // Add Manager Mode -> Initial Password Creation Required
              <>
                <Field data-invalid={Boolean(errors.password)}>
                  <FieldLabel htmlFor="mgr-password">Password *</FieldLabel>
                  <Input
                    id="mgr-password"
                    type="password"
                    placeholder="Set initial password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(errors.password)}
                  />
                  {errors.password && <FieldDescription>{errors.password}</FieldDescription>}
                </Field>

                <Field data-invalid={Boolean(errors.confirmPassword)}>
                  <FieldLabel htmlFor="mgr-confirmpassword">Confirm Password *</FieldLabel>
                  <Input
                    id="mgr-confirmpassword"
                    type="password"
                    placeholder="Re-enter initial password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={Boolean(errors.confirmPassword)}
                  />
                  {errors.confirmPassword && <FieldDescription>{errors.confirmPassword}</FieldDescription>}
                </Field>
              </>
            ) : (
              // Edit Manager Mode -> Password is hidden by default with Change Password toggle
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Password</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsChangingPassword(!isChangingPassword)
                      setCurrentPassword("")
                      setPassword("")
                      setConfirmPassword("")
                      setErrors({})
                    }}
                  >
                    <KeyRound data-icon="inline-start" />
                    {isChangingPassword ? "Cancel Password Change" : "Change Password"}
                    {isChangingPassword ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
                  </Button>
                </div>

                {isChangingPassword && (
                  <div className="flex flex-col gap-3 pt-2 border-t border-border mt-1">
                    <Field data-invalid={Boolean(errors.currentPassword)}>
                      <FieldLabel htmlFor="mgr-currpassword">Current Password *</FieldLabel>
                      <Input
                        id="mgr-currpassword"
                        type="password"
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        aria-invalid={Boolean(errors.currentPassword)}
                      />
                      {errors.currentPassword && <FieldDescription>{errors.currentPassword}</FieldDescription>}
                    </Field>

                    <Field data-invalid={Boolean(errors.password)}>
                      <FieldLabel htmlFor="mgr-newpassword">New Password *</FieldLabel>
                      <Input
                        id="mgr-newpassword"
                        type="password"
                        placeholder="Enter new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-invalid={Boolean(errors.password)}
                      />
                      {errors.password && <FieldDescription>{errors.password}</FieldDescription>}
                    </Field>

                    <Field data-invalid={Boolean(errors.confirmPassword)}>
                      <FieldLabel htmlFor="mgr-confirmpassword">Confirm New Password *</FieldLabel>
                      <Input
                        id="mgr-confirmpassword"
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        aria-invalid={Boolean(errors.confirmPassword)}
                      />
                      {errors.confirmPassword && <FieldDescription>{errors.confirmPassword}</FieldDescription>}
                    </Field>
                  </div>
                )}
              </div>
            )}

            <Field orientation="horizontal">
              <FieldLabel htmlFor="mgr-status">Account Status</FieldLabel>
              <ToggleGroup
                id="mgr-status"
                value={[status]}
                onValueChange={(v) => v[0] && setStatus(v[0] as "active" | "inactive")}
                spacing={2}
              >
                <ToggleGroupItem value="active">Active</ToggleGroupItem>
                <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save Manager"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" className="w-full" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

