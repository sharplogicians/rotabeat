"use client"

import * as React from "react"
import { apiUrl } from '@/lib/api'
import { useRouter } from "next/navigation"
import {
  Clock,
  CalendarRange,
  ClipboardCheck,
  Tablet,
  UserCheck,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ArrowLeft,
  RefreshCw,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { RotaBeatLogo, RotaBeatIcon } from "@/components/brand/rotabeat-logo"

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

  // Forgot password modal states
  const [forgotOpen, setForgotOpen] = React.useState(false)
  const [forgotStep, setForgotStep] = React.useState<"email" | "code">("email")
  const [forgotIdentifier, setForgotIdentifier] = React.useState("")
  const [forgotCode, setForgotCode] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [forgotLoading, setForgotLoading] = React.useState(false)
  const [maskedEmail, setMaskedEmail] = React.useState("")
  const [resendCountdown, setResendCountdown] = React.useState(0)

  // Resend code countdown timer
  React.useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCountdown])

  // Load remembered credentials on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved =
          localStorage.getItem("rotabeat_remembered_login") ||
          localStorage.getItem("rotaflow_remembered_login")
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
        const saved =
          localStorage.getItem("rotabeat_remembered_login") ||
          localStorage.getItem("rotaflow_remembered_login")
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
                "rotabeat_remembered_login",
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
              localStorage.removeItem("rotabeat_remembered_login")
              localStorage.removeItem("rotaflow_remembered_login")
            } catch { }
          }
        }
        const u = data.user
        const initials =
          u.avatarInitials ||
          `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() ||
          "US"

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
        const targetUrl =
          data.user.role === "employee" ? apiUrl("/attendance/clock") : apiUrl("/dashboard")
        if (typeof window !== "undefined") {
          window.location.href = targetUrl
        } else {
          router.push(targetUrl)
        }
      }
    } catch (err: any) {
      console.error("Login request exception:", err)
      const exactMsg = err?.message
        ? `Connection failed: ${err.message}`
        : "Failed to connect to authentication server."
      toast.error(exactMsg)
    } finally {
      setLoading(false)
    }
  }

  // Request 6-digit verification code
  async function handleSendVerificationCode(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!forgotIdentifier.trim()) {
      toast.error("Please enter your registered email address or username.")
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to send verification code.")
        return
      }

      setMaskedEmail(data.maskedEmail || "")
      setForgotStep("code")
      setResendCountdown(60)
      toast.success(data.message || "Verification code sent to your registered email!")
      if (data.devCode) {
        toast.info(`[Dev Code] Verification code: ${data.devCode}`, { duration: 10000 })
      }
    } catch (err: any) {
      toast.error("Could not reach the server. Please try again.")
    } finally {
      setForgotLoading(false)
    }
  }

  // Submit 6-digit code and set new password in the database
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()

    const cleanCode = forgotCode.replace(/\D/g, "").slice(0, 6)
    if (cleanCode.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code.")
      return
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter.")
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: forgotIdentifier.trim(),
          code: cleanCode,
          newPassword: newPassword.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to reset password.")
        return
      }

      toast.success(data.message || "Password reset successfully! You can now log in.")
      // Automatically prefill the new credentials on the login screen
      setIdentifier(forgotIdentifier.trim())
      setPassword(newPassword.trim())
      setForgotOpen(false)
      setForgotStep("email")
      setForgotCode("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      toast.error("Could not reach the server. Please try again.")
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-12">
        <div className="flex items-center gap-2.5">
          <RotaBeatLogo size="md" priority />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-12">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to access your RotaBeat account.</p>
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
                    <button
                      type="button"
                      onClick={() => {
                        setForgotIdentifier(identifier)
                        setForgotStep("email")
                        setForgotCode("")
                        setNewPassword("")
                        setConfirmPassword("")
                        setForgotOpen(true)
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 hover:underline transition-colors focus:outline-none"
                    >
                      Forgot password?
                    </button>
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
                      maxLength={4}
                      placeholder="Enter your 4-digit PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
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
          RotaBeat Attendance &amp; Workforce Management System.
        </p>
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#4F46E5] via-[#4338CA] to-[#312E81] p-12 text-white lg:flex shadow-2xl">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="absolute -right-16 -top-16 opacity-15 pointer-events-none">
          <RotaBeatIcon size={340} />
        </div>

        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-100 backdrop-blur-sm">
              Workforce Simplified
            </span>
          </div>
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-white leading-tight">
            One weekly workflow, from rota to payroll.
          </h2>
          <p className="text-sm text-indigo-100/80 max-w-md">
            Smart scheduling, automated GPS &amp; PIN attendance, exception handling, and one-click payroll exports.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3.5 my-auto">
          {[
            { icon: CalendarRange, text: "Build the weekly rota once, and publish instantly to staff." },
            { icon: Tablet, text: "Staff clock in & out with fast PIN entry or tablet kiosk." },
            { icon: ClipboardCheck, text: "Review exceptions, approve hours, and export clean payroll." },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-3.5 rounded-xl bg-white/10 p-4 border border-white/10 backdrop-blur-md">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                <item.icon className="size-4" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-white/95">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-indigo-200/80 border-t border-white/10 pt-4">
          <span>RotaBeat Platform</span>
          <span>Fast · Accurate · Compliant</span>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md p-6">
          {forgotStep === "email" ? (
            <form onSubmit={handleSendVerificationCode} className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="size-11 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <KeyRound className="size-5" />
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight">Forgot password?</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Enter your Owner or Manager registered email or username. We will send a 6-digit verification code to reset your password.
                </DialogDescription>
              </div>

              <div className="space-y-2 pt-2">
                <FieldLabel htmlFor="forgot-identifier" className="text-sm font-medium">
                  Registered Email or Username
                </FieldLabel>
                <Input
                  id="forgot-identifier"
                  type="text"
                  placeholder="e.g. aisha.khan@northerntable.co.uk"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={forgotLoading || !forgotIdentifier.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {forgotLoading ? "Sending Code…" : "Send Verification Code"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForgotOpen(false)}
                  className="w-full text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="size-11 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Mail className="size-5" />
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight">Enter Verification Code</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  A 6-digit code has been sent to{" "}
                  <span className="font-semibold text-foreground">{maskedEmail || forgotIdentifier}</span>.
                  Enter it below to reset your password.
                </DialogDescription>
              </div>

              {/* 6-Digit OTP */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    6-Digit Verification Code
                  </FieldLabel>
                  {resendCountdown > 0 ? (
                    <span className="text-xs text-muted-foreground">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendVerificationCode()}
                      disabled={forgotLoading}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="size-3" /> Resend code
                    </button>
                  )}
                </div>

                <div className="flex justify-center py-2">
                  <InputOTP
                    maxLength={6}
                    value={forgotCode}
                    onChange={(val) => setForgotCode(val.replace(/\D/g, "").slice(0, 6))}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot index={0} className="size-11 text-lg font-bold" />
                      <InputOTPSlot index={1} className="size-11 text-lg font-bold" />
                      <InputOTPSlot index={2} className="size-11 text-lg font-bold" />
                      <InputOTPSlot index={3} className="size-11 text-lg font-bold" />
                      <InputOTPSlot index={4} className="size-11 text-lg font-bold" />
                      <InputOTPSlot index={5} className="size-11 text-lg font-bold" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <FieldLabel htmlFor="confirm-password">Confirm New Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive font-medium">Passwords do not match</p>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={
                    forgotLoading ||
                    forgotCode.length !== 6 ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword
                  }
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {forgotLoading ? "Resetting Password…" : "Reset Password & Save"}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotStep("email")}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-1"
                >
                  <ArrowLeft className="size-3.5" /> Back to email
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
