import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, AlertCircle } from 'lucide-react'

const SUGGESTIONS = {
  individual: [
    'What is the difference between a tax deduction and a tax credit?',
    'How do I know if I should itemize or take the standard deduction?',
    'What is self-employment tax and how is it calculated?',
    'How do quarterly estimated tax payments work?',
    'What home office expenses can I deduct?',
  ],
  business: [
    'What are the tax differences between an LLC and an S-Corp?',
    'How does the QBI deduction work for small businesses?',
    'What business expenses are generally deductible?',
    'How do payroll taxes work for a small business owner?',
    'What is the Section 179 deduction for equipment?',
  ],
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-gray-200' : ''}`}
        style={isUser ? {} : { backgroundColor: '#1D9E75' }}
      >
        {isUser ? <User size={14} className="text-gray-600" /> : <Bot size={14} className="text-white" />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-gray-100 text-gray-900 rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
        }`}
      >
        {message.content || (
          <span className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  )
}

export default function AIChat({ mode }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userText = text || input.trim()
    if (!userText || loading) return

    setInput('')
    setError(null)

    const userMsg = { role: 'user', content: userText }
    const assistantMsg = { role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: userText }] }),
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      if (!response.body) throw new Error('No response stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.text,
                }
                return updated
              })
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }
    } catch (err) {
      setError(err.message)
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestions = SUGGESTIONS[mode]

  return (
    <div className="max-w-2xl flex flex-col h-full" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center py-10">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#e8f7f2' }}
            >
              <Bot size={22} style={{ color: '#1D9E75' }} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Tax Education Assistant</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Ask any tax question and get a clear, plain-language explanation.
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-col gap-2 items-center">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm text-gray-700 border border-gray-200 rounded-full px-4 py-2 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors bg-white max-w-sm w-full"
                  style={{ maxWidth: '420px' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}. Make sure your API key is set in .env.local.</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a tax question..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:bg-gray-50 max-h-32 overflow-y-auto"
            onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px #1D9E75'}
            onBlur={(e) => e.target.style.boxShadow = ''}
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#1D9E75' }}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          For educational purposes only. This AI is not a licensed tax advisor. Always consult a qualified CPA or tax professional for advice specific to your situation.
        </p>
      </div>
    </div>
  )
}
