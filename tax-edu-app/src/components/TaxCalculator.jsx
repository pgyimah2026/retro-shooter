import { useState, useMemo } from 'react'

// 2026 tax brackets — IRS Rev. Proc. 2025-29 (includes One Big Beautiful Bill)
// MFS brackets = exactly half of MFJ (IRS rule); QSS brackets = same as MFJ
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
    // Half of MFJ thresholds; 37% starts at $384,350 (half of $768,700)
    { rate: 0.10, min: 0,       max: 12400 },
    { rate: 0.12, min: 12400,   max: 50400 },
    { rate: 0.22, min: 50400,   max: 105700 },
    { rate: 0.24, min: 105700,  max: 201775 },
    { rate: 0.32, min: 201775,  max: 256225 },
    { rate: 0.35, min: 256225,  max: 384350 },
    { rate: 0.37, min: 384350,  max: Infinity },
  ],
  hoh: [
    // 10% & 12% thresholds are IRS-estimated; 22%+ are official
    { rate: 0.10, min: 0,       max: 17700 },
    { rate: 0.12, min: 17700,   max: 67450 },
    { rate: 0.22, min: 67450,   max: 105700 },
    { rate: 0.24, min: 105700,  max: 201775 },
    { rate: 0.32, min: 201775,  max: 256225 },
    { rate: 0.35, min: 256225,  max: 640600 },
    { rate: 0.37, min: 640600,  max: Infinity },
  ],
  qss: [
    // Same as MFJ — IRS Rev. Proc. 2025-29
    { rate: 0.10, min: 0,       max: 24800 },
    { rate: 0.12, min: 24800,   max: 100800 },
    { rate: 0.22, min: 100800,  max: 211400 },
    { rate: 0.24, min: 211400,  max: 403550 },
    { rate: 0.32, min: 403550,  max: 512450 },
    { rate: 0.35, min: 512450,  max: 768700 },
    { rate: 0.37, min: 768700,  max: Infinity },
  ],
}

// 2026 standard deductions — IRS Rev. Proc. 2025-29
const STANDARD_DEDUCTIONS = { single: 16100, mfj: 32200, mfs: 16100, hoh: 24150, qss: 32200 }

const STATUS_LABELS = {
  single: 'Single',
  mfj:    'Married Filing Jointly',
  mfs:    'Married Filing Separately',
  hoh:    'Head of Household',
  qss:    'Qualifying Surviving Spouse',
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n) {
  return (n * 100).toFixed(2) + '%'
}

function calcTax(taxableIncome, brackets) {
  let tax = 0
  const breakdown = []

  for (const b of brackets) {
    if (taxableIncome <= b.min) break
    const incomeInBracket = Math.min(taxableIncome, b.max) - b.min
    const taxInBracket = incomeInBracket * b.rate
    tax += taxInBracket
    breakdown.push({ rate: b.rate, min: b.min, max: b.max, incomeInBracket, taxInBracket })
  }

  return { tax, breakdown }
}

const TAX_YEAR = new Date().getFullYear() - 1

export default function TaxCalculator() {
  const [status, setStatus] = useState('single')
  const [grossIncome, setGrossIncome] = useState('')
  const [deductionType, setDeductionType] = useState('standard')
  const [itemizedAmount, setItemizedAmount] = useState('')

  const result = useMemo(() => {
    const income = parseFloat(grossIncome.replace(/,/g, '')) || 0
    if (income <= 0) return null

    const standardDed = STANDARD_DEDUCTIONS[status]
    const itemized = parseFloat(itemizedAmount.replace(/,/g, '')) || 0
    const deduction = deductionType === 'standard' ? standardDed : Math.max(itemized, 0)

    const taxableIncome = Math.max(0, income - deduction)
    const brackets = BRACKETS[status]
    const { tax, breakdown } = calcTax(taxableIncome, brackets)
    const effectiveRate = income > 0 ? tax / income : 0

    const topBracket = breakdown.length > 0 ? breakdown[breakdown.length - 1].rate : 0

    return { income, deduction, taxableIncome, tax, effectiveRate, topBracket, breakdown }
  }, [grossIncome, status, deductionType, itemizedAmount])

  const handleIncomeInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setGrossIncome(raw ? parseInt(raw).toLocaleString() : '')
  }

  const handleItemizedInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setItemizedAmount(raw ? parseInt(raw).toLocaleString() : '')
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Inputs card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">2026 Federal Tax Estimator</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Filing status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Filing Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Gross income */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Gross Annual Income</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="text"
                value={grossIncome}
                onChange={handleIncomeInput}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#1D9E75' }}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #1D9E75'}
                onBlur={(e) => e.target.style.boxShadow = ''}
              />
            </div>
          </div>

          {/* Deduction type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deduction Type</label>
            <div className="flex gap-3">
              {['standard', 'itemized'].map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deductionType"
                    value={type}
                    checked={deductionType === type}
                    onChange={() => setDeductionType(type)}
                    className="accent-[#1D9E75]"
                  />
                  <span className="text-sm text-gray-700 capitalize">{type}</span>
                  {type === 'standard' && status && (
                    <span className="text-xs text-gray-400">({fmt(STANDARD_DEDUCTIONS[status])})</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Itemized amount */}
          {deductionType === 'itemized' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Itemized Deduction Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="text"
                  value={itemizedAmount}
                  onChange={handleItemizedInput}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none"
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #1D9E75'}
                  onBlur={(e) => e.target.style.boxShadow = ''}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Gross Income', value: fmt(result.income) },
              { label: 'Taxable Income', value: fmt(result.taxableIncome) },
              { label: 'Estimated Tax', value: fmt(result.tax), highlight: true },
              { label: 'Effective Rate', value: fmtPct(result.effectiveRate) },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={`rounded-xl p-4 border ${highlight ? 'border-[#1D9E75]' : 'border-gray-200 bg-white'}`}
                style={highlight ? { backgroundColor: '#e8f7f2', borderColor: '#1D9E75' } : {}}
              >
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p
                  className={`text-lg font-semibold ${highlight ? 'text-[#1D9E75]' : 'text-gray-900'}`}
                  style={highlight ? { color: '#1D9E75' } : {}}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Deduction note */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">Deduction used: </span>
              {deductionType === 'standard'
                ? `Standard deduction of ${fmt(result.deduction)}`
                : `Itemized deduction of ${fmt(result.deduction)}`}
              {' '}reduces taxable income to {fmt(result.taxableIncome)}.
            </p>
          </div>

          {/* Bracket breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Bracket Breakdown</h3>
              <p className="text-xs text-gray-500 mt-0.5">Your top bracket: <span className="font-medium text-gray-700">{fmtPct(result.topBracket)}</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-2.5">Rate</th>
                    <th className="text-left px-5 py-2.5">Bracket Range</th>
                    <th className="text-right px-5 py-2.5">Income in Bracket</th>
                    <th className="text-right px-5 py-2.5">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {result.breakdown.map((row, i) => {
                    const isTop = i === result.breakdown.length - 1
                    return (
                      <tr
                        key={i}
                        className={`border-b border-gray-50 last:border-0 ${isTop ? 'font-medium' : ''}`}
                        style={isTop ? { backgroundColor: '#f0faf6' } : {}}
                      >
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${isTop ? 'text-white' : 'text-gray-600 bg-gray-100'}`}
                            style={isTop ? { backgroundColor: '#1D9E75' } : {}}
                          >
                            {fmtPct(row.rate)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {fmt(row.min)} – {row.max === Infinity ? 'and above' : fmt(row.max)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-800">{fmt(row.incomeInBracket)}</td>
                        <td className="px-5 py-3 text-right text-gray-800">{fmt(row.taxInBracket)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-700">Total Estimated Federal Tax</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(result.tax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            This is an estimate for federal income tax only. It does not include state taxes, self-employment tax, AMT, or tax credits. Consult a CPA for a complete tax picture.
          </p>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">Enter your gross income above to see your estimated tax.</p>
        </div>
      )}
    </div>
  )
}
