import { useState, useEffect } from 'react'
import { CheckCircle, Circle, RotateCcw, Download, ChevronDown, ChevronRight } from 'lucide-react'

const STORAGE_KEY_IND = 'tps-checklist-individual-2026'
const STORAGE_KEY_BUS = 'tps-checklist-business-2026'

const INDIVIDUAL_CATEGORIES = [
  {
    id: 'personal',
    label: 'Personal Information',
    desc: 'Needed to identify you and any dependents on your return',
    items: [
      { id: 'ssn-self',      label: 'Your Social Security Number (SSN)' },
      { id: 'ssn-spouse',    label: 'Spouse SSN (if Married Filing Jointly)' },
      { id: 'ssn-deps',      label: 'SSN / ITIN for each dependent' },
      { id: 'dob',           label: 'Date of birth for you, spouse, and dependents' },
      { id: 'bank',          label: 'Bank routing & account number (for direct deposit refund)' },
      { id: 'prior-return',  label: 'Prior year tax return (for AGI verification and carryovers)' },
      { id: 'ip-pin',        label: 'IRS Identity Protection PIN (if assigned)' },
    ],
  },
  {
    id: 'income',
    label: 'Income Documents',
    desc: 'All sources of income received during the tax year',
    items: [
      { id: 'w2',           label: 'W-2 from each employer (wage & salary income)' },
      { id: '1099nec',      label: '1099-NEC (freelance / independent contractor income)' },
      { id: '1099misc',     label: '1099-MISC (rents, prizes, royalties, other income)' },
      { id: '1099int',      label: '1099-INT (bank interest income)' },
      { id: '1099div',      label: '1099-DIV (dividend income from investments)' },
      { id: '1099b',        label: '1099-B (proceeds from stocks, mutual funds, crypto sales)' },
      { id: '1099r',        label: '1099-R (distributions from IRA, 401(k), pension)' },
      { id: '1099g',        label: '1099-G (unemployment compensation or state tax refund)' },
      { id: '1099ssa',      label: 'SSA-1099 (Social Security benefits received)' },
      { id: 'k1',           label: 'Schedule K-1 (income from partnerships, S-Corps, trusts, estates)' },
      { id: 'alimony',      label: 'Alimony received (pre-2019 divorce decrees)' },
      { id: 'gambling',     label: 'W-2G or records of gambling winnings' },
      { id: 'rental',       label: 'Rental income records and related expenses' },
    ],
  },
  {
    id: 'deductions',
    label: 'Deductions & Adjustments',
    desc: 'Documents supporting above-the-line deductions and itemized deductions',
    items: [
      { id: 'mortgage-int', label: '1098 — Mortgage interest statement' },
      { id: 'prop-tax',     label: 'Property tax payment records' },
      { id: 'charitable',   label: 'Charitable donation receipts (cash and non-cash gifts)' },
      { id: 'medical',      label: 'Medical and dental expense receipts (unreimbursed)' },
      { id: 'student-int',  label: '1098-E — Student loan interest paid' },
      { id: 'tuition',      label: '1098-T — Tuition statement (education credits)' },
      { id: 'hsa-contrib',  label: '5498-SA — HSA contributions (if contributed outside payroll)' },
      { id: 'ira-contrib',  label: 'IRA contribution records for the tax year' },
      { id: 'se-health',    label: 'Self-employed health insurance premiums paid' },
      { id: 'salt',         label: 'State & local taxes paid (income or sales tax)' },
      { id: 'casualty',     label: 'Casualty or theft loss documentation (federally declared disaster)' },
      { id: 'vehicle-log',  label: 'Business vehicle mileage log (if claiming vehicle deduction)' },
    ],
  },
  {
    id: 'credits',
    label: 'Credits & Special Situations',
    desc: 'Supporting documents for tax credits and less common situations',
    items: [
      { id: 'childcare',    label: 'Childcare provider name, address, and EIN (Form 2441)' },
      { id: 'eitc',         label: 'Records confirming earned income (for EITC)' },
      { id: 'ev-credit',    label: 'EV / clean vehicle credit documentation (Form 8936)' },
      { id: 'energy',       label: 'Energy efficiency improvement receipts (Form 5695)' },
      { id: 'qbi',          label: 'QBI deduction records (if self-employed)' },
      { id: 'foreign-tax',  label: 'Foreign tax paid records (Form 1116)' },
      { id: 'adoption',     label: 'Adoption expense records (if applicable)' },
    ],
  },
  {
    id: 'payments',
    label: 'Taxes Paid',
    desc: 'Records of payments already made toward your tax liability',
    items: [
      { id: 'w4-verify',    label: 'W-4 on file — verify withholding was correct' },
      { id: 'est-q1',       label: 'Q1 estimated tax payment confirmation (Jan 15, 2026)' },
      { id: 'est-q2',       label: 'Q2 estimated tax payment confirmation (Jun 15, 2026)' },
      { id: 'est-q3',       label: 'Q3 estimated tax payment confirmation (Sep 15, 2026)' },
      { id: 'est-q4',       label: 'Q4 estimated tax payment confirmation (Jan 15, 2027)' },
      { id: 'prior-balance', label: 'Prior year overpayment applied to current year' },
    ],
  },
]

const BUSINESS_CATEGORIES = [
  {
    id: 'biz-info',
    label: 'Business Information',
    desc: 'Foundational details needed for business tax filings',
    items: [
      { id: 'ein',           label: 'Employer Identification Number (EIN)' },
      { id: 'entity-docs',   label: 'Entity formation documents (Articles, Operating Agreement)' },
      { id: 'prior-return',  label: 'Prior year business tax return (1120, 1120-S, 1065, or Schedule C)' },
      { id: 'officers',      label: 'Names, SSNs, and ownership % of all owners / officers' },
      { id: 'fiscal-year',   label: 'Confirm fiscal year-end (calendar vs. non-calendar)' },
    ],
  },
  {
    id: 'income-biz',
    label: 'Business Income',
    desc: 'All revenue and income sources for the business',
    items: [
      { id: 'gross-receipts', label: 'Total gross receipts / sales records' },
      { id: '1099s-recd',     label: '1099-NEC / 1099-K forms received from clients or platforms' },
      { id: 'bank-stmts',     label: 'Business bank statements (all accounts)' },
      { id: 'cc-stmts',       label: 'Business credit card statements' },
      { id: 'receivables',    label: 'Accounts receivable report (year-end balance)' },
      { id: 'other-income',   label: 'Other business income (interest, grants, insurance proceeds)' },
    ],
  },
  {
    id: 'expenses',
    label: 'Business Expenses',
    desc: 'Deductible costs of running the business',
    items: [
      { id: 'payroll-recs',   label: 'Payroll records (wages, salaries, bonuses paid to employees)' },
      { id: 'contractors',    label: 'Contractor payment records (1099-NEC issued)' },
      { id: 'rent-lease',     label: 'Office / equipment rent or lease agreements and payments' },
      { id: 'utilities',      label: 'Utilities paid for business premises' },
      { id: 'insurance',      label: 'Business insurance premiums' },
      { id: 'supplies',       label: 'Office supplies and materials receipts' },
      { id: 'travel',         label: 'Business travel receipts (airfare, hotel, meals at 50%)' },
      { id: 'vehicle-biz',    label: 'Business vehicle mileage log or actual expense records' },
      { id: 'advertising',    label: 'Advertising and marketing expense records' },
      { id: 'professional',   label: 'Professional fees (attorney, CPA, consultants)' },
      { id: 'subscriptions',  label: 'Software subscriptions and professional dues' },
      { id: 'homeoffice',     label: 'Home office measurements and expenses (if applicable)' },
    ],
  },
  {
    id: 'assets',
    label: 'Assets & Depreciation',
    desc: 'Records for Section 179, bonus depreciation, and asset tracking',
    items: [
      { id: 'asset-list',     label: 'Fixed asset schedule from prior year' },
      { id: 'purchases',      label: 'Invoices for equipment, machinery, or vehicles purchased' },
      { id: 'disposals',      label: 'Records of any assets sold or disposed of' },
      { id: 's179',           label: 'Section 179 election documentation (equipment expensed)' },
      { id: 'deprec-sch',     label: 'Prior year depreciation schedule' },
    ],
  },
  {
    id: 'payroll-tax',
    label: 'Payroll & Employment Taxes',
    desc: 'Required if you have employees',
    items: [
      { id: 'w2s-issued',     label: 'W-2s issued to all employees (copies)' },
      { id: '1099nec-issued', label: '1099-NECs issued to contractors paid $600+' },
      { id: '941s',           label: 'Form 941 quarterly payroll tax returns (all 4 quarters)' },
      { id: '940',            label: 'Form 940 — Annual FUTA tax return' },
      { id: 'state-payroll',  label: 'State payroll tax filings and payment confirmations' },
      { id: 'payroll-tax-pmts', label: 'EFTPS payroll tax deposit confirmations' },
    ],
  },
  {
    id: 'biz-payments',
    label: 'Estimated Taxes Paid',
    desc: 'Business estimated tax payments made during the year',
    items: [
      { id: 'biz-est-q1',    label: 'Q1 estimated tax payment (Apr 15, 2026)' },
      { id: 'biz-est-q2',    label: 'Q2 estimated tax payment (Jun 15, 2026)' },
      { id: 'biz-est-q3',    label: 'Q3 estimated tax payment (Sep 15, 2026)' },
      { id: 'biz-est-q4',    label: 'Q4 estimated tax payment (Jan 15, 2027)' },
    ],
  },
]

function loadChecked(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} }
  catch { return {} }
}

function CategorySection({ cat, checked, onToggle }) {
  const [open, setOpen] = useState(true)
  const doneCount = cat.items.filter(it => checked[it.id]).length
  const total     = cat.items.length
  const pct       = total > 0 ? doneCount / total : 0
  const allDone   = doneCount === total

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{cat.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${allDone ? 'text-white' : 'text-gray-600 bg-gray-100'}`}
              style={allDone ? { backgroundColor: '#1D9E75' } : {}}>
              {doneCount}/{total}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{cat.desc}</p>
        </div>
        {/* Progress bar */}
        <div className="w-24 shrink-0 hidden sm:block">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct * 100}%`, backgroundColor: allDone ? '#1D9E75' : '#6ee7c7' }} />
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-1.5">
          {cat.items.map(it => {
            const done = !!checked[it.id]
            return (
              <label key={it.id} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                <div className="shrink-0" onClick={() => onToggle(it.id)}>
                  {done
                    ? <CheckCircle size={18} style={{ color: '#1D9E75' }} />
                    : <Circle size={18} className="text-gray-300 group-hover:text-gray-400 transition-colors" />}
                </div>
                <span className={`text-sm transition-colors ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {it.label}
                </span>
              </label>
            )
          })}
          <button
            onClick={() => cat.items.forEach(it => !checked[it.id] && onToggle(it.id))}
            className="text-xs mt-2 py-1 px-3 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            Mark all as collected
          </button>
        </div>
      )}
    </div>
  )
}

export default function DocumentsChecklist({ mode }) {
  const storageKey  = mode === 'individual' ? STORAGE_KEY_IND : STORAGE_KEY_BUS
  const categories  = mode === 'individual' ? INDIVIDUAL_CATEGORIES : BUSINESS_CATEGORIES

  const [checked, setChecked] = useState(() => loadChecked(storageKey))

  // Persist to localStorage whenever checked changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked))
  }, [checked, storageKey])

  // Reload when mode switches
  useEffect(() => {
    setChecked(loadChecked(storageKey))
  }, [storageKey])

  const toggleItem = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }))

  const allItems   = categories.flatMap(c => c.items)
  const totalDone  = allItems.filter(it => checked[it.id]).length
  const totalItems = allItems.length
  const pct        = totalItems > 0 ? totalDone / totalItems : 0

  const handleReset = () => {
    if (window.confirm('Clear all checkmarks for this checklist?')) {
      setChecked({})
    }
  }

  const handlePrint = () => window.print()

  return (
    <div className="max-w-2xl space-y-5">

      {/* Progress header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {mode === 'individual' ? 'Individual Filing' : 'Business Filing'} — Document Checklist
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalDone} of {totalItems} documents collected for tax year 2026
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={12} /> Print
            </button>
            <button onClick={handleReset}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct * 100}%`, backgroundColor: pct === 1 ? '#1D9E75' : '#6ee7c7' }} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{Math.round(pct * 100)}% complete</span>
          {pct === 1 && (
            <span className="text-xs font-medium" style={{ color: '#1D9E75' }}>
              All documents collected — ready to file!
            </span>
          )}
        </div>
      </div>

      {/* Categories */}
      {categories.map(cat => (
        <CategorySection key={cat.id} cat={cat} checked={checked} onToggle={toggleItem} />
      ))}

      <p className="text-xs text-gray-400 leading-relaxed">
        This checklist covers common documents for tax year 2026. Your specific situation may require additional
        forms. Switch between Individual and Business modes using the sidebar toggle. Progress is saved automatically
        in your browser. Consult a CPA to confirm which documents apply to you.
      </p>
    </div>
  )
}
