import { useState } from 'react'
import { ChevronDown, Lightbulb } from 'lucide-react'

const GUIDES = {
  individual: [
    {
      id: 'income-basics',
      title: 'Income Tax Basics',
      tabs: [
        {
          id: 'filing-status',
          label: 'Filing Status',
          tip: 'Choosing the right filing status can significantly reduce your tax bill. Head of Household status often provides better brackets than Single for qualifying single parents.',
          questions: [
            {
              q: 'What is filing status and why does it matter?',
              a: 'Your filing status determines your standard deduction amount, the tax brackets that apply to your income, and eligibility for certain credits. The five statuses are: Single, Married Filing Jointly, Married Filing Separately, Head of Household, and Qualifying Surviving Spouse.',
            },
            {
              q: 'Who qualifies as Head of Household?',
              a: "You may file as Head of Household if you're unmarried (or considered unmarried), paid more than half the cost of keeping up a home, and had a qualifying person live with you for more than half the year. This status gives you a larger standard deduction and better tax brackets than Single.",
            },
            {
              q: 'Can my filing status change from year to year?',
              a: 'Yes. Your status is determined based on your situation on December 31 of the tax year. Life events like marriage, divorce, or the birth of a child can change your status each year.',
            },
          ],
        },
        {
          id: 'tax-brackets',
          label: 'Tax Brackets',
          tip: 'Tax brackets are marginal — only the income within each bracket is taxed at that rate. Earning more never means you take home less after taxes.',
          questions: [
            {
              q: 'How do tax brackets work?',
              a: 'The U.S. uses a progressive tax system with marginal rates. Income is taxed in layers — the first dollars are taxed at 10%, the next layer at 12%, and so on up to 37%. Only the income within each bracket is taxed at that rate, not your entire income.',
            },
            {
              q: "What's the difference between marginal and effective rate?",
              a: 'Your marginal rate is the rate applied to your last dollar of income (your top bracket). Your effective rate is the average rate across all your income — it\'s always lower than your marginal rate. Use effective rate to compare your actual tax burden.',
            },
            {
              q: 'Are tax brackets adjusted each year?',
              a: 'Yes, the IRS adjusts bracket thresholds annually for inflation. This prevents "bracket creep" — the phenomenon where inflation pushes you into higher brackets even though your real purchasing power hasn\'t increased.',
            },
          ],
        },
        {
          id: 'w2-1099',
          label: 'W-2 vs 1099',
          tip: 'If you receive 1099 income, set aside 25–30% of each payment for taxes to avoid underpayment penalties at filing time.',
          questions: [
            {
              q: "What's the difference between a W-2 and a 1099?",
              a: 'A W-2 is issued by employers to employees and shows wages plus taxes already withheld. A 1099 is issued to independent contractors and other non-employees — no taxes are withheld, so you\'re responsible for paying them yourself.',
            },
            {
              q: 'Can I receive both a W-2 and a 1099?',
              a: 'Absolutely. Many people have a primary job (W-2) and side income from freelancing or contract work (1099). You must report all income regardless of the form received.',
            },
            {
              q: 'What if I don\'t receive a 1099?',
              a: 'You must still report all income even if you don\'t receive a 1099. The IRS requires you to report income when it\'s $400 or more from self-employment, but payers are only required to issue a 1099-NEC when they paid you $600 or more.',
            },
          ],
        },
      ],
    },
    {
      id: 'deductions',
      title: 'Deductions & Credits',
      tabs: [
        {
          id: 'standard-deduction',
          label: 'Standard Deduction',
          tip: 'For 2024, the standard deduction is $14,600 for Single filers and $29,200 for Married Filing Jointly. About 90% of taxpayers use the standard deduction.',
          questions: [
            {
              q: 'What is the standard deduction?',
              a: 'The standard deduction is a flat dollar amount that reduces your taxable income. You don\'t need receipts or documentation — everyone qualifies based on filing status. For 2024: Single = $14,600, Married Filing Jointly = $29,200, Head of Household = $21,900.',
            },
            {
              q: 'Should I take the standard deduction or itemize?',
              a: 'Choose whichever gives you a larger deduction. Itemizing makes sense if your qualifying expenses (mortgage interest, state/local taxes, charitable donations, medical expenses) total more than the standard deduction for your filing status.',
            },
            {
              q: 'Are there situations where I must itemize?',
              a: 'If you\'re married filing separately and your spouse itemizes, you must also itemize. Otherwise, you always have the choice. Most people benefit from the standard deduction since it\'s been roughly doubled since 2018.',
            },
          ],
        },
        {
          id: 'tax-credits',
          label: 'Tax Credits',
          tip: 'Credits beat deductions dollar-for-dollar. A $1,000 credit reduces your tax bill by exactly $1,000. A $1,000 deduction only saves you your marginal rate × $1,000.',
          questions: [
            {
              q: "What's the difference between a deduction and a credit?",
              a: 'Deductions reduce your taxable income, which indirectly lowers your tax. Credits directly reduce the tax you owe, dollar for dollar. Refundable credits can even give you money back if the credit exceeds your tax liability.',
            },
            {
              q: 'What are the most common tax credits?',
              a: 'Key credits include: Child Tax Credit (up to $2,000 per child), Earned Income Tax Credit (for lower-to-moderate income earners), Child and Dependent Care Credit, American Opportunity Credit (education), and Lifetime Learning Credit.',
            },
            {
              q: "What's the difference between refundable and non-refundable credits?",
              a: 'Non-refundable credits can reduce your tax to zero but not below. Refundable credits (like the EITC) can give you a refund even if you owe no tax. Partially refundable credits, like the Child Tax Credit, work somewhere in between.',
            },
          ],
        },
        {
          id: 'itemizing',
          label: 'Itemizing',
          tip: 'The SALT deduction (state and local taxes) is capped at $10,000. If you live in a high-tax state and own a home, this cap may push you toward the standard deduction even if you have significant deductible expenses.',
          questions: [
            {
              q: 'What expenses can I itemize?',
              a: 'Common itemized deductions: mortgage interest (up to $750K of debt), state and local taxes (capped at $10,000), charitable contributions, medical expenses exceeding 7.5% of AGI, and casualty/theft losses from federally declared disasters.',
            },
            {
              q: 'How do I track deductible expenses?',
              a: 'Keep receipts, bank statements, and documentation throughout the year. For charitable donations over $250, you need written acknowledgment from the organization. For medical expenses, keep an expense log and all receipts.',
            },
            {
              q: 'Can I deduct home office expenses?',
              a: 'Employees working from home generally cannot deduct home office expenses under current law. However, self-employed individuals can deduct home office costs using either the simplified method ($5/sq ft, up to 300 sq ft) or the actual expense method.',
            },
          ],
        },
      ],
    },
    {
      id: 'self-employment',
      title: 'Self-Employment Income',
      tabs: [
        {
          id: 'se-tax',
          label: 'Self-Employment Tax',
          tip: 'You can deduct half of your self-employment tax from your gross income as an above-the-line deduction. This reduces your income tax even if you take the standard deduction.',
          questions: [
            {
              q: 'What is self-employment tax?',
              a: 'Self-employment tax covers Social Security (12.4%) and Medicare (2.9%), totaling 15.3% on net self-employment income up to $168,600 (2024 SS wage base). Employees split this with employers, but self-employed individuals pay the full amount.',
            },
            {
              q: 'How is SE tax calculated?',
              a: 'Multiply your net self-employment income by 92.35% (to account for the employer deduction equivalent), then multiply by 15.3%. The 0.9% Additional Medicare Tax applies to SE income over $200,000 (single) or $250,000 (married).',
            },
            {
              q: 'Are there ways to reduce self-employment tax?',
              a: 'Forming an S-Corp can reduce SE tax by allowing you to pay yourself a "reasonable salary" (subject to payroll taxes) and take additional profit as distributions (not subject to SE tax). Consult a CPA to determine if this structure makes sense for your income level.',
            },
          ],
        },
        {
          id: 'quarterly',
          label: 'Quarterly Payments',
          tip: 'Underpaying estimated taxes can result in a penalty. A safe harbor: pay either 100% of last year\'s tax (110% if AGI > $150K) or 90% of this year\'s expected tax.',
          questions: [
            {
              q: 'Who needs to make quarterly estimated tax payments?',
              a: 'You generally must make quarterly payments if you expect to owe at least $1,000 in federal taxes after withholding and credits. This includes self-employed individuals, freelancers, and anyone with significant investment income.',
            },
            {
              q: 'When are quarterly payments due?',
              a: 'The 2024 due dates are: April 15 (Q1), June 17 (Q2), September 16 (Q3), and January 15, 2025 (Q4). Note that Q2 covers only 2 months — this is a quirk of the IRS schedule.',
            },
            {
              q: 'How do I calculate how much to pay?',
              a: 'Estimate your total tax liability for the year, subtract expected withholding, and divide the remaining amount by four. Or use the "safe harbor" method: pay 25% of last year\'s total tax bill each quarter to avoid underpayment penalties.',
            },
          ],
        },
        {
          id: 'home-office',
          label: 'Home Office',
          tip: 'The simplified method ($5/sq ft, max $1,500) is easier to calculate but may give a smaller deduction than the actual expense method for larger home offices.',
          questions: [
            {
              q: 'What qualifies as a home office?',
              a: 'Your home office must be used regularly and exclusively for business. It can be a separate room or a dedicated area within a room. Exclusive use means it\'s not your dining table or a guest bedroom — it must be your workspace only.',
            },
            {
              q: 'What can I deduct with the actual expense method?',
              a: 'You deduct the business-use percentage of: rent or mortgage interest, utilities, insurance, repairs, depreciation, and HOA fees. The business-use percentage = home office square footage ÷ total home square footage.',
            },
            {
              q: 'Can I deduct internet and phone expenses?',
              a: 'Yes — the business-use portion of internet and phone bills is deductible. If you use your phone 60% for business, you can deduct 60% of the bill. Keep records or a usage log to support your deduction percentage.',
            },
          ],
        },
      ],
    },
  ],
  business: [
    {
      id: 'biz-structures',
      title: 'Business Structures & Tax',
      tabs: [
        {
          id: 'sole-prop',
          label: 'Sole Proprietorship',
          tip: 'A sole proprietorship is the simplest structure, but all business income flows to your personal return and is subject to self-employment tax. As your income grows, other structures may offer significant tax savings.',
          questions: [
            {
              q: 'How is a sole proprietorship taxed?',
              a: 'Business income and expenses are reported on Schedule C of your personal tax return (Form 1040). Net profit is subject to both income tax at your marginal rate and self-employment tax (15.3%). There\'s no separate business tax return.',
            },
            {
              q: 'What records should a sole proprietor keep?',
              a: 'Keep records of all income (invoices, 1099s), all business expenses (receipts, bank statements), mileage logs, and any asset purchases. Good record-keeping is essential since you\'re personally responsible for all business taxes.',
            },
            {
              q: 'When does it make sense to change from a sole proprietorship?',
              a: 'Consider forming an LLC or S-Corp when your net self-employment income consistently exceeds $50,000–$80,000 per year. At that level, the potential payroll tax savings can outweigh the cost and complexity of maintaining a separate entity.',
            },
          ],
        },
        {
          id: 'llc-scorp',
          label: 'LLC & S-Corp',
          tip: 'An S-Corp election can save significant self-employment taxes, but the IRS requires you to pay yourself a "reasonable salary." The savings only apply to distributions above that salary.',
          questions: [
            {
              q: 'How is an LLC taxed by default?',
              a: 'A single-member LLC is taxed as a sole proprietorship by default (Schedule C). A multi-member LLC is taxed as a partnership (Form 1065). LLCs can elect to be taxed as an S-Corp or C-Corp by filing the appropriate election with the IRS.',
            },
            {
              q: "What's the tax benefit of an S-Corp?",
              a: 'With an S-Corp, you pay yourself a reasonable salary (subject to payroll taxes), and remaining profits are distributed as dividends not subject to self-employment tax (15.3%). This can save thousands when business income is high.',
            },
            {
              q: 'What are the compliance requirements for an S-Corp?',
              a: 'S-Corps must: file a separate business return (Form 1120-S), run payroll for owner-employees, hold annual meetings, maintain corporate minutes, and meet IRS eligibility requirements (max 100 shareholders, U.S. citizens/residents only).',
            },
          ],
        },
        {
          id: 'ccorp',
          label: 'C-Corporation',
          tip: 'C-Corps pay a flat 21% federal corporate tax rate. Profits distributed as dividends are taxed again on shareholders\' returns — this "double taxation" is the main downside of C-Corp status.',
          questions: [
            {
              q: 'How is a C-Corp taxed?',
              a: 'C-Corps pay a flat federal corporate income tax rate of 21% on taxable income. Shareholders also pay personal income tax on dividends received. This double taxation is the main disadvantage compared to pass-through structures.',
            },
            {
              q: 'When is a C-Corp structure advantageous?',
              a: 'C-Corps make sense when you plan to reinvest most profits back into the business (avoiding the double tax), seek venture capital (VCs often require C-Corp status), or want to offer stock options to employees via qualified plans like ISOs.',
            },
            {
              q: 'What is the C-Corp tax return deadline?',
              a: 'C-Corps with a December 31 fiscal year end must file Form 1120 by April 15. The deadline can be extended to October 15 by filing Form 7004. Estimated tax payments are due quarterly on the 15th of April, June, September, and December.',
            },
          ],
        },
      ],
    },
    {
      id: 'biz-deductions',
      title: 'Business Deductions',
      tabs: [
        {
          id: 'operating',
          label: 'Operating Expenses',
          tip: 'Expenses must be "ordinary and necessary" to be deductible. Ordinary means common in your industry; necessary means helpful and appropriate for your business. Both criteria must be met.',
          questions: [
            {
              q: 'What business expenses are generally deductible?',
              a: 'Deductible operating expenses include: rent, utilities, office supplies, software subscriptions, professional services (legal, accounting), advertising, business insurance, employee wages and benefits, and professional development.',
            },
            {
              q: 'Can I deduct meals and entertainment?',
              a: 'Business meals are 50% deductible if there\'s a genuine business purpose and you document who attended and the business topic. Entertainment expenses (concerts, sporting events) are generally not deductible under current law since the 2017 tax reform.',
            },
            {
              q: 'What is the QBI deduction?',
              a: 'The Qualified Business Income (QBI) deduction allows eligible self-employed individuals and pass-through entity owners to deduct up to 20% of their qualified business income. Income limits and business type restrictions apply — some service businesses phase out at higher income levels.',
            },
          ],
        },
        {
          id: 'vehicle-travel',
          label: 'Vehicle & Travel',
          tip: 'Keep a contemporaneous mileage log — date, destination, purpose, and miles. The IRS scrutinizes vehicle deductions closely, and a log created retroactively may not hold up in an audit.',
          questions: [
            {
              q: 'How can I deduct business vehicle use?',
              a: 'Two methods: (1) Standard mileage rate — 67 cents per mile for 2024, simple to calculate. (2) Actual expense method — deduct the business-use percentage of all vehicle costs (gas, insurance, repairs, depreciation). Choose the method that gives you the larger deduction.',
            },
            {
              q: 'What travel expenses are deductible?',
              a: 'When traveling away from your tax home for business: airfare, hotels, 50% of meals, rental cars, taxis/rideshares, and tips are deductible. Personal vacation costs are not — only the business portion qualifies if a trip mixes business and pleasure.',
            },
            {
              q: 'Can I deduct commuting costs?',
              a: 'No — commuting from home to your regular workplace is not a deductible business expense. However, travel from your office to a client site, or travel between multiple work locations, is deductible. Home office users may have different rules.',
            },
          ],
        },
        {
          id: 'equipment',
          label: 'Equipment & Assets',
          tip: 'Section 179 lets you deduct up to $1,220,000 of qualifying equipment in the year of purchase (2024 limit), rather than depreciating it over many years. This can be a powerful tool for reducing taxable income.',
          questions: [
            {
              q: 'How do I deduct business equipment?',
              a: 'Two approaches: (1) Section 179 — immediately expense up to $1,220,000 of qualifying equipment in 2024. (2) Regular depreciation — deduct a portion of the asset\'s cost each year over its useful life (MACRS). Bonus depreciation (currently 60% in 2024) is another option.',
            },
            {
              q: 'What qualifies for Section 179?',
              a: 'Qualifying property includes tangible personal property used in business (computers, machinery, furniture), off-the-shelf software, and some improvements to nonresidential real property. Vehicles have separate limits. The property must be used more than 50% for business.',
            },
            {
              q: 'What is depreciation recapture?',
              a: 'When you sell a depreciated business asset, any gain up to the amount previously depreciated is taxed as ordinary income (not the lower capital gains rate). This is called depreciation recapture and applies to Section 179 deductions as well.',
            },
          ],
        },
      ],
    },
    {
      id: 'payroll',
      title: 'Payroll Taxes',
      tabs: [
        {
          id: 'what-is-payroll',
          label: 'Payroll Tax Basics',
          tip: 'Payroll taxes are trust fund taxes — the IRS treats employee withholdings as money held in trust for the government. Failure to remit these funds can result in the Trust Fund Recovery Penalty, which holds responsible individuals personally liable.',
          questions: [
            {
              q: 'What are payroll taxes?',
              a: 'Payroll taxes are taxes withheld from employee wages and matched by employers. They fund Social Security and Medicare (FICA taxes) and unemployment insurance (FUTA). Employers must withhold, match, and remit these amounts to the IRS on a regular schedule.',
            },
            {
              q: 'What forms are involved in payroll taxes?',
              a: 'Key forms: Form 941 (quarterly federal payroll tax return), Form 944 (annual alternative to 941 for small employers), Form 940 (annual FUTA return), W-2 (annual wage statements to employees), and Form W-3 (transmittal for W-2s to the SSA).',
            },
            {
              q: 'When must payroll taxes be deposited?',
              a: 'Deposit frequency depends on your payroll tax liability. Small employers may deposit monthly; larger employers deposit semi-weekly. New employers generally deposit monthly. The IRS determines your schedule each year based on the prior year\'s tax liability.',
            },
          ],
        },
        {
          id: 'fica-futa',
          label: 'FICA & FUTA',
          tip: 'The Social Security wage base for 2024 is $168,600. Wages above this threshold are still subject to Medicare tax (2.9%) but not the 6.2% Social Security portion.',
          questions: [
            {
              q: 'How does FICA work?',
              a: 'FICA = Social Security + Medicare. For 2024: Social Security is 6.2% on wages up to $168,600 (employee and employer each). Medicare is 1.45% on all wages (both parties). An additional 0.9% Medicare surtax applies to employees earning over $200,000 — employers don\'t match this portion.',
            },
            {
              q: 'What is FUTA and who pays it?',
              a: 'FUTA (Federal Unemployment Tax Act) funds the federal portion of unemployment insurance. Only employers pay FUTA — it\'s not withheld from employee wages. The rate is 6% on the first $7,000 of each employee\'s wages, but a 5.4% credit applies if state unemployment taxes are paid timely, reducing the effective rate to 0.6%.',
            },
            {
              q: 'Are there payroll taxes for contractors?',
              a: 'No payroll taxes apply to independent contractors. You do not withhold or match FICA for contractors. However, you must issue Form 1099-NEC for payments of $600 or more and may need to verify contractor status carefully — misclassifying employees as contractors carries significant penalties.',
            },
          ],
        },
        {
          id: 'employer-resp',
          label: 'Employer Responsibilities',
          tip: 'Set up payroll before hiring your first employee, not after. Late payroll tax deposits accrue penalties starting at 2% (1–5 days late) up to 15% (10+ days late after IRS notice).',
          questions: [
            {
              q: 'What must employers do when hiring their first employee?',
              a: 'Required steps: obtain an EIN from the IRS, verify employment eligibility (Form I-9), have employee complete Form W-4, register with your state for state income tax withholding, set up state unemployment tax (SUTA), and establish a payroll system or hire a payroll service.',
            },
            {
              q: 'What are the year-end payroll responsibilities?',
              a: 'By January 31: provide W-2 forms to employees and file with the Social Security Administration. Reconcile W-2 totals with Form 941 filings. File Form 940 for FUTA. Verify contractor payments and issue 1099-NEC forms for those paid $600 or more.',
            },
            {
              q: 'Can I use payroll software or a service?',
              a: 'Yes, and it\'s strongly recommended. Payroll services like Gusto, ADP, or QuickBooks Payroll automatically calculate withholdings, handle deposits, file quarterly returns, and generate year-end W-2s. The cost (typically $40–$150/month) is far less than payroll tax penalties.',
            },
          ],
        },
      ],
    },
  ],
}

function QAItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800 pr-4">{q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

function TipBox({ tip }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg mt-4" style={{ backgroundColor: '#e8f7f2', borderLeft: '3px solid #1D9E75' }}>
      <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: '#1D9E75' }} />
      <p className="text-sm leading-relaxed" style={{ color: '#14764f' }}>{tip}</p>
    </div>
  )
}

export default function TaxGuides({ mode }) {
  const guides = GUIDES[mode]
  const [openTopic, setOpenTopic] = useState(guides[0].id)
  const [activeTab, setActiveTab] = useState({})

  const getActiveTab = (topic) => activeTab[topic.id] || topic.tabs[0].id

  return (
    <div className="max-w-3xl space-y-3">
      {guides.map((topic) => {
        const isOpen = openTopic === topic.id
        const currentTabId = getActiveTab(topic)
        const currentTab = topic.tabs.find((t) => t.id === currentTabId) || topic.tabs[0]

        return (
          <div key={topic.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Topic header */}
            <button
              onClick={() => setOpenTopic(isOpen ? null : topic.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-900">{topic.title}</span>
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {/* Sub-tabs */}
                <div className="flex border-b border-gray-100 px-5 gap-1">
                  {topic.tabs.map((tab) => {
                    const active = tab.id === currentTabId
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab((prev) => ({ ...prev, [topic.id]: tab.id }))}
                        className={`px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                          active
                            ? 'border-[#1D9E75] text-[#1D9E75]'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        style={active ? { borderColor: '#1D9E75', color: '#1D9E75' } : {}}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* Q&A */}
                <div className="px-5 py-5 space-y-2.5">
                  {currentTab.questions.map((qa, i) => (
                    <QAItem key={i} q={qa.q} a={qa.a} />
                  ))}
                  <TipBox tip={currentTab.tip} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
