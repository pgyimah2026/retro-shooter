import { useState, useMemo, useEffect } from 'react'
import { Lightbulb, TrendingDown, Info, CheckCircle, XCircle } from 'lucide-react'

// ─── Official 2026 IRS figures ────────────────────────────────────────────────
// Brackets & standard deductions: IRS Rev. Proc. 2025-29 (One Big Beautiful Bill)
// HSA limits: IRS Pub. 969 | 401(k)/IRA limits: IRS retirement plans guidance
// IRA phase-out ranges: based on 2025 IRS guidance (IR-2024-285); 2026 pending

const PLAN_YEAR = new Date().getFullYear()  // 2026

const BRACKETS = {
  single: [
    { rate: 0.10, min: 0,       max: 12400 },
    { rate: 0.12, min: 12400,   max: 50400 },
    { rate: 0.22, min: 50400,   max: 105700 },
    { rate: 0.24, min: 105700,  max: 201775 },
    { rate: 0.32, min: 201775,  max: 256225 },
    { rate: 0.35, min: 256225,  max: 640600 },
    { rate: 0.37, min: 640600,  max: Infinity },
  ],
  mfj: [
    { rate: 0.10, min: 0,       max: 24800 },
    { rate: 0.12, min: 24800,   max: 100800 },
    { rate: 0.22, min: 100800,  max: 211400 },
    { rate: 0.24, min: 211400,  max: 403550 },
    { rate: 0.32, min: 403550,  max: 512450 },
    { rate: 0.35, min: 512450,  max: 768700 },
    { rate: 0.37, min: 768700,  max: Infinity },
  ],
  mfs: [
    { rate: 0.10, min: 0,       max: 12400 },
    { rate: 0.12, min: 12400,   max: 50400 },
    { rate: 0.22, min: 50400,   max: 105700 },
    { rate: 0.24, min: 105700,  max: 201775 },
    { rate: 0.32, min: 201775,  max: 256225 },
    { rate: 0.35, min: 256225,  max: 384350 },
    { rate: 0.37, min: 384350,  max: Infinity },
  ],
  hoh: [
    { rate: 0.10, min: 0,       max: 17700 },
    { rate: 0.12, min: 17700,   max: 67450 },
    { rate: 0.22, min: 67450,   max: 105700 },
    { rate: 0.24, min: 105700,  max: 201775 },
    { rate: 0.32, min: 201775,  max: 256225 },
    { rate: 0.35, min: 256225,  max: 640600 },
    { rate: 0.37, min: 640600,  max: Infinity },
  ],
  qss: [
    { rate: 0.10, min: 0,       max: 24800 },
    { rate: 0.12, min: 24800,   max: 100800 },
    { rate: 0.22, min: 100800,  max: 211400 },
    { rate: 0.24, min: 211400,  max: 403550 },
    { rate: 0.32, min: 403550,  max: 512450 },
    { rate: 0.35, min: 512450,  max: 768700 },
    { rate: 0.37, min: 768700,  max: Infinity },
  ],
}

const STD_DED = { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200 }

const STATUS_LABELS = {
  single: 'Single',
  mfj:    'Married Filing Jointly',
  mfs:    'Married Filing Separately',
  hoh:    'Head of Household',
  qss:    'Qualifying Surviving Spouse',
}

const CTC_PER_CHILD = 2000
const CTC_PHASEOUT = { single: 200000, mfs: 200000, hoh: 200000, mfj: 400000, qss: 400000 }

const LIMITS = {
  under50: { k401: 24500, ira: 7500, hsa_ind: 4400, hsa_fam: 8750 },
  age5059: { k401: 32500, ira: 8600, hsa_ind: 4400, hsa_fam: 8750 },
  age6063: { k401: 35750, ira: 8600, hsa_ind: 4400, hsa_fam: 8750 },
  age64p:  { k401: 32500, ira: 8600, hsa_ind: 4400, hsa_fam: 8750 },
}

const AGE_LABELS = {
  under50: 'Under 50',
  age5059: '50–59 (catch-up eligible)',
  age6063: '60–63 (SECURE 2.0 enhanced catch-up)',
  age64p:  '64+ (catch-up eligible)',
}

// IRA deduction phase-out MAGI ranges — 2026 IRS figures
// Single/HoH and MFJ start points confirmed via IRS COLA adjustments page (irs.gov)
// Phase-out width: $10,000 for single/MFS/HoH; $20,000 for MFJ/QSS (IRS rule)
// MFS: fixed $0–$10,000, no annual COLA per IRS
// Spouse-covered range estimated from 2025 confirmed figures + COLA pattern
const IRA_PHASEOUT = {
  single_covered:    { lo: 81000,  hi: 91000  },  // IRS confirmed 2026
  hoh_covered:       { lo: 81000,  hi: 91000  },  // IRS confirmed 2026
  mfj_covered:       { lo: 129000, hi: 149000 },  // IRS confirmed 2026
  qss_covered:       { lo: 129000, hi: 149000 },  // IRS confirmed 2026
  mfs_covered:       { lo: 0,      hi: 10000  },  // fixed — no annual COLA per IRS
  mfj_spousecov:     { lo: 240000, hi: 250000 },  // estimated (+~$4k from 2025)
  qss_spousecov:     { lo: 240000, hi: 250000 },  // estimated (+~$4k from 2025)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcTax(taxableIncome, status) {
  let tax = 0
  for (const b of BRACKETS[status]) {
    if (taxableIncome <= b.min) break
    tax += (Math.min(taxableIncome, b.max) - b.min) * b.rate
  }
  return tax
}

function getMarginalRate(taxableIncome, status) {
  if (taxableIncome <= 0) return 0
  for (let i = BRACKETS[status].length - 1; i >= 0; i--) {
    if (taxableIncome > BRACKETS[status][i].min) return BRACKETS[status][i].rate
  }
  return 0
}

function calcCTC(children, agi, status) {
  if (children <= 0) return 0
  const fullCredit = children * CTC_PER_CHILD
  const excess = Math.max(0, agi - CTC_PHASEOUT[status])
  return Math.max(0, fullCredit - Math.ceil(excess / 1000) * 50)
}

const fmt     = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const fmtPct  = (n) => (n * 100).toFixed(1) + '%'
const parseNum = (str) => parseFloat(String(str).replace(/,/g, '')) || 0

// Returns phase-out range label for the IRA input hint (before income is known)
function getIraPhaseoutLabel(status, coveredByPlan, spouseCovered) {
  if (!coveredByPlan) {
    const hasSpouse = (status === 'mfj' || status === 'qss') && spouseCovered
    if (!hasSpouse) return 'No plan coverage — fully deductible regardless of income'
    const r = IRA_PHASEOUT[`${status}_spousecov`]
    return `Spouse covered — phases out ${fmt(r.lo)}–${fmt(r.hi)} MAGI${status === 'mfj' || status === 'qss' ? ' (est. 2026)' : ''}`
  }
  if (status === 'mfs') return 'MFS — phases out $0–$10,000 MAGI (most filers: non-deductible)'
  const r = IRA_PHASEOUT[`${status}_covered`]
  return `Phases out ${fmt(r.lo)}–${fmt(r.hi)} MAGI (2026 IRS)`
}

// Calculates actual deductibility once AGI is known
function calcIraDeductibility(agi, status, coveredByPlan, spouseCovered, iraLimit) {
  if (!coveredByPlan) {
    const hasSpouse = (status === 'mfj' || status === 'qss') && spouseCovered
    if (!hasSpouse) return { type: 'full', deductible: iraLimit }
    const r = IRA_PHASEOUT[`${status}_spousecov`]
    if (agi <= r.lo) return { type: 'full', deductible: iraLimit }
    if (agi >= r.hi) return { type: 'none', deductible: 0 }
    const partial = Math.max(200, Math.ceil(iraLimit * (1 - (agi - r.lo) / (r.hi - r.lo)) / 10) * 10)
    return { type: 'partial', deductible: partial }
  }
  const r = IRA_PHASEOUT[`${status}_covered`]
  if (!r) return { type: 'full', deductible: iraLimit }
  if (agi <= r.lo) return { type: 'full', deductible: iraLimit }
  if (agi >= r.hi) return { type: 'none', deductible: 0 }
  const partial = Math.max(200, Math.ceil(iraLimit * (1 - (agi - r.lo) / (r.hi - r.lo)) / 10) * 10)
  return { type: 'partial', deductible: partial }
}

function useNumInput() {
  const [val, setVal] = useState('')
  const onChange = (e) => {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    setVal(digits ? parseInt(digits).toLocaleString() : '')
  }
  return [val, onChange]
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InputField({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5 leading-snug">{hint}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="0"
          className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none"
          onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #1D9E75')}
          onBlur={(e)  => (e.target.style.boxShadow = '')}
        />
      </div>
    </div>
  )
}

function ContribRow({ label, value, onChange, max, hint }) {
  const used = parseNum(value)
  const pct  = max > 0 ? Math.min(used / max, 1) : 0
  const room = Math.max(0, max - used)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-400">Limit: {fmt(max)}</span>
      </div>
      {hint && <p className="text-xs text-gray-400 leading-snug">{hint}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="0"
          className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none"
          onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #1D9E75')}
          onBlur={(e)  => (e.target.style.boxShadow = '')}
        />
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, backgroundColor: pct >= 1 ? '#1D9E75' : '#6ee7c7' }}
        />
      </div>
      {used > 0 && room > 0  && <p className="text-xs text-gray-400">{fmt(room)} remaining</p>}
      {pct >= 1              && <p className="text-xs font-medium" style={{ color: '#1D9E75' }}>Limit reached ✓</p>}
    </div>
  )
}

function SummaryCard({ label, value, highlight, sub, isRefund }) {
  const refundStyle = isRefund === true  ? { backgroundColor: '#e8f7f2', borderColor: '#1D9E75' }
                    : isRefund === false ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
                    : {}
  const valueColor  = isRefund === true  ? '#1D9E75'
                    : isRefund === false ? '#dc2626'
                    : highlight ? '#1D9E75' : '#111827'

  return (
    <div
      className={`rounded-xl p-4 border ${highlight || isRefund != null ? '' : 'border-gray-200 bg-white'}`}
      style={isRefund != null ? refundStyle : highlight ? { backgroundColor: '#e8f7f2', borderColor: '#1D9E75' } : {}}
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold" style={{ color: valueColor }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TaxPlanning() {
  const [status,       setStatus]       = useState('single')
  const [ageGroup,     setAgeGroup]     = useState('under50')
  const [familyHSA,    setFamilyHSA]    = useState(false)
  const [children,     setChildren]     = useState(0)
  const [coveredByPlan, setCovered]     = useState(false)
  const [spouseCovered, setSpouseCov]   = useState(false)
  const [dedType,      setDedType]      = useState('standard')

  const [wages,       onWages]      = useNumInput()
  const [seNet,       onSeNet]      = useNumInput()
  const [k401,        onK401]       = useNumInput()
  const [ira,         onIra]        = useNumInput()
  const [hsa,         onHsa]        = useNumInput()
  const [itemized,    onItemized]   = useNumInput()
  const [withholding, onWithholding] = useNumInput()
  const [estPaid,     onEstPaid]    = useNumInput()
  const [otherTax,    onOtherTax]   = useNumInput()

  // MFJ and QSS default to family HSA; all others default to individual
  useEffect(() => {
    setFamilyHSA(status === 'mfj' || status === 'qss')
  }, [status])

  const lim    = LIMITS[ageGroup]
  const hsaMax = familyHSA ? lim.hsa_fam : lim.hsa_ind
  const showSpouseField = status === 'mfj' || status === 'qss'

  const iraPhaseoutLabel = getIraPhaseoutLabel(status, coveredByPlan, spouseCovered)

  const result = useMemo(() => {
    const w  = parseNum(wages)
    const se = parseNum(seNet)
    const gross = w + se
    if (gross <= 0) return null

    const k401Val = Math.min(parseNum(k401), lim.k401)
    const iraVal  = Math.min(parseNum(ira),  lim.ira)
    const hsaVal  = Math.min(parseNum(hsa),  hsaMax)

    const netSE       = se * 0.9235
    const seTax       = netSE * 0.153
    const seAboveLine = seTax / 2

    const contributions = k401Val + iraVal + hsaVal + seAboveLine
    const agi           = Math.max(0, gross - contributions)

    const stdDed    = STD_DED[status]
    const itemAmt   = parseNum(itemized)
    const deduction = dedType === 'standard' ? stdDed : Math.max(itemAmt, stdDed)
    const taxable   = Math.max(0, agi - deduction)

    const incomeTax   = calcTax(taxable, status)
    const ctc         = calcCTC(children, agi, status)
    const taxAfterCTC = Math.max(0, incomeTax - ctc)
    const totalTax    = taxAfterCTC + seTax + parseNum(otherTax)
    const effective   = gross > 0 ? totalTax / gross : 0
    const marginal    = getMarginalRate(taxable, status)

    const totalPaid   = parseNum(withholding) + parseNum(estPaid)
    const balance     = totalTax - totalPaid  // positive = owe, negative = refund

    // Baseline (no voluntary contributions) for savings calc
    const baseAGI     = Math.max(0, gross - seAboveLine)
    const baseTaxable = Math.max(0, baseAGI - deduction)
    const baseCTC     = calcCTC(children, baseAGI, status)
    const baseTax     = Math.max(0, calcTax(baseTaxable, status) - baseCTC) + seTax
    const savings     = baseTax - taxAfterCTC - seTax  // savings from voluntary contributions only

    const iraDeductibility = calcIraDeductibility(agi, status, coveredByPlan, spouseCovered, lim.ira)

    return {
      gross, w, se, seTax, seAboveLine,
      k401Val, iraVal, hsaVal,
      contributions, agi, deduction, taxable,
      incomeTax, ctc, taxAfterCTC, totalTax, effective, marginal,
      savings: Math.max(0, savings),
      stdDed, totalPaid, balance,
      k401Room: lim.k401 - k401Val,
      iraRoom:  lim.ira  - iraVal,
      hsaRoom:  hsaMax   - hsaVal,
      iraDeductibility,
    }
  }, [wages, seNet, k401, ira, hsa, dedType, itemized, status, lim, hsaMax, children, withholding, estPaid, otherTax, coveredByPlan, spouseCovered])

  const tips = useMemo(() => {
    if (!result) return []
    const r = result.marginal
    const out = []

    if (result.k401Room > 0)
      out.push(`You have ${fmt(result.k401Room)} of unused 401(k) space. Maxing it out could save roughly ${fmt(Math.round(result.k401Room * r))} in federal taxes.`)
    if (result.iraRoom > 0)
      out.push(`You can still contribute up to ${fmt(result.iraRoom)} to a Traditional IRA${coveredByPlan ? ' — check the deductibility note above based on your income' : ', which is fully deductible'}. A Roth IRA is worth considering if you expect a higher bracket in retirement.`)
    if (result.hsaRoom > 0)
      out.push(`HSAs offer triple tax advantages — pre-tax in, tax-free growth, tax-free out for medical expenses. You have ${fmt(result.hsaRoom)} of unused ${PLAN_YEAR} HSA space.`)
    if (result.se > 0 && result.k401Val < lim.k401 * 0.5)
      out.push(`As a self-employed person, a Solo 401(k) lets you contribute as both employee (up to ${fmt(lim.k401)}) and employer (up to 25% of net SE income), dramatically lowering taxable income.`)
    if (r >= 0.22 && dedType === 'standard')
      out.push(`At a ${fmtPct(r)} marginal rate, compare your ${fmt(result.stdDed)} standard deduction against your actual deductible expenses — mortgage interest, state taxes, and charitable gifts can push you over.`)
    if (result.marginal >= 0.32)
      out.push(`In the ${fmtPct(r)} bracket, charitable bunching — stacking two or more years of donations into one year — can help you clear the standard deduction and maximize itemized deductions.`)
    if (children === 0 && result.gross < 200000)
      out.push(`If you have qualifying children under 17, the ${PLAN_YEAR} Child Tax Credit is worth up to ${fmt(CTC_PER_CHILD)} per child. Enter the number above to see the impact.`)
    if (result.marginal === 0)
      out.push(`Your taxable income falls in the 0% bracket — an excellent year for a Roth IRA conversion at minimal tax cost.`)
    if (result.balance > 500)
      out.push(`You're projected to owe ${fmt(result.balance)} at filing. Consider increasing withholding or making an estimated payment to avoid an underpayment penalty.`)
    if (result.balance < -500)
      out.push(`You're projected for a ${fmt(Math.abs(result.balance))} refund. A large refund means you've given the IRS an interest-free loan — adjusting your W-4 withholding puts that money to work sooner.`)

    return out
  }, [result, dedType, children, lim, coveredByPlan])

  const hasContribs = result && (result.k401Val + result.iraVal + result.hsaVal) > 0
  const hasPaid     = result && result.totalPaid > 0

  return (
    <div className="max-w-3xl space-y-5">

      {/* Source banner */}
      <div className="flex gap-3 p-3.5 rounded-lg border border-blue-200 bg-blue-50">
        <Info size={15} className="shrink-0 mt-0.5 text-blue-500" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Official {PLAN_YEAR} IRS figures</span> — brackets and standard deductions from IRS Rev. Proc. 2025-29. HSA from IRS Pub. 969. IRA phase-out ranges based on 2025 guidance; 2026 adjustments pending IRS publication.
        </p>
      </div>

      {/* Filing setup */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">{PLAN_YEAR} Planning Setup</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Filing Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none"
              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #1D9E75')}
              onBlur={(e)  => (e.target.style.boxShadow = '')}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Age Group</label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none"
              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #1D9E75')}
              onBlur={(e)  => (e.target.style.boxShadow = '')}
            >
              {Object.entries(AGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Qualifying Children Under 17</label>
            <input
              type="number" min={0} max={20} value={children}
              onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none"
              onFocus={(e) => (e.target.style.boxShadow = '0 0 0 2px #1D9E75')}
              onBlur={(e)  => (e.target.style.boxShadow = '')}
            />
            {children > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Up to {fmt(children * CTC_PER_CHILD)} CTC — phases out above {fmt(CTC_PHASEOUT[status])} AGI
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 justify-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={familyHSA} onChange={(e) => setFamilyHSA(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1D9E75]" />
              <span className="text-sm text-gray-700">Family HSA coverage</span>
              <span className="text-xs text-gray-400">({fmt(lim.hsa_fam)})</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={coveredByPlan} onChange={(e) => setCovered(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1D9E75]" />
              <span className="text-sm text-gray-700">Covered by workplace retirement plan</span>
            </label>
            {showSpouseField && coveredByPlan === false && (
              <label className="flex items-center gap-2.5 cursor-pointer pl-1">
                <input type="checkbox" checked={spouseCovered} onChange={(e) => setSpouseCov(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#1D9E75]" />
                <span className="text-sm text-gray-600">Spouse covered by workplace plan</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Income */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Projected {PLAN_YEAR} Income</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="W-2 / Salary Income" value={wages} onChange={onWages} hint="Gross wages before any deductions" />
          <InputField label="Self-Employment Net Income" value={seNet} onChange={onSeNet} hint="After business expenses, before SE tax" />
        </div>
      </div>

      {/* Pre-tax contributions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <TrendingDown size={15} style={{ color: '#1D9E75' }} />
          <h2 className="text-sm font-semibold text-gray-900">Pre-Tax Contributions</h2>
          <span className="text-xs text-gray-400">— each dollar reduces taxable income</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <ContribRow
            label="401(k) / 403(b)"
            value={k401} onChange={onK401} max={lim.k401}
            hint={
              ageGroup === 'age6063' ? 'Includes $11,250 SECURE 2.0 catch-up' :
              ageGroup !== 'under50' ? 'Includes $8,000 catch-up' : undefined
            }
          />
          <div className="space-y-2">
            <ContribRow
              label="Traditional IRA"
              value={ira} onChange={onIra} max={lim.ira}
              hint={iraPhaseoutLabel}
            />
            {/* Live deductibility badge — updates with filing status, income, and coverage */}
            {result ? (
              <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                result.iraDeductibility.type === 'full'    ? 'bg-green-50 text-green-700' :
                result.iraDeductibility.type === 'partial' ? 'bg-amber-50 text-amber-700' :
                                                             'bg-red-50 text-red-700'
              }`}>
                {result.iraDeductibility.type === 'full'    && '✓ Fully deductible'}
                {result.iraDeductibility.type === 'partial' && `⚡ Partially deductible — up to ${fmt(result.iraDeductibility.deductible)}`}
                {result.iraDeductibility.type === 'none'    && '✕ Non-deductible — consider Roth IRA'}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Enter income to see deductibility</p>
            )}
          </div>
          <ContribRow
            label="HSA"
            value={hsa} onChange={onHsa} max={hsaMax}
            hint={familyHSA ? 'Family plan limit' : 'Individual plan limit'}
          />
        </div>
      </div>

      {/* Deductions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Deductions</h2>
        <div className="flex gap-5 flex-wrap">
          {['standard', 'itemized'].map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dedType" value={t} checked={dedType === t}
                onChange={() => setDedType(t)} className="accent-[#1D9E75]" />
              <span className="text-sm text-gray-700 capitalize">{t}</span>
              {t === 'standard' && (
                <span className="text-xs text-gray-400">({fmt(STD_DED[status])} — official {PLAN_YEAR})</span>
              )}
            </label>
          ))}
        </div>
        {dedType === 'itemized' && (
          <div className="max-w-xs">
            <InputField label="Total Itemized Deductions" value={itemized} onChange={onItemized} />
          </div>
        )}
      </div>

      {/* Payments & withholding */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Taxes Paid &amp; Withheld</h2>
        <p className="text-xs text-gray-400 -mt-2">Enter payments already made to estimate your refund or balance due.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField
            label="Federal Tax Withheld"
            value={withholding} onChange={onWithholding}
            hint="From W-2 Box 2 and/or 1099 withholding"
          />
          <InputField
            label="Estimated Tax Payments"
            value={estPaid} onChange={onEstPaid}
            hint="Quarterly payments made (Forms 1040-ES)"
          />
          <InputField
            label="Other Additional Taxes"
            value={otherTax} onChange={onOtherTax}
            hint="e.g. AMT, NIIT, household employment taxes"
          />
        </div>
      </div>

      {/* Results */}
      {result ? (
        <>
          {/* Savings callout */}
          {hasContribs && result.savings > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl border"
              style={{ backgroundColor: '#e8f7f2', borderColor: '#1D9E75' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#1D9E75' }}>
                <TrendingDown size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#14764f' }}>
                  Pre-tax contributions save you {fmt(result.savings)} in federal taxes
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#1D9E75' }}>
                  {fmt(result.contributions)} in contributions reduces your taxable income
                </p>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Gross Income"   value={fmt(result.gross)} />
            <SummaryCard label="Adj. Gross Income" value={fmt(result.agi)}
              sub={result.contributions > 0 ? `−${fmt(result.contributions)} deducted` : undefined} />
            <SummaryCard label="Est. Total Tax" value={fmt(result.totalTax)} highlight />
            <SummaryCard
              label={result.balance >= 0 ? 'Balance Due' : 'Est. Refund'}
              value={fmt(Math.abs(result.balance))}
              isRefund={hasPaid ? result.balance < 0 : null}
              sub={hasPaid
                ? `${fmt(result.totalPaid)} paid so far`
                : 'Enter payments above'}
            />
          </div>

          {/* Effective/marginal rate pills */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Effective Rate', val: fmtPct(result.effective) },
              { label: 'Marginal Rate', val: fmtPct(result.marginal) },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5">
                <span className="text-xs text-gray-500">{label}:</span>
                <span className="text-xs font-semibold text-gray-900">{val}</span>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">{PLAN_YEAR} Tax Breakdown</h3>
            </div>
            <div className="px-5 py-4 space-y-2.5 text-sm">
              {[
                { label: 'W-2 / Salary Income',                                      value: result.w,            show: result.w > 0 },
                { label: 'Self-Employment Income',                                    value: result.se,           show: result.se > 0 },
                { label: 'Total Gross Income',                                        value: result.gross,        bold: true },
                { label: '401(k) Contribution',                                       value: -result.k401Val,     show: result.k401Val > 0, muted: true },
                { label: 'IRA Contribution',                                          value: -result.iraVal,      show: result.iraVal > 0,  muted: true },
                { label: 'HSA Contribution',                                          value: -result.hsaVal,      show: result.hsaVal > 0,  muted: true },
                { label: 'Half SE Tax Deduction',                                     value: -result.seAboveLine, show: result.se > 0,      muted: true },
                { label: 'Adjusted Gross Income',                                     value: result.agi,          bold: true },
                { label: dedType === 'standard' ? `Standard Deduction (official ${PLAN_YEAR})` : 'Itemized Deduction',
                                                                                      value: -result.deduction,   muted: true },
                { label: 'Taxable Income',                                            value: result.taxable,      bold: true },
                { label: 'Federal Income Tax',                                        value: result.incomeTax },
                { label: `Child Tax Credit (${children} child${children !== 1 ? 'ren' : ''})`,
                                                                                      value: -result.ctc,         show: result.ctc > 0, muted: true },
                { label: 'Income Tax After Credits',                                  value: result.taxAfterCTC,  show: result.ctc > 0 },
                { label: 'Self-Employment Tax (15.3%)',                               value: result.seTax,        show: result.se > 0 },
                { label: 'Other Additional Taxes',                                    value: parseNum(otherTax),  show: parseNum(otherTax) > 0 },
                { label: 'Total Estimated Tax',                                       value: result.totalTax,     bold: true, highlight: true },
                { label: 'Federal Tax Withheld',                                      value: -parseNum(withholding), show: parseNum(withholding) > 0, muted: true },
                { label: 'Estimated Payments Made',                                   value: -parseNum(estPaid),  show: parseNum(estPaid) > 0,      muted: true },
                { label: result.balance >= 0 ? 'Balance Due at Filing' : 'Estimated Refund',
                                                                                      value: Math.abs(result.balance), show: hasPaid,
                  bold: true, refund: result.balance < 0 },
              ]
                .filter((r) => r.show !== false)
                .map(({ label, value, bold, muted, highlight, refund }, i) => (
                  <div key={i}
                    className={`flex justify-between items-center py-1 ${bold ? 'border-t border-gray-100 pt-2.5 mt-1' : ''}`}>
                    <span className={bold ? 'font-semibold text-gray-900' : muted ? 'text-gray-400 pl-3' : 'text-gray-600'}>
                      {muted && value < 0 ? '− ' : ''}{label}
                    </span>
                    <span
                      className={`font-medium ${highlight || (bold && refund != null) ? 'text-base font-semibold' : ''}`}
                      style={{
                        color: highlight ? '#1D9E75'
                             : refund === true ? '#1D9E75'
                             : refund === false ? '#dc2626'
                             : value < 0 ? '#6b7280' : '#111827'
                      }}
                    >
                      {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Bracket table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{PLAN_YEAR} Brackets — {STATUS_LABELS[status]}</h3>
              <span className="text-xs text-gray-400">Official IRS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-2.5">Rate</th>
                    <th className="text-left px-5 py-2.5">Income Range</th>
                    <th className="text-right px-5 py-2.5">Your Income in Bracket</th>
                  </tr>
                </thead>
                <tbody>
                  {BRACKETS[status].map((b, i) => {
                    const inBracket = result.taxable > b.min
                      ? Math.min(result.taxable, b.max === Infinity ? result.taxable : b.max) - b.min : 0
                    const isActive = inBracket > 0
                    const isTop = isActive && (i === BRACKETS[status].length - 1 || result.taxable <= BRACKETS[status][i + 1]?.min)
                    return (
                      <tr key={i} className={`border-b border-gray-50 last:border-0 ${isTop ? 'font-medium' : ''}`}
                        style={isTop ? { backgroundColor: '#f0faf6' } : {}}>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${isTop ? 'text-white' : isActive ? 'text-gray-700 bg-gray-100' : 'text-gray-400 bg-gray-50'}`}
                            style={isTop ? { backgroundColor: '#1D9E75' } : {}}>
                            {fmtPct(b.rate)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{fmt(b.min)} – {b.max === Infinity ? 'and above' : fmt(b.max)}</td>
                        <td className="px-5 py-3 text-right text-gray-800">{inBracket > 0 ? fmt(inBracket) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Planning tips */}
          {tips.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb size={15} style={{ color: '#1D9E75' }} />
                <h3 className="text-sm font-semibold text-gray-900">Planning Opportunities</h3>
              </div>
              {tips.map((tip, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f0faf6' }}>
                  <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: '#1D9E75' }}>{i + 1}</span>
                  <p className="text-xs text-gray-700 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Federal income tax estimate only. Does not include state taxes, AMT, NIIT, or all available credits.
            Figures: IRS Rev. Proc. 2025-29, IRS Pub. 969. IRA phase-out ranges based on 2025 IRS guidance.
            Consult a CPA for an accurate plan specific to your situation.
          </p>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">Enter your projected {PLAN_YEAR} income above to see your tax estimate and planning opportunities.</p>
        </div>
      )}
    </div>
  )
}
