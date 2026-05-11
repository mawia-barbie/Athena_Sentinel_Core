import { useState, useEffect } from 'react'

export default function Profile({ navigate }) {
  const [profile, setProfile] = useState({ username: '', bio: '', profile_image: '' })

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('user') || 'null')
    if (stored) setProfile(prev => ({ ...prev, username: stored.username }))
  }, [])

  function handleSave(e) {
    e.preventDefault()
    // Mock save to localStorage
    const user = { username: profile.username, bio: profile.bio, profile_image: profile.profile_image }
    localStorage.setItem('user', JSON.stringify(user))
    console.log('[Profile] saved', user)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white/5 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Profile</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <input value={profile.username} onChange={e=>setProfile(p=>({...p, username: e.target.value}))} placeholder="Username" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          <textarea value={profile.bio} onChange={e=>setProfile(p=>({...p, bio: e.target.value}))} placeholder="Bio" className="w-full bg-white/5 rounded px-3 py-2 text-sm h-24" />
          <input value={profile.profile_image} onChange={e=>setProfile(p=>({...p, profile_image: e.target.value}))} placeholder="Profile image URL" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          <div className="flex items-center justify-between">
            <button type="submit" className="px-3 py-2 bg-green-600 rounded text-white">Save</button>
            <button type="button" onClick={()=>navigate('/dashboard')} className="text-sm text-gray-300">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
