const FALLBACK_API = 'https://envidicy-dash-client.onrender.com'

export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE
  return FALLBACK_API
}

export async function apiFetch(path, options = {}) {
  const base = getApiBase().replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, options)
  return res
}
