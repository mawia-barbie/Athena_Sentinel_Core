import { useState, useEffect } from 'react'
import ChatAssistant from '../components/ChatAssistant'
import { apiFetch } from '../lib/api'

function MetricCard({ title, value, children }) {
  return (
    <div className="bg-white/5 rounded-lg p-4 flex-1 min-w-[160px]">
      <div className="text-sm text-gray-300">{title}</div>
      <div className="text-2xl font-semibold mt-2 text-white">{value}</div>
      <div className="mt-3 text-xs text-gray-400">{children}</div>
    </div>
  )
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm mr-2 ${active ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-200'}`}
    >
      {label}
    </button>
  )
}

function FeedItem({ item }) {
  return (
    <div className="p-3 border-b border-white/5">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm font-medium text-white">{item.title}</div>
          <div className="text-xs text-gray-400">{item.source} • {new Date(item.timestamp).toLocaleString()}</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded ${item.severity === 'High' ? 'bg-red-600' : item.severity === 'Medium' ? 'bg-yellow-600' : 'bg-gray-600'}`}>
          {item.severity}
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-300">{item.description}</div>
    </div>
  )
}

export default function Dashboard({ navigate }) {
  // provide fallback navigate if not supplied
  const fallbackNavigate = (to) => {
    console.log('[Dashboard] fallbackNavigate ->', to)
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const go = navigate || fallbackNavigate

  const [filters, setFilters] = useState(['CVE','Malware','Phishing','Ransomware'])
  const [activeFilters, setActiveFilters] = useState([])
  const [query, setQuery] = useState('')
  const [feed, setFeed] = useState([])
  const [stats, setStats] = useState({ total: 0, mostCommon: 'N/A', recentAlerts: 0 })
  const [assistantOpen, setAssistantOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    console.log('[Dashboard] mount')
    // fetch real metrics
    apiFetch('/api/dashboard/metrics').then(d=>{
      if(d && mounted) {
        setStats({ total: d.total || 0, mostCommon: d.mostCommon || 'N/A', recentAlerts: d.recentAlerts || 0 })
        console.log('[Dashboard] fetched metrics', d)
      }
    }).catch(err=>console.error('[Dashboard] metrics error', err))

    // polling feed
    const fetchFeed = async () => {
      try {
        const items = await apiFetch('/api/threats/feed')
        if (mounted) {
          if (Array.isArray(items)) {
            setFeed(items)
            console.log('[Dashboard] polled feed count', items.length)
          } else {
            console.warn('[Dashboard] feed returned non-array, setting empty', items)
            setFeed([])
          }
        }
      } catch (err) {
        console.error('[Dashboard] feed error', err)
        // fallback: try direct backend URL (useful if Vite proxy not running)
        if (err && err.status === 404) {
          try {
            const url = (location.protocol === 'https:' ? 'https:' : 'http:') + '//127.0.0.1:8000/api/threats/feed'
            const res = await fetch(url)
            if (res.ok) {
              const items = await res.json()
              if (mounted) setFeed(Array.isArray(items) ? items : [])
              console.log('[Dashboard] fallback polled feed count', Array.isArray(items) ? items.length : 'non-array')
            } else {
              console.warn('[Dashboard] fallback feed fetch not ok', res.status)
            }
          } catch (e) {
            console.error('[Dashboard] fallback feed error', e)
          }
        }
      }
    }
    fetchFeed()
    const iv = setInterval(fetchFeed, 10000)
    return () => { mounted = false; clearInterval(iv); console.log('[Dashboard] unmount') }
  }, [])

  function toggleFilter(f) {
    console.log('[Dashboard] toggleFilter ->', f)
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f])
  }

  function handleSearchChange(e) {
    const v = e.target.value
    console.log('[Dashboard] search ->', v)
    setQuery(v)
  }

  const filtered = feed.filter(item => {
    if (activeFilters.length && !item.tags.some(t=>activeFilters.includes(t))) return false
    if (query && !(`${item.title} ${item.description} ${item.source}`).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  useEffect(() => {
    console.log('[Dashboard] filtered feed count ->', filtered.length)
  }, [feed, activeFilters, query])

  const handleNavigate = (to) => {
    console.log('[Dashboard] navigate ->', to)
    go(to)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">SOC Dashboard</h1>
            <button onClick={() => handleNavigate('/threats')} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Threat Intelligence</button>
            <button onClick={() => handleNavigate('/live')} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Live Feed</button>
            <button onClick={() => handleNavigate('/analytics')} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Analytics</button>
            <button onClick={() => handleNavigate('/profile')} className="px-3 py-1 rounded bg-gray-600 text-white text-sm">Profile</button>
            <button onClick={() => setAssistantOpen(a=>!a)} className="px-3 py-1 rounded bg-gray-700 text-white text-sm">AI Assistant</button>
          </div>
          <div className="flex items-center">
            <input value={query} onChange={handleSearchChange} placeholder="Search threats..." className="bg-white/5 rounded px-3 py-2 text-sm w-64 mr-4" />
            <div className="text-sm text-gray-400">Auto-refresh: 10s</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard title="Total threats detected" value={stats.total}>Compared to last 24h</MetricCard>
          <MetricCard title="Most common attack type" value={stats.mostCommon}>Based on tags</MetricCard>
          <MetricCard title="Recent alerts" value={stats.recentAlerts}>High severity in last hour</MetricCard>
        </div>

        <div className="flex gap-4">
          <div className="w-2/3 bg-white/3 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="font-medium">Live Threat Feed</div>
              <div className="text-sm text-gray-400">Auto-refreshing</div>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {filtered.map(item=> <FeedItem key={item.id} item={item} />)}
            </div>
          </div>

          <div className="w-1/3">
            <div className="bg-white/3 rounded-lg p-4 mb-4">
              <div className="font-medium mb-2">Filters</div>
              <div className="flex flex-wrap">
                {filters.map(f=> <FilterPill key={f} label={f} active={activeFilters.includes(f)} onClick={()=>toggleFilter(f)} />)}
              </div>
            </div>

            <div className="bg-white/3 rounded-lg p-4">
              <div className="font-medium mb-2">Quick stats</div>
              <div className="text-sm text-gray-300">Threats by severity</div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between"><div>High</div><div className="text-red-500">2</div></div>
                <div className="flex items-center justify-between"><div>Medium</div><div className="text-yellow-400">1</div></div>
                <div className="flex items-center justify-between"><div>Low</div><div className="text-gray-400">0</div></div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <ChatAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  )
}
