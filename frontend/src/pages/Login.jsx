import { useState } from 'react'

export default function Login({ navigate }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const stored = JSON.parse(localStorage.getItem('user') || 'null')
    if (!stored || stored.username !== username) return setError('Invalid credentials')
    // in a real app you'd verify password against backend
    console.log('[Login] login', username)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white/5 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex items-center justify-between">
            <button type="submit" className="px-3 py-2 bg-blue-600 rounded text-white">Login</button>
            <button type="button" onClick={()=>navigate('/register')} className="text-sm text-gray-300">Create account</button>
          </div>
        </form>
      </div>
    </div>
  )
}
