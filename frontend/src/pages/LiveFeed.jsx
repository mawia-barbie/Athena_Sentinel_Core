import { useState, useEffect } from 'react'

function FeedRow({ item }) {
  return (
    <div className={`p-3 border-b border-white/5 flex justify-between items-start ${item.severity === 'High' ? 'bg-red-900/10' : ''}`}>
      <div>
        <div className="text-sm font-medium text-white">{item.title}</div>
        <div className="text-xs text-gray-400">{item.source} • {new Date(item.timestamp).toLocaleString()}</div>
        <div className="mt-2 text-sm text-gray-300">{item.description}</div>
      </div>
      <div className={`text-xs px-2 py-1 rounded self-start ${item.severity === 'High' ? 'bg-red-600' : item.severity === 'Medium' ? 'bg-yellow-600' : 'bg-gray-600'}`}>
        {item.severity}
      </div>
    </div>
  )
}

export default function LiveFeed({ navigate }) {
  const fallbackNavigate = (to) => {
    console.log('[LiveFeed] fallbackNavigate ->', to)
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const go = navigate || fallbackNavigate

  const [feed, setFeed] = useState([])
  const [pollInterval, setPollInterval] = useState(10000)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    console.log('[LiveFeed] mount')
    // seed
    const now = Date.now()
    const seed = [
      { id:1, title: 'CVE-2024-1234 disclosed', description: 'Sample vulnerability disclosed', source: 'CVE', severity: 'High', tags: ['CVE'], timestamp: now - 1000*60*4 },
      { id:2, title: 'Malware campaign observed', description: 'New loader variants', source: 'ThreatFeed', severity: 'Medium', tags: ['Malware'], timestamp: now - 1000*60*30 }
    ]
    setFeed(seed)
    return () => console.log('[LiveFeed] unmount')
  }, [])

  useEffect(() => {
    if (!running) return
    console.log('[LiveFeed] start polling every', pollInterval, 'ms')
    const t = setInterval(() => {
      // generate a mock event
      const now = Date.now()
      const types = [
        {title: 'New CVE - 2024-'+Math.floor(Math.random()*9000+1000), severity: 'High', tag: 'CVE'},
        {title: 'Active exploit observed', severity: 'High', tag: 'Exploit'},
        {title: 'Phishing campaign spikes', severity: 'Medium', tag: 'Phishing'},
        {title: 'Malware distribution increase', severity: 'Low', tag: 'Malware'},
      ]
      const pick = types[Math.floor(Math.random()*types.length)]
      const item = { id: Math.floor(Math.random()*1000000), title: pick.title, description: 'Automated feed item (demo)', source: 'LivePoll', severity: pick.severity, tags: [pick.tag], timestamp: now }
      console.log('[LiveFeed] new item', item)
      setFeed(prev => [item, ...prev].slice(0, 500))
    }, pollInterval)
    return () => { clearInterval(t); console.log('[LiveFeed] polling stopped') }
  }, [pollInterval, running])

  const handleNavigate = (to) => { console.log('[LiveFeed] navigate ->', to); go(to) }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Live Threat Feed</h1>
            <button onClick={() => handleNavigate('/dashboard')} className="px-3 py-1 rounded bg-gray-700 text-white text-sm">Dashboard</button>
            <button onClick={() => handleNavigate('/threats')} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Threat Intelligence</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">Polling: {pollInterval/1000}s</div>
            <button onClick={() => setRunning(r=>!r)} className={`px-3 py-1 rounded text-white text-sm ${running ? 'bg-red-600' : 'bg-green-600'}`}>{running ? 'Pause' : 'Resume'}</button>
          </div>
        </div>

        <div className="bg-white/3 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/5 font-medium">Live Events</div>
          <div className="max-h-[640px] overflow-y-auto">
            {feed.map(f => <FeedRow key={f.id} item={f} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
