const KEY_TOKEN = 'auth_token'
const KEY_EMAIL = 'auth_email'
const KEY_USER_ID = 'auth_user_id'

export function setAuth(auth) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY_TOKEN, auth.token)
  localStorage.setItem(KEY_EMAIL, auth.email)
  localStorage.setItem(KEY_USER_ID, String(auth.id))
}

export function clearAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY_TOKEN)
  localStorage.removeItem(KEY_EMAIL)
  localStorage.removeItem(KEY_USER_ID)
}

export function getAuthToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY_TOKEN)
}
