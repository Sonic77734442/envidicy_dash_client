'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { clearAuth, getAuthToken } from '../../lib/auth'
import AppShell from '../../components/layout/AppShell'

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'https://envidicy-dash-client.onrender.com').replace(/\/$/, '')

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function SettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState('profile')

  const [profile, setProfile] = useState({
    name: '',
    company: '',
    email: '',
    language: 'ru',
    whatsapp_phone: '',
    telegram_handle: '',
    avatar_url: '',
    can_manage_accesses: false,
  })
  const [profileStatus, setProfileStatus] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarStatus, setAvatarStatus] = useState('')

  const [passwordState, setPasswordState] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [passwordStatus, setPasswordStatus] = useState('')

  const [accessEmail, setAccessEmail] = useState('')
  const [accessStatus, setAccessStatus] = useState('')
  const [accesses, setAccesses] = useState([])

  const [fees, setFees] = useState(null)
  const [documents, setDocuments] = useState([])
  const [docsStatus, setDocsStatus] = useState('')

  const canManageAccesses = Boolean(profile.can_manage_accesses)

  const visibleTabs = useMemo(
    () => [
      { key: 'profile', label: 'Profile' },
      { key: 'security', label: 'Security' },
      ...(canManageAccesses ? [{ key: 'accesses', label: 'Accesses' }] : []),
      { key: 'fees', label: 'Fees' },
      { key: 'docs', label: 'Documents' },
    ],
    [canManageAccesses]
  )

  async function safeFetch(path, options = {}) {
    const res = await apiFetch(path, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    return res
  }

  async function loadProfile() {
    try {
      const res = await safeFetch('/profile')
      if (!res.ok) throw new Error('profile failed')
      const data = await res.json()
      setProfile((prev) => ({
        ...prev,
        name: data.name || '',
        company: data.company || '',
        email: data.email || '',
        language: data.language || 'ru',
        whatsapp_phone: data.whatsapp_phone || '',
        telegram_handle: data.telegram_handle || '',
        avatar_url: data.avatar_url || '',
        can_manage_accesses: Boolean(data.can_manage_accesses),
      }))
      if (Boolean(data.can_manage_accesses)) loadAccesses()
    } catch {
      setProfileStatus('Failed to load profile.')
    }
  }

  async function loadAccesses() {
    if (!canManageAccesses && !profile.can_manage_accesses) return
    try {
      const res = await safeFetch('/profile/accesses')
      if (res.status === 403) return
      if (!res.ok) throw new Error('accesses failed')
      const data = await res.json()
      setAccesses(Array.isArray(data.items) ? data.items : [])
    } catch {
      setAccessStatus('Failed to load accesses.')
    }
  }

  async function addAccess() {
    const email = accessEmail.trim().toLowerCase()
    if (!email) {
      setAccessStatus('Enter an email.')
      return
    }
    setAccessStatus('Adding access...')
    try {
      const res = await safeFetch('/profile/accesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'create access failed')
      setAccessEmail('')
      setAccessStatus('Access added. Secondary email can set a password on the login page.')
      await loadAccesses()
    } catch (e) {
      setAccessStatus(e?.message || 'Failed to add access.')
    }
  }

  async function deleteAccess(id) {
    if (!id) return
    if (!window.confirm('Delete this secondary access?')) return
    setAccessStatus('Removing access...')
    try {
      const res = await safeFetch(`/profile/accesses/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'delete access failed')
      setAccessStatus('Access removed.')
      await loadAccesses()
    } catch (e) {
      setAccessStatus(e?.message || 'Failed to remove access.')
    }
  }

  async function saveProfile() {
    setProfileStatus('Saving...')
    try {
      const res = await safeFetch('/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name?.trim() || null,
          company: profile.company?.trim() || null,
          language: profile.language || 'ru',
          whatsapp_phone: profile.whatsapp_phone?.trim() || null,
          telegram_handle: profile.telegram_handle?.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setProfileStatus('Profile saved.')
    } catch {
      setProfileStatus('Failed to save changes.')
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) {
      setAvatarStatus('Choose a file.')
      return
    }
    setAvatarStatus('Uploading...')
    const form = new FormData()
    form.append('file', avatarFile)
    try {
      const res = await safeFetch('/profile/avatar', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('upload failed')
      const data = await res.json()
      setProfile((prev) => ({ ...prev, avatar_url: data.avatar_url || prev.avatar_url }))
      setAvatarStatus('Avatar updated.')
    } catch {
      setAvatarStatus('Failed to upload avatar.')
    }
  }

  async function changePassword() {
    const current = passwordState.current_password.trim()
    const next = passwordState.new_password.trim()
    const confirm = passwordState.confirm_password.trim()

    if (!current || !next) {
      setPasswordStatus('Fill current and new password.')
      return
    }
    if (next !== confirm) {
      setPasswordStatus('Passwords do not match.')
      return
    }

    setPasswordStatus('Changing password...')
    try {
      const res = await safeFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'change failed')

      if (data?.token && typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.token)
      }

      setPasswordState({ current_password: '', new_password: '', confirm_password: '' })
      setPasswordStatus('Password changed.')
    } catch {
      setPasswordStatus('Failed to change password.')
    }
  }

  async function loadFees() {
    try {
      const res = await safeFetch('/fees')
      if (!res.ok) throw new Error('fees failed')
      const data = await res.json()
      setFees(data || {})
    } catch {
      setFees({ __error: true })
    }
  }

  async function loadDocuments() {
    try {
      const res = await safeFetch('/documents')
      if (!res.ok) throw new Error('docs failed')
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
      setDocsStatus('')
    } catch {
      setDocuments([])
      setDocsStatus('Failed to load documents.')
    }
  }

  useEffect(() => {
    loadProfile()
    loadFees()
    loadDocuments()
  }, [])

  useEffect(() => {
    if (tab === 'accesses' && canManageAccesses) {
      loadAccesses()
    }
  }, [tab, canManageAccesses])

  return (
    <AppShell
      eyebrow="Envidicy · Profile"
      title="Settings"
      subtitle="Update profile, security, and documents."
    >

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Account settings</h2>
          </div>
          <span className="chip chip-ghost">Private</span>
        </div>

        <div className="tabs">
          <div className="tab-buttons">
            {visibleTabs.map((t) => (
              <button key={t.key} className={`tab-button ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)} type="button">
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' ? (
            <div className="tab-panel active">
              <div className="profile-avatar">
                <div className="avatar-large" id="profile-avatar-preview">
                  {profile.avatar_url ? (
                    <img src={`${API_BASE}${profile.avatar_url}`} alt="avatar" />
                  ) : (
                    (profile.email || 'U').trim().charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="avatar-actions">
                  <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                  <button className="btn ghost" onClick={uploadAvatar} type="button">Upload avatar</button>
                  <p className="muted small">{avatarStatus}</p>
                </div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Name</span>
                  <input value={profile.name} onChange={(e) => setProfile((s) => ({ ...s, name: e.target.value }))} type="text" />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input value={profile.company} onChange={(e) => setProfile((s) => ({ ...s, company: e.target.value }))} type="text" />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input value={profile.email} type="email" disabled />
                </label>
                <label className="field">
                  <span>Language</span>
                  <select value={profile.language} onChange={(e) => setProfile((s) => ({ ...s, language: e.target.value }))}>
                    <option value="ru">Russian</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="field">
                  <span>WhatsApp</span>
                  <input value={profile.whatsapp_phone} onChange={(e) => setProfile((s) => ({ ...s, whatsapp_phone: e.target.value }))} type="text" />
                </label>
                <label className="field">
                  <span>Telegram</span>
                  <input value={profile.telegram_handle} onChange={(e) => setProfile((s) => ({ ...s, telegram_handle: e.target.value }))} type="text" />
                </label>
              </div>
              <div className="panel-actions">
                <button className="btn primary" onClick={saveProfile} type="button">Save</button>
              </div>
              <p className="muted small">{profileStatus}</p>
            </div>
          ) : null}

          {tab === 'security' ? (
            <div className="tab-panel active">
              <div className="form-grid">
                <label className="field">
                  <span>Current password</span>
                  <input type="password" value={passwordState.current_password} onChange={(e) => setPasswordState((s) => ({ ...s, current_password: e.target.value }))} />
                </label>
                <label className="field">
                  <span>New password</span>
                  <input type="password" value={passwordState.new_password} onChange={(e) => setPasswordState((s) => ({ ...s, new_password: e.target.value }))} />
                </label>
                <label className="field">
                  <span>Confirm password</span>
                  <input type="password" value={passwordState.confirm_password} onChange={(e) => setPasswordState((s) => ({ ...s, confirm_password: e.target.value }))} />
                </label>
              </div>
              <div className="panel-actions">
                <button className="btn primary" onClick={changePassword} type="button">Change password</button>
              </div>
              <p className="muted small">{passwordStatus}</p>
            </div>
          ) : null}

          {tab === 'accesses' && canManageAccesses ? (
            <div className="tab-panel active">
              <div className="form-grid access-row">
                <label className="field">
                  <span>Secondary email</span>
                  <input value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} type="email" placeholder="team@company.com" />
                </label>
              </div>
              <div className="panel-actions">
                <button className="btn primary" onClick={addAccess} type="button">Add access</button>
              </div>
              <p className="muted small">Added email can access the same workspace after setting a password on the login page.</p>
              <p className="muted small">{accessStatus}</p>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!accesses.length ? (
                      <tr>
                        <td colSpan={4} className="muted">No secondary accesses yet.</td>
                      </tr>
                    ) : (
                      accesses.map((row) => {
                        const isOwner = (row.role || 'member') === 'owner'
                        return (
                          <tr key={row.id}>
                            <td>{row.email || '?'}</td>
                            <td>{isOwner ? 'Owner' : 'Secondary'}</td>
                            <td>{row.status === 'active' ? 'Active' : row.status || '?'}</td>
                            <td style={{ textAlign: 'right' }}>
                              {isOwner ? (
                                <span className="muted small">Cannot delete</span>
                              ) : (
                                <button className="btn ghost" onClick={() => deleteAccess(row.id)} type="button">Delete</button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'fees' ? (
            <div className="tab-panel active">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Fee</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees?.__error ? (
                      <tr>
                        <td colSpan={3} className="muted">Failed to load fees.</td>
                      </tr>
                    ) : (
                      [
                        { key: 'meta', platform: 'Meta', note: 'Facebook / Instagram' },
                        { key: 'google', platform: 'Google Ads', note: 'Search / Display / YouTube' },
                        { key: 'yandex', platform: 'Yandex Direct', note: 'Search / Network' },
                        { key: 'tiktok', platform: 'TikTok Ads', note: 'Video' },
                        { key: 'telegram', platform: 'Telegram Ads', note: 'Channels / Bots' },
                        { key: 'monochrome', platform: 'Monochrome', note: 'Programmatic' },
                      ].map((r) => {
                        const val = fees?.[r.key]
                        const label = val == null || val === '' ? '-' : `${Number(val).toFixed(2)}%`
                        return (
                          <tr key={r.key}>
                            <td>{r.platform}</td>
                            <td>{label}</td>
                            <td>{r.note}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="muted small">Fees are shown per advertising platform.</p>
            </div>
          ) : null}

          {tab === 'docs' ? (
            <div className="tab-panel active">
              {docsStatus ? <div className="notice">{docsStatus}</div> : null}
              {!documents.length ? <div className="notice">No documents uploaded yet.</div> : null}
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((row) => {
                      const token = getAuthToken()
                      const url = `${API_BASE}/documents/${row.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`
                      return (
                        <tr key={row.id}>
                          <td>{row.title}</td>
                          <td>{String(row.created_at || '').split(' ')[0] || '?'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <a className="btn ghost" href={url} target="_blank" rel="noopener">Download</a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  )
}
