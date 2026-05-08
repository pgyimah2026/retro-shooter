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
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system:
              'You are a friendly tax education assistant. Explain tax concepts in plain language without jargon. Always clarify you are not a licensed tax advisor and recommend consulting a CPA for specific situations. Keep answers concise and practical.',
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
