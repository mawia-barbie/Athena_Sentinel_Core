import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

function ThreatItem({ t }) {
  const ts = t.timestamp || (t.created_at ? new Date(t.created_at).getTime() : null)
  const isNew = ts && (Date.now() - ts) < (5 * 60 * 1000) // 5 minutes
  return (
    <div className="p-3 border-b border-white/5">
      <div className="flex justify-between items-start">
        <div>
          <a href={t.url || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:underline">
            {t.title}
          </a>
          <div className="text-xs text-gray-400">
            {t.source} • {ts ? new Date(ts).toLocaleString() : 'unknown'} • {ts ? relativeTime(ts) : ''}
            {isNew && <span className="ml-2 inline-block bg-green-600 text-white text-xs px-2 py-0.5 rounded">NEW</span>}
          </div>
        </div>
        <div className={`text-xs px-2 py-1 rounded ${t.severity === 'High' ? 'bg-red-600' : t.severity === 'Medium' ? 'bg-yellow-600' : 'bg-gray-600'}`}>
          {t.severity}
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-300">{t.description}</div>
      <div className="mt-2 text-xs text-gray-400">Tags: {Array.isArray(t.tags) ? t.tags.join(', ') : ''}</div>
      <div className="mt-2 text-xs text-blue-400">
        {t.url && (
          <a href={t.url} target="_blank" rel="noopener noreferrer" className="hover:underline">Read original</a>
        )}
      </div>
    </div>
  )
}

export default function Threats({ navigate }) {
  const fallbackNavigate = (to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }
  const go = navigate || fallbackNavigate

  const [running, setRunning] = useState(false)
  const [keywords, setKeywords] = useState(['ransomware','exploit','zero-day'])
  const [entries, setEntries] = useState([])
  const [lastRun, setLastRun] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0)

  useEffect(() => {
    // initial load from backend (list endpoint)
    apiFetch('/api/threats?limit=50').then(d=>{
      if(d && d.items) {
        // ensure newest-first ordering
        const sorted = d.items.sort((a,b)=> (b.timestamp||0) - (a.timestamp||0))
        setEntries(sorted)
      }
    }).catch(e=>console.error('[Threats] load error', e))
    return () => {}
  }, [])

  useEffect(() => {
    let timer
    if (running) {
      // poll backend feed every 10s
      const fetchFeed = async () => {
        try {
          const items = await apiFetch('/api/threats/feed')
          if (Array.isArray(items)) {
            // ensure newest-first ordering
            const sorted = items.sort((a,b)=> (b.timestamp||0) - (a.timestamp||0))
            setEntries(sorted)
            const now = new Date()
            setLastRun(now)
            setLastUpdatedAt(now)
            setSecondsSinceUpdate(0)
          }
        } catch (err) {
          console.error('[Threats] feed poll error', err)
        }
      }
      fetchFeed()
      timer = setInterval(fetchFeed, 10000)
    }
    return () => {
      clearInterval(timer)
    }
  }, [running])

  // update 'seconds since last update' clock
  useEffect(() => {
    const t = setInterval(()=>{
      if (lastUpdatedAt) {
        setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdatedAt.getTime())/1000))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [lastUpdatedAt])

  function startStop() {
    setRunning(r => !r)
  }

  function addKeyword(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const k = f.get('keyword')?.toString().trim()
    if (k && !keywords.includes(k)) setKeywords(prev => [...prev, k])
    e.target.reset()
  }

  async function manualRun() {
    try {
      // trigger backend scraper once and then refresh feed
      await apiFetch('/api/threats/scrape', { method: 'POST' })
      const items = await apiFetch('/api/threats/feed')
      if (Array.isArray(items)) {
        const sorted = items.sort((a,b)=> (b.timestamp||0) - (a.timestamp||0))
        setEntries(sorted)
      }
      const now = new Date()
      setLastRun(now)
      setLastUpdatedAt(now)
      setSecondsSinceUpdate(0)
    } catch (err) {
      console.error('[Threats] manual scrape error', err)
    }
  }

  const handleNavigate = (to) => go(to)

  const handleSearch = (q) => {
    apiFetch('/api/threats/search?q='+encodeURIComponent(q)).then(d=>{
      if(d && d.items) setEntries(d.items)
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Threat Intelligence Scraper</h1>
            <button onClick={() => handleNavigate('/dashboard')} className="px-3 py-1 rounded bg-gray-700 text-white text-sm">Back to Dashboard</button>
          </div>
          <div className="text-sm text-gray-400">Last run: {lastRun ? lastRun.toLocaleString() : 'never'} {lastUpdatedAt && <span> • Updated {secondsSinceUpdate}s ago</span>}</div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-white/3 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-medium">Scraper Control</div>
              <div className="flex items-center gap-2">
                <button onClick={manualRun} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Run now</button>
                <button onClick={startStop} className={`px-3 py-1 rounded text-white text-sm ${running ? 'bg-red-600' : 'bg-green-600'}`}>{running ? 'Stop' : 'Start'}</button>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-300 mb-2">Keywords</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {keywords.map(k => (
                  <span key={k} className="px-2 py-1 bg-white/5 rounded text-sm">{k}</span>
                ))}
              </div>

              <form onSubmit={addKeyword} className="flex gap-2">
                <input name="keyword" placeholder="Add keyword (e.g. ransomware)" className="bg-white/5 rounded px-3 py-2 text-sm flex-1" />
                <button type="submit" className="px-3 py-2 bg-green-600 rounded text-white text-sm">Add</button>
              </form>
            </div>

          </div>

          <div className="bg-white/3 rounded-lg p-4">
            <div className="font-medium mb-2">Scrape Settings</div>
            <div className="text-sm text-gray-300">Polling interval: 10s</div>
            <div className="mt-3 text-sm text-gray-300">Sources: NVD, TheHackerNews, SecurityWeek (real feeds)</div>
          </div>
        </div>

        <div className="bg-white/3 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/5 font-medium">Scraped Results</div>
          <div className="max-h-[540px] overflow-y-auto">
            {entries.map(e => <ThreatItem key={e.id} t={e} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
