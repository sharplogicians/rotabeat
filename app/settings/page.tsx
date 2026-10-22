"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import { toast } from "sonner"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore, useCurrentUser } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { OrgSettings } from "@/lib/types"
import { Settings2 } from "lucide-react"

export default function SettingsPage() {
  const { state, dispatch } = useAppStore()
  const actor = useCurrentUser()

  const [settings, setSettings] = React.useState<OrgSettings>(state.orgSettings)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    setSettings(state.orgSettings)
    setDirty(false)
  }, [state.orgSettings])

  if (state.role !== "head_office") {
    return (
      <AdminShell crumbs={[{ label: "Settings" }]}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Settings2 />
            </EmptyMedia>
            <EmptyTitle>Head office access required</EmptyTitle>
            <EmptyDescription>Only head office users can change organisation-wide settings.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AdminShell>
    )
  }

  function update<K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function handleSave() {
    dispatch({ type: "UPDATE_ORG_SETTINGS", settings, actorName: actor.name })
    toast.success("Organisation settings saved")
    setDirty(false)
  }

  function handleReset() {
    setSettings(state.orgSettings)
    setDirty(false)
  }

  return (
    <AdminShell crumbs={[{ label: "Settings" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Organisation-wide defaults for time tracking, payroll and rota behaviour.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>Basic details used across the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="org-name">Organisation name</FieldLabel>
                <Input
                  id="org-name"
                  value={settings.orgName}
                  onChange={(e) => update("orgName", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="time-zone">Time zone</FieldLabel>
                  <Input id="time-zone" value={settings.timeZone} disabled />
                  <FieldDescription>All sites currently operate on Europe/London.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="week-start">Week starts on</FieldLabel>
                  <Input id="week-start" value="Monday" disabled />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time tracking</CardTitle>
            <CardDescription>Rules applied when employees clock in and out at the kiosk.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="early-clock-in">Early clock-in allowance (minutes)</FieldLabel>
                  <Input
                    id="early-clock-in"
                    type="number"
                    min="0"
                    value={settings.earlyClockInMinutes}
                    onChange={(e) => update("earlyClockInMinutes", Number(e.target.value))}
                  />
                  <FieldDescription>How early an employee can clock in before their shift starts.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="late-threshold">Late threshold (minutes)</FieldLabel>
                  <Input
                    id="late-threshold"
                    type="number"
                    min="0"
                    value={settings.lateThresholdMinutes}
                    onChange={(e) => update("lateThresholdMinutes", Number(e.target.value))}
                  />
                  <FieldDescription>Minutes after shift start before a clock-in is flagged late.</FieldDescription>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="rounding">Payable time rounding</FieldLabel>
                <Select
                  value={settings.rounding}
                  onValueChange={(v) => v && update("rounding", v as OrgSettings["rounding"])}
                  items={[
                    { value: "exact", label: "Exact (no rounding)" },
                    { value: "5", label: "Nearest 5 minutes" },
                    { value: "15", label: "Nearest 15 minutes" },
                  ]}
                >
                  <SelectTrigger id="rounding" className="sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="exact">Exact (no rounding)</SelectItem>
                      <SelectItem value="5">Nearest 5 minutes</SelectItem>
                      <SelectItem value="15">Nearest 15 minutes</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <FieldSeparator />

              <Field orientation="horizontal">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="breaks-clocked">Breaks must be clocked</FieldLabel>
                  <FieldDescription>Require employees to start/end breaks at the kiosk.</FieldDescription>
                </div>
                <Switch
                  id="breaks-clocked"
                  checked={settings.breaksClocked}
                  onCheckedChange={(v) => update("breaksClocked", v)}
                />
              </Field>

              <Field orientation="horizontal">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="duplicate-prevention">Prevent duplicate clock actions</FieldLabel>
                  <FieldDescription>Block repeated clock-ins within a short window of each other.</FieldDescription>
                </div>
                <Switch
                  id="duplicate-prevention"
                  checked={settings.duplicateActionPrevention}
                  onCheckedChange={(v) => update("duplicateActionPrevention", v)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification &amp; Warnings Preferences</CardTitle>
            <CardDescription>Configure in-app warning alerts and email reminder rules for managers.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="email-reminders">Weekly Approval Email Reminders</FieldLabel>
                  <FieldDescription>Send an email reminder to Site Managers when weekly timesheet approval is due.</FieldDescription>
                </div>
                <Switch
                  id="email-reminders"
                  checked={settings.weeklyApprovalEmailReminder ?? true}
                  onCheckedChange={(v) => update("weeklyApprovalEmailReminder" as any, v)}
                />
              </Field>

              <FieldSeparator />

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">In-App Warnings (Always Active)</div>
              <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Missing Punch Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Shift Conflict Warnings</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Weekly Approval Deadlines</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Overdue Escalations</span>
                </div>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payroll</CardTitle>
            <CardDescription>Overtime and pay period defaults used in payroll exports.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor="overtime-enabled">Track overtime</FieldLabel>
                  <FieldDescription>Split payable hours into regular and overtime once a weekly threshold is exceeded.</FieldDescription>
                </div>
                <Switch
                  id="overtime-enabled"
                  checked={settings.overtimeEnabled}
                  onCheckedChange={(v) => update("overtimeEnabled", v)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="overtime-threshold">Weekly overtime threshold (hours)</FieldLabel>
                <Input
                  id="overtime-threshold"
                  type="number"
                  min="0"
                  disabled={!settings.overtimeEnabled}
                  value={settings.weeklyOvertimeThreshold}
                  onChange={(e) => update("weeklyOvertimeThreshold", Number(e.target.value))}
                  className="sm:w-40"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="pay-period">Default pay period</FieldLabel>
                <Input id="pay-period" value="Weekly" disabled className="sm:w-40" />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!dirty}>
              Discard changes
            </Button>
            <Button onClick={handleSave} disabled={!dirty}>
              Save settings
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AdminShell>
  )
}
