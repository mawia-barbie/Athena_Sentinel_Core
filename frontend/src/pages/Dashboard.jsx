import { useState, useEffect, useRef } from 'react'
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
      className={`px-3 py-1 rounded-full text-sm mr-2 mb-2 ${active ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-200'}`}
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

function ProfileModal({ user, onClose, onSave }) {
  const [username, setUsername] = useState(user?.username || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    const updated = { ...(user || {}), username, avatar }
    localStorage.setItem('user', JSON.stringify(updated))
    onSave(updated)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-lg p-6 w-[400px]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Update profile</h2>

        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-20 h-20 rounded-full bg-white/10 overflow-hidden flex items-center justify-center cursor-pointer border border-white/20"
            onClick={() => fileRef.current?.click()}
          >
            {avatar
              ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-2xl text-gray-300">{(username || 'U').charAt(0).toUpperCase()}</span>}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1 rounded bg-white/10 text-sm text-gray-200 hover:bg-white/20"
          >
            Change picture
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>

        <label className="block text-xs text-gray-400 mb-1">Username</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full bg-white/5 rounded px-3 py-2 text-sm text-white mb-4"
        />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded bg-white/5 text-sm text-gray-200">Cancel</button>
          <button onClick={handleSave} className="px-3 py-1 rounded bg-green-600 text-sm text-white">Save</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ navigate }) {
  const fallbackNavigate = (to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const go = navigate || fallbackNavigate

  const [filters] = useState(['CVE','Malware','Phishing','Ransomware'])
  const [activeFilters, setActiveFilters] = useState([])
  const [query, setQuery] = useState('')
  const [feed, setFeed] = useState([])
  const [stats, setStats] = useState({ total: 0, mostCommon: 'N/A', recentAlerts: 0 })
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    try {
      const stored = JSON.parse(localStorage.getItem('user') || 'null')
      if (stored && mounted) setUser(stored)
    } catch (e) { console.warn(e) }

    apiFetch('/api/dashboard/metrics').then(d => {
      if (d && mounted) setStats({ total: d.total || 0, mostCommon: d.mostCommon || 'N/A', recentAlerts: d.recentAlerts || 0 })
    }).catch(err => console.error(err))

    const fetchFeed = async () => {
      try {
        const items = await apiFetch('/api/threats/feed')
        if (mounted) setFeed(Array.isArray(items) ? items : [])
      } catch (err) { console.error(err) }
    }
    fetchFeed()
    const iv = setInterval(fetchFeed, 10000)
    return () => { mounted = false; clearInterval(iv) }
  }, [])

  function toggleFilter(f) {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  const filtered = feed.filter(item => {
    if (activeFilters.length && !item.tags?.some(t => activeFilters.includes(t))) return false
    if (query && !(`${item.title} ${item.description} ${item.source}`).toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Top bar: profile (left) — nav (center) — search (right) */}
        <div className="flex items-center justify-between gap-4 mb-6">

          {/* LEFT: avatar + greeting */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <button
              onClick={() => setProfileOpen(true)}
              title="Update profile"
              className="w-12 h-12 rounded-full bg-white/10 overflow-hidden flex items-center justify-center border border-white/20 hover:border-green-500 transition"
            >
              {user?.avatar
                ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-lg text-gray-200">{(user?.username || 'G').charAt(0).toUpperCase()}</span>}
            </button>
            <div>
              <div className="text-xs text-gray-400">Hello,</div>
              <button
                onClick={() => setProfileOpen(true)}
                className="text-sm font-semibold text-white hover:underline"
              >
                {user?.username || 'Guest'}
              </button>
            </div>
          </div>

          {/* CENTER: title + nav */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <h1 className="text-xl font-semibold mr-2">SOC Dashboard</h1>
            <button onClick={() => go('/threats')} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Threat Intelligence</button>
            <button onClick={() => go('/live')} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Live Feed</button>
            <button onClick={() => go('/analytics')} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Analytics</button>
            <button onClick={() => setAssistantOpen(a => !a)} className="px-3 py-1 rounded bg-gray-700 text-white text-sm">AI Assistant</button>
          </div>

          {/* RIGHT: search */}
          <div className="flex flex-col items-end min-w-[220px]">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search threats..."
              className="bg-white/5 rounded px-3 py-2 text-sm w-56"
            />
            <div className="text-xs text-gray-400 mt-1">Auto-refresh: 10s</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard title="Total threats detected" value={stats.total}>Compared to last 24h</MetricCard>
          <MetricCard title="Most common attack type" value={stats.mostCommon}>Based on tags</MetricCard>
          <MetricCard title="Recent alerts" value={stats.recentAlerts}>High severity in last hour</MetricCard>
        </div>

        <div className="flex gap-4">
          <div className="w-2/3 bg-white/5 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="font-medium">Live Threat Feed</div>
              <div className="text-sm text-gray-400">Auto-refreshing</div>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {filtered.map(item => <FeedItem key={item.id} item={item} />)}
            </div>
          </div>

          <div className="w-1/3">
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <div className="font-medium mb-2">Filters</div>
              <div className="flex flex-wrap">
                {filters.map(f => <FilterPill key={f} label={f} active={activeFilters.includes(f)} onClick={() => toggleFilter(f)} />)}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
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
      {profileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onSave={(u) => setUser(u)}
        />
      )}
    </div>
  )
}
