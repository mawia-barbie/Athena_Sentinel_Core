import { useState, useRef, useEffect } from 'react'

export default function ChatAssistant({ open, onClose }) {
  const [messages, setMessages] = useState([
    { id: 1, role: 'system', text: 'AI assistant ready. Ask about CVEs, malware, or mitigation steps.' }
  ])
  const [input, setInput] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    if (open) console.log('[ChatAssistant] opened')
  }, [open])

  useEffect(() => {
    // scroll to bottom on new message
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  function classifyText(text) {
    console.log('[ChatAssistant] classifyText ->', text)
    const t = (text || '').toLowerCase()
    const categories = []
    if (/cve|vuln|vulnerability|cve-\d{4}/.test(t)) categories.push('Vulnerability')
    if (/ransomware|malware|trojan|worm|virus|loader|ransom/.test(t)) categories.push('Malware')
    if (/phish|phishing|credential|spearphish/.test(t)) categories.push('Phishing')
    if (/exploit|poc|proof of concept|0day|zero-day|zero day/.test(t)) categories.push('Exploit')
    const category = categories.length ? categories[0] : 'Other'

    // severity heuristic
    let severity = 'Low'
    if (/critical|high|ransomware|0day|zero-day|active exploit|weaponized|privilege escalation/.test(t)) severity = 'High'
    else if (/medium|moderate|phish|spearphish|credential/.test(t)) severity = 'Medium'

    return { category, severity, categories }
  }

  function sendMessage() {
    if (!input.trim()) return
    const userMsg = { id: Date.now(), role: 'user', text: input }
    console.log('[ChatAssistant] user ->', input)
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // If user asked to classify explicitly (prefix 'classify:'), run classifier and reply
    if (userMsg.text.toLowerCase().startsWith('classify:')) {
      const toClassify = userMsg.text.slice('classify:'.length).trim()
      const res = classifyText(toClassify)
      const reply = { id: Date.now()+1, role: 'assistant', text: `Classification result:\nCategory: ${res.category}\nSeverity: ${res.severity}\nDetected tags: ${res.categories.join(', ') || 'none'}` }
      console.log('[ChatAssistant] classification ->', reply.text)
      setMessages(prev => [...prev, reply])
      return
    }

    // simulate retrieval + LLM response
    setTimeout(() => {
      const reply = { id: Date.now()+1, role: 'assistant', text: `Mocked assistant reply for: "${userMsg.text}"\n\n(Uses retrieval from local DB + simple LLM)` }
      console.log('[ChatAssistant] assistant ->', reply.text)
      setMessages(prev => [...prev, reply])
    }, 800)
  }

  function classifyCurrent() {
    // classify current input if present, otherwise classify last user message
    const target = input.trim() || (() => {
      for (let i = messages.length-1; i >=0; i--) {
        if (messages[i].role === 'user') return messages[i].text
      }
      return ''
    })()
    if (!target) return
    const res = classifyText(target)
    const reply = { id: Date.now()+2, role: 'assistant', text: `Classification result:\nCategory: ${res.category}\nSeverity: ${res.severity}\nDetected tags: ${res.categories.join(', ') || 'none'}` }
    console.log('[ChatAssistant] manual classification ->', reply.text)
    setMessages(prev => [...prev, reply])
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      sendMessage()
    }
  }

  if (!open) return null

  return (
    <div className="fixed right-6 bottom-6 w-96 bg-gradient-to-br from-gray-900 to-black/80 border border-white/5 rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="font-medium">AI Assistant</div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-sm px-2 py-1 bg-white/5 rounded">Close</button>
        </div>
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto p-3 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`text-sm ${m.role === 'assistant' ? 'text-gray-300' : 'text-white'}`}>
            <div className="text-xs text-gray-400 mb-1">{m.role}</div>
            <div className="whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-white/5">
        <textarea
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask: 'What is CVE-2024-xxxx?' or type 'classify: <text>'"
          className="w-full bg-white/5 rounded p-2 text-sm text-gray-100 h-20 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-400">Press Ctrl+Enter to send</div>
          <div className="flex gap-2">
            <button onClick={classifyCurrent} className="px-3 py-1 bg-yellow-600 rounded text-white text-sm">Classify</button>
            <button onClick={sendMessage} className="px-3 py-1 bg-green-600 rounded text-white text-sm">Send</button>
          </div>
        </div>
      </div>
    </div>
  )
}
