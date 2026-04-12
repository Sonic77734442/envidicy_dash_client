'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import { adminFetch } from '../../../lib/admin'

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.replace('T', ' ').slice(0, 16)
  return str
}

export default function AdminAgenciesPage() {
  const router = useRouter()
  const [agencies, setAgencies] = useState([])
  const [users, setUsers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [detail, setDetail] = useState(null)
  const [status, setStatus] = useState('Loading agencies...')

  const [createForm, setCreateForm] = useState({ name: '', slug: '', owner_user_id: '' })
  const [memberForm, setMemberForm] = useState({ user_id: '', role: 'client_viewer' })
  const [accountForm, setAccountForm] = useState({ account_id: '', label: '' })
  const [accessForm, setAccessForm] = useState({ user_id: '', account_id: '', access_level: 'viewer' })

  async function safeFetch(path, options = {}) {
    return adminFetch(router, path, options)
  }

  async function loadBase() {
    try {
      const [agenciesRes, usersRes, clientsRes, accountsRes] = await Promise.all([
        safeFetch('/admin/agencies'),
        safeFetch('/admin/users'),
        safeFetch('/admin/clients'),
        safeFetch('/admin/accounts'),
      ])
      if (!agenciesRes.ok || !usersRes.ok || !clientsRes.ok || !accountsRes.ok) {
        throw new Error('Failed to load agency data.')
      }
      const [agenciesData, usersData, clientsData, accountsData] = await Promise.all([
        agenciesRes.json(),
        usersRes.json(),
        clientsRes.json(),
        accountsRes.json(),
      ])
      const mergedUsers = [...(Array.isArray(usersData) ? usersData : []), ...(Array.isArray(clientsData) ? clientsData : [])]
      const uniqueUsers = new Map()
      mergedUsers.forEach((row) => {
        if (row?.id != null && row?.email) uniqueUsers.set(String(row.id), { id: row.id, email: row.email })
      })
      const nextAgencies = Array.isArray(agenciesData) ? agenciesData : []
      setAgencies(nextAgencies)
      setUsers(Array.from(uniqueUsers.values()).sort((a, b) => String(a.email).localeCompare(String(b.email), 'ru')))
      setAccounts(Array.isArray(accountsData) ? accountsData : [])
      if (!selectedAgencyId && nextAgencies.length) {
        setSelectedAgencyId(String(nextAgencies[0].id))
      }
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load agency data.')
    }
  }

  async function loadDetail(agencyId) {
    if (!agencyId) {
      setDetail(null)
      return
    }
    try {
      const res = await safeFetch(`/admin/agencies/${agencyId}`)
      if (!res.ok) throw new Error('Failed to load agency.')
      const data = await res.json()
      setDetail(data)
      setStatus('')
    } catch (e) {
      setDetail(null)
      setStatus(e?.message || 'Failed to load agency.')
    }
  }

  async function createAgency() {
    if (!createForm.name.trim()) {
      setStatus('Provide an agency name.')
      return
    }
    try {
      const res = await safeFetch('/admin/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          slug: createForm.slug.trim() || null,
          owner_user_id: createForm.owner_user_id ? Number(createForm.owner_user_id) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Failed to create agency.')
      }
      const data = await res.json()
      setCreateForm({ name: '', slug: '', owner_user_id: '' })
      setSelectedAgencyId(String(data.id))
      await loadBase()
      await loadDetail(String(data.id))
      setStatus('Agency created.')
    } catch (e) {
      setStatus(e?.message || 'Failed to create agency.')
    }
  }

  async function addMember() {
    if (!selectedAgencyId || !memberForm.user_id) {
      setStatus('Select an agency and a user.')
      return
    }
    try {
      const res = await safeFetch(`/admin/agencies/${selectedAgencyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(memberForm.user_id),
          role: memberForm.role,
          status: 'active',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Failed to add member.')
      }
      await loadDetail(selectedAgencyId)
      setStatus('Member added.')
    } catch (e) {
      setStatus(e?.message || 'Failed to add member.')
    }
  }

  async function attachAccount() {
    if (!selectedAgencyId || !accountForm.account_id) {
      setStatus('Select an agency and an account.')
      return
    }
    try {
      const res = await safeFetch(`/admin/agencies/${selectedAgencyId}/accounts/${accountForm.account_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: accountForm.label.trim() || null,
          status: 'active',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Failed to attach account.')
      }
      await loadDetail(selectedAgencyId)
      setStatus('Account attached to agency.')
    } catch (e) {
      setStatus(e?.message || 'Failed to attach account.')
    }
  }

  async function grantAccess() {
    if (!selectedAgencyId || !accessForm.user_id || !accessForm.account_id) {
      setStatus('Select an agency, user and account.')
      return
    }
    try {
      const res = await safeFetch(`/admin/agencies/${selectedAgencyId}/accounts/${accessForm.account_id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(accessForm.user_id),
          access_level: accessForm.access_level,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Failed to grant access.')
      }
      await loadDetail(selectedAgencyId)
      setStatus('Account access granted.')
    } catch (e) {
      setStatus(e?.message || 'Failed to grant access.')
    }
  }

  useEffect(() => {
    loadBase()
  }, [])

  useEffect(() => {
    loadDetail(selectedAgencyId)
  }, [selectedAgencyId])

  const selectedAgency = detail?.agency || agencies.find((row) => String(row.id) === String(selectedAgencyId)) || null

  return (
    <AdminShell title="Agencies" subtitle="Tenant layer, membership, account mapping and access control.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Agency SaaS</p>
            <h2>Create agency</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} placeholder="Smart Lab" />
          </label>
          <label className="field">
            <span>Slug</span>
            <input value={createForm.slug} onChange={(e) => setCreateForm((s) => ({ ...s, slug: e.target.value }))} placeholder="smart-lab" />
          </label>
          <label className="field">
            <span>Owner</span>
            <select value={createForm.owner_user_id} onChange={(e) => setCreateForm((s) => ({ ...s, owner_user_id: e.target.value }))}>
              <option value="">No owner</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>{user.email}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="panel-actions">
          <button className="btn primary" type="button" onClick={createAgency}>Create agency</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Management</p>
            <h2>Agency</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Agency</span>
            <select value={selectedAgencyId} onChange={(e) => setSelectedAgencyId(e.target.value)}>
              <option value="">Select agency</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={String(agency.id)}>
                  {agency.name} {agency.slug ? `· ${agency.slug}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedAgency ? (
          <div className="grid-3" style={{ marginTop: 16 }}>
            <article className="stat">
              <p className="muted">Agency</p>
              <h3>{selectedAgency.name}</h3>
              <p className="muted small">{selectedAgency.slug || '—'}</p>
            </article>
            <article className="stat">
              <p className="muted">Owner</p>
              <h3>{selectedAgency.owner_email || '—'}</h3>
              <p className="muted small">status: {selectedAgency.status || 'active'}</p>
            </article>
            <article className="stat">
              <p className="muted">Members</p>
              <h3>{detail?.members?.length || 0} users</h3>
              <p className="muted small">{detail?.accounts?.length || 0} accounts mapped</p>
            </article>
          </div>
        ) : null}
        <p className="muted">{status}</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Members</p>
            <h2>Agency members</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>User</span>
            <select value={memberForm.user_id} onChange={(e) => setMemberForm((s) => ({ ...s, user_id: e.target.value }))}>
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>{user.email}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Role</span>
            <select value={memberForm.role} onChange={(e) => setMemberForm((s) => ({ ...s, role: e.target.value }))}>
              <option value="owner">owner</option>
              <option value="agency_admin">agency_admin</option>
              <option value="manager">manager</option>
              <option value="client_viewer">client_viewer</option>
            </select>
          </label>
        </div>
        <div className="panel-actions">
          <button className="btn primary" type="button" onClick={addMember}>Add member</button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th><th>Role</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {!(detail?.members || []).length ? (
                <tr><td colSpan={4}>No members.</td></tr>
              ) : (
                detail.members.map((row) => (
                  <tr key={row.id}>
                    <td>{row.email}</td>
                    <td>{row.role}</td>
                    <td>{row.status || 'active'}</td>
                    <td>{formatDate(row.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Accounts</p>
            <h2>Agency accounts</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Account</span>
            <select value={accountForm.account_id} onChange={(e) => setAccountForm((s) => ({ ...s, account_id: e.target.value }))}>
              <option value="">Select account</option>
              {accounts.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.user_email || '—'} · {row.platform} · {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Label</span>
            <input value={accountForm.label} onChange={(e) => setAccountForm((s) => ({ ...s, label: e.target.value }))} placeholder="Client reporting label" />
          </label>
        </div>
        <div className="panel-actions">
          <button className="btn primary" type="button" onClick={attachAccount}>Attach account</button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Account</th><th>Platform</th><th>Client</th><th>Label</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!(detail?.accounts || []).length ? (
                <tr><td colSpan={5}>No attached accounts.</td></tr>
              ) : (
                detail.accounts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.platform}</td>
                    <td>{row.user_email || '—'}</td>
                    <td>{row.label || '—'}</td>
                    <td>{row.status || row.ad_account_status || 'active'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Access</p>
            <h2>Account access</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>User</span>
            <select value={accessForm.user_id} onChange={(e) => setAccessForm((s) => ({ ...s, user_id: e.target.value }))}>
              <option value="">Select user</option>
              {(detail?.members || []).map((row) => (
                <option key={row.id} value={String(row.user_id)}>{row.email}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Account</span>
            <select value={accessForm.account_id} onChange={(e) => setAccessForm((s) => ({ ...s, account_id: e.target.value }))}>
              <option value="">Select account</option>
              {(detail?.accounts || []).map((row) => (
                <option key={row.id} value={String(row.ad_account_id)}>
                  {row.platform} · {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Access level</span>
            <select value={accessForm.access_level} onChange={(e) => setAccessForm((s) => ({ ...s, access_level: e.target.value }))}>
              <option value="viewer">viewer</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </div>
        <div className="panel-actions">
          <button className="btn primary" type="button" onClick={grantAccess}>Grant access</button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th><th>Account</th><th>Platform</th><th>Level</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {!(detail?.accesses || []).length ? (
                <tr><td colSpan={5}>No granted accesses yet.</td></tr>
              ) : (
                detail.accesses.map((row) => (
                  <tr key={row.id}>
                    <td>{row.email}</td>
                    <td>{row.account_name}</td>
                    <td>{row.platform}</td>
                    <td>{row.access_level}</td>
                    <td>{formatDate(row.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  )
}
