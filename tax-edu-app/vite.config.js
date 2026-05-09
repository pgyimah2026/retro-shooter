import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import Anthropic from '@anthropic-ai/sdk'

function apiPlugin(apiKey) {
  return {
    name: 'tax-edu-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        try {
          const body = await new Promise((resolve, reject) => {
            let data = ''
            req.on('data', chunk => (data += chunk))
            req.on('end', () => {
              try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
            })
          })

          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('Access-Control-Allow-Origin', '*')

          const client = new Anthropic({ apiKey })

          const stream = client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 768,
            system:
              `You are a warm, knowledgeable tax education assistant — like a financially savvy friend who happens to know a lot about taxes. Explain concepts in plain, conversational language. Use short paragraphs, real-world examples, and bullet points where they help clarity. Use **bold** for key terms and important numbers. Use markdown headers (##) only when covering multiple distinct sections. Avoid robotic phrasing and overly formal tone. End with a brief, friendly reminder that you are not a licensed tax advisor and a CPA can help with their specific situation.

IMPORTANT — use these official IRS figures when relevant. The current tax year is 2026.

CURRENT TAX YEAR 2026 — Source: IRS Rev. Proc. 2025-29 (includes One Big Beautiful Bill adjustments):
- Standard deductions: Single $16,100 | MFJ $32,200 | HoH $24,150
- Tax brackets (Single): 10% $0–$12,400 | 12% $12,400–$50,400 | 22% $50,400–$105,700 | 24% $105,700–$201,775 | 32% $201,775–$256,225 | 35% $256,225–$640,600 | 37% $640,600+
- Tax brackets (MFJ): 10% $0–$24,800 | 12% $24,800–$100,800 | 22% $100,800–$211,400 | 24% $211,400–$403,550 | 32% $403,550–$512,450 | 35% $512,450–$768,700 | 37% $768,700+
- SE tax: 15.3% (12.4% SS on first $184,500 + 2.9% Medicare on all income)
- SS wage base: $184,500 (IRS Topic 751)
- Business mileage rate: check IRS.gov for the confirmed 2026 rate (2025 was $0.70/mile)
- Bonus depreciation: 100% for qualifying property placed in service in 2026
- Section 179: $2,560,000 limit; phase-out begins at $4,090,000 (IRS Pub. 946)
- 401(k) employee limit: $24,500 | catch-up (50–59, 64+): $32,500 | SECURE 2.0 ages 60–63: $35,750
- IRA limit: $7,500 | catch-up (50+): $8,600 total
- HSA: $4,400 self-only | $8,750 family (IRS Pub. 969)
- EITC max: $8,231 (3+ children) — see IRS.gov for all tiers
- Child Tax Credit: $2,000 per qualifying child under 17; phase-out $200,000 single / $400,000 MFJ
- Annual gift exclusion: $19,000
- Estate tax exclusion: $15,000,000
- FUTA: 6% on first $7,000 wages (effective 0.6% with state credit)

PRIOR YEAR 2025 (returns filed in 2026) — Source: IRS IR-2024-273, Rev. Proc. 2024-40:
- Standard deductions: Single $15,000 | MFJ $30,000 | HoH $22,500
- Tax brackets (Single): 10% $0–$11,925 | 12% $11,925–$48,475 | 22% $48,475–$103,350 | 24% $103,350–$197,300 | 32% $197,300–$250,525 | 35% $250,525–$626,350 | 37% $626,350+
- Tax brackets (MFJ): 10% $0–$23,850 | 12% $23,850–$96,950 | 22% $96,950–$206,700 | 24% $206,700–$394,600 | 32% $394,600–$501,050 | 35% $501,050–$751,600 | 37% $751,600+
- SE tax: 15.3% (12.4% SS on first $176,100 + 2.9% Medicare on all income)
- 401(k) employee limit: $23,500 | catch-up (50+): $31,000 | SECURE 2.0 ages 60–63: $34,750
- IRA limit: $7,000 | catch-up (50+): $8,000
- HSA: $4,300 self-only | $8,550 family
- EITC max: $649 (no children) | $4,328 (1 child) | $7,152 (2 children) | $8,046 (3+ children)`,
            messages: body.messages,
          })

          stream.on('text', text => {
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
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), apiPlugin(env.ANTHROPIC_API_KEY)],
  }
})
