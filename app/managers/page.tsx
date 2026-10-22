"use client"

import * as React from "react"
 import { apiUrl } from '@/lib/api';
import Link from "next/link"
import { AdminShell } from "@/components/shell/admin-shell"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { UserCog } from "lucide-react"

export default function ManageManagersPage() {
  const { state } = useAppStore()
  const isOwner = state.role === "business_owner" || state.role === "head_office"

  if (!isOwner) {
    return (
      <AdminShell crumbs={[{ label: "Manage Managers" }]}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCog />
            </EmptyMedia>
            <EmptyTitle>Business Owner access required</EmptyTitle>
            <EmptyDescription>Only Business Owner accounts can access this section.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AdminShell>
    )
  }

  return (
    <AdminShell crumbs={[{ label: "Manage Managers" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Manager Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manager accounts are now integrated directly into the employee management workflow.
          </p>
        </div>

        <Card className="max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              <h2 className="font-heading text-base font-semibold">Flow Updated</h2>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              To add a manager for a location, select the location from the top header or site filter and add a new employee with the job title <strong className="text-foreground">&quot;Site Manager&quot;</strong>.
            </p>
            <div>
              <Button render={<Link href="/employees" />}>
                Go to Employees
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
