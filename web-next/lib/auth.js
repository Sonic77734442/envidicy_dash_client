const KEY_TOKEN = 'auth_token'
const KEY_EMAIL = 'auth_email'
const KEY_USER_ID = 'auth_user_id'
const KEY_IMPERSONATION_ACTIVE = 'impersonation_active'
const KEY_IMPERSONATION_RETURN = 'impersonation_return'
const KEY_IMPERSONATION_LABEL = 'impersonation_label'

function storageGet(key) {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(key) || window.localStorage.getItem(key)
}

function consumeImpersonationFromUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const token = params.get('impersonate_token')
  if (!token) return

  window.sessionStorage.setItem(KEY_TOKEN, token)
  window.sessionStorage.setItem(KEY_EMAIL, params.get('impersonate_email') || '')
  window.sessionStorage.setItem(KEY_USER_ID, params.get('impersonate_user_id') || '')
  window.sessionStorage.setItem(KEY_IMPERSONATION_ACTIVE, '1')
  window.sessionStorage.setItem(KEY_IMPERSONATION_RETURN, params.get('impersonation_return') || '/admin/clients')
  window.sessionStorage.setItem(KEY_IMPERSONATION_LABEL, params.get('impersonate_email') || '')

  params.delete('impersonate_token')
  params.delete('impersonate_email')
  params.delete('impersonate_user_id')
  params.delete('impersonation_return')
  const query = params.toString()
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`
  window.history.replaceState({}, '', nextUrl)
}

export function setAuth(auth) {
  if (typeof window === 'undefined') return
  clearImpersonation()
  localStorage.setItem(KEY_TOKEN, auth.token)
  localStorage.setItem(KEY_EMAIL, auth.email)
  localStorage.setItem(KEY_USER_ID, String(auth.id))
}

export function clearAuth() {
  if (typeof window === 'undefined') return
  clearImpersonation()
  localStorage.removeItem(KEY_TOKEN)
  localStorage.removeItem(KEY_EMAIL)
  localStorage.removeItem(KEY_USER_ID)
}

export function getAuthToken() {
  consumeImpersonationFromUrl()
  return storageGet(KEY_TOKEN)
}

export function getAuthEmail() {
  consumeImpersonationFromUrl()
  return storageGet(KEY_EMAIL)
}

export function isImpersonating() {
  if (typeof window === 'undefined') return false
  consumeImpersonationFromUrl()
  return window.sessionStorage.getItem(KEY_IMPERSONATION_ACTIVE) === '1'
}

export function getImpersonationReturnUrl() {
  if (typeof window === 'undefined') return '/admin/clients'
  consumeImpersonationFromUrl()
  return window.sessionStorage.getItem(KEY_IMPERSONATION_RETURN) || '/admin/clients'
}

export function getImpersonationLabel() {
  if (typeof window === 'undefined') return ''
  consumeImpersonationFromUrl()
  return window.sessionStorage.getItem(KEY_IMPERSONATION_LABEL) || ''
}

export function clearImpersonation() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(KEY_TOKEN)
  window.sessionStorage.removeItem(KEY_EMAIL)
  window.sessionStorage.removeItem(KEY_USER_ID)
  window.sessionStorage.removeItem(KEY_IMPERSONATION_ACTIVE)
  window.sessionStorage.removeItem(KEY_IMPERSONATION_RETURN)
  window.sessionStorage.removeItem(KEY_IMPERSONATION_LABEL)
}
