import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiFetch } from '../lib/api'

// Mirror of backend SITE_MAP — used for quick navigation chips and link rewriting.
const SITE_MAP = {
  Dashboard: { route: '/',          desc: 'Live alerts & threat score' },
  Threats:   { route: '/threats',   desc: 'Search CVEs & vulnerabilities' },
  Alerts:    { route: '/alerts',    desc: 'Live security alerts' },
  Analytics: { route: '/analytics', desc: 'Trends & charts' },
  Learn:     { route: '/learn',     desc: 'Cybersecurity lessons' },
  Settings:  { route: '/settings',  desc: 'Account & integrations' },
}

const QUICK_ACTIONS = [
  { label: 'Explain phishing', prompt: 'Explain phishing for a beginner with one real example.' },
  { label: 'What is a CVE?',   prompt: 'What is a CVE and how do I read its severity?' },
  { label: 'Tour the app',     prompt: 'Give me a short tour of this Athena Sentinel app and what each page does.' },
  { label: 'Where are live alerts?', prompt: 'Where do I see live alerts in this app?' },
  { label: 'Harden my account', prompt: 'How do I harden my account? Mention MFA and where to enable it here.' },
]

// Light heuristic classifier (kept from your original)
function classifyText(text) {
  const t = (text || '').toLowerCase()
  const cats = []
  if (/cve|vuln|vulnerability|cve-\d{4}/.test(t)) cats.push('Vulnerability')
  if (/ransomware|malware|trojan|worm|virus|loader|ransom/.test(t)) cats.push('Malware')
  if (/phish|phishing|credential|spearphish/.test(t)) cats.push('Phishing')
  if (/exploit|poc|0day|zero-?day/.test(t)) cats.push('Exploit')
  let severity = 'Low'
  if (/critical|high|ransomware|0day|zero-?day|active exploit|weaponized|privilege escalation/.test(t)) severity = 'High'
  else if (/medium|moderate|phish|credential/.test(t)) severity = 'Medium'
  return { category: cats[0] || 'Other', severity, categories: cats }
}

// Turn "Go to Threats (/threats)" into proper markdown links the renderer can route on.
function linkifyRoutes(md) {
  if (!md) return ''
  return md.replace(
    /\b(Go to|Visit|Open|Head to|Check)\s+([A-Z][\w\s]{0,30}?)\s*\((\/[\w\-/]*)\)/g,
    (_m, verb, name, route) => `${verb} [${name.trim()}](${route})`
  )
}

export default function ChatAssistant({ open, onClose, navigate: propNavigate }) {
  // If the app doesn't provide a navigate function (no react-router),
  // use a simple client-side fallback that mirrors the app's navigation.
  const navigate = propNavigate || ((to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  })

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text:
        "Hi, I'm **Athena Sentinel**. I can teach cybersecurity from beginner to advanced and help you find your way around the app.\n\nTry a quick action below or ask me anything.",
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const listRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, streaming])

  // ---------- core send (with streaming + history) ----------
  async function send(textOverride) {
    const userText = (textOverride ?? input).trim()
    if (!userText || streaming) return

    const userMsg = { id: Date.now(), role: 'user', text: userText }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')

    // local "classify:" shortcut
    if (userText.toLowerCase().startsWith('classify:')) {
      const target = userText.slice('classify:'.length).trim()
      const r = classifyText(target)
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: `**Classification**\n- Category: \`${r.category}\`\n- Severity: \`${r.severity}\`\n- Tags: ${r.categories.join(', ') || '_none_'}`,
      }])
      return
    }

    // Build history payload for the model
    const history = nextMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))

    // Add empty assistant bubble we'll stream into
    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '' }])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText, history }),
        signal: controller.signal,
      })

      // ---- streaming path ----
      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const frames = buf.split('\n\n')
          buf = frames.pop() ?? ''
          for (const frame of frames) {
            const line = frame.replace(/^data:\s*/, '').trim()
            if (!line || line === '[DONE]') continue
            try {
              const { delta } = JSON.parse(line)
              if (!delta) continue
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, text: m.text + delta } : m)
              )
            } catch {/* partial frame */}
          }
        }
      } else {
        // ---- fallback to non-streaming endpoint ----
        const data = await apiFetch('/api/ai/query', {
          method: 'POST',
          body: { question: userText, history },
        })
        const text = renderApiPayload(data)
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text } : m))
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, text: `⚠️ ${err.name === 'AbortError' ? 'Stopped.' : 'Error: ' + err.message}` }
          : m)
      )
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function renderApiPayload(data) {
    if (!data) return 'No response.'
    if (data.type === 'cve' || data.type === 'db') {
      const items = data.results || [data]
      return items.map(r =>
        `**${r.title || r.external_id}** \`${r.severity || ''}\`\n${r.summary || ''}${r.url ? `\n[Source](${r.url})` : ''}`
      ).join('\n\n')
    }
    if (data.type === 'definition') return `**${data.term.toUpperCase()}** — ${data.definition}`
    return data.answer || data.summary || 'No answer.'
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ---------- markdown renderers ----------
  const mdComponents = useMemo(() => ({
     a: ({ href = '', children }) => {
       // internal route -> client-side navigation
       if (href.startsWith('/')) {
         return (
           <button
             type="button"
             onClick={() => { navigate(href); onClose?.() }}
             className="text-blue-600 underline hover:text-blue-700"
           >
             {children}
           </button>
         )
       }
       return <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">{children}</a>
     },
    code: ({ inline, children }) =>
      inline
        ? <code className="px-1 py-0.5 rounded bg-gray-200 text-[12px]">{children}</code>
        : <pre className="bg-gray-900 text-gray-100 text-xs p-2 rounded overflow-x-auto"><code>{children}</code></pre>,
     ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
     ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
  }), [onClose])

  if (!open) return null

  return (
    <div className="fixed right-6 bottom-6 w-[420px] max-h-[85vh] bg-white text-gray-900 border border-gray-200 rounded-xl shadow-2xl z-50 flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center font-bold text-white">AS</div>
          <div>
            <div className="font-semibold leading-tight">Athena Sentinel</div>
            <div className="text-[11px] text-gray-500">Cybersecurity tutor & app guide</div>
          </div>
        </div>
        <button onClick={onClose} className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Close</button>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed
              ${m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {linkifyRoutes(m.text) || (streaming ? '▍' : '')}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.text}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* quick actions */}
      <div className="px-3 pt-2 flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map(q => (
          <button
            key={q.label}
            onClick={() => send(q.prompt)}
            disabled={streaming}
            className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* nav shortcut chips */}
      <div className="px-3 pt-2 flex flex-wrap gap-1.5">
        {Object.entries(SITE_MAP).map(([name, { route }]) => (
          <button
            key={name}
            onClick={() => { navigate(route); onClose?.() }}
            className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
            title={SITE_MAP[name].desc}
          >
            {name}
          </button>
        ))}
      </div>

      {/* composer */}
      <div className="p-3 border-t border-gray-100 mt-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about a CVE, a concept, or how to use the app… (Shift+Enter = newline)"
          className="w-full bg-gray-50 rounded-lg p-2 text-sm h-16 resize-none border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={streaming}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-[11px] text-gray-500">Tip: prefix <code>classify:</code> to tag a snippet</div>
          {streaming ? (
            <button onClick={stop} className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-white text-sm">Stop</button>
          ) : (
            <button onClick={() => send()} disabled={!input.trim()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm disabled:opacity-50">
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
