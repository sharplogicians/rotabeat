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
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from "@/components/ui/field"
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
import { useAccessibleSites, useAppStore, useCurrentUser } from "@/lib/store"
import type { Employee, EmployeeStatus, PayType } from "@/lib/types"
import { Building2, Eye, EyeOff, Camera, X } from "lucide-react"

interface EmployeeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee
}

function nextEmployeeNumber(existing: Employee[]): string {
  const max = existing.reduce((m, e) => {
    const n = Number(e.employeeNumber.replace("EMP-", ""))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 1000)
  return `EMP-${max + 1}`
}

const PRESET_JOB_TITLES = [
  "Site Manager",
  "Barista",
  "Bakery Assistant",
  "Baker",
  "Chef",
  "Server",
  "Shift Supervisor",
] as const

export function EmployeeFormSheet({ open, onOpenChange, employee }: EmployeeFormSheetProps) {
  const { state, dispatch } = useAppStore()
  const sites = useAccessibleSites()
  const actor = useCurrentUser()
  const isEdit = Boolean(employee)
  const isBusinessOwner = state.role === "business_owner" || state.role === "head_office"

  const [firstName, setFirstName] = React.useState(employee?.firstName ?? "")
  const [lastName, setLastName] = React.useState(employee?.lastName ?? "")
  const [email, setEmail] = React.useState(employee?.email ?? "")
  const [phone, setPhone] = React.useState(employee?.phone ?? "")
  const [jobTitle, setJobTitle] = React.useState(employee?.jobTitle ?? "")

  const cannotEditSiteManager = isEdit && (employee?.jobTitle === "Site Manager" || jobTitle === "Site Manager") && !isBusinessOwner
  const [siteId, setSiteId] = React.useState(
    employee?.primarySiteId ?? (sites.some((s) => s.id === state.currentSiteId) ? state.currentSiteId : sites[0]?.id ?? "")
  )
  const [payType, setPayType] = React.useState<PayType>(employee?.payType ?? "hourly")
  const [hourlyRate, setHourlyRate] = React.useState(String(employee?.hourlyRate ?? ""))
  const [salaryAnnual, setSalaryAnnual] = React.useState(String(employee?.salaryAnnual ?? ""))
  const [startDate, setStartDate] = React.useState(employee?.startDate ?? "")
  const [status, setStatus] = React.useState<EmployeeStatus>(employee?.status ?? "active")

  // Manager password & Employee PIN states
  const [password, setPassword] = React.useState("")
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [pin, setPin] = React.useState(employee?.pin ?? "")
  const [showPin, setShowPin] = React.useState(false)
  const [profileImage, setProfileImage] = React.useState<string>(employee?.profileImage ?? "")
  const imageInputRef = React.useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Check if a Site Manager already exists at the selected location
  const hasSiteManagerAtSelectedSite = React.useMemo(() => {
    return state.employees.some(
      (e) =>
        e.primarySiteId === siteId &&
        e.jobTitle === "Site Manager" &&
        e.status !== "left" &&
        (!employee || e.id !== employee.id)
    )
  }, [state.employees, siteId, employee])

  // Filter out Site Manager option if one already exists for this site
  const availableJobTitles = React.useMemo(() => {
    let titles = Array.from(PRESET_JOB_TITLES)
    if (hasSiteManagerAtSelectedSite) {
      titles = titles.filter((t) => t !== "Site Manager")
    }
    if (jobTitle && !titles.includes(jobTitle as any)) {
      titles.push(jobTitle as any)
    }
    return titles
  }, [hasSiteManagerAtSelectedSite, jobTitle])

  const jobTitleItems = React.useMemo(() => {
    return availableJobTitles.map((t) => ({ value: t, label: t }))
  }, [availableJobTitles])

  const siteItems = React.useMemo(() => {
    return sites.map((s) => ({ value: s.id, label: `${s.name} — ${s.town}` }))
  }, [sites])

  React.useEffect(() => {
    if (open) {
      setFirstName(employee?.firstName ?? "")
      setLastName(employee?.lastName ?? "")
      setEmail(employee?.email ?? "")
      setPhone(employee?.phone ?? "")
      setJobTitle(employee?.jobTitle ?? "")
      const initialSiteId =
        employee?.primarySiteId ??
        (sites.some((s) => s.id === state.currentSiteId) ? state.currentSiteId : sites[0]?.id ?? "")
      setSiteId(initialSiteId)
      setPayType(employee?.payType ?? "hourly")
      setHourlyRate(String(employee?.hourlyRate ?? ""))
      setSalaryAnnual(String(employee?.salaryAnnual ?? ""))
      setStartDate(employee?.startDate ?? "")
      setStatus(employee?.status ?? "active")
      setPassword("")
      setCurrentPassword("")
      setNewPassword("")
      setPin(employee?.pin ?? "")
      setShowPin(false)
      setProfileImage(employee?.profileImage ?? "")
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id])

  function validate(): boolean {
    if (cannotEditSiteManager) {
      toast.error("Site Managers can only be edited or deleted by a Business Owner.")
      return false
    }
    const next: Record<string, string> = {}
    if (!firstName.trim()) next.firstName = "First name is required."
    if (!lastName.trim()) next.lastName = "Last name is required."

    // Name uniqueness validation
    if (firstName.trim() && lastName.trim()) {
      const isNameDuplicate = state.employees.some(
        (e) =>
          (!employee || e.id !== employee.id) &&
          e.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() &&
          e.lastName.trim().toLowerCase() === lastName.trim().toLowerCase() &&
          e.status !== "left"
      )
      if (isNameDuplicate) {
        next.firstName = "An employee with this first and last name already exists."
        next.lastName = "An employee with this first and last name already exists."
      }
    }

    // Email validation & uniqueness
    if (!email.trim() || !email.includes("@")) {
      next.email = "Enter a valid email address."
    } else {
      const isEmailDuplicate = state.employees.some(
        (e) =>
          (!employee || e.id !== employee.id) &&
          e.email.trim().toLowerCase() === email.trim().toLowerCase()
      )
      if (isEmailDuplicate) {
        next.email = "An employee with this email already exists."
      }
    }

    // Phone validation & uniqueness
    if (!phone.trim()) {
      next.phone = "Phone number is required."
    } else if (!/^\d+$/.test(phone.trim()) || phone.trim().length > 13) {
      next.phone = "Phone number must be digits only and cannot exceed 13 digits."
    } else {
      const isPhoneDuplicate = state.employees.some(
        (e) =>
          (!employee || e.id !== employee.id) &&
          e.phone &&
          e.phone.trim() === phone.trim()
      )
      if (isPhoneDuplicate) {
        next.phone = "An employee with this phone number already exists."
      }
    }

    if (!jobTitle.trim()) next.jobTitle = "Job title is required."
    if (!siteId) next.siteId = "Select a primary site."
    if (!startDate) next.startDate = "Start date is required."
    if (jobTitle !== "Site Manager") {
      if (!pin.trim() || pin.trim().length < 4) {
        next.pin = "PIN must be at least 4 digits."
      }
    }
    if (payType === "hourly" && (!hourlyRate || Number(hourlyRate) <= 0)) {
      next.hourlyRate = "Enter an hourly rate greater than zero."
    }
    if (payType === "salaried" && (!salaryAnnual || Number(salaryAnnual) <= 0)) {
      next.salaryAnnual = "Enter an annual salary greater than zero."
    }

    // Password validation for Site Manager
    if (jobTitle === "Site Manager") {
      if (!isEdit) {
        if (!password || password.length < 4) {
          next.password = "Password is required for Site Manager (min 4 characters)."
        }
      } else {
        if (newPassword.trim()) {
          if (!currentPassword.trim()) {
            next.currentPassword = "Current password is required to update password."
          }
          if (newPassword.length < 4) {
            next.newPassword = "New password must be at least 4 characters."
          }
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
    const site = sites.find((s) => s.id === siteId)
    const isSiteManager = jobTitle === "Site Manager"

    // Determine profileImage payload:
    // - New/changed image: send the data URI
    // - Removed image (was set, now empty): send "__REMOVE__"
    // - Unchanged: send undefined (don't touch it)
    let profileImagePayload: string | undefined = undefined
    if (profileImage && profileImage !== employee?.profileImage) {
      profileImagePayload = profileImage
    } else if (!profileImage && employee?.profileImage) {
      profileImagePayload = "__REMOVE__"
    }

    const payload = {
      id: employee?.id,
      employeeNumber: isEdit ? employee?.employeeNumber : undefined,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      jobTitle: jobTitle.trim(),
      profileImage: profileImagePayload,
      primarySiteId: siteId,
      managerId: site?.managerId ?? employee?.managerId ?? actor.id,
      payType,
      hourlyRate: payType === "hourly" ? Number(hourlyRate) || 0 : null,
      salaryAnnual: payType === "salaried" ? Number(salaryAnnual) || 0 : null,
      startDate,
      status,
      leavingDate: employee?.leavingDate,
      leavingReason: employee?.leavingReason,
      password: password.trim(),
      currentPassword: currentPassword.trim(),
      newPassword: newPassword.trim(),
      pin: isSiteManager ? "" : pin.trim(),
    }

    try {
      const res = await fetch(apiUrl("/api/employees"), {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.message.includes("Current password")) {
          setErrors({ currentPassword: data.message })
        } else {
          toast.error(data.message || "Failed to save employee in database.")
        }
        setSubmitting(false)
        return
      }

      const savedEmp: Employee = {
        id: data.employee.id,
        employeeNumber: data.employee.employeeNumber,
        firstName: data.employee.firstName,
        lastName: data.employee.lastName,
        email: data.employee.email,
        phone: data.employee.phone,
        jobTitle: data.employee.jobTitle,
        profileImage: data.employee.profileImage ?? undefined,
        primarySiteId: data.employee.primarySiteId,
        managerId: data.employee.managerId ?? actor.id,
        payType: data.employee.payType,
        hourlyRate: data.employee.hourlyRate ?? undefined,
        salaryAnnual: data.employee.salaryAnnual ?? undefined,
        startDate: data.employee.startDate,
        status: data.employee.status,
        leavingDate: data.employee.leavingDate ?? undefined,
        leavingReason: data.employee.leavingReason ?? undefined,
        pinSet: !isSiteManager,
        pin: isSiteManager ? undefined : (data.employee?.pin ?? pin.trim()),
      }

      if (isEdit) {
        dispatch({ type: "UPDATE_EMPLOYEE", employee: savedEmp, actorName: actor.name })
        toast.success(`Updated ${savedEmp.firstName} ${savedEmp.lastName} in database`)
      } else {
        dispatch({ type: "ADD_EMPLOYEE", employee: savedEmp, actorName: actor.name })
        toast.success(`Added ${savedEmp.firstName} ${savedEmp.lastName} to database`)
      }
      onOpenChange(false)
    } catch {
      toast.error("Network error while saving employee.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit employee" : "Add employee"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this employee's details."
              : "Add a new employee to the directory."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
          {/* Profile Image Upload */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <div className="relative">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile preview"
                  className="h-24 w-24 rounded-full object-cover border-2 border-border shadow-sm"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {profileImage && (
                <button
                  type="button"
                  onClick={() => { setProfileImage(""); if (imageInputRef.current) imageInputRef.current.value = "" }}
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
                  title="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                id="profileImageUpload"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (!file.type.startsWith("image/")) {
                    toast.error("Please upload a valid image file.")
                    return
                  }
                  if (file.size > 1_000_000) {
                    toast.error("Image must be less than 1 MB.")
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => setProfileImage(reader.result as string)
                  reader.readAsDataURL(file)
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" />
                {profileImage ? "Change Photo" : "Upload Photo"}
              </Button>
            </div>
            {errors.profileImage && <p className="text-sm text-destructive">{errors.profileImage}</p>}
          </div>

          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.firstName)}>
                <FieldLabel htmlFor="firstName">First name *</FieldLabel>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && <FieldDescription>{errors.firstName}</FieldDescription>}
              </Field>
              <Field data-invalid={Boolean(errors.lastName)}>
                <FieldLabel htmlFor="lastName">Last name *</FieldLabel>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-invalid={Boolean(errors.lastName)}
                />
                {errors.lastName && <FieldDescription>{errors.lastName}</FieldDescription>}
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">Email *</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <FieldDescription>{errors.email}</FieldDescription>}
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="phone">Phone *</FieldLabel>
              <Input
                id="phone"
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

            {state.currentSiteId ? (
              <Field>
                <FieldLabel>Primary site *</FieldLabel>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                  <Building2 className="size-4 text-primary" />
                  <span>
                    {sites.find((s) => s.id === siteId)?.name
                      ? `${sites.find((s) => s.id === siteId)?.name} — ${sites.find((s) => s.id === siteId)?.town}`
                      : "Selected Location"}
                  </span>
                </div>
                <FieldDescription className="text-xs text-muted-foreground">
                  Automatically set to currently selected location.
                </FieldDescription>
              </Field>
            ) : (
              <Field data-invalid={Boolean(errors.siteId)}>
                <FieldLabel htmlFor="site">Primary site *</FieldLabel>
                <Select
                  items={siteItems}
                  value={siteId}
                  onValueChange={(v) => {
                    if (v) {
                      setSiteId(v)
                      // If switching to site that already has site manager, clear site manager selection
                      const hasMgr = state.employees.some(
                        (e) => e.primarySiteId === v && e.jobTitle === "Site Manager" && (!employee || e.id !== employee.id)
                      )
                      if (hasMgr && jobTitle === "Site Manager") {
                        setJobTitle("")
                      }
                    }
                  }}
                >
                  <SelectTrigger id="site" aria-invalid={Boolean(errors.siteId)}>
                    <SelectValue placeholder="Select a site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — {s.town}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.siteId && <FieldDescription>{errors.siteId}</FieldDescription>}
              </Field>
            )}

            <Field data-invalid={Boolean(errors.jobTitle)}>
              <FieldLabel htmlFor="jobTitle">Job title *</FieldLabel>
              <Select
                items={jobTitleItems}
                value={jobTitle}
                onValueChange={(v) => v && setJobTitle(v)}
              >
                <SelectTrigger id="jobTitle" aria-invalid={Boolean(errors.jobTitle)}>
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableJobTitles.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {errors.jobTitle ? (
                <FieldDescription>{errors.jobTitle}</FieldDescription>
              ) : hasSiteManagerAtSelectedSite ? (
                <FieldDescription className="text-xs text-muted-foreground">
                  A Site Manager is already assigned to this location.
                </FieldDescription>
              ) : null}
            </Field>

            {jobTitle === "Site Manager" && (
              <FieldSet className="border-t border-border pt-3">
                <FieldLegend variant="label">Site Manager Account Security</FieldLegend>
                <FieldGroup className="gap-3 mt-2">
                  {!isEdit ? (
                    <Field data-invalid={Boolean(errors.password)}>
                      <FieldLabel htmlFor="managerPassword">Account Password *</FieldLabel>
                      <Input
                        id="managerPassword"
                        type="password"
                        placeholder="Create manager password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-invalid={Boolean(errors.password)}
                      />
                      {errors.password ? (
                        <FieldDescription>{errors.password}</FieldDescription>
                      ) : (
                        <FieldDescription className="text-xs text-muted-foreground">
                          Compulsory for Site Managers to sign into their dashboard.
                        </FieldDescription>
                      )}
                    </Field>
                  ) : (
                    <>
                      <Field data-invalid={Boolean(errors.currentPassword)}>
                        <FieldLabel htmlFor="currentPassword">Current Password</FieldLabel>
                        <Input
                          id="currentPassword"
                          type="password"
                          placeholder="Enter current password to verify"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          aria-invalid={Boolean(errors.currentPassword)}
                        />
                        {errors.currentPassword && <FieldDescription>{errors.currentPassword}</FieldDescription>}
                      </Field>
                      <Field data-invalid={Boolean(errors.newPassword)}>
                        <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
                        <Input
                          id="newPassword"
                          type="password"
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          aria-invalid={Boolean(errors.newPassword)}
                        />
                        {errors.newPassword && <FieldDescription>{errors.newPassword}</FieldDescription>}
                      </Field>
                    </>
                  )}
                </FieldGroup>
              </FieldSet>
            )}

            {jobTitle !== "Site Manager" && (
              <Field data-invalid={Boolean(errors.pin)}>
                <FieldLabel htmlFor="employeePin">Employee Login PIN (4 Digits) *</FieldLabel>
                <div className="relative">
                  <Input
                    id="employeePin"
                    type={showPin ? "text" : "password"}
                    maxLength={6}
                    placeholder="Set 4-digit PIN (e.g. 1234)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    aria-invalid={Boolean(errors.pin)}
                    className="pr-10 font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                    onClick={() => setShowPin(!showPin)}
                    tabIndex={-1}
                    title={showPin ? "Hide PIN" : "Unhide PIN"}
                  >
                    {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.pin ? (
                  <FieldDescription>{errors.pin}</FieldDescription>
                ) : (
                  <FieldDescription className="text-xs text-muted-foreground">
                    Custom PIN used by employee to log into the attendance system.
                  </FieldDescription>
                )}
              </Field>
            )}

            <Field data-invalid={Boolean(errors.startDate)}>
              <FieldLabel htmlFor="startDate">Start date *</FieldLabel>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate && <FieldDescription>{errors.startDate}</FieldDescription>}
            </Field>

            {isEdit && (
              <Field orientation="horizontal">
                <FieldLabel htmlFor="employeeStatus">Account status</FieldLabel>
                <ToggleGroup
                  id="employeeStatus"
                  defaultValue={[status]}
                  value={[status]}
                  onValueChange={(v) => v[0] && setStatus(v[0] as EmployeeStatus)}
                  spacing={2}
                >
                  <ToggleGroupItem value="active">Active</ToggleGroupItem>
                  <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
                  <ToggleGroupItem value="left">Left</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            )}
          </FieldGroup>

          <FieldSet>
            <FieldLegend variant="label">Pay</FieldLegend>
            <FieldGroup className="gap-3">
              <Field orientation="horizontal">
                <FieldLabel htmlFor="payType">Pay type</FieldLabel>
                <ToggleGroup
                  id="payType"
                  defaultValue={[payType]}
                  value={[payType]}
                  onValueChange={(v) => {
                    if (v[0]) {
                      const nextType = v[0] as PayType
                      setPayType(nextType)
                      if (nextType === "hourly") {
                        setSalaryAnnual("")
                        setErrors((prev) => {
                          const copy = { ...prev }
                          delete copy.salaryAnnual
                          return copy
                        })
                      } else {
                        setHourlyRate("")
                        setErrors((prev) => {
                          const copy = { ...prev }
                          delete copy.hourlyRate
                          return copy
                        })
                      }
                    }
                  }}
                  spacing={2}
                >
                  <ToggleGroupItem value="hourly">Hourly</ToggleGroupItem>
                  <ToggleGroupItem value="salaried">Salaried</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {payType === "hourly" ? (
                <Field data-invalid={Boolean(errors.hourlyRate)}>
                  <FieldLabel htmlFor="hourlyRate">Hourly rate (£) *</FieldLabel>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    aria-invalid={Boolean(errors.hourlyRate)}
                  />
                  {errors.hourlyRate && <FieldDescription>{errors.hourlyRate}</FieldDescription>}
                </Field>
              ) : (
                <Field data-invalid={Boolean(errors.salaryAnnual)}>
                  <FieldLabel htmlFor="salaryAnnual">Annual salary (£) *</FieldLabel>
                  <Input
                    id="salaryAnnual"
                    type="number"
                    step="100"
                    min="0"
                    value={salaryAnnual}
                    onChange={(e) => setSalaryAnnual(e.target.value)}
                    aria-invalid={Boolean(errors.salaryAnnual)}
                  />
                  {errors.salaryAnnual && <FieldDescription>{errors.salaryAnnual}</FieldDescription>}
                </Field>
              )}
            </FieldGroup>
          </FieldSet>

          {cannotEditSiteManager && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-600 dark:text-amber-400">
              Site Managers can only be edited or deleted by a Business Owner.
            </div>
          )}

          <SheetFooter className="px-0">
            <Button type="submit" disabled={submitting || cannotEditSiteManager} className="w-full">
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add employee"}
            </Button>
            <SheetClose render={<Button type="button" variant="outline" className="w-full" />}>Cancel</SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
