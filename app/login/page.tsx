"use client"

import * as React from "react"
import { apiUrl } from '@/lib/api';
import { useRouter } from "next/navigation"
import { Clock, CalendarRange, ClipboardCheck, Tablet, UserCheck, ShieldCheck, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"

export default function LoginPage() {
  const router = useRouter()
  const { dispatch } = useAppStore()
  const [loginType, setLoginType] = React.useState<"manager" | "employee">("manager")

  // Form states
  const [identifier, setIdentifier] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pin, setPin] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [showPin, setShowPin] = React.useState(false)
  const [rememberMe, setRememberMe] = React.useState(true)
  const [loading, setLoading] = React.useState(false)

  // Load remembered credentials on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("rotaflow_remembered_login")
        if (saved) {
          const creds = JSON.parse(saved)
          if (creds && typeof creds === "object") {
            if (creds.loginType) setLoginType(creds.loginType)
            if (creds.identifier) setIdentifier(creds.identifier)
            if (creds.password) setPassword(creds.password)
            if (creds.pin) setPin(creds.pin)
            setRememberMe(true)
          }
        }
      } catch { }
    }
  }, [])

  // Switch demo defaults when tab changes
  const handleTabChange = (val: string) => {
    const mode = val as "manager" | "employee"
    setLoginType(mode)

    // Try loading remembered credentials for this tab mode
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("rotaflow_remembered_login")
        if (saved) {
          const creds = JSON.parse(saved)
          if (creds && creds.loginType === mode) {
            if (creds.identifier) setIdentifier(creds.identifier)
            if (mode === "employee" && creds.pin) setPin(creds.pin)
            if (mode === "manager" && creds.password) setPassword(creds.password)
            return
          }
        }
      } catch { }
    }

    setIdentifier("")
    if (mode === "employee") {
      setPin("")
    } else {
      setPassword("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const secretInput = loginType === "employee" ? pin : password

    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: loginType === "manager" ? password : "",
          pin: loginType === "employee" ? pin : "",
          loginType,
        }),
      })

      let data: any = null
      const contentType = res.headers.get("content-type") || ""

      if (contentType.includes("application/json")) {
        try {
          data = await res.json()
        } catch (jsonErr) {
          console.error("Failed to parse JSON response:", jsonErr)
        }
      } else {
        const rawText = await res.text()
        console.error("Non-JSON response from server:", res.status, res.statusText, rawText)
      }

      if (!res.ok || !data?.success) {
        const errorMessage =
          data?.message ||
          `Server Error (${res.status} ${res.statusText || "Internal Server Error"}). Please check server logs.`
        toast.error(errorMessage)
        setLoading(false)
        return
      }

      if (data.user) {
        if (typeof window !== "undefined") {
          sessionStorage.clear()
          if (rememberMe) {
            try {
              localStorage.setItem(
                "rotaflow_remembered_login",
                JSON.stringify({
                  loginType,
                  identifier: identifier.trim(),
                  password: loginType === "manager" ? password : "",
                  pin: loginType === "employee" ? pin : "",
                })
              )
            } catch { }
          } else {
            try {
              localStorage.removeItem("rotaflow_remembered_login")
            } catch { }
          }
        }
        const u = data.user
        const initials = u.avatarInitials || `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "US"

        // Immediately fetch and dispatch fresh DB locations so the store has all real locations
        try {
          const locRes = await fetch(apiUrl("/api/locations"))
          if (locRes.ok) {
            const locData = await locRes.json()
            if (locData.success && Array.isArray(locData.locations)) {
              const formattedSites = locData.locations.map((loc: any) => ({
                id: loc.id,
                name: loc.name,
                town: loc.town,
                address: loc.address || "",
                city: loc.city || loc.town || "",
                postalCode: loc.postalCode || "",
                country: loc.country || "UK",
                phone: loc.phone || "",
                email: loc.email || "",
                managerId: loc.managerId || "",
                businessOwnerId: loc.businessOwnerId || "user-aisha",
                timeZone: loc.timeZone || "Europe/London",
                weekStart: (loc.weekStart as any) || "monday",
                status: (loc.status as any) || "active",
                kiosks: loc.kiosks || [],
              }))
              dispatch({ type: "SET_SITES", sites: formattedSites })
            }
          }
        } catch { }

        dispatch({
          type: "SET_USER_SESSION",
          userId: u.id,
          role: u.role,
          siteId: u.locationId,
          profile: {
            id: u.id,
            name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            email: u.email || "",
            username: u.username || u.employeeNumber || "",
            role: u.role,
            status: u.status || "active",
            siteIds: u.locationId ? [u.locationId] : [],
            avatarInitials: initials,
          },
        })

        toast.success(data.message || "Signed in successfully!")

        // Navigate with full window load so session cookies and DB state are freshly initialized
        const targetUrl = data.user.role === "employee" ? apiUrl("/attendance/clock") : apiUrl("/dashboard")
        if (typeof window !== "undefined") {
          window.location.href = targetUrl
        } else {
          router.push(targetUrl)
        }
      }
    } catch (err: any) {
      console.error("Login request exception:", err)
      const exactMsg = err?.message ? `Connection failed: ${err.message}` : "Failed to connect to authentication server."
      toast.error(exactMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-12">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Clock className="size-5" />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">RotaFlow</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-12">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to access your RotaFlow account.</p>
          </div>

          <Tabs value={loginType} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manager" className="text-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Owner / Manager
              </TabsTrigger>
              <TabsTrigger value="employee" className="text-xs">
                <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                Employee PIN
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">
                  {loginType === "employee" ? "Employee Number, Username, or Email" : "Username or Email"}
                </FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder={loginType === "employee" ? "e.g. EMP-1002 or john@email.com" : "john@email.com"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </Field>

              {loginType === "manager" ? (
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
              ) : (
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="pin">Employee PIN (4 Digits)</FieldLabel>
                  </div>
                  <div className="relative">
                    <Input
                      id="pin"
                      type={showPin ? "text" : "password"}
                      autoComplete="current-password"
                      maxLength={6}
                      placeholder="Enter your 4-digit PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="pr-10 font-mono tracking-widest"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                      onClick={() => setShowPin(!showPin)}
                      tabIndex={-1}
                      title={showPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
              )}

              <Field orientation="horizontal">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                />
                <FieldLabel htmlFor="remember" className="text-sm font-normal cursor-pointer select-none">
                  Remember me on this device
                </FieldLabel>
              </Field>

              <Button type="submit" disabled={loading} className="mt-2 w-full">
                {loading ? "Signing in…" : loginType === "employee" ? "Sign in with PIN" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          RotaFlow Attendance &amp; Workforce Management System.
        </p>
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative z-10 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">Northern Table Group</span>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-balance">
            One weekly workflow, from rota to payroll.
          </h2>
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          {[
            { icon: CalendarRange, text: "Build the weekly rota once, and publish it to every site." },
            { icon: Tablet, text: "Staff clock in and out using custom PIN — simple and secure." },
            { icon: ClipboardCheck, text: "Review exceptions, approve hours, export for payroll." },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-3 rounded-xl bg-white/5 p-4">
              <item.icon className="mt-0.5 size-5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-primary-foreground/90">{item.text}</p>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60">
          Bright Café · Riverside Kitchen · Central Bakery
        </p>
      </div>
    </div>
  )
}
