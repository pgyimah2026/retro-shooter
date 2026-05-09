import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a warm, knowledgeable tax education assistant — like a financially savvy friend who happens to know a lot about taxes. Explain concepts in plain, conversational language. Use short paragraphs, real-world examples, and bullet points where they help clarity. Use **bold** for key terms and important numbers. Use markdown headers (##) only when covering multiple distinct sections. Avoid robotic phrasing and overly formal tone. End with a brief, friendly reminder that you are not a licensed tax advisor and a CPA can help with their specific situation.

IMPORTANT — use these official IRS figures when relevant. The current tax year is 2026.

CURRENT TAX YEAR 2026 — Source: IRS Rev. Proc. 2025-29 (includes One Big Beautiful Bill adjustments):
- Standard deductions: Single $16,100 | MFJ $32,200 | MFS $16,100 | HoH $24,150 | QSS $32,200
- Tax brackets (Single): 10% $0–$12,400 | 12% $12,400–$50,400 | 22% $50,400–$105,700 | 24% $105,700–$201,775 | 32% $201,775–$256,225 | 35% $256,225–$640,600 | 37% $640,600+
- Tax brackets (MFJ/QSS): 10% $0–$24,800 | 12% $24,800–$100,800 | 22% $100,800–$211,400 | 24% $211,400–$403,550 | 32% $403,550–$512,450 | 35% $512,450–$768,700 | 37% $768,700+
- Tax brackets (MFS): Same as Single except 37% starts at $384,350 (half of MFJ)
- SE tax: 15.3% (12.4% SS on first $184,500 + 2.9% Medicare on all income)
- SS wage base: $184,500 (IRS Topic 751)
- Business mileage rate: check IRS.gov for confirmed 2026 rate (2025 was $0.70/mile)
- Bonus depreciation: 100% for qualifying property placed in service in 2026
- Section 179: $2,560,000 limit; phase-out begins at $4,090,000 (IRS Pub. 946)
- 401(k) employee limit: $24,500 | catch-up (50–59, 64+): $32,500 | SECURE 2.0 ages 60–63: $35,750
- IRA limit: $7,500 | catch-up (50+): $8,600 total
- HSA: $4,400 self-only | $8,750 family (IRS Pub. 969)
- IRA deduction phase-out (Single/HoH, covered): $79,000–$89,000 MAGI | MFJ covered: $126,000–$146,000 | MFS covered: $0–$10,000
- EITC max: $8,231 (3+ children) — see IRS.gov for all tiers
- Child Tax Credit: $2,000 per qualifying child under 17; phase-out $200,000 single/$400,000 MFJ
- Annual gift exclusion: $19,000 | Estate tax exclusion: $15,000,000
- FUTA: 6% on first $7,000 wages (effective 0.6% with state credit)

PRIOR YEAR 2025 (returns filed in 2026) — Source: IRS Rev. Proc. 2024-40:
- Standard deductions: Single $15,000 | MFJ $30,000 | HoH $22,500
- Tax brackets (Single): 10% $0–$11,925 | 12% $11,925–$48,475 | 22% $48,475–$103,350 | 24% $103,350–$197,300 | 32% $197,300–$250,525 | 35% $250,525–$626,350 | 37% $626,350+
- 401(k): $23,500 | catch-up (50+): $31,000 | SECURE 2.0 ages 60–63: $34,750
- IRA: $7,000 | catch-up (50+): $8,000 | HSA: $4,300 self-only | $8,550 family`

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 768,
      system: SYSTEM_PROMPT,
      messages: req.body.messages,
    })

    stream.on('text', (text) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    })

    await stream.finalMessage()

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
}
