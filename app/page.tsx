"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarRange,
  Clock,
  ScanFace,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
  Building2,
  FileSpreadsheet,
  Tablet,
  Check,
  ChevronDown,
  Menu,
  X,
  Lock,
  AlertTriangle,
  History,
  TrendingUp,
} from "lucide-react"
import { RotaBeatLogo, RotaBeatIcon } from "@/components/brand/rotabeat-logo"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  const loginUrl = "/login"
  const kioskUrl = "/kiosk"

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b0f19] dark:text-slate-100 antialiased selection:bg-indigo-600 selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          1. STICKY NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 dark:bg-[#0b0f19]/85 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <RotaBeatLogo size="md" priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Features
            </a>
            <a href="#biometrics" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Biometrics
            </a>
            <a href="#comparison" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Why RotaBeat
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              FAQ
            </a>
            <Link href="/terms-of-service" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Terms
            </Link>
            <Link href="/privacy-policy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Privacy
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href={kioskUrl}>
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:inline-flex border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Tablet className="size-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                Tablet Kiosk
              </Button>
            </Link>
            <Link href={loginUrl}>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/20 px-5"
              >
                Log In
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <Link href={loginUrl}>
              <Button size="sm" className="bg-indigo-600 text-white text-xs px-3 py-1 h-8">
                Log In
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] px-4 pt-2 pb-6 space-y-3">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600"
            >
              Features
            </a>
            <a
              href="#biometrics"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600"
            >
              Biometrics
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600"
            >
              Why RotaBeat
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600"
            >
              FAQ
            </a>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <Link
                href="/terms-of-service"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs text-slate-500 hover:text-indigo-600"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy-policy"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs text-slate-500 hover:text-indigo-600"
              >
                Privacy Policy
              </Link>
              <Link href={kioskUrl} onClick={() => setMobileMenuOpen(false)} className="mt-2">
                <Button variant="outline" className="w-full text-xs">
                  <Tablet className="size-3.5 mr-2" />
                  Launch Tablet Kiosk
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Glow Effects & Grid Background */}
        <div
          className="absolute inset-0 -z-10 opacity-30 dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(#6366f1 1px, transparent 1px), radial-gradient(#6366f1 1px, #f8fafc 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: "0 0, 20px 20px",
          }}
        />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 w-[600px] h-[300px] bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-semibold mb-6 shadow-xs animate-in fade-in slide-in-from-bottom-2">
            <Sparkles className="size-4 text-indigo-500" />
            <span>Next-Gen Workforce & Biometric Management</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.15]">
            Workforce Management,{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Simplified.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Build weekly rotas in minutes, verify clock-ins with AI facial recognition, automatically track worked hours,
            and export clean payroll — without spreadsheet disputes.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={loginUrl} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-6 text-base rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                Log In to Workspace
                <ArrowRight className="size-5 ml-2" />
              </Button>
            </Link>
            <Link href={kioskUrl} className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold px-6 py-6 text-base rounded-xl"
              >
                <Tablet className="size-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                Open Tablet Kiosk
              </Button>
            </Link>
          </div>

          {/* Trust Highlights */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              UK GDPR & Biometric Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Zero Buddy-Punching Guarantee
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              Multi-Branch Support
            </span>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              HERO UI MOCKUP SHOWCASE
          ───────────────────────────────────────────────────────────── */}
          <div className="mt-14 relative max-w-5xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#111625]/95 shadow-2xl overflow-hidden p-4 sm:p-6 text-left">
            {/* Window Top Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-rose-500/80" />
                <div className="size-3 rounded-full bg-amber-500/80" />
                <div className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-medium text-slate-400">RotaBeat Dashboard — Live Operations</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Attendance Engine Active
              </div>
            </div>

            {/* Mockup Dashboard Content */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {/* Card 1: Rota Schedule */}
              <div className="bg-slate-50 dark:bg-[#182032] p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Weekly Schedule
                    </span>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2 py-0.5 rounded">
                      Locked & Final
                    </span>
                  </div>
                  <h3 className="mt-2 font-bold text-sm text-slate-900 dark:text-white">Manchester Branch</h3>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-white dark:bg-[#131927] border border-slate-200/50 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Chef & Kitchen Staff</p>
                        <p className="text-[10px] text-slate-500">08:00 AM – 04:30 PM</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        4 on duty
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-[#131927] border border-slate-200/50 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Front of House</p>
                        <p className="text-[10px] text-slate-500">10:00 AM – 06:15 PM</p>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                        6 on duty
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between items-center">
                  <span>Weekly Budget: £4,850</span>
                  <span className="font-semibold text-emerald-600">On Target</span>
                </div>
              </div>

              {/* Card 2: Biometric Punch Card */}
              <div className="bg-slate-50 dark:bg-[#182032] p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Biometric Punch
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                      <ScanFace className="size-3" />
                      98.4% Match
                    </span>
                  </div>
                  <h3 className="mt-2 font-bold text-sm text-slate-900 dark:text-white">FaceNet Verification</h3>
                  <div className="mt-3 p-3 rounded-lg bg-white dark:bg-[#131927] border border-slate-200/50 dark:border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Employee:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Zeeshan Qurban</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled:</span>
                      <span className="text-slate-800 dark:text-slate-200">10:05 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Clock-in:</span>
                      <span className="text-slate-800 dark:text-slate-200">10:39 AM</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Status:</span>
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded">
                        Reviewed
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex justify-between items-center">
                  <span>Photo Audit Log:</span>
                  <span className="font-semibold text-indigo-600">Saved securely</span>
                </div>
              </div>

              {/* Card 3: Payroll & Timesheets */}
              <div className="bg-slate-50 dark:bg-[#182032] p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Timesheet Audit
                    </span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded">
                      Auto-Calculated
                    </span>
                  </div>
                  <h3 className="mt-2 font-bold text-sm text-slate-900 dark:text-white">Payable Hours</h3>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <span>Gross Worked:</span>
                      <span className="font-semibold">39.5 hrs</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                      <span>Unpaid Breaks Deducted:</span>
                      <span className="font-semibold text-rose-500">-2.5 hrs</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-900 dark:text-white font-bold pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span>Net Payable:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-sm">37.0 hrs</span>
                    </div>
                  </div>
                </div>
                <Link href={loginUrl} className="mt-4">
                  <Button size="sm" variant="outline" className="w-full text-xs font-semibold">
                    <FileSpreadsheet className="size-3.5 mr-1.5 text-indigo-600" />
                    Export CSV for Payroll
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. KEY METRICS STATS BAR
      ───────────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1320] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">3x Faster</p>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">Weekly Rota Scheduling</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">Zero</p>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">Buddy Punching via AI</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">100%</p>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">UK GDPR Compliant</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">1-Click</p>
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">Accurate Payroll Export</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CORE CAPABILITIES (FEATURES)
      ───────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Engineered for UK Hospitality & Retail
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Everything you need to manage shifts, attendance, and payroll.
            </p>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300">
              Stop juggling paper rotas and manual spreadsheet calculations. RotaBeat automates the entire staff lifecycle.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <CalendarRange className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Visual Weekly Rota Builder</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Build your weekly schedule in minutes. Duplicate last week&apos;s rota with 1 click, assign shifts by role,
                and publish shifts directly to employee portals.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  One-click &quot;Copy Previous Week&quot;
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Instant publishing & shift notifications
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Lock-week feature to prevent accidental edits
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <ScanFace className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Biometric Face Verification</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Eliminate buddy punching once and for all. FaceNet neural network compares live clock-in photos with
                registered employee profiles in real-time.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  128-dimensional biometric embedding
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  70%+ strict match threshold
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Photo evidence captured for every event
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <Clock className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Smart Attendance & Exceptions</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Automatic detection of late arrivals, missed punches, and overtime. Review decisions once, issue formal
                warnings, or approve exceptions seamlessly.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Dynamic late arrival alerts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Deduction calculations & formal warnings
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Full audit trail on all corrections
                </li>
              </ul>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <Tablet className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dedicated On-Site Kiosk</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Turn any tablet or iPad into a secure clock-in terminal. Staff select their name, enter their PIN, and verify
                with the front-facing camera.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Runs full-screen in any web browser
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  No personal phone requirement for staff
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Break start & finish tracking
                </li>
              </ul>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Two-Tier Weekly Approval</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Site Managers review attendance records daily, while Business Owners give final sign-off before payroll is
                run and exported.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Manager-first review workflow
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Owner sign-off locks payable hours
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Reopen safeguards with audit logs
                </li>
              </ul>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#111625] border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5">
                <FileSpreadsheet className="size-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">One-Click Payroll Exports</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Export approved payable hours formatted cleanly for your payroll provider, accountant, or software like
                Xero, Sage, or QuickBooks.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Clean CSV payroll format
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Net payable hours automatically calculated
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-indigo-600" />
                  Break deductions factored in automatically
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. THE OLD WAY VS THE ROTABEAT WAY
      ───────────────────────────────────────────────────────────── */}
      <section id="comparison" className="py-20 bg-slate-100 dark:bg-[#0e1320] border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Transformation
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
              The Old Way vs. The RotaBeat Way
            </p>
          </div>

          <div className="mt-12 max-w-4xl mx-auto overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111625] shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              {/* The Old Way */}
              <div className="p-6 sm:p-8 bg-rose-50/30 dark:bg-rose-950/10">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-lg mb-6">
                  <AlertTriangle className="size-5" />
                  The Old Way
                </div>
                <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold">✕</span>
                    Paper rotas pinned to a staff board that get outdated the moment someone swaps.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold">✕</span>
                    Employees constantly texting managers: &quot;What time is my shift tomorrow?&quot;
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold">✕</span>
                    Handwritten sign-in sheets where anyone can sign in for a late friend.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold">✕</span>
                    Hours wasted every Sunday calculating break deductions on paper.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-rose-500 font-bold">✕</span>
                    Unresolvable &quot;he said, she said&quot; payroll disputes over worked hours.
                  </li>
                </ul>
              </div>

              {/* The RotaBeat Way */}
              <div className="p-6 sm:p-8 bg-emerald-50/30 dark:bg-emerald-950/10">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-lg mb-6">
                  <CheckCircle2 className="size-5" />
                  The RotaBeat Way
                </div>
                <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Digital weekly rota built and published in minutes; staff notified instantly.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Staff check their schedule and shift history 24/7 on their secure mobile portal.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Biometric FaceNet recognition ensures only the actual employee can clock in.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Worked hours, late arrivals, and break deductions calculated in real time.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Tamper-proof audit trail with photo records on every single clock punch.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. BIOMETRICS & UK GDPR SECURITY
      ───────────────────────────────────────────────────────────── */}
      <section id="biometrics" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#4338CA] via-[#4F46E5] to-[#312E81] text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-2xl">
            {/* Background Icon Watermark */}
            <div className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none">
              <RotaBeatIcon size={380} />
            </div>

            <div className="max-w-2xl relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold mb-6">
                <ShieldCheck className="size-4 text-emerald-400" />
                UK Data Protection Act 2018 & UK GDPR
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Enterprise-Grade Biometric Security & Complete Privacy Compliance
              </h2>
              <p className="mt-4 text-base sm:text-lg text-indigo-100 leading-relaxed">
                Biometric data requires the highest level of care. RotaBeat converts facial scans into irreversible 128-dimensional
                mathematical vectors. We never sell, rent, or share biometric templates with third parties.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-indigo-100">
                <div className="flex items-start gap-2.5">
                  <Lock className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Encrypted biometric vectors stored securely.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <History className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Strict retention schedules & automated deletion.</span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/privacy-policy">
                  <Button className="bg-white text-indigo-900 hover:bg-slate-100 font-bold px-6">
                    Read Our Privacy Policy
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/terms-of-service">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 font-medium">
                    Terms of Service
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FREQUENTLY ASKED QUESTIONS
      ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-slate-100 dark:bg-[#0e1320] border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Got Questions?
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {[
              {
                q: "How does the biometric face-verified clock-in work?",
                a: "When an employee registers, RotaBeat creates a 128-dimensional mathematical vector representation of their face. When clocking in at the tablet kiosk or mobile portal, the camera verifies the live face against this vector. It requires a 70%+ match to confirm identity, stopping buddy punching instantly.",
              },
              {
                q: "Do employees need to download a mobile app?",
                a: "No app store downloads are required! RotaBeat is a progressive web platform. Employees can access their shift schedule and clock-in from any mobile browser using their employee number and PIN, or clock in on the shared on-site tablet kiosk.",
              },
              {
                q: "How does RotaBeat handle late arrivals and breaks?",
                a: "RotaBeat automatically compares clock-in times against scheduled shifts. If someone clocks in past the configured grace period (e.g. 5 minutes), it flags a Late Arrival exception. Managers can configure automatic pro-rata pay deductions, issue formal warnings, or excuse the exception with a documented note.",
              },
              {
                q: "Can I manage multiple branch locations from one account?",
                a: "Yes! Business Owners can manage multiple branches, review site managers, approve timesheets across all sites, and view unified payroll reports from a single central login.",
              },
              {
                q: "Is our employee data and facial recognition compliant with UK GDPR?",
                a: "Yes. RotaBeat is designed in strict compliance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. Biometric data is encrypted, processed only for workplace attendance, and never shared with third parties. Full details are available in our Privacy Policy.",
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111625] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between p-5 text-left font-semibold text-slate-900 dark:text-white hover:text-indigo-600 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`size-4 text-slate-400 transition-transform duration-200 ${
                      openFaq === i ? "rotate-180 text-indigo-600" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. BOTTOM CALL TO ACTION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden bg-white dark:bg-[#0b0f19]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Ready to simplify your workforce operations?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Log in to your RotaBeat dashboard to build your weekly rota, manage on-duty staff, and run payroll with total confidence.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={loginUrl} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-9 py-6 text-base rounded-xl shadow-lg shadow-indigo-600/30"
              >
                Log In to RotaBeat
                <ArrowRight className="size-5 ml-2" />
              </Button>
            </Link>
            <Link href={kioskUrl} className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-slate-300 dark:border-slate-700 font-semibold px-6 py-6 text-base rounded-xl"
              >
                <Tablet className="size-5 mr-2 text-indigo-600" />
                Launch Tablet Kiosk
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. COMPREHENSIVE FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070a12] py-14 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Column 1: Brand */}
            <div className="md:col-span-2 space-y-4">
              <Link href="/">
                <RotaBeatLogo size="md" />
              </Link>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm text-xs leading-relaxed">
                Smart workforce management platform built for UK retail and hospitality. Rota scheduling, biometric
                anti-buddy attendance, and automatic payroll exports.
              </p>
              <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
                <span>© {new Date().getFullYear()} RotaBeat. All rights reserved.</span>
              </div>
            </div>

            {/* Column 2: Platform Links */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
                Platform
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <Link href={loginUrl} className="hover:text-indigo-600 transition-colors">
                    Dashboard Login
                  </Link>
                </li>
                <li>
                  <Link href={kioskUrl} className="hover:text-indigo-600 transition-colors">
                    On-Site Tablet Kiosk
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-indigo-600 transition-colors">
                    Weekly Rota Scheduling
                  </a>
                </li>
                <li>
                  <a href="#biometrics" className="hover:text-indigo-600 transition-colors">
                    Biometric Face Recognition
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal & Compliance */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-3">
                Legal & Privacy
              </h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <Link href="/privacy-policy" className="hover:text-indigo-600 transition-colors">
                    Privacy Policy (UK GDPR)
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className="hover:text-indigo-600 transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <span className="text-slate-400 text-[11px] block mt-2">
                    Compliant with Data Protection Act 2018
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>Designed and hosted for high-reliability workforce operations.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy-policy" className="hover:text-indigo-600">
                Privacy
              </Link>
              <span>·</span>
              <Link href="/terms-of-service" className="hover:text-indigo-600">
                Terms
              </Link>
              <span>·</span>
              <Link href={loginUrl} className="hover:text-indigo-600 font-semibold text-indigo-600">
                Log In →
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
