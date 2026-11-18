import type { Metadata } from "next"
import Link from "next/link"
import {
  FileText,
  ShieldCheck,
  Scale,
  Clock,
  ScanFace,
  Server,
  UserCheck,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Briefcase,
  AlertTriangle,
  Gavel,
} from "lucide-react"
import { RotaBeatLogo, RotaBeatIcon } from "@/components/brand/rotabeat-logo"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "RotaBeat Terms of Service — terms and conditions governing the use of RotaBeat workforce management, rota scheduling, biometric attendance, and timesheet services.",
}

export default function TermsOfServicePage() {
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

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-semibold backdrop-blur-md">
              <Scale className="w-3.5 h-3.5 text-indigo-300" />
              Governed by English Law
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
            Terms of Service
          </h1>

          <p className="text-sm sm:text-base text-indigo-100/90 max-w-2xl font-normal leading-relaxed">
            Effective Date: <strong className="text-white">{lastUpdated}</strong> · Version 2.2
            <br />
            The legal terms governing your access to and use of the RotaBeat workforce management, scheduling, and attendance platform.
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
                Service Scope
              </span>
              <Briefcase className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                B2B Workforce Platform
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Designed for businesses, managers, and authorized employees for scheduling and payroll management.
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-indigo-950/5 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Integrity &amp; Fairness
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Anti-Buddy Punching
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Biometric verification and GPS proximity ensure reliable, dispute-free timesheets for fair pay.
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 sm:p-5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 shadow-lg shadow-indigo-950/5 backdrop-blur-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Legal Jurisdiction
              </span>
              <Gavel className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <strong className="block text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                England &amp; Wales
              </strong>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Governed under English contract law and UK employment legislation standards.
              </p>
            </div>
          </div>
        </div>

        {/* Intro Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm mb-8 space-y-3.5 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            Please read these Terms of Service (&ldquo;Terms&rdquo;, &ldquo;Agreement&rdquo;) carefully before using the <strong>RotaBeat</strong> platform, web dashboard (rotabeat.com), mobile applications, and kiosk hardware solutions operated by <strong>RotaBeat Ltd</strong> (&ldquo;RotaBeat&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).
          </p>
          <p>
            By accessing our platform as an employer, account administrator, site manager, or employee user, you agree to be bound by these Terms and our companion{" "}
            <Link href="/privacy-policy" className="text-indigo-600 dark:text-indigo-400 font-semibold underline">
              Privacy Policy
            </Link>
            . If you are entering into these Terms on behalf of an organization or business entity, you confirm that you possess the lawful authority to bind that entity to this Agreement.
          </p>
          <p>
            If you do not agree with any part of these Terms, you must not access or use the RotaBeat services.
          </p>
        </section>

        {/* Quick Jump / Table of Contents Chips */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
            Table of Contents
          </h2>
          <nav className="flex flex-wrap gap-2 text-xs font-medium" aria-label="Table of contents">
            {[
              { id: "s1", label: "1. Eligibility & Accounts" },
              { id: "s2", label: "2. Permitted Use" },
              { id: "s3", label: "3. Biometrics & Verification" },
              { id: "s4", label: "4. Geolocation Rules" },
              { id: "s5", label: "5. Employer Responsibilities" },
              { id: "s6", label: "6. Employee Obligations" },
              { id: "s7", label: "7. Subscriptions & Billing" },
              { id: "s8", label: "8. Intellectual Property" },
              { id: "s9", label: "9. Availability & Support" },
              { id: "s10", label: "10. Liability & Disclaimers" },
              { id: "s11", label: "11. Termination & Suspension" },
              { id: "s12", label: "12. Governing Law" },
              { id: "s13", label: "13. Contact & Inquiries" },
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
                  Eligibility &amp; Account Security
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  User qualifications, account creation, and credential stewardship.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                To register for or use RotaBeat, you must be of legal working age (at least 16 years of age in the United Kingdom) and authorized by an employing organization that has subscribed to RotaBeat.
              </p>

              <ul className="grid gap-3">
                <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                    Account Confidentiality:
                  </strong>
                  You are solely responsible for maintaining the confidentiality of your login credentials, including passwords, PIN codes, and one-time verification tokens (OTP). You must immediately notify RotaBeat and your manager of any unauthorized access.
                </li>
                <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                    Accurate Information:
                  </strong>
                  You agree to provide true, current, and complete personal and contact details during enrollment and to update them whenever changes occur.
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                Legal Working Age (16+)
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                PIN &amp; Password Safeguards
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                Single User Licensing
              </span>
            </div>
          </section>

          {/* Section 2 */}
          <section
            id="s2"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                2
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Permitted Use &amp; Platform Guidelines
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Acceptable use guidelines and prohibited conduct.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                RotaBeat grants organizations and individual users a non-exclusive, non-transferable, revocable license to access our platform solely for internal workforce operations, scheduling, and attendance recording.
              </p>

              <div className="p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-800/60 space-y-2">
                <h3 className="font-semibold text-violet-900 dark:text-violet-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  Strictly Prohibited Activities:
                </h3>
                <ul className="space-y-1.5 text-xs sm:text-sm text-violet-950/90 dark:text-violet-200/90 list-disc list-inside">
                  <li>Clocking in, breaking, or clocking out on behalf of another employee (&ldquo;proxy clocking&rdquo; or &ldquo;buddy punching&rdquo;).</li>
                  <li>Using GPS spoofing, mock location software, emulator sandboxes, or altered hardware to falsify presence.</li>
                  <li>Attempting to reverse-engineer, decompile, crawl, or scrape RotaBeat application source code or APIs.</li>
                  <li>Circumventing attendance validation thresholds, grace periods, or manager approval gates.</li>
                  <li>Using the platform to harass, exploit, or unlawfully monitor employees outside contracted work parameters.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section
            id="s3"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                3
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Biometric Facial Verification Terms
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rules and covenants governing biometric enrollment and live comparison.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                Where your employer activates facial recognition verification for shift attendance:
              </p>

              <ul className="grid gap-3 text-xs sm:text-sm">
                <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold block mb-0.5">
                    Enrollment Consent:
                  </strong>
                  Enrollment requires voluntary participation in accordance with your organization&apos;s workplace policies and applicable UK labor guidelines. Organizations must provide alternative PIN verification if an employee cannot provide biometric data.
                </li>
                <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold block mb-0.5">
                    Mathematical Embeddings Only:
                  </strong>
                  You acknowledge and agree that RotaBeat converts facial landmarks into a non-reversible 128-dimensional mathematical vector. Raw photographs are not stored for ongoing attendance matching.
                </li>
                <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold block mb-0.5">
                    Anti-Spoofing &amp; Fraud Monitoring:
                  </strong>
                  Live camera frames are analyzed for liveness. Attempting to present static printouts, deepfakes, or digital screens to fool the scanner constitutes gross platform abuse and may lead to immediate account termination.
                </li>
              </ul>
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
                  Geolocation &amp; Mobile Clock-In Requirements
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proximity validation rules for mobile and remote clock-in.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              If an organization configures geofenced mobile attendance:
            </p>

            <div className="grid gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-amber-600 dark:text-amber-400 font-semibold block mb-0.5">
                  Point-of-Clock Verification:
                </strong>
                Location data is only requested at the precise moment a clock action is performed to confirm you are within the assigned venue radius (e.g., 150m).
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-amber-600 dark:text-amber-400 font-semibold block mb-0.5">
                  Device Hardware Integrity:
                </strong>
                Users must enable location permissions on their mobile devices during shift clocking. Attempts to disable GPS or tamper with mobile network beacons to simulate on-site arrival are strictly prohibited.
              </div>
            </div>
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
                  Employer Responsibilities &amp; UK Labor Compliance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Statutory employment duties of subscribing organizations.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                As an employer or organizational subscriber, you expressly warrant and agree to:
              </p>

              <ul className="grid gap-2.5 text-xs sm:text-sm">
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>UK Working Time Regulations 1998:</strong> Comply with statutory rest intervals (11 hours uninterrupted rest daily, 24 hours weekly) and maximum 48-hour working week limits unless an opt-out has been signed.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>National Minimum &amp; Living Wage:</strong> Ensure all calculated timesheets and hourly adjustments adhere to UK National Minimum Wage and National Living Wage statutory rates.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Fair Exception Review:</strong> Review late arrivals, grace periods, and warnings impartially before authorizing payroll adjustments or disciplinary measures.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Data Controller Accountability:</strong> Serve as the lawful Data Controller under UK GDPR for employee personal information and provide staff with adequate privacy notices.
                  </span>
                </li>
              </ul>
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
                  Employee Obligations &amp; Conduct
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Standards of honesty and punctuality for staff users.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
              Staff members accessing RotaBeat agree to use the service ethically:
            </p>

            <ul className="grid gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong>Honest Time Logging:</strong> Clock in only upon actual arrival at your designated workstation and record all statutory meal and rest breaks accurately.
              </li>
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong>Timely Rota Review:</strong> Review published weekly schedules and promptly notify site managers of any scheduling conflicts or unavailability.
              </li>
              <li className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong>Exception Acknowledgment:</strong> Review and respond truthfully to any manager late arrival notifications, warnings, or timesheet adjustments.
              </li>
            </ul>
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
                  Subscriptions, Fees &amp; Billing
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Payment terms, renewals, and invoice settlement.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                RotaBeat is provided on a software-as-a-service (SaaS) subscription model billed monthly or annually per active employee or per site:
              </p>

              <div className="grid gap-3 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                    Payment Terms:
                  </strong>
                  Subscription fees are invoiced in advance and are non-refundable except where required by mandatory consumer or commercial law. All charges are exclusive of Value Added Tax (VAT) unless explicitly stated otherwise.
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                    Automatic Renewal:
                  </strong>
                  Subscriptions renew automatically at the end of each billing cycle unless cancelled with at least 14 days&apos; notice prior to the renewal date.
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                  <strong className="text-indigo-600 dark:text-indigo-400 font-semibold block mb-0.5">
                    Late Payment &amp; Suspension:
                  </strong>
                  Failure to settle outstanding invoices within 14 calendar days of the due date may result in suspension of administrative dashboard access. Employee attendance data will remain secured during grace periods.
                </div>
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
                  Intellectual Property &amp; Proprietary Rights
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ownership of RotaBeat software, algorithms, and brand assets.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                All rights, title, and interest in and to RotaBeat, including our software codebase, proprietary scheduling algorithms, facial vector recognition pipelines, UI components, brand marks, and documentation, are and remain the exclusive intellectual property of RotaBeat Ltd and its licensors.
              </p>
              <p>
                Customers retain full ownership of their organizational business data, employee records, and timesheet reports uploaded to or processed through the platform.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section
            id="s9"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                9
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Platform Availability, Uptime &amp; Support
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Service level targets and offline kiosk capabilities.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                We strive to maintain a <strong>99.9% uptime target</strong> for all cloud services. Planned maintenance windows are scheduled during low-volume hours and communicated in advance.
              </p>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800">
                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold block mb-1">
                  Offline Kiosk Resilience:
                </strong>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  RotaBeat kiosk terminals and mobile apps are engineered with offline queuing to capture clock-in timestamps during transient network outages, syncing securely once internet connectivity is restored.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section
            id="s10"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                10
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Limitation of Liability &amp; Disclaimers
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Contractual caps on damages and statutory disclaimers.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                To the fullest extent permitted by English law, RotaBeat shall not be liable for any indirect, consequential, incidental, or special damages, including loss of business profits, goodwill, or business interruption arising from the use of our services.
              </p>
              <p>
                Our aggregate liability arising out of or related to this Agreement shall be limited to the total fees paid by the customer to RotaBeat in the twelve (12) months preceding the claim. Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud, or fraudulent misrepresentation.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section
            id="s11"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                11
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Termination &amp; Account Suspension
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Procedures for closing accounts and handling data upon exit.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                Either party may terminate the subscription agreement for material breach if such breach remains uncured for 30 calendar days following written notice.
              </p>
              <p>
                Upon termination of the service, customers may export their historical rotas, shift logs, and approved timesheet data for 30 calendar days. Following this handover window, all active customer database entries and biometric vector records will be irreversibly purged in accordance with our{" "}
                <Link href="/privacy-policy" className="text-indigo-600 dark:text-indigo-400 font-semibold underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section
            id="s12"
            className="scroll-mt-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                12
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white">
                  Governing Law &amp; Dispute Resolution
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Applicable jurisdiction and conflict resolution forums.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              These Terms and any dispute or claim arising out of or in connection with them (including non-contractual disputes or claims) shall be governed by and construed in accordance with the <strong>laws of England and Wales</strong>. The courts of England and Wales shall have exclusive jurisdiction to settle any dispute or claim arising under or related to this Agreement.
            </p>
          </section>

          {/* Section 13: Contact Card (Styled with matching gradient) */}
          <section
            id="s13"
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
                    13
                  </span>
                  <h2 className="text-xl font-bold font-heading text-white">Legal Inquiries &amp; Notices</h2>
                </div>
                <p className="text-xs sm:text-sm text-indigo-100/90 max-w-xl leading-relaxed">
                  For questions regarding these Terms, commercial contracts, or formal legal notices, please contact our legal counsel:
                </p>
                <div className="pt-2 flex flex-col sm:flex-row gap-3 text-xs sm:text-sm">
                  <a
                    href="mailto:legal@rotabeat.com"
                    className="inline-flex items-center gap-2 text-white hover:text-indigo-200 underline font-semibold"
                  >
                    <Mail className="w-4 h-4" />
                    legal@rotabeat.com
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
            <Link href="/privacy-policy" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Privacy Policy
            </Link>
            <span>·</span>
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
