import { useState } from 'react'
import { ChevronDown, Lightbulb } from 'lucide-react'

// All figures sourced from IRS.gov for tax year 2026
// Key sources: IRS Rev. Proc. 2025-29 (brackets, deductions), IRS Pub. 946 (2026, Section 179),
//              IRS Pub. 15 / Topic 751 (FICA 2026), IRS retirement plans guidance (2026),
//              IRS Pub. 969 (HSA 2026), IRS EITC tables (2026 estimates based on Rev. Proc. 2025-29)

const GUIDES = {
  individual: [
    {
      id: 'income-basics',
      title: 'Income Tax Basics',
      tabs: [
        {
          id: 'filing-status',
          label: 'Filing Status',
          tip: 'Choosing the right filing status can significantly reduce your tax bill. Head of Household gives you a $24,150 standard deduction in 2026 — $8,050 more than filing Single — plus access to more favorable brackets if you\'re a qualifying single parent.',
          questions: [
            {
              q: 'What is filing status and why does it matter?',
              a: 'Your filing status determines your standard deduction, the tax brackets that apply to your income, and eligibility for certain credits. The five statuses are: Single, Married Filing Jointly, Married Filing Separately, Head of Household, and Qualifying Surviving Spouse. For 2026: Single = $16,100, MFJ = $32,200, HoH = $24,150 (IRS Rev. Proc. 2025-29).',
            },
            {
              q: 'Who qualifies as Head of Household?',
              a: "You may file as Head of Household if you're unmarried (or considered unmarried), paid more than half the cost of keeping up a home, and had a qualifying person live with you for more than half the year. This gives you a $24,150 standard deduction in 2026 and access to lower bracket rates than Single filing status.",
            },
            {
              q: 'Can my filing status change from year to year?',
              a: 'Yes. Your status is determined based on your situation on December 31 of the tax year. Life events like marriage, divorce, or the birth of a child can change your status — and with it, your standard deduction, brackets, and credit eligibility. Review your status every year.',
            },
          ],
        },
        {
          id: 'tax-brackets',
          label: 'Tax Brackets',
          tip: 'Tax brackets are marginal — only the income within each bracket is taxed at that rate. In 2026, the 37% top rate only applies to income above $640,600 (Single) or $768,700 (Married Filing Jointly). Most Americans never reach those thresholds.',
          questions: [
            {
              q: 'What are the 2026 federal tax brackets?',
              a: 'For 2026 (IRS Rev. Proc. 2025-29), Single filers: 10% on $0–$12,400, 12% on $12,400–$50,400, 22% on $50,400–$105,700, 24% on $105,700–$201,775, 32% on $201,775–$256,225, 35% on $256,225–$640,600, 37% above $640,600. Married Filing Jointly thresholds are roughly double: 10% on $0–$24,800, 12% on $24,800–$100,800, 22% on $100,800–$211,400, and so on up to 37% above $768,700.',
            },
            {
              q: "What's the difference between marginal and effective rate?",
              a: 'Your marginal rate is the rate applied to your last dollar of income. Your effective rate is the average across all your income — always lower than your marginal rate. For example, a single filer with $80,000 in taxable income is in the 22% bracket for 2026, but their effective rate is well below 22% because the first $12,400 is taxed at 10% and the next layer at 12%.',
            },
            {
              q: 'Are tax brackets adjusted each year?',
              a: 'Yes. The IRS adjusts bracket thresholds annually for inflation to prevent "bracket creep." For 2026, the thresholds rose roughly 3.9–4.0% from 2025 under Rev. Proc. 2025-29. The 2026 adjustments also reflect changes from the One Big Beautiful Bill signed in 2025.',
            },
          ],
        },
        {
          id: 'w2-1099',
          label: 'W-2 vs 1099',
          tip: 'If you receive 1099 income, set aside 25–30% of each payment for taxes to cover both income tax and self-employment tax (15.3%). Self-employment tax on top of income tax is often a shock for new freelancers — plan for it from day one.',
          questions: [
            {
              q: "What's the difference between a W-2 and a 1099?",
              a: 'A W-2 is issued by employers to employees — it shows wages and taxes already withheld. A 1099-NEC is issued to independent contractors — no taxes are withheld, so you\'re responsible for paying them yourself, including both income tax and self-employment tax (15.3% on net SE income up to $184,500 for 2026, 2.9% above that).',
            },
            {
              q: 'Can I receive both a W-2 and a 1099?',
              a: 'Absolutely. Many people have a primary job (W-2) and side income from freelancing or contract work (1099-NEC). You must report all income regardless of the form received — it all flows to your Form 1040.',
            },
            {
              q: 'What if I don\'t receive a 1099?',
              a: 'You must still report all income even without a 1099. The IRS requires you to report self-employment income of $400 or more. Payers must issue a 1099-NEC when they paid you $600 or more, but your obligation to report exists regardless of whether you received a form.',
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
          tip: 'For 2026, the standard deduction increased to $16,100 (Single), $32,200 (Married Filing Jointly), and $24,150 (Head of Household) — up roughly 7% from 2025 levels. About 90% of taxpayers use the standard deduction because it\'s simply larger than their itemized expenses.',
          questions: [
            {
              q: 'What is the 2026 standard deduction?',
              a: 'The standard deduction is a flat amount that reduces your taxable income — no receipts or documentation needed. For 2026 (IRS Rev. Proc. 2025-29): Single = $16,100, Married Filing Jointly = $32,200, Head of Household = $24,150, Married Filing Separately = $16,100. Additional amounts apply if you\'re 65 or older or legally blind.',
            },
            {
              q: 'Should I take the standard deduction or itemize?',
              a: 'Take whichever gives you the larger deduction. Itemizing makes sense if your qualifying expenses — mortgage interest, state and local taxes (capped at $10,000), charitable donations, medical expenses over 7.5% of AGI — exceed your standard deduction. With the 2026 standard deduction reaching $32,200 for MFJ, most people benefit from taking the standard.',
            },
            {
              q: 'Are there situations where I must itemize?',
              a: 'If you\'re married filing separately and your spouse itemizes, you must also itemize. Otherwise, you always have the choice. Most people benefit from the standard deduction — it has grown significantly since the 2017 tax law changes.',
            },
          ],
        },
        {
          id: 'tax-credits',
          label: 'Tax Credits',
          tip: 'Credits beat deductions dollar-for-dollar. A $1,000 credit cuts your tax bill by exactly $1,000, while a $1,000 deduction only saves you your marginal rate × $1,000. If you\'re in the 22% bracket, a $1,000 deduction saves you $220 — but a $1,000 credit saves you the full $1,000.',
          questions: [
            {
              q: "What's the difference between a deduction and a credit?",
              a: 'Deductions reduce your taxable income, which indirectly lowers your tax. Credits directly reduce the tax you owe, dollar for dollar. Refundable credits (like the EITC) can even generate a refund if the credit exceeds your tax liability. Non-refundable credits reduce your tax to zero but no further.',
            },
            {
              q: 'What are the most valuable 2026 tax credits?',
              a: 'Key 2026 credits include: Child Tax Credit ($2,000 per qualifying child under 17, phasing out above $200,000 single/$400,000 MFJ), Earned Income Tax Credit (up to $8,231 for 3+ children — see EITC tab), Child and Dependent Care Credit (up to $3,000 single child/$6,000 for two+ children), American Opportunity Credit (up to $2,500 for college), and the Saver\'s Credit for retirement contributions.',
            },
            {
              q: "What's the difference between refundable and non-refundable credits?",
              a: 'Non-refundable credits reduce your tax to zero but no further. Refundable credits (like the EITC) can produce a refund even if you owe no tax. The Child Tax Credit is partially refundable — up to $1,700 per child can be refunded as the Additional Child Tax Credit if the credit exceeds your tax liability.',
            },
          ],
        },
        {
          id: 'eitc',
          label: 'EITC',
          tip: 'The EITC is one of the most powerful credits for working families — and one of the most overlooked. For 2026, a family with three or more qualifying children can receive up to $8,231, even if they owe no federal income tax. File a return to claim it.',
          questions: [
            {
              q: 'Who qualifies for the 2026 Earned Income Tax Credit?',
              a: 'You must have earned income, a valid Social Security number, and fall within the income limits. For 2026 (estimated from IRS Rev. Proc. 2025-29): No children — under ~$19,550 single / ~$26,850 MFJ. 1 child — under ~$51,600 single / ~$58,900 MFJ. 2 children — under ~$58,650 single / ~$65,950 MFJ. 3+ children — under ~$63,000 single / ~$70,300 MFJ. Investment income must be $12,200 or less.',
            },
            {
              q: 'What are the maximum 2026 EITC amounts?',
              a: 'Maximum 2026 credits (IRS Rev. Proc. 2025-29 / IRS newsroom): $8,231 (3+ qualifying children — confirmed), approximately $7,317 (2 children), $4,432 (1 child), and $665 (no qualifying children). The credit phases in as you earn more, peaks, then phases out above the income thresholds. Verify exact figures at IRS.gov/EITC.',
            },
            {
              q: 'Do I need to claim the EITC, or is it automatic?',
              a: 'You must claim it — it is not automatic. File a tax return and use Schedule EIC with Form 1040. This applies even if your income is low enough that you might not otherwise need to file. The IRS EITC Assistant tool at IRS.gov can help you determine if you qualify and estimate your credit.',
            },
          ],
        },
        {
          id: 'itemizing',
          label: 'Itemizing',
          tip: 'The SALT deduction (state and local taxes) is capped at $10,000 total. If you live in a high-tax state and own a home, this cap can make it hard to beat the 2026 standard deduction — especially with Single standard deduction now at $16,100.',
          questions: [
            {
              q: 'What expenses can I itemize for 2026?',
              a: 'Common 2026 itemized deductions: mortgage interest (on up to $750,000 of acquisition debt), state and local income/property/sales taxes (capped at $10,000 total), charitable contributions (up to 60% of AGI for cash donations), unreimbursed medical expenses exceeding 7.5% of AGI, and casualty/theft losses from federally declared disasters.',
            },
            {
              q: 'How do I track deductible expenses throughout the year?',
              a: 'Keep receipts, bank statements, and records as you go — don\'t try to reconstruct at tax time. For charitable donations over $250, you need written acknowledgment from the organization. For medical expenses, keep a running log plus all receipts. A dedicated folder (physical or digital) makes this much easier.',
            },
            {
              q: 'Can I deduct home office expenses?',
              a: 'Employees working from home generally cannot deduct home office expenses under current law (post-2017 tax reform). Self-employed individuals can deduct using the simplified method ($5/sq ft, max 300 sq ft = $1,500 maximum) or the actual expense method (business-use % of rent/mortgage interest, utilities, insurance, depreciation). The space must be used regularly and exclusively for business.',
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
          tip: 'You can deduct half of your self-employment tax as an above-the-line deduction from gross income — reducing your AGI even if you take the standard deduction. This deduction is automatic and available to all self-employed individuals.',
          questions: [
            {
              q: 'What is self-employment tax for 2026?',
              a: 'Self-employment tax is 15.3%: 12.4% for Social Security (on the first $184,500 of net SE income — the 2026 SS wage base per IRS Topic 751) plus 2.9% for Medicare (on all net SE income). An additional 0.9% Medicare surtax applies to SE income over $200,000 (single) or $250,000 (MFJ). Employees split this with employers, but self-employed individuals pay the full 15.3%.',
            },
            {
              q: 'How is SE tax calculated for 2026?',
              a: 'Multiply net self-employment income by 92.35% (this accounts for the employer-equivalent half-deduction), then multiply by 15.3%. Example: $80,000 net SE × 0.9235 = $73,880 × 0.153 = $11,304 in SE tax. You then deduct half ($5,652) from your gross income as an above-the-line deduction on Form 1040.',
            },
            {
              q: 'Are there ways to reduce self-employment tax in 2026?',
              a: 'Forming an S-Corp can reduce SE tax by allowing you to pay yourself a reasonable salary (subject to payroll taxes) and take remaining profit as distributions not subject to SE tax. This strategy typically makes sense when net self-employment income consistently exceeds $60,000–$80,000. Consult a CPA — the compliance costs must be weighed against the tax savings.',
            },
          ],
        },
        {
          id: 'quarterly',
          label: 'Quarterly Payments',
          tip: 'Safe harbor rule for 2026: pay either 100% of your 2025 tax liability (110% if prior-year AGI exceeded $150,000) or 90% of your expected 2026 tax — whichever is smaller. Doing so avoids underpayment penalties even if you owe more at filing.',
          questions: [
            {
              q: 'Who needs to make 2026 quarterly estimated tax payments?',
              a: 'You must make quarterly payments if you expect to owe at least $1,000 in federal taxes after withholding and credits. This includes self-employed individuals, freelancers, landlords, investors with significant capital gains or dividends, and anyone whose withholding covers less than 90% of their expected tax liability.',
            },
            {
              q: 'What are the 2026 quarterly estimated tax due dates?',
              a: 'The 2026 due dates are: April 15, 2026 (Q1 — Jan 1 to Mar 31, already passed), June 15, 2026 (Q2 — Apr 1 to May 31), September 15, 2026 (Q3 — Jun 1 to Aug 31), and January 15, 2027 (Q4 — Sep 1 to Dec 31). Q2 covers only 2 months — a quirk of the IRS schedule. Pay using IRS Direct Pay or EFTPS.gov.',
            },
            {
              q: 'How do I calculate 2026 quarterly payments?',
              a: 'Estimate your total 2026 tax liability, subtract any withholding, and divide the remainder into four payments. Alternatively, use the safe harbor: pay 25% of your total 2025 tax each quarter to avoid underpayment penalties. IRS Form 1040-ES includes worksheets to help you calculate. Review and adjust each quarter as your income changes.',
            },
          ],
        },
        {
          id: 'home-office',
          label: 'Home Office',
          tip: 'Run both methods before choosing: simplified ($5/sq ft, max $1,500) vs. actual expenses (business-use % of all home costs). For larger home offices or high-cost homes, the actual expense method often yields a significantly larger deduction.',
          questions: [
            {
              q: 'What qualifies as a home office for 2026?',
              a: 'The space must be used regularly and exclusively for business — it cannot double as a guest room, living area, or anywhere else with personal use. It can be a dedicated room or a clearly defined space within a room. The IRS applies the "exclusive use" requirement strictly.',
            },
            {
              q: 'What can I deduct with the actual expense method?',
              a: 'Deduct the business-use percentage (office sq ft ÷ total home sq ft) of: rent or mortgage interest, utilities, insurance, repairs, home depreciation, and HOA fees. For example, a 200 sq ft office in a 2,000 sq ft home = 10% business use, meaning 10% of each qualifying expense is deductible.',
            },
            {
              q: 'Can I deduct internet and phone expenses?',
              a: 'Yes — the business-use portion is deductible. If you use your phone 70% for business, you can deduct 70% of the bill. For internet used exclusively for work, a larger portion may be deductible. Keep records or a usage log — the IRS may ask you to substantiate the percentage you claim.',
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
          tip: 'As a sole proprietor in 2026, you pay 15.3% SE tax on the first $184,500 of net SE income, plus income tax at your marginal rate. When net profits consistently exceed $60,000–$80,000, the potential SE tax savings from an S-Corp election often justify the added complexity.',
          questions: [
            {
              q: 'How is a sole proprietorship taxed in 2026?',
              a: 'Business income and expenses are reported on Schedule C (Form 1040). Net profit is subject to both income tax at your marginal rate and self-employment tax: 15.3% on net SE income up to $184,500 (2026 SS wage base), then 2.9% Medicare on any amount above that. There\'s no separate business tax return.',
            },
            {
              q: 'What records should a sole proprietor keep?',
              a: 'Keep records of all income (invoices, 1099-NECs), all business expenses (receipts, bank/card statements), a mileage log for vehicle use (see 2026 business mileage rate at IRS.gov), and records for any asset purchases. The IRS can audit up to 3 years back — or 6 years if there\'s a substantial understatement of income.',
            },
            {
              q: 'When does it make sense to switch from a sole proprietorship?',
              a: 'Consider forming an LLC or S-Corp when net self-employment income consistently exceeds $60,000–$80,000. At that level, paying yourself a reasonable salary via an S-Corp and taking remaining profits as distributions (not subject to SE tax) can save several thousand dollars annually — often more than the cost of payroll compliance.',
            },
          ],
        },
        {
          id: 'llc-scorp',
          label: 'LLC & S-Corp',
          tip: 'An S-Corp election requires you to pay yourself a "reasonable salary" — the IRS scrutinizes this carefully. The tax savings only apply to distributions above that salary. Most CPAs suggest the salary be at least 40–60% of total S-Corp profit.',
          questions: [
            {
              q: 'How is an LLC taxed by default?',
              a: 'A single-member LLC is taxed as a sole proprietorship by default (Schedule C). A multi-member LLC is taxed as a partnership (Form 1065). LLCs can elect to be taxed as an S-Corp by filing IRS Form 2553, or as a C-Corp using Form 8832, changing the tax treatment without changing the legal structure.',
            },
            {
              q: "What's the tax benefit of an S-Corp in 2026?",
              a: 'With an S-Corp, you pay yourself a reasonable salary (subject to FICA at 15.3% on up to $184,500 for 2026). Remaining profit flows to you as a distribution — not subject to the 15.3% SE tax. Example: $200,000 profit, $80,000 salary = SE tax on $80,000 vs. $200,000, potentially saving ~$18,400 in SE tax.',
            },
            {
              q: 'What are the 2026 compliance requirements for an S-Corp?',
              a: 'S-Corps must: file Form 1120-S by March 16, 2026 (or October 15 with extension), run payroll for owner-employees and deposit payroll taxes on schedule, issue W-2s to owners by January 31, maintain shareholder records, and meet IRS eligibility rules (max 100 shareholders, U.S. citizens/residents only, one class of stock).',
            },
          ],
        },
        {
          id: 'ccorp',
          label: 'C-Corporation',
          tip: 'C-Corps pay a flat 21% federal corporate rate. Profits distributed as dividends are taxed again on shareholders\' returns — the "double taxation" problem. But retained profits that stay in the business are only taxed once at 21%, making C-Corps attractive for businesses that reinvest heavily.',
          questions: [
            {
              q: 'How is a C-Corp taxed in 2026?',
              a: 'C-Corps pay a flat 21% federal corporate income tax on taxable income. Shareholders also pay personal income tax on dividends received. Qualified dividends are taxed at the preferential 0%, 15%, or 20% capital gains rates depending on the shareholder\'s income — which softens the double-taxation impact.',
            },
            {
              q: 'When is a C-Corp structure advantageous?',
              a: 'C-Corps make the most sense when you plan to reinvest most profits back into the business, seek venture capital (VCs typically require C-Corp status), want to offer employees qualified incentive stock options (ISOs), or plan to take the company public or be acquired. At 21%, the corporate rate can be lower than individual rates for high earners.',
            },
            {
              q: 'What are the 2026 C-Corp tax deadlines?',
              a: 'Calendar-year C-Corps must file Form 1120 by April 15, 2026. An extension to October 15, 2026 is available by filing Form 7004. Quarterly estimated payments for 2026 were due: April 15 (Q1, passed), June 15 (Q2), September 15 (Q3), and December 15, 2026 (Q4 — corporations use December instead of January).',
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
          tip: 'Expenses must be "ordinary and necessary" to be deductible. Ordinary means common in your industry; necessary means helpful and appropriate for your business. Both criteria must be met — and the IRS can disallow deductions that appear personal, so documentation of business purpose is essential.',
          questions: [
            {
              q: 'What business expenses are generally deductible in 2026?',
              a: 'Deductible operating expenses include: rent, utilities, office supplies, software subscriptions, advertising and marketing, professional services (legal, accounting, consulting), business insurance, employee wages and benefits, professional development and training, and the business-use portion of phone and internet.',
            },
            {
              q: 'Can I deduct meals and entertainment in 2026?',
              a: 'Business meals remain 50% deductible in 2026 when there is a genuine business purpose and you document who attended and the business discussion. Entertainment expenses (sports events, concerts, theater) are generally not deductible under current law. Keep receipts and a brief note of the business purpose for every meal you deduct.',
            },
            {
              q: 'What is the 2026 QBI deduction?',
              a: 'The Qualified Business Income (QBI) deduction lets eligible pass-through business owners deduct up to 20% of qualified business income. For 2026, the phase-out range begins at approximately $201,775 (single) and $403,550 (MFJ). Certain service businesses (law, health, consulting) face stricter income-based limits. Claimed on Form 8995 or 8995-A.',
            },
          ],
        },
        {
          id: 'vehicle-travel',
          label: 'Vehicle & Travel',
          tip: 'Keep a contemporaneous mileage log — date, destination, business purpose, and miles for every trip. The IRS scrutinizes vehicle deductions closely, and a log created after the fact often doesn\'t hold up in an audit. Apps like MileIQ or Everlance make this nearly effortless.',
          questions: [
            {
              q: 'How can I deduct business vehicle use in 2026?',
              a: 'Two methods: (1) Standard mileage rate — check IRS.gov for the confirmed 2026 business mileage rate (2025 was $0.70/mile). Simple to track and calculate. (2) Actual expense method — deduct the business-use percentage of all vehicle costs (gas, insurance, registration, repairs, depreciation). You must elect the standard mileage method in the first year the vehicle is placed in service to use it in later years.',
            },
            {
              q: 'What travel expenses are deductible?',
              a: 'When traveling away from your tax home overnight for business: airfare, hotels, 50% of meals, rental cars, taxis/rideshares, parking, and tips are deductible. Only the business portion qualifies when a trip mixes business and pleasure — if business is the primary purpose, the transportation cost is fully deductible even with personal days added.',
            },
            {
              q: 'Can I deduct commuting costs?',
              a: 'No — commuting from home to your regular workplace is a personal expense, not deductible. However, travel from your regular office to a client site, between two business locations, or from a home office to another business location is deductible. The distinction between commuting and business travel is strictly applied.',
            },
          ],
        },
        {
          id: 'equipment',
          label: 'Equipment & Assets',
          tip: 'For 2026, Section 179 allows an immediate deduction of up to $2,560,000 for qualifying equipment (IRS Pub. 946, 2026) — a significant expansion from prior years. The phase-out begins when total equipment placed in service exceeds $4,090,000. This can dramatically reduce your 2026 taxable income.',
          questions: [
            {
              q: 'How do I deduct business equipment in 2026?',
              a: 'Two main approaches: (1) Section 179 — immediately deduct up to $2,560,000 of qualifying equipment in 2026 (IRS Pub. 946). The deduction phases out dollar-for-dollar when total equipment exceeds $4,090,000. SUV purchases are limited to $32,000. (2) MACRS — regular depreciation over the asset\'s IRS-defined useful life. Both can be combined.',
            },
            {
              q: 'What about bonus depreciation in 2026?',
              a: 'Under current IRS guidance, 100% bonus depreciation was restored for qualified property placed in service after January 19, 2025. This means most new business equipment purchased in 2026 can be fully expensed in the year of purchase — either through Section 179 or bonus depreciation. Verify the current rules at IRS.gov/Pub946 as legislation may continue to evolve.',
            },
            {
              q: 'What is depreciation recapture?',
              a: 'When you sell a depreciated business asset, any gain up to the amount previously deducted is taxed as ordinary income (not at lower capital gains rates). This is depreciation recapture and applies to Section 179 deductions as well. Plan accordingly before selling business property — the recapture tax can be a surprise if overlooked.',
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
          tip: 'Payroll taxes are "trust fund" taxes — the IRS treats withheld employee funds as money held in trust for the government. Failure to remit them triggers the Trust Fund Recovery Penalty, which makes responsible individuals personally liable — even if the business is an LLC or corporation.',
          questions: [
            {
              q: 'What are payroll taxes?',
              a: 'Payroll taxes include amounts withheld from employee wages plus employer-paid taxes. They fund Social Security and Medicare (FICA) and federal unemployment insurance (FUTA). Employers must withhold, match, and remit FICA on a regular IRS deposit schedule, and pay FUTA separately on Form 940.',
            },
            {
              q: 'What forms are involved in payroll taxes?',
              a: 'Key forms: Form 941 (quarterly federal payroll tax return, due April 30, July 31, October 31, and January 31), Form 944 (annual alternative for very small employers), Form 940 (annual FUTA return), W-2 (annual wage statements to employees, due January 31), and Form W-3 (transmittal sent with W-2s to the Social Security Administration).',
            },
            {
              q: 'When must payroll taxes be deposited in 2026?',
              a: 'Deposit frequency depends on your prior-year payroll tax liability — monthly or semi-weekly. New employers deposit monthly. The IRS notifies you of your schedule each November. Late deposits carry escalating penalties: 2% (1–5 days late), 5% (6–15 days), 10% (16+ days or failure to use EFTPS), up to 15% (10+ days after IRS notice).',
            },
          ],
        },
        {
          id: 'fica-futa',
          label: 'FICA & FUTA',
          tip: 'For 2026, the Social Security wage base is $184,500 (IRS Topic 751). Wages above that are still subject to Medicare (2.9%) and potentially the 0.9% Additional Medicare Tax — but the 6.2% Social Security portion stops at $184,500. This makes high-wage employees significantly cheaper to employ above that threshold.',
          questions: [
            {
              q: 'How does FICA work in 2026?',
              a: 'FICA = Social Security + Medicare. For 2026: Social Security is 6.2% on wages up to $184,500 — employer and employee each pay 6.2%, totaling 12.4% (IRS Topic 751). Medicare is 1.45% on all wages, paid by both parties (2.9% total). An additional 0.9% Medicare surtax is withheld from employees earning over $200,000 per year — employers do not match this portion.',
            },
            {
              q: 'What is FUTA and who pays it?',
              a: 'FUTA (Federal Unemployment Tax Act) funds federal unemployment insurance. Only employers pay it — it is never withheld from employees. The rate is 6% on the first $7,000 of each employee\'s wages. A credit of up to 5.4% applies if state unemployment taxes (SUTA) are paid on time, reducing the effective federal rate to just 0.6% — about $42 per employee per year.',
            },
            {
              q: 'Are there payroll taxes for independent contractors?',
              a: 'No payroll taxes apply to independent contractors. You do not withhold or match FICA for 1099 workers. However, you must issue Form 1099-NEC for payments of $600 or more, and worker classification must be accurate. Misclassifying employees as contractors carries significant back-tax liability plus interest and penalties.',
            },
          ],
        },
        {
          id: 'employer-resp',
          label: 'Employer Responsibilities',
          tip: 'Set up payroll before your first employee\'s first paycheck — not after. Getting an EIN, registering with your state, and setting up EFTPS takes time. Late first-paycheck deposits carry the same penalties as any other late deposit.',
          questions: [
            {
              q: 'What must employers do when hiring their first employee in 2026?',
              a: 'Required steps: (1) Obtain an EIN from IRS.gov — free, instant online. (2) Verify employment eligibility with Form I-9. (3) Have employee complete Form W-4. (4) Register with your state for income tax withholding and SUTA. (5) Set up EFTPS.gov for federal tax deposits. (6) Establish a payroll system or service.',
            },
            {
              q: 'What are the 2026 year-end payroll responsibilities?',
              a: 'By January 31, 2027: provide W-2s to all employees and file W-2s plus Form W-3 with the Social Security Administration. Reconcile W-2 totals with your four quarterly Form 941 filings. File Form 940 for 2026 FUTA. Issue 1099-NEC forms to contractors paid $600 or more during 2026.',
            },
            {
              q: 'Should I use payroll software or a service?',
              a: 'For most small businesses, a payroll service is strongly recommended. Services like Gusto, ADP, or QuickBooks Payroll automatically calculate withholdings, handle federal and state tax deposits, file quarterly and annual returns, and generate year-end W-2s. The monthly cost ($40–$200) is typically far less than the cost of a single payroll tax penalty.',
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
                <div className="flex border-b border-gray-100 px-5 gap-1 overflow-x-auto">
                  {topic.tabs.map((tab) => {
                    const active = tab.id === currentTabId
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab((prev) => ({ ...prev, [topic.id]: tab.id }))}
                        className={`px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                          active ? 'border-[#1D9E75] text-[#1D9E75]' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        style={active ? { borderColor: '#1D9E75', color: '#1D9E75' } : {}}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

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

      <p className="text-xs text-gray-400 pt-2">
        Figures reflect tax year 2026. Sources: IRS Rev. Proc. 2025-29, IRS Pub. 946 (2026), IRS Pub. 15 / Topic 751, IRS retirement plans guidance, IRS Pub. 969, IRS.gov/EITC. Some EITC income limits are estimated from confirmed 2026 maximums. Consult a CPA for advice specific to your situation.
      </p>
    </div>
  )
}
