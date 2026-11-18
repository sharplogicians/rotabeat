import type { Metadata } from "next"
import Link from "next/link"
import {
  ShieldCheck,
  Lock,
  MapPin,
  Clock,
  ScanFace,
  Server,
  UserCheck,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  ExternalLink,
  ChevronRight,
  Database,
  EyeOff,
  Sparkles,
} from "lucide-react"
import { RotaBeatLogo, RotaBeatIcon } from "@/components/brand/rotabeat-logo"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "RotaBeat Privacy Policy — how we collect, process, safeguard, and retain workforce, biometric facial recognition, and attendance data in compliance with UK GDPR and Data Protection Act 2018.",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "18th November, 2026"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0b0f19] dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* ---------- Header / Hero ---------- */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#4338CA] via-[#4F46E5] to-[#312E81] text-white pt-12 pb-24 px-4 sm:px-6 lg:px-8 rounded-b-[2rem] shadow-xl">
        {/* Subtle decorative background elements */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -right-16 -top-20 opacity-10 pointer-events-none">
          <RotaBeatIcon size={340} />
        </div>
        <div className="absolute -left-12 -bottom-16 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Top navigation row */}
          <div className="flex items-center justify-between gap-4 mb-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-xs font-medium border border-white/15 backdrop-blur-md transition-all hover:translate-x-[-2px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to RotaBeat</span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              UK GDPR &amp; DPA 2018 Compliant
            </div>
          </div>

          {/* Brand pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-md mb-5 shadow-sm">
            <div className="w-6 h-6 rounded-md bg-white text-indigo-600 flex items-center justify-center font-bold text-xs shadow-sm">
              <RotaBeatIcon size={18} />
            </div>
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white">
              RotaBeat Platform
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-heading leading-tight text-white mb-3">
            Privacy Policy
          </h1>

          <p className="text-sm sm:text-base text-indigo-100/90 max-w-2xl font-normal leading-relaxed">
            Effective Date: <strong className="text-white">{lastUpdated}</strong> · Version 2.4
            <br />
            Our commitment to transparency, biometric data protection, geolocation ethics, and workforce privacy.
          </p>
        </div>
      </header>

      {/* ---------- Main Content Container ---------- */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 pb-20">
        {/* Quick Highlights / Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
          <div className="rounded-2xl p-4 sm:p-5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-indigo-950/5 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Biometric Protection
              </span>
              <ScanFace className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Vector Embeddings Only
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Raw face photos are never stored for matching; only irreversible mathematical coordinates.
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-indigo-950/5 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Geofencing Ethics
              </span>
              <MapPin className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Clock-In Only
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                GPS is strictly queried at the instant of clocking; zero background or continuous tracking.
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-indigo-950/5 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Data Sovereignty
              </span>
              <ShieldCheck className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                UK GDPR &amp; DPA 2018
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Full right of access, rectification, portability, and permanent erasure at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Intro Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm mb-8 space-y-3.5 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            <strong>RotaBeat Ltd</strong> (&ldquo;RotaBeat&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) provides an intelligent workforce management, rota scheduling, time &amp; attendance tracking, facial biometric verification, and automated payroll calculation platform via our web dashboard (rotabeat.com), mobile applications (iOS &amp; Android), and kiosk terminals.
          </p>
          <p>
            This Privacy Policy explains how we collect, process, store, and safeguard personal information when employers and employees interact with our services. Under the <strong>UK General Data Protection Regulation (UK GDPR)</strong> and the <strong>Data Protection Act 2018 (DPA 2018)</strong>, your employing organization acts as the <em>Data Controller</em>, and RotaBeat acts as the <em>Data Processor</em> performing authorized workforce administration on their behalf.
          </p>
          <p>
            By accessing or using RotaBeat, you acknowledge the terms described herein. We never sell, rent, or trade your personal or biometric information to third parties or data brokers.
          </p>
        </section>

        {/* Quick Jump / Table of Contents Chips */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
            Table of Contents
          </h2>
          <nav className="flex flex-wrap gap-2 text-xs font-medium" aria-label="Table of contents">
            {[
              { id: "s1", label: "1. Information We Collect" },
              { id: "s2", label: "2. Facial Biometrics" },
              { id: "s3", label: "3. Geolocation & Geofencing" },
              { id: "s4", label: "4. How We Use Information" },
              { id: "s5", label: "5. Data Sharing" },
              { id: "s6", label: "6. Retention & Deletion Rights" },
              { id: "s7", label: "7. Security & Encryption" },
              { id: "s8", label: "8. UK GDPR Rights" },
              { id: "s9", label: "9. Children's Privacy" },
              { id: "s10", label: "10. Policy Changes" },
              { id: "s11", label: "11. Contact Us" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs transition-all hover:-translate-y-0.5"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Sections Container */}
        <div className="space-y-6">
          {/* Section 1 */}
          <section
            id="s1"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                1
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Information Collection and Categories
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Data gathered to operate scheduling, authentication, and attendance workflows.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              To deliver our scheduling and attendance services, RotaBeat collects and processes the following categories of information provided by your employer or directly by you:
            </p>

            <ul className="grid gap-3 text-sm text-slate-700 dark:text-slate-300">
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                  Employee Identity &amp; Account Data:
                </strong>
                Full name, company email address, username, mobile telephone number, unique employee ID / number, job title, department, assigned sites/stores, emergency contact details, and secure PIN / password credentials.
              </li>
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                  Rota &amp; Shift Management Records:
                </strong>
                Scheduled shift times, roster assignments, shift swaps, availability preferences, annual leave records, absence notes, and manager shift approvals.
              </li>
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                  Time &amp; Attendance Timestamps:
                </strong>
                Exact clock-in and clock-out timestamps, break durations (meal and rest intervals), total gross minutes, net worked minutes, late arrival calculations (beyond organizational grace thresholds), and timesheet adjustments.
              </li>
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                  Compensation &amp; Payroll Metadata:
                </strong>
                Pay scheme designation (hourly rate or salaried), standard weekly hours, contractual rates, and calculated payable gross earnings for export into employer payroll software (e.g. Sage, Xero, BrightPay).
              </li>
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                  Device Telemetry &amp; Audit Logs:
                </strong>
                Device model, operating system version, browser user agent, IP address, app build version, and timestamped audit logs for security, fraud prevention, and authentication diagnostics.
              </li>
            </ul>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                Account Profiles
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                Shift Rotas
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Clock-In Records
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                Payroll Hours
              </span>
            </div>
          </section>

          {/* Section 2 */}
          <section
            id="s2"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                2
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Biometric Data &amp; Facial Recognition Verification
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  How facial verification works and our stringent anti-surveillance guarantees.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                When an employer enables biometric clock-in on RotaBeat mobile or kiosk apps, facial recognition is used exclusively to verify that the person clocking into a shift is genuinely the scheduled employee, preventing fraudulent &ldquo;buddy punching.&rdquo;
              </p>

              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Our Strict Biometric Privacy Safeguards:
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-emerald-950/90 dark:text-emerald-200/90 list-disc list-inside">
                  <li>
                    <strong>Vector Embeddings Only:</strong> During enrollment, the camera detects facial landmarks and transforms them into an irreversible 128-dimensional mathematical array (vector embedding). <em>We do not store your raw facial photographs for matching.</em>
                  </li>
                  <li>
                    <strong>Irreversible Math:</strong> It is mathematically impossible to reconstruct, render, or recreate a person&apos;s face or photo from a 128-dimensional vector embedding.
                  </li>
                  <li>
                    <strong>Mathematical Comparison:</strong> Clock-in verification compares the live embedding with the stored baseline using Euclidean distance and similarity thresholds. If distance is within tolerance, attendance is confirmed.
                  </li>
                  <li>
                    <strong>Zero Third-Party Sharing:</strong> Biometric embeddings are strictly encrypted at rest and never shared with, sold to, or accessible by advertisers, law enforcement, or external vendors.
                  </li>
                  <li>
                    <strong>Deletion on Demand:</strong> Your biometric embedding can be purged at any moment by your manager or upon written request to RotaBeat.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                128-D Vector Coordinates
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                No Raw Photo Matching
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Anti-Buddy Punching
              </span>
            </div>
          </section>

          {/* Section 3 */}
          <section
            id="s3"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                3
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Geolocation &amp; Site Geofencing
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Precision location for physical workplace proximity confirmation.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                When clocking in or out via the RotaBeat mobile application, the app may request device location permissions to ensure the employee is physically present within the employer&apos;s authorized job site or venue geofence radius.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-violet-600 dark:text-violet-400 font-semibold block mb-1">
                  Point-in-Time Geolocation Verification:
                </strong>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  Location coordinates (latitude and longitude) are accessed <strong>strictly at the exact split-second</strong> an employee taps &ldquo;Clock In&rdquo;, &ldquo;Break&rdquo;, or &ldquo;Clock Out&rdquo;. The coordinates are checked against the site radius to validate on-site arrival.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60">
                <strong className="text-violet-900 dark:text-violet-300 font-semibold block mb-1 flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  No Background Tracking or Continuous Monitoring:
                </strong>
                <p className="text-xs sm:text-sm text-violet-950/90 dark:text-violet-200/90">
                  RotaBeat <strong>never</strong> tracks employee locations in the background, between shifts, during personal time, or while off-duty. Once the clock-in action is processed, GPS hardware access is immediately terminated.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                Instant Event Only
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                Zero Background Tracking
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                Configurable Radius (e.g. 150m)
              </span>
            </div>
          </section>

          {/* Section 4 */}
          <section
            id="s4"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                4
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  How We Use Collected Information
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Legitimate business and operational purposes.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              We process personal information under the instruction of the Data Controller for legitimate workforce administration purposes:
            </p>

            <ul className="grid gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Workforce Scheduling:</strong> Publishing rotas, managing shift assignments, handling open shifts, and managing leave requests.
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Accurate Time Recording:</strong> Calculating total shift hours, unpaid/paid breaks, punctuality grace periods, and overtime allowances.
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Late Arrival &amp; Exception Management:</strong> Providing managers with transparent, auditable review workflows for lateness, warnings, and pro-rata adjustments.
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Payroll Reconciliation:</strong> Preparing compliant timesheet data for employer approval and direct export into payroll software.
                </span>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>System Security &amp; Diagnostics:</strong> Maintaining platform availability, monitoring uptime, preventing credential brute-forcing, and debugging errors.
                </span>
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section
            id="s5"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                5
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Data Sharing &amp; Third-Party Disclosures
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Strict boundaries on data access. No monetization or ad networks.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                We do not sell, rent, or lease your personal data. We disclose data solely under strict necessity to the following entities:
              </p>

              <div className="grid gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-cyan-600 dark:text-cyan-400 font-semibold block mb-0.5">
                    Your Employing Organization:
                  </strong>
                  Authorized managers, site supervisors, and HR administrators within your organization have access to schedules, timesheets, and attendance records according to role-based access controls.
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-cyan-600 dark:text-cyan-400 font-semibold block mb-0.5">
                    Secure Infrastructure Sub-Processors:
                  </strong>
                  We use trusted enterprise cloud hosting and managed database providers with data centers in the United Kingdom and EEA, bound by strict Data Processing Agreements (DPAs) meeting ISO 27001 and SOC 2 standards.
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-cyan-600 dark:text-cyan-400 font-semibold block mb-0.5">
                    Transactional Communications:
                  </strong>
                  Secure email delivery gateways for verification codes, password resets, shift notifications, and warning notices.
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-cyan-600 dark:text-cyan-400 font-semibold block mb-0.5">
                    Statutory &amp; Legal Authorities:
                  </strong>
                  Only where mandated by enforceable court orders, statutory UK law enforcement requests, or to enforce our terms of service against unlawful abuse.
                </div>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section
            id="s6"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                6
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Data Retention &amp; Deletion Rights
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compliance with Apple App Store, Google Play, and UK HMRC standards.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                We retain your personal and attendance information for as long as your employer maintains an active subscription with RotaBeat, or as required by UK employment and tax legislation (e.g., HMRC timesheet audit retention guidelines).
              </p>

              <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 space-y-2">
                <h3 className="font-semibold text-rose-900 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  Account Deletion &amp; Right to Erasure:
                </h3>
                <p className="text-xs sm:text-sm text-rose-950/90 dark:text-rose-200/90">
                  In compliance with Apple App Store and Google Play Store policies and UK GDPR Article 17, employees and managers may request full deletion of their account, credentials, and biometric embeddings at any time:
                </p>
                <ul className="text-xs sm:text-sm text-rose-950/90 dark:text-rose-200/90 list-disc list-inside space-y-1">
                  <li>
                    <strong>Employees:</strong> You may submit an erasure request directly through your employer&apos;s HR administrator or by emailing{" "}
                    <a href="mailto:privacy@rotabeat.com" className="underline font-semibold">
                      privacy@rotabeat.com
                    </a>.
                  </li>
                  <li>
                    <strong>Employers:</strong> When an organization terminates its contract, all associated workforce profiles, biometric vectors, and timesheet records are permanently purged within 30 days after statutory reconciliation.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section
            id="s7"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                7
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Security, Storage &amp; Encryption Standards
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Multi-layered defense protecting enterprise workforce records.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <Lock className="w-4 h-4" />
                  <span>Encryption in Transit</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  All traffic between mobile devices, kiosk hardware, and cloud servers is protected with TLS 1.3 encryption with strict HTTPS enforcement and modern cipher suites.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <Database className="w-4 h-4" />
                  <span>Encryption at Rest</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Databases and backup archives utilize AES-256 bit encryption at rest. Biometric vector embeddings are stored in isolated encrypted database fields.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <UserCheck className="w-4 h-4" />
                  <span>Role-Based Permissions</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Strict multi-tenant isolation ensures store managers can only view staff assigned to their site. Head office oversight has granular permission policies.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <Server className="w-4 h-4" />
                  <span>Hashed Passwords &amp; PINs</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  All PIN numbers and account passwords are salted and cryptographically hashed with industry-standard bcrypt/argon algorithms prior to storage.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section
            id="s8"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                8
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Employee Rights under UK GDPR &amp; DPA 2018
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your statutory rights as an individual data subject.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                As an individual whose personal data is processed by RotaBeat, you enjoy comprehensive legal rights under the UK GDPR and the Data Protection Act 2018:
              </p>

              <div className="grid gap-2 text-xs sm:text-sm">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <strong>Right of Access (SAR):</strong> Request a copy of the personal and attendance records we hold about you.
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <strong>Right to Rectification:</strong> Request correction of inaccurate timesheets, clock-in times, contact info, or profile data.
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Request deletion of your account and biometric embeddings when no longer needed for statutory employment purposes.
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <strong>Right to Restriction:</strong> Request limitation of processing while an objection or timesheet dispute is being investigated.
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <strong>Right to Data Portability:</strong> Request export of your attendance and timesheet history in structured CSV/JSON format.
                </div>
              </div>
            </div>
          </section>

          {/* Section 9 */}
          <section
            id="s9"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                9
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Children&apos;s Privacy &amp; Legal Working Age
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Services for lawful employment workforce only.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              RotaBeat is an enterprise business software application intended exclusively for working employees who meet the statutory minimum employment age in their respective jurisdiction (in the UK, individuals aged 16 and over). We do not knowingly collect personal or biometric information from individuals under the age of 16 without appropriate employer verification and statutory parental/guardian consent required by applicable labor laws. If we learn that personal data of a minor under 16 has been collected without statutory authorization, we will take immediate steps to delete the record.
            </p>
          </section>

          {/* Section 10 */}
          <section
            id="s10"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                10
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Changes to This Privacy Policy
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  How updates and revisions are communicated.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              We may update this Privacy Policy from time to time to reflect platform enhancements, operational modifications, or legislative amendments. Any updates will be posted to this page with an updated &ldquo;Effective Date&rdquo;. For material changes affecting the collection or processing of biometric or location data, we will provide prominent notification within the mobile and web application.
            </p>
          </section>

          {/* Section 11: Contact Card (Styled with matching gradient) */}
          <section
            id="s11"
            className="scroll-mt-6 rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-[#4338CA] via-[#4F46E5] to-[#312E81] text-white shadow-xl relative overflow-hidden"
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold text-sm">
                    11
                  </span>
                  <h2 className="text-xl font-bold font-heading text-white">Contact Us &amp; DPO</h2>
                </div>
                <p className="text-xs sm:text-sm text-indigo-100/90 max-w-xl leading-relaxed">
                  If you have inquiries regarding this Privacy Policy, your biometric data, or wish to exercise your UK GDPR rights, please reach out to our Data Protection team:
                </p>
                <div className="pt-2 flex flex-col sm:flex-row gap-3 text-xs sm:text-sm">
                  <a
                    href="mailto:privacy@rotabeat.com"
                    className="inline-flex items-center gap-2 text-white hover:text-indigo-200 underline font-semibold"
                  >
                    <Mail className="w-4 h-4" />
                    privacy@rotabeat.com
                  </a>
                  <span className="hidden sm:inline text-white/40">·</span>
                  <a
                    href="mailto:support@rotabeat.com"
                    className="inline-flex items-center gap-2 text-white hover:text-indigo-200 underline font-semibold"
                  >
                    <Mail className="w-4 h-4" />
                    support@rotabeat.com
                  </a>
                </div>
              </div>

              <div className="shrink-0 flex flex-col gap-2.5 w-full sm:w-auto">
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-xs sm:text-sm shadow-md transition-all text-center"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 py-8 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <RotaBeatIcon size={20} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">RotaBeat</span>
            <span>· Workforce Management, Simplified.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Sign In
            </Link>
            <span>·</span>
            <a href="#top" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Back to Top
            </a>
          </div>
        </div>
        <div className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} RotaBeat Ltd. All rights reserved. Registered in the United Kingdom.
        </div>
      </footer>
    </div>
  )
}
