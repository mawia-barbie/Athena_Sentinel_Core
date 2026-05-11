// Use Vite env var VITE_API_BASE when available, otherwise default to the FastAPI backend
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export async function apiFetch(path, opts = {}) {
  // If path is already a full URL, use it as-is. Otherwise prefix with API_BASE.
  const isFullUrl = /^https?:\/\//i.test(path)
  const url = isFullUrl ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`

  // Build headers: don't force Content-Type for GET/HEAD to avoid preflight.
  const method = (opts.method || 'GET').toUpperCase()
  const headers = { ...(opts.headers || {}) }

  let body = opts.body
  // If there's a body and it's a plain object (not FormData), stringify it and set header
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (body && !isFormData && typeof body === 'object') {
    body = JSON.stringify(body)
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }
  }

  // For non-GET/HEAD requests with no explicit Content-Type, set application/json
  if (!['GET', 'HEAD'].includes(method) && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    ...opts,
    method,
    headers,
    body,
  })

  const text = await res.text()
  const contentType = res.headers.get('content-type') || ''
  let data
  try { data = JSON.parse(text) } catch { data = text }

  // ensure we only accept JSON responses for API routes
  if (!contentType.includes('application/json')) {
    const err = new Error(`Non-JSON response for ${url}`)
    err.status = res.status
    err.body = data
    throw err
  }

  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`)
    err.status = res.status
    err.body = data
    throw err
  }

  return data
}
