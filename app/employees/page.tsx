"use client"

import * as React from "react";
import { apiUrl } from "@/lib/api";
import Link from "next/link";
import { toast } from "sonner";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAppStore, useAccessibleSites } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  UserPlus,
  Search,
  Users,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  UserMinus,
  Eye,
  EyeOff,
} from "lucide-react";
import { EmployeeFormSheet } from "@/components/employees/employee-form-sheet";
import type { Employee, EmployeeStatus } from "@/lib/types";

function initials(e: Employee) {
  const f = e.firstName ? e.firstName[0] : "";
  const l = e.lastName ? e.lastName[0] : "";
  return `${f}${l}`.toUpperCase() || "EM";
}

const STATUS_BADGE: Record<
  EmployeeStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  inactive: { label: "Inactive", variant: "secondary" },
  left: { label: "Left", variant: "outline" },
};

const STATUS_FILTER_ITEMS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "left", label: "Left" },
  { value: "all", label: "All statuses" },
];

export default function EmployeesPage() {
  const { state, dispatch } = useAppStore();
  const sites = useAccessibleSites();
  const siteIds = React.useMemo(() => new Set(sites.map((s) => s.id)), [sites]);
  const siteFilterItems = React.useMemo(() => [
    { value: "all", label: "All locations" },
    ...sites.map((s) => ({ value: s.id, label: s.name })),
  ], [sites]);

  const [query, setQuery] = React.useState("");
  const [siteFilter, setSiteFilter] = React.useState<string>(
    state.currentSiteId || "all",
  );
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<
    Employee | undefined
  >(undefined);
  const [visiblePins, setVisiblePins] = React.useState<Record<string, boolean>>({});
  const [showAllPins, setShowAllPins] = React.useState(false);

  const togglePin = (empId: string) => {
    setVisiblePins((prev) => ({ ...prev, [empId]: !prev[empId] }));
  };

  const toggleAllPins = () => {
    const next = !showAllPins;
    setShowAllPins(next);
    setVisiblePins({});
  };

  // Sync siteFilter when currentSiteId changes in header switcher
  React.useEffect(() => {
    if (state.currentSiteId) {
      setSiteFilter(state.currentSiteId);
    }
  }, [state.currentSiteId]);

  const loadEmployeesFromDb = React.useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/employees"));
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        dispatch({ type: "SET_EMPLOYEES", employees: data.employees });
      }
    } catch (e) {
      console.error("Failed to load employees from DB", e);
    }
  }, [dispatch]);

  React.useEffect(() => {
    loadEmployeesFromDb();
  }, [loadEmployeesFromDb]);

  const isBusinessOwner =
    state.role === "business_owner" || state.role === "head_office";

  async function handleDeleteEmployee(emp: Employee) {
    if (emp.jobTitle === "Site Manager" && !isBusinessOwner) {
      toast.error("Site Managers can only be deleted by a Business Owner.");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to delete ${emp.firstName} ${emp.lastName}?`,
      )
    )
      return;
    try {
      const res = await fetch(apiUrl(`/api/employees?id=${emp.id}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${emp.firstName} ${emp.lastName}`);
        loadEmployeesFromDb();
      } else {
        toast.error(data.message || "Failed to delete employee");
      }
    } catch {
      toast.error("Failed to delete employee");
    }
  }

  async function handleToggleStatus(emp: Employee) {
    if (emp.jobTitle === "Site Manager" && !isBusinessOwner) {
      toast.error("Site Managers can only be deactivated by a Business Owner.");
      return;
    }
    const nextStatus: EmployeeStatus =
      emp.status === "active" ? "inactive" : "active";
    const actionLabel = nextStatus === "inactive" ? "deactivate" : "reactivate";
    if (
      !confirm(
        `Are you sure you want to ${actionLabel} ${emp.firstName} ${emp.lastName}?`,
      )
    )
      return;
    try {
      const res = await fetch(apiUrl("/api/employees"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `${nextStatus === "inactive" ? "Deactivated" : "Reactivated"} ${emp.firstName} ${emp.lastName}`,
        );
        loadEmployeesFromDb();
      } else {
        toast.error(data.message || `Failed to ${actionLabel} employee`);
      }
    } catch {
      toast.error(`Failed to ${actionLabel} employee`);
    }
  }

  async function handleMarkLeft(emp: Employee) {
    if (emp.jobTitle === "Site Manager" && !isBusinessOwner) {
      toast.error("Site Managers can only be updated by a Business Owner.");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to mark ${emp.firstName} ${emp.lastName} as Left?`,
      )
    )
      return;
    try {
      const res = await fetch(apiUrl("/api/employees"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emp.id, status: "left" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Marked ${emp.firstName} ${emp.lastName} as Left`);
        loadEmployeesFromDb();
      } else {
        toast.error(data.message || "Failed to update employee status");
      }
    } catch {
      toast.error("Failed to update employee status");
    }
  }

  const employees = React.useMemo(() => {
    return state.employees
      .filter((e) => siteIds.has(e.primarySiteId))
      .filter((e) =>
        siteFilter === "all" ? true : e.primarySiteId === siteFilter,
      )
      .filter((e) =>
        statusFilter === "all" ? true : e.status === statusFilter,
      )
      .filter((e) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q) ||
          e.jobTitle.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
  }, [state.employees, siteIds, siteFilter, statusFilter, query]);

  const siteName = (id: string) =>
    sites.find((s) => s.id === id)?.name ??
    state.sites.find((s) => s.id === id)?.name ??
    "—";

  return (
    <AdminShell crumbs={[{ label: "Employees" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            Employees
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage employee records, pay setup and kiosk access across your
            locations.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <InputGroup className="sm:max-w-xs">
              <InputGroupInput
                placeholder="Search name, ID, role..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>

            {!state.currentSiteId && (
              <Select
                value={siteFilter}
                onValueChange={(v) => {
                  if (v) {
                    setSiteFilter(v);
                    if (v !== "all") {
                      dispatch({ type: "SET_SITE", siteId: v });
                    }
                  }
                }}
                items={siteFilterItems}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All sites</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}

            <Select
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v)}
              items={STATUS_FILTER_ITEMS}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              setEditingEmployee(undefined);
              setFormOpen(true);
            }}
          >
            <UserPlus data-icon="inline-start" />
            Add employee
          </Button>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto min-w-0 max-w-full shadow-inner">
          {employees.length === 0 ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No employees found</EmptyTitle>
                <EmptyDescription>
                  Try adjusting your search or filters, or add a new employee.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Pay type</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1.5">
                      <span>Kiosk PIN</span>
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none"
                        onClick={toggleAllPins}
                        title={showAllPins ? "Hide all PINs" : "Show all PINs"}
                      >
                        {showAllPins ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/employees/${e.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <Avatar className="size-8">
                          {e.profileImage && (
                            <AvatarImage
                              src={e.profileImage}
                              alt={`${e.firstName} ${e.lastName}`}
                            />
                          )}
                          <AvatarFallback className="text-xs">
                            {initials(e)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {e.firstName} {e.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {e.employeeNumber}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.jobTitle}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {siteName(e.primarySiteId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.payType === "hourly"
                        ? `£${e.hourlyRate?.toFixed(2)}/hr`
                        : `£${e.salaryAnnual?.toLocaleString()}/yr`}
                    </TableCell>
                    <TableCell onClick={(evt) => evt.stopPropagation()}>
                      {e.jobTitle === "Site Manager" ? (
                        <span className="text-xs text-muted-foreground italic">Manager Login</span>
                      ) : e.pin ? (
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-muted/60 hover:bg-muted px-2 py-1 rounded-md border border-border/60">
                          <span className="font-semibold tracking-wider min-w-[32px] text-center">
                            {(visiblePins[e.id] !== undefined ? visiblePins[e.id] : showAllPins)
                              ? e.pin
                              : "••••"}
                          </span>
                          <button
                            type="button"
                            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors focus:outline-none p-0"
                            onClick={() => togglePin(e.id)}
                            title={
                              (visiblePins[e.id] !== undefined ? visiblePins[e.id] : showAllPins)
                                ? "Hide PIN"
                                : "Unhide PIN"
                            }
                          >
                            {(visiblePins[e.id] !== undefined ? visiblePins[e.id] : showAllPins) ? (
                              <EyeOff className="size-3" />
                            ) : (
                              <Eye className="size-3" />
                            )}
                          </button>
                        </div>
                      ) : e.pinSet ? (
                        <Badge variant="secondary">Set</Badge>
                      ) : (
                        <Badge variant="outline">Not set</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[e.status]?.variant || "default"}>
                        {STATUS_BADGE[e.status]?.label || e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(evt) => evt.stopPropagation()}
                      >
                        {e.jobTitle === "Site Manager" && !isBusinessOwner ? (
                          <span className="text-xs text-muted-foreground italic px-2">
                            Managed by Owner
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingEmployee(e);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil data-icon="inline-start" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={
                                e.status === "active"
                                  ? "text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:hover:bg-amber-950/30"
                                  : "text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/50 dark:hover:bg-emerald-950/30"
                              }
                              onClick={() => handleToggleStatus(e)}
                            >
                              {e.status === "active" ? (
                                <>
                                  <UserX data-icon="inline-start" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck data-icon="inline-start" />
                                  Reactivate
                                </>
                              )}
                            </Button>
                            {e.status !== "left" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                                onClick={() => handleMarkLeft(e)}
                              >
                                <UserMinus data-icon="inline-start" />
                                Left
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteEmployee(e)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <EmployeeFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
      />
    </AdminShell>
  );
}
