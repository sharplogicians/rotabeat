"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import { useParams, useRouter } from "next/navigation"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore, useCurrentUser } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmployeeFormSheet } from "@/components/employees/employee-form-sheet"
import { formatDateLong, formatTime12 } from "@/lib/date-utils"
import { computeWorkedTotals, minutesToHours } from "@/lib/calc"
import { MoreHorizontal, Pencil, KeyRound, UserX, UserCheck, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { state, dispatch } = useAppStore()
  const actor = useCurrentUser()

  const employee = state.employees.find((e) => e.id === params.id)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deactivateOpen, setDeactivateOpen] = React.useState(false)
  const [pinOpen, setPinOpen] = React.useState(false)
  const [pin, setPin] = React.useState("")
  const [showPin, setShowPin] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        // Fetch all employees (cross-site) so the detail page works for any employee
        const res = await fetch(apiUrl("/api/employees?siteId=all"))
        const data = await res.json()
        if (data.success && Array.isArray(data.employees)) {
          dispatch({ type: "SET_EMPLOYEES", employees: data.employees })
        }
      } catch (e) {
        console.error("Failed to load employees from DB", e)
      }
    }
    load()
  }, [dispatch])

  if (!employee) {
    return (
      <AdminShell crumbs={[{ label: "Employees", href: "/employees" }, { label: "Not found" }]}>
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-muted-foreground">This employee could not be found.</p>
          <Button variant="outline" onClick={() => router.push("/employees")}>
            <ArrowLeft data-icon="inline-start" />
            Back to employees
          </Button>
        </div>
      </AdminShell>
    )
  }

  const site = state.sites.find((s) => s.id === employee.primarySiteId)
  const shifts = state.shifts
    .filter((s) => s.employeeId === employee.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
  const attendance = state.attendance.filter((a) => a.employeeId === employee.id)

  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase()

  function handleDeactivate() {
    if (!employee) return
    const nextStatus = employee.status === "active" ? "inactive" : "active"
    dispatch({
      type: "SET_EMPLOYEE_STATUS",
      employeeId: employee.id,
      status: nextStatus,
      actorName: actor.name,
      reason: nextStatus === "inactive" ? "Deactivated from employee profile" : undefined,
    })
    toast.success(nextStatus === "inactive" ? `${employee.firstName} deactivated` : `${employee.firstName} reactivated`)
    setDeactivateOpen(false)
  }

  async function handleResetPin() {
    if (!employee || pin.length !== 4) return
    try {
      const res = await fetch(apiUrl("/api/employees"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: employee.id, pin }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to reset PIN in database.")
        return
      }
      dispatch({ type: "RESET_PIN", employeeId: employee.id, pin, actorName: actor.name })
      toast.success("Kiosk PIN reset")
      setPinOpen(false)
      setPin("")
    } catch {
      toast.error("Network error while resetting PIN.")
    }
  }

  return (
    <AdminShell
      crumbs={[
        { label: "Employees", href: "/employees" },
        { label: `${employee.firstName} ${employee.lastName}` },
      ]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">
                  {employee.firstName} {employee.lastName}
                </h1>
                <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                  {employee.status === "active" ? "Active" : employee.status === "inactive" ? "Inactive" : "Left"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {employee.jobTitle} · {employee.employeeNumber} · {site?.name}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <MoreHorizontal />
              Actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil data-icon="inline-start" />
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPinOpen(true)}>
                  <KeyRound data-icon="inline-start" />
                  Reset kiosk PIN
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeactivateOpen(true)} variant={employee.status === "active" ? "destructive" : undefined}>
                  {employee.status === "active" ? (
                    <>
                      <UserX data-icon="inline-start" />
                      Deactivate employee
                    </>
                  ) : (
                    <>
                      <UserCheck data-icon="inline-start" />
                      Reactivate employee
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Contact & employment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Email</span>
                <span>{employee.email}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Phone</span>
                <span>{employee.phone || "—"}</span>
              </div>
              <Separator />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Primary site</span>
                <span>{site?.name}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Start date</span>
                <span>{formatDateLong(employee.startDate)}</span>
              </div>
              {employee.leavingDate && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Leaving date</span>
                  <span>{formatDateLong(employee.leavingDate)}</span>
                </div>
              )}
              <Separator />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Pay type</span>
                <span>
                  {employee.payType === "hourly"
                    ? `£${employee.hourlyRate?.toFixed(2)} / hour`
                    : `£${employee.salaryAnnual?.toLocaleString()} / year`}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Kiosk PIN</span>
                {employee.jobTitle === "Site Manager" ? (
                  <span className="text-sm text-muted-foreground italic">Manager Login</span>
                ) : employee.pin ? (
                  <div className="flex items-center gap-2 h-7">
                    <span className="font-mono text-sm font-semibold tracking-wider inline-flex items-center h-6 leading-none select-none">
                      {showPin ? employee.pin : "••••"}
                    </span>
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none"
                      onClick={() => setShowPin(!showPin)}
                      title={showPin ? "Hide PIN" : "Unhide PIN"}
                    >
                      {showPin ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                ) : (
                  <span>{employee.pinSet ? "Set" : "Not set"}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Recent shifts</CardTitle>
              <CardDescription>The most recent scheduled shifts for this employee.</CardDescription>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No shifts scheduled yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Worked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => {
                      const record = attendance.find((a) => a.shiftId === shift.id)
                      const worked = record ? minutesToHours(computeWorkedTotals(record.events).payableMinutes) : null
                      return (
                        <TableRow key={shift.id}>
                          <TableCell>{formatDateLong(shift.date)}</TableCell>
                          <TableCell className="text-muted-foreground">{shift.role}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatTime12(shift.startTime)}–{formatTime12(shift.endTime)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {worked !== null ? `${worked.toFixed(2)} hrs` : "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EmployeeFormSheet open={editOpen} onOpenChange={setEditOpen} employee={employee} />

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {employee.status === "active" ? "Deactivate employee?" : "Reactivate employee?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {employee.status === "active"
                ? `${employee.firstName} ${employee.lastName} will no longer be able to clock in at the kiosk or be scheduled for new shifts.`
                : `${employee.firstName} ${employee.lastName} will be restored to active status.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset kiosk PIN</DialogTitle>
            <DialogDescription>
              Set a new 4-digit PIN for {employee.firstName} to use at the tablet kiosk.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <InputOTP maxLength={4} value={pin} onChange={setPin}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleResetPin} disabled={pin.length !== 4}>
              Set PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
