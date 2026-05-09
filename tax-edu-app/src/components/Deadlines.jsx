import { CheckCircle, Clock, Calendar } from 'lucide-react'

// Today is 2026-05-08
const INDIVIDUAL_DEADLINES = [
  {
    date: 'Jan 15, 2026',
    label: 'Q4 2025 Estimated Tax Payment',
    description: 'Final quarterly estimated payment for the 2025 tax year.',
    status: 'passed',
  },
  {
    date: 'Jan 31, 2026',
    label: 'W-2 / 1099 Forms from Employers',
    description: 'Employers and payers must provide W-2 and most 1099 forms to recipients.',
    status: 'passed',
  },
  {
    date: 'Feb 18, 2026',
    label: '1099-B & 1099-DIV Due',
    description: 'Brokerages must deliver 1099-B (securities) and 1099-DIV (dividends) forms.',
    status: 'passed',
  },
  {
    date: 'Apr 15, 2026',
    label: '2025 Federal Tax Return Due',
    description: 'File Form 1040 or request an extension via Form 4868.',
    status: 'passed',
  },
  {
    date: 'Apr 15, 2026',
    label: 'Q1 2026 Estimated Tax Payment',
    description: 'First quarterly estimated tax payment for the 2026 tax year.',
    status: 'passed',
  },
  {
    date: 'Jun 15, 2026',
    label: 'Q2 2026 Estimated Tax Payment',
    description: 'Second quarterly estimated tax payment. Covers income from Apr 1 – May 31.',
    status: 'coming-up',
  },
  {
    date: 'Sep 15, 2026',
    label: 'Q3 2026 Estimated Tax Payment',
    description: 'Third quarterly estimated tax payment. Covers income from Jun 1 – Aug 31.',
    status: 'upcoming',
  },
  {
    date: 'Oct 15, 2026',
    label: 'Extended 2025 Return Due',
    description: 'Final deadline for 2025 returns if you filed for an extension on Apr 15.',
    status: 'upcoming',
  },
  {
    date: 'Jan 15, 2027',
    label: 'Q4 2026 Estimated Tax Payment',
    description: 'Final quarterly estimated payment for the 2026 tax year.',
    status: 'upcoming',
  },
]

const BUSINESS_DEADLINES = [
  {
    date: 'Jan 15, 2026',
    label: 'Q4 2025 Corporate Estimated Tax',
    description: 'Final quarterly estimated tax for C-Corps and other business entities.',
    status: 'passed',
  },
  {
    date: 'Jan 31, 2026',
    label: 'W-2 & 1099-NEC to Recipients',
    description: 'Furnish W-2s to employees and 1099-NECs to contractors paid $600+.',
    status: 'passed',
  },
  {
    date: 'Feb 28, 2026',
    label: '1099-NEC Paper Filing (IRS)',
    description: 'Paper deadline to file 1099-NEC with the IRS (electronic due Mar 31).',
    status: 'passed',
  },
  {
    date: 'Mar 16, 2026',
    label: 'S-Corp & Partnership Returns Due',
    description: 'File Form 1120-S (S-Corp) or Form 1065 (Partnership), or request extension.',
    status: 'passed',
  },
  {
    date: 'Apr 15, 2026',
    label: 'C-Corp Tax Return Due',
    description: 'File Form 1120 for calendar-year C-Corps, or request extension via Form 7004.',
    status: 'passed',
  },
  {
    date: 'Apr 15, 2026',
    label: 'Q1 2026 Estimated Tax',
    description: 'First quarterly business estimated tax payment for 2026.',
    status: 'passed',
  },
  {
    date: 'Jun 15, 2026',
    label: 'Q2 2026 Estimated Tax',
    description: 'Second quarterly estimated tax payment for businesses.',
    status: 'coming-up',
  },
  {
    date: 'Sep 15, 2026',
    label: 'Q3 2026 Estimated Tax & Extended S-Corp/Partnership',
    description: 'Quarterly tax payment plus final deadline for extended S-Corp and partnership returns.',
    status: 'upcoming',
  },
  {
    date: 'Oct 15, 2026',
    label: 'Extended C-Corp Return Due',
    description: 'Final deadline for C-Corp returns that received a Form 7004 extension.',
    status: 'upcoming',
  },
  {
    date: 'Jan 15, 2027',
    label: 'Q4 2026 Estimated Tax',
    description: 'Final quarterly estimated business tax payment for the 2026 tax year.',
    status: 'upcoming',
  },
]

const STATUS_CONFIG = {
  passed: {
    label: 'Passed',
    icon: CheckCircle,
    pillStyle: { backgroundColor: '#f3f4f6', color: '#6b7280' },
    iconColor: '#9ca3af',
  },
  'coming-up': {
    label: 'Coming Up',
    icon: Clock,
    pillStyle: { backgroundColor: '#fef3c7', color: '#b45309' },
    iconColor: '#f59e0b',
  },
  upcoming: {
    label: 'Upcoming',
    icon: Calendar,
    pillStyle: { backgroundColor: '#eff6ff', color: '#1d4ed8' },
    iconColor: '#3b82f6',
  },
}

function DeadlineRow({ date, label, description, status }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const isPassed = status === 'passed'

  return (
    <div className={`flex gap-4 p-4 rounded-lg border transition-colors ${isPassed ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex flex-col items-center gap-1 shrink-0 w-14 text-center">
        <Icon size={16} style={{ color: config.iconColor }} />
        <span className="text-xs font-medium text-gray-500 leading-tight">{date.split(',')[0].split(' ')[0]}</span>
        <span className="text-lg font-bold leading-tight" style={{ color: isPassed ? '#9ca3af' : '#111827' }}>
          {date.split(' ')[1].replace(',', '')}
        </span>
        <span className="text-xs text-gray-400">{date.split(',')[1]?.trim()}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-2 mb-1">
          <p className={`text-sm font-medium leading-snug ${isPassed ? 'text-gray-500' : 'text-gray-900'}`}>{label}</p>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
            style={config.pillStyle}
          >
            {config.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

export default function Deadlines({ mode }) {
  const deadlines = mode === 'individual' ? INDIVIDUAL_DEADLINES : BUSINESS_DEADLINES

  const counts = deadlines.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-2xl space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'passed', label: 'Passed', style: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', color: '#6b7280' } },
          { key: 'coming-up', label: 'Coming Up', style: { backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#b45309' } },
          { key: 'upcoming', label: 'Upcoming', style: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' } },
        ].map(({ key, label, style }) => (
          <div key={key} className="rounded-xl border p-4 text-center" style={style}>
            <p className="text-2xl font-bold">{counts[key] || 0}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Deadlines list */}
      <div className="space-y-2.5">
        {deadlines.map((d, i) => (
          <DeadlineRow key={i} {...d} />
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Dates shown reflect the 2026 tax calendar. When a deadline falls on a weekend or holiday, the IRS typically extends to the next business day. Consult a CPA to confirm dates relevant to your situation.
      </p>
    </div>
  )
}
