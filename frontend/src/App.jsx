import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Threats from './pages/Threats'
import LiveFeed from './pages/LiveFeed'
import Analytics from './pages/Analytics'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'

function App() {
  const [route, setRoute] = useState(window.location.pathname)

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
      setRoute(to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  // simple client-side auth: user stored in localStorage by Register/Login mocks
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null')
  const isAuthenticated = !!currentUser

  // If not authenticated, only allow /login and /register routes
  if (!isAuthenticated && route !== '/login' && route !== '/register') {
    // ensure the URL shows /login when unauthenticated (e.g. opening '/')
    if (route !== '/login') {
      window.history.replaceState({}, '', '/login')
      setRoute('/login')
    }
    return <Login navigate={navigate} />
  }

  // If authenticated and user navigates to login/register, redirect to dashboard
  if (isAuthenticated && (route === '/login' || route === '/register')) {
    // set route to dashboard and render it
    if (route !== '/dashboard') {
      window.history.replaceState({}, '', '/dashboard')
      setRoute('/dashboard')
    }
    return <Dashboard navigate={navigate} />
  }

  if (route === '/login') return <Login navigate={navigate} />
  if (route === '/register') return <Register navigate={navigate} />
  if (route === '/threats') return <Threats navigate={navigate} />
  if (route === '/live') return <LiveFeed navigate={navigate} />
  if (route === '/analytics') return <Analytics navigate={navigate} />
  if (route === '/profile') return <Profile navigate={navigate} />
  return <Dashboard navigate={navigate} />
}

export default App;