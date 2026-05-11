import { useEffect, useState } from 'react'

function StatCard({ title, value }) {
  return (
    <div className="bg-white/5 rounded-lg p-4 min-w-[180px]">
      <div className="text-sm text-gray-300">{title}</div>
      <div className="text-2xl font-semibold mt-2 text-white">{value}</div>
    </div>
  )
}

function TimelineItem({ t }) {
  return (
    <div className="p-3 border-b border-white/5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white">{t.title}</div>
        <div className="text-xs text-gray-400">{new Date(t.timestamp).toLocaleString()}</div>
      </div>
      <div className="text-xs text-gray-300 mt-1">{t.source} • {t.severity}</div>
    </div>
  )
}

export default function Analytics({ navigate }) {
  const fallbackNavigate = (to) => {
    console.log('[Analytics] fallbackNavigate ->', to)
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const go = navigate || fallbackNavigate

  const [stats, setStats] = useState({ total: 0, high: 0, medium: 0, low: 0 })
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    console.log('[Analytics] mount')
    const now = Date.now()
    const mock = [
      { id:1, title: 'CVE-2024-1234', source: 'CVE', severity: 'High', timestamp: now - 1000*60*60 },
      { id:2, title: 'Ransomware campaign', source: 'ThreatFeed', severity: 'High', timestamp: now - 1000*60*30 },
      { id:3, title: 'Phishing spike', source: 'Blog', severity: 'Medium', timestamp: now - 1000*60*10 },
    ]
    setTimeline(mock)
    const h = mock.filter(m=>m.severity==='High').length
    const m = mock.filter(m=>m.severity==='Medium').length
    const l = mock.filter(m=>m.severity==='Low').length
    setStats({ total: mock.length, high: h, medium: m, low: l })
    return () => console.log('[Analytics] unmount')
  }, [])

  function exportJSON() {
    console.log('[Analytics] exportJSON')
    const data = { stats, timeline }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'analytics.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNavigate = (to) => { console.log('[Analytics] navigate ->', to); go(to) }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Analytics & Reporting</h1>
            <button onClick={() => handleNavigate('/dashboard')} className="px-3 py-1 rounded bg-gray-700 text-white text-sm">Dashboard</button>
            <button onClick={() => handleNavigate('/threats')} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Threat Intelligence</button>
            <button onClick={() => handleNavigate('/live')} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Live Feed</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportJSON} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Export JSON</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard title="Total threats" value={stats.total} />
          <StatCard title="High" value={stats.high} />
          <StatCard title="Medium" value={stats.medium} />
        </div>

        <div className="bg-white/3 rounded-lg p-4 mb-6">
          <div className="font-medium mb-2">Attack types distribution (mock)</div>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40 rounded-full bg-white/5 flex items-center justify-center">
              <div className="text-sm text-white">Pie (placeholder)</div>
            </div>
            <div className="text-sm text-gray-300">
              <div>Ransomware: 40%</div>
              <div>Exploit: 35%</div>
              <div>Phishing: 25%</div>
            </div>
          </div>
        </div>

        <div className="bg-white/3 rounded-lg p-4">
          <div className="font-medium mb-2">Timeline of recent threats</div>
          <div className="max-h-[440px] overflow-y-auto">
            {timeline.map(t => <TimelineItem key={t.id} t={t} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
