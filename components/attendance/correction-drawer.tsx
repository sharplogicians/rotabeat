"use client"
import { apiUrl } from "@/lib/api";

import * as React from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAppStore, useCurrentUser } from "@/lib/store";
import type {
  AttendanceRecord,
  ClockEvent,
  Employee,
  ExceptionType,
  Shift,
} from "@/lib/types";
import { formatDateLong, isoToLocalTime } from "@/lib/date-utils";
import { validateCorrectionTimes, EXCEPTION_LABELS } from "@/lib/calc";

interface CorrectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  siteId: string;
  date: string;
  shift?: Shift;
  record?: AttendanceRecord;
}

function timeFromIso(iso?: string): string {
  return isoToLocalTime(iso);
}

export function CorrectionDrawer({
  open,
  onOpenChange,
  employee,
  siteId,
  date,
  shift,
  record,
}: CorrectionDrawerProps) {
  const { state, dispatch } = useAppStore();
  const actor = useCurrentUser();

  const initialAbsent = record?.exceptions.includes("absent") ?? false;
  const [markAbsent, setMarkAbsent] = React.useState(initialAbsent);
  const [scheduledStartTime, setScheduledStartTime] = React.useState(
    shift?.startTime ?? record?.scheduledStartTime ?? "09:00",
  );
  const [scheduledEndTime, setScheduledEndTime] = React.useState(
    shift?.endTime ?? record?.scheduledEndTime ?? "17:00",
  );
  const [clockIn, setClockIn] = React.useState("");
  const [breakStart, setBreakStart] = React.useState("");
  const [breakEnd, setBreakEnd] = React.useState("");
  const [clockOut, setClockOut] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const events = record?.events ?? [];
      setMarkAbsent(record?.exceptions.includes("absent") ?? false);
      setScheduledStartTime(
        shift?.startTime ?? record?.scheduledStartTime ?? "09:00",
      );
      setScheduledEndTime(
        shift?.endTime ?? record?.scheduledEndTime ?? "17:00",
      );
      setClockIn(
        timeFromIso(events.find((e) => e.type === "clock_in")?.timestamp),
      );
      setBreakStart(
        timeFromIso(events.find((e) => e.type === "break_start")?.timestamp),
      );
      setBreakEnd(
        timeFromIso(events.find((e) => e.type === "break_end")?.timestamp),
      );
      setClockOut(
        timeFromIso(events.find((e) => e.type === "clock_out")?.timestamp),
      );
      setReason("");
      setError("");
    }
  }, [open, record, shift]);

  if (!employee) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;

    // Mandatory reason & sequence validation
    const validation = validateCorrectionTimes(
      markAbsent ? undefined : clockIn,
      markAbsent ? undefined : breakStart,
      markAbsent ? undefined : breakEnd,
      markAbsent ? undefined : clockOut,
      reason,
    );

    if (!validation.valid) {
      setError(validation.error || "Validation failed.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let savedRecord = null;
      const payload = {
        clockIn,
        breakStart,
        breakEnd,
        clockOut,
        markAbsent,
        scheduledStartTime,
        scheduledEndTime,
        reason: reason.trim(),
        actorName: actor.name,
      };

      if (record?.id) {
        // API PUT request
        const res = await fetch(apiUrl(`/api/attendance/${record.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          savedRecord = data.record;
        } else if (res.status === 404 || data.message?.includes("not found")) {
          // If record ID does not exist in DB yet, fallback to POST
          const postRes = await fetch(apiUrl("/api/attendance"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: employee.id,
              siteId,
              date,
              allowUpdate: true,
              ...payload,
            }),
          });
          const postData = await postRes.json();
          if (!postRes.ok || !postData.success) {
            throw new Error(
              postData.message || "Failed to create attendance record.",
            );
          }
          savedRecord = postData.record;
        } else {
          throw new Error(
            data.message || "Failed to update attendance record.",
          );
        }
      } else {
        // API POST request
        const res = await fetch(apiUrl("/api/attendance"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: employee.id,
            siteId,
            date,
            allowUpdate: true,
            ...payload,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(
            data.message || "Failed to create attendance record.",
          );
        }
        savedRecord = data.record;
      }

      // Local store sync
      let events: ClockEvent[] = [];
      let exceptions: ExceptionType[] = [];

      if (markAbsent) {
        exceptions = ["absent"];
      } else {
        let counter = 0;
        const makeEvent = (
          type: ClockEvent["type"],
          time: string,
        ): ClockEvent => ({
          id: `evt-corr-${Date.now()}-${counter++}`,
          type,
          timestamp: `${date}T${time}:00`,
          source: "manager_correction",
        });
        if (clockIn) events.push(makeEvent("clock_in", clockIn));
        if (breakStart) events.push(makeEvent("break_start", breakStart));
        if (breakEnd) events.push(makeEvent("break_end", breakEnd));
        if (clockOut) events.push(makeEvent("clock_out", clockOut));
      }

      // Sync shift in local store if matching shift exists
      const existingShift =
        shift ||
        state.shifts.find(
          (s) => s.employeeId === employee.id && s.date === date,
        );
      if (existingShift) {
        dispatch({
          type: "UPDATE_SHIFT",
          shift: {
            ...existingShift,
            startTime: scheduledStartTime,
            endTime: scheduledEndTime,
          },
        });
      }

      dispatch({
        type: "CORRECT_ATTENDANCE",
        attendanceId: savedRecord?.id || record?.id,
        employeeId: employee.id,
        siteId,
        date,
        shiftId: shift?.id,
        events,
        exceptions,
        reason: reason.trim(),
        actorName: actor.name,
        markAbsent,
      });

      toast.success(
        `Updated shift & attendance for ${employee.firstName} ${employee.lastName}`,
      );
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save correction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Correct attendance &amp; shift schedule</SheetTitle>
          <SheetDescription>
            {employee.firstName} {employee.lastName} — {formatDateLong(date)}
            {shift
              ? ` · Scheduled ${shift.startTime}–${shift.endTime}`
              : " · Unplanned attendance"}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4"
        >
          <FieldSet>
            <FieldLegend variant="label">
              Scheduled Shift (Updates Rota)
            </FieldLegend>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <Field>
                <FieldLabel htmlFor="schedStart">Shift start</FieldLabel>
                <Input
                  id="schedStart"
                  type="time"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedEnd">Shift end</FieldLabel>
                <Input
                  id="schedEnd"
                  type="time"
                  value={scheduledEndTime}
                  onChange={(e) => setScheduledEndTime(e.target.value)}
                />
              </Field>
            </div>
          </FieldSet>

          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="markAbsent">Mark as absent</FieldLabel>
              <Switch
                id="markAbsent"
                checked={markAbsent}
                onCheckedChange={setMarkAbsent}
              />
            </Field>
            <FieldDescription>
              Toggle on if the employee did not work this shift at all. This
              clears any existing clock events.
            </FieldDescription>
          </FieldGroup>

          {!markAbsent && (
            <FieldSet>
              <FieldLegend variant="label">Actual Clock Events</FieldLegend>
              <FieldGroup className="gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="clockIn">Clock in</FieldLabel>
                    <Input
                      id="clockIn"
                      type="time"
                      value={clockIn}
                      onChange={(e) => setClockIn(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="clockOut">Clock out</FieldLabel>
                    <Input
                      id="clockOut"
                      type="time"
                      value={clockOut}
                      onChange={(e) => setClockOut(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="breakStart">Break start</FieldLabel>
                    <Input
                      id="breakStart"
                      type="time"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="breakEnd">Break end</FieldLabel>
                    <Input
                      id="breakEnd"
                      type="time"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
          )}

          {record && record.exceptions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">
                Current exceptions:
              </span>
              {record.exceptions.map((ex) => (
                <Badge key={ex} variant="outline" className="text-xs">
                  {EXCEPTION_LABELS[ex] || ex}
                </Badge>
              ))}
            </div>
          )}

          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="reason">
              Reason for correction <span className="text-red-500">*</span>
            </FieldLabel>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="e.g. Employee forgot to clock out, confirmed with them directly."
              rows={3}
              required
              aria-invalid={Boolean(error)}
            />
            {error && (
              <FieldDescription className="text-red-500 font-medium">
                {error}
              </FieldDescription>
            )}
          </Field>

          <SheetFooter className="px-0 flex flex-col gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? "Saving..." : "Save correction"}
            </Button>
            <SheetClose
              render={
                <Button type="button" variant="outline" className="w-full" />
              }
            >
              Cancel
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
