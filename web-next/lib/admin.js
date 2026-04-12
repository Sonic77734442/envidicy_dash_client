import { apiFetch } from './api'
import { clearAuth, getAuthToken } from './auth'

export function getAdminAuthHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function adminFetch(router, path, options = {}) {
  const res = await apiFetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...getAdminAuthHeaders(),
    },
  })

  if (res.status === 401) {
    clearAuth()
    router.push('/login')
    throw new Error('Unauthorized')
  }

  if (res.status === 403) {
    throw new Error('Нет доступа к админке.')
  }

  return res
}
