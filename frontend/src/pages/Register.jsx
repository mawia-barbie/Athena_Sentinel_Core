import { useState } from 'react'

export default function Register({ navigate }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  function verifyPasswordPolicy(p) {
    if (p.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Za-z]/.test(p)) return 'Password must include letters.'
    if (!/[0-9]/.test(p)) return 'Password must include numbers.'
    if (!/[^A-Za-z0-9]/.test(p)) return 'Password must include symbols.'
    return ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Passwords do not match')
    const policyErr = verifyPasswordPolicy(password)
    if (policyErr) return setError(policyErr)
    // mock register: store username in localStorage and navigate
    console.log('[Register] registering', username)
    localStorage.setItem('user', JSON.stringify({ username }))
    // in a real app you'd call POST /api/auth/register
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-gray-200 p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white/5 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Register</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          <input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="Confirm password" className="w-full bg-white/5 rounded px-3 py-2 text-sm" />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex items-center justify-between">
            <button type="submit" className="px-3 py-2 bg-green-600 rounded text-white">Register</button>
            <button type="button" onClick={()=>navigate('/login')} className="text-sm text-gray-300">Already have an account?</button>
          </div>
        </form>
      </div>
    </div>
  )
}
