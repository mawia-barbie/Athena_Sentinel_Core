import { useEffect, useState } from 'react'
import AnalyticsChart from './AnalyticsChart'
import { apiFetch } from '../lib/api'

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
  const [distribution, setDistribution] = useState({})
  const [daysWindow, setDaysWindow] = useState(7)
  const [loadingDist, setLoadingDist] = useState(false)
  const [recentVulns, setRecentVulns] = useState([])
  const [vulnDist, setVulnDist] = useState([])

  useEffect(() => {
    // load real timeline and distribution
    const load = async () => {
      try {
        const t = await apiFetch('/api/analytics/timeline?limit=50')
        setTimeline(t)
        const counts = { high: 0, medium: 0, low: 0 }
        t.forEach(it => { if (it.severity==='High') counts.high++; else if (it.severity==='Medium') counts.medium++; else counts.low++ })
        setStats({ total: t.length, high: counts.high, medium: counts.medium, low: counts.low })
        // fetch recent vulnerabilities for specificity
        try {
          const v = await apiFetch('/api/analytics/vulnerabilities?limit=20')
          setRecentVulns(v)
          // load vulnerability distribution for charting specific CVEs
          try {
            const vd = await apiFetch(`/api/analytics/vulnerability-distribution?days=${daysWindow}&limit=10`)
            if (vd && vd.items) setVulnDist(vd.items)
          } catch (e) {
            console.error('failed to load vuln distribution', e)
          }
        } catch (e) {
          console.error('failed to load recent vulnerabilities', e)
        }
      } catch (err) {
        console.error('[Analytics] timeline load error', err)
      }
    }
    load()
    loadDistribution(daysWindow)
    return () => {}
  }, [])

  async function loadDistribution(days) {
    setLoadingDist(true)
    try {
      const d = await apiFetch(`/api/analytics/type-distribution?days=${days}`)
      if (d && d.counts) setDistribution(d.counts)
    } catch (err) {
      console.error('[Analytics] distribution load error', err)
    } finally {
      setLoadingDist(false)
    }
  }

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
          <div className="font-medium mb-2">Attack types distribution</div>
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1">
              {loadingDist ? <div className="text-sm text-gray-300">Loading chart...</div> : (() => {
                // Prepare chart data: if we have vulnerability breakdown, expand it into top CVEs + Other
                const dist = { ...(distribution || {}) }
                const vulnTotal = dist['Vulnerability'] || 0
                if (vulnTotal > 0 && vulnDist && vulnDist.length > 0) {
                  // take top 5 CVEs
                  const top = vulnDist.slice(0,5)
                  let topSum = 0
                  top.forEach(v => { topSum += v.count })
                  const remainder = Math.max(0, vulnTotal - topSum)
                  // remove generic Vulnerability bucket
                  delete dist['Vulnerability']
                  // insert CVE entries
                  top.forEach(v => { dist[v.external_id || v.title] = v.count })
                  if (remainder > 0) dist['Other Vulnerabilities'] = remainder
                }
                return <AnalyticsChart data={dist} />
              })()}
            </div>
            <div className="text-sm text-gray-300 w-48">
              <div className="mb-2">Window:
                <select value={daysWindow} onChange={(e)=>{ const v = parseInt(e.target.value); setDaysWindow(v); loadDistribution(v) }} className="ml-2 bg-black/20 rounded px-2 py-1">
                  <option value={1}>24h</option>
                  <option value={7}>7d</option>
                  <option value={30}>30d</option>
                </select>
              </div>
              {Object.keys(distribution).length === 0 && !loadingDist && <div className="text-sm">No data</div>}
              {Object.entries(distribution).map(([k,v])=> (
                <div key={k} className="flex justify-between"><div>{k}</div><div>{v}</div></div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/3 rounded-lg p-4">
          <div className="font-medium mb-2">Timeline of recent threats</div>
          <div className="max-h-[440px] overflow-y-auto">
            {timeline.map(t => <TimelineItem key={t.id} t={t} />)}
          </div>
        </div>
        <div className="bg-white/3 rounded-lg p-4 mt-6">
          <div className="font-medium mb-2">Recent Vulnerabilities (CVE)</div>
          <div className="max-h-[240px] overflow-y-auto text-sm">
            <table className="w-full">
              <thead className="text-left text-xs text-gray-400"><tr><th>ID</th><th>Title</th><th>Severity</th></tr></thead>
              <tbody>
                {recentVulns.map(v => (
                  <tr key={v.id} className="border-t border-white/5"><td className="py-2 pr-4"><a href={v.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{v.external_id || v.title}</a></td><td>{v.title}</td><td>{v.severity}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {vulnDist.length > 0 && (
          <div className="bg-white/3 rounded-lg p-4 mb-6">
            <div className="font-medium mb-2">Top Vulnerabilities (by count)</div>
            <div className="max-h-[240px] overflow-y-auto text-sm">
              <table className="w-full">
                <thead className="text-left text-xs text-gray-400"><tr><th>CVE</th><th>Title</th><th>Count</th></tr></thead>
                <tbody>
                  {vulnDist.map(v => (
                    <tr key={v.external_id} className="border-t border-white/5"><td className="py-2 pr-4"><a href={`https://nvd.nist.gov/vuln/detail/${v.external_id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{v.external_id}</a></td><td>{v.title}</td><td>{v.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
