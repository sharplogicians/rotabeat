"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { formatDateTime } from "@/lib/date-utils"
import { ScrollText, Search } from "lucide-react"
import { formatAuditAction, formatAuditDetails } from "@/lib/audit-format"

export default function AuditLogPage() {
  const { state } = useAppStore()

  const [query, setQuery] = React.useState("")
  const [entityFilter, setEntityFilter] = React.useState("all")
  const [siteFilter, setSiteFilter] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  if (state.role !== "head_office") {
    return (
      <AdminShell crumbs={[{ label: "Audit log" }]}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>Head office access required</EmptyTitle>
            <EmptyDescription>Only head office users can view the organisation-wide audit log.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AdminShell>
    )
  }

  const entities = Array.from(new Set(state.auditLog.map((a) => a.entity))).sort()

  const events = state.auditLog
    .filter((a) => (entityFilter === "all" ? true : a.entity === entityFilter))
    .filter((a) => (siteFilter === "all" ? true : a.siteId === siteFilter))
    .filter((a) => (dateFrom ? a.timestamp.slice(0, 10) >= dateFrom : true))
    .filter((a) => (dateTo ? a.timestamp.slice(0, 10) <= dateTo : true))
    .filter((a) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        a.userName.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.entity.toLowerCase().includes(q) ||
        (a.newValue ?? "").toLowerCase().includes(q) ||
        (a.previousValue ?? "").toLowerCase().includes(q) ||
        (a.reason ?? "").toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  function siteName(id?: string) {
    if (!id) return "—"
    return state.sites.find((s) => s.id === id)?.name ?? id
  }

  return (
    <AdminShell crumbs={[{ label: "Audit log" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            A complete, filterable history of changes made across your organisation.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 sm:min-w-52">
              <InputGroup>
                <InputGroupInput
                  placeholder="Search user, action, details..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
              </InputGroup>
            </div>

            <Field className="sm:w-44">
              <FieldLabel htmlFor="entity-filter" className="text-xs text-muted-foreground">
                Entity
              </FieldLabel>
              <Select
                value={entityFilter}
                onValueChange={(v) => v && setEntityFilter(v)}
                items={[{ value: "all", label: "All entities" }, ...entities.map((e) => ({ value: e, label: e }))]}
              >
                <SelectTrigger id="entity-filter">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All entities</SelectItem>
                    {entities.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="sm:w-44">
              <FieldLabel htmlFor="site-filter" className="text-xs text-muted-foreground">
                Site
              </FieldLabel>
              <Select
                value={siteFilter}
                onValueChange={(v) => v && setSiteFilter(v)}
                items={[
                  { value: "all", label: "All sites" },
                  ...state.sites.map((s) => ({ value: s.id, label: s.name })),
                ]}
              >
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All sites</SelectItem>
                    {state.sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="sm:w-36">
              <FieldLabel htmlFor="date-from" className="text-xs text-muted-foreground">
                From
              </FieldLabel>
              <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Field>

            <Field className="sm:w-36">
              <FieldLabel htmlFor="date-to" className="text-xs text-muted-foreground">
                To
              </FieldLabel>
              <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"} matching your filters.
          </p>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto min-w-0 max-w-full shadow-inner">
          {events.length === 0 ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollText />
                </EmptyMedia>
                <EmptyTitle>No matching events</EmptyTitle>
                <EmptyDescription>Try adjusting your search or filters.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date &amp; time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(event.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{event.userName}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {event.role.replace("_", " ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {event.entity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{formatAuditAction(event.action)}</TableCell>
                    <TableCell className="text-muted-foreground">{siteName(event.siteId)}</TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {event.previousValue && (
                          <span>Before: {formatAuditDetails(event.previousValue, state.employees, event.action, event.userName)}</span>
                        )}
                        {event.newValue && (
                          <span>{formatAuditDetails(event.newValue, state.employees, event.action, event.userName, event.previousValue)}</span>
                        )}
                        {event.reason && <span className="italic">Reason: {event.reason}</span>}
                        <span className="text-[11px] text-muted-foreground/70">via {event.source}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
