'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import { clearAuth, getAuthToken } from '../../../lib/auth'

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

function financeDocumentTypeLabel(value) {
  return String(value || '').toLowerCase() === 'avr' ? 'Completion Act' : 'Invoice'
}

function walletTypeLabel(value) {
  const key = String(value || '')
  if (key === 'adjustment') return 'Manual adjustment'
  if (key === 'topup_hold') return 'Topup hold'
  if (key === 'topup_hold_release') return 'Topup hold release'
  if (key === 'topup') return 'Topup debit'
  return key || '—'
}

export default function AdminClientsPage() {
  const router = useRouter()

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Loading clients...')
  const [activeTab, setActiveTab] = useState('requests')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [modalStatus, setModalStatus] = useState('')

  const [clientRequests, setClientRequests] = useState([])
  const [clientTopups, setClientTopups] = useState([])
  const [clientWalletOps, setClientWalletOps] = useState([])
  const [clientAccounts, setClientAccounts] = useState([])
  const [clientProfile, setClientProfile] = useState(null)
  const [clientFees, setClientFees] = useState(null)
  const [clientDocuments, setClientDocuments] = useState([])
  const [clientSummary, setClientSummary] = useState(null)
  const [clientIssues, setClientIssues] = useState([])
  const [documentsForm, setDocumentsForm] = useState({
    document_type: 'invoice',
    title: '',
    document_number: '',
    document_date: '',
    amount: '',
    currency: 'KZT',
    note: '',
    file: null,
  })

  const [requestEdits, setRequestEdits] = useState({})
  const [feesForm, setFeesForm] = useState({
    meta: '',
    google: '',
    yandex: '',
    tiktok: '',
    telegram: '',
    monochrome: '',
  })

  async function adminRouteFetch(path, options = {}) {
    const token = getAuthToken()
    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    if (res.status === 403) throw new Error('Admin access denied.')
    return res
  }

  async function fetchClients() {
    try {
      const res = await adminRouteFetch('/api/admin/clients')
      if (!res.ok) throw new Error('Failed to load clients.')
      const data = await res.json()
      setRows(Array.isArray(data?.items) ? data.items : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load clients.')
    }
  }

  async function fetchClientDetails(userId) {
    const res = await adminRouteFetch(`/api/admin/clients/${userId}`)
    if (!res.ok) throw new Error('Failed to load client card.')
    const data = await res.json()
    const requests = Array.isArray(data?.requests) ? data.requests : []
    const topups = Array.isArray(data?.topups) ? data.topups : []
    const wallet = Array.isArray(data?.walletTransactions) ? data.walletTransactions : []
    const accounts = Array.isArray(data?.accounts) ? data.accounts : []
    const profile = data?.profile || null
    const fees = data?.fees || null
    const documents = Array.isArray(data?.documents) ? data.documents : []
    const issues = Array.isArray(data?.issues) ? data.issues : []

    setClientRequests(Array.isArray(requests) ? requests : [])
    setClientTopups(Array.isArray(topups) ? topups : [])
    setClientWalletOps(Array.isArray(wallet) ? wallet : [])
    setClientAccounts(Array.isArray(accounts) ? accounts : [])
    setClientProfile(profile || null)
    setClientFees(fees || null)
    setClientDocuments(Array.isArray(documents) ? documents : [])
    setClientSummary(data?.summary || null)
    setClientIssues(issues)
    setFeesForm({
      meta: fees?.meta ?? '',
      google: fees?.google ?? '',
      yandex: fees?.yandex ?? '',
      tiktok: fees?.tiktok ?? '',
      telegram: fees?.telegram ?? '',
      monochrome: fees?.monochrome ?? '',
    })
    setRequestEdits(
      Object.fromEntries(
        (Array.isArray(requests) ? requests : []).map((row) => [
          String(row.id),
          {
            fx_rate: row.fx_rate ?? '',
            amount_net: row.amount_net ?? '',
          },
        ])
      )
    )
  }

  async function uploadClientDocument() {
    if (!selected) return
    if (!documentsForm.title.trim()) {
      setModalStatus('Enter a document title.')
      return
    }
    if (!documentsForm.file) {
      setModalStatus('Choose a file to upload.')
      return
    }
    try {
      const form = new FormData()
      form.append('document_type', documentsForm.document_type)
      form.append('title', documentsForm.title.trim())
      form.append('file', documentsForm.file)
      if (documentsForm.document_number.trim()) form.append('document_number', documentsForm.document_number.trim())
      if (documentsForm.document_date) form.append('document_date', documentsForm.document_date)
      if (documentsForm.amount !== '') form.append('amount', documentsForm.amount)
      if (documentsForm.currency.trim()) form.append('currency', documentsForm.currency.trim().toUpperCase())
      if (documentsForm.note.trim()) form.append('note', documentsForm.note.trim())
      const res = await adminRouteFetch(`/api/admin/clients/${selected.id}/documents/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to upload document.')
      setClientDocuments((prev) => [data, ...prev])
      setDocumentsForm({
        document_type: 'invoice',
        title: '',
        document_number: '',
        document_date: '',
        amount: '',
        currency: 'KZT',
        note: '',
        file: null,
      })
      setModalStatus('Document uploaded.')
    } catch (e) {
      setModalStatus(e?.message || 'Failed to upload document.')
    }
  }

  async function deleteClientDocument(docId) {
    if (!selected) return
    const ok = window.confirm('Delete this document?')
    if (!ok) return
    try {
      const res = await adminRouteFetch(`/api/admin/clients/${selected.id}/documents/${docId}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to delete document.')
      setClientDocuments((prev) => prev.filter((row) => row.id !== docId))
      setModalStatus('Document deleted.')
    } catch (e) {
      setModalStatus(e?.message || 'Failed to delete document.')
    }
  }

  async function openClientModal(row) {
    setSelected(row)
    setModalOpen(true)
    setModalStatus('Loading client card...')
    try {
      await fetchClientDetails(row.id)
      setModalStatus('')
      await adminRouteFetch(`/api/admin/clients/${row.id}/mark-seen`, { method: 'POST' })
      await fetchClients()
    } catch (e) {
      setModalStatus(e?.message || 'Failed to load client card.')
    }
  }

  async function impersonateClient(userId, email) {
    try {
      const res = await adminRouteFetch(`/api/admin/clients/${userId}/impersonate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to impersonate client')
      const params = new URLSearchParams({
        impersonate_token: data.token,
        impersonate_email: data.email || email || '',
        impersonate_user_id: String(data.id || userId),
        impersonation_return: '/admin/clients',
      })
      window.open(`/dashboard?${params.toString()}`, '_blank', 'noopener')
    } catch (e) {
      setStatus(e?.message || 'Failed to open client workspace.')
    }
  }

  async function updateTopup(topupId, action) {
    if (!selected) return
    const edit = requestEdits[String(topupId)] || {}
    const fxRate = edit.fx_rate === '' ? null : Number(edit.fx_rate)
    const amountNet = edit.amount_net === '' ? null : Number(edit.amount_net)

    try {
      if (fxRate !== null || amountNet !== null) {
        const patchRes = await adminRouteFetch(`/api/admin/topups/${topupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fx_rate: fxRate, amount_net: amountNet }),
        })
        if (!patchRes.ok) throw new Error('Failed to save topup parameters.')
      }

      if (action === 'complete') {
        const res = await adminRouteFetch(`/api/admin/topups/${topupId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        })
        if (!res.ok) throw new Error('Failed to complete topup.')
      } else if (action === 'reject') {
        const ok = window.confirm('Reject this topup request? Held funds will be released back to the client.')
        if (!ok) return
        const res = await adminRouteFetch(`/api/admin/topups/${topupId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'failed' }),
        })
        if (!res.ok) throw new Error('Failed to reject topup.')
      }

      await fetchClientDetails(selected.id)
      await fetchClients()
    } catch (e) {
      setModalStatus(e?.message || 'Failed to update request.')
    }
  }

  async function saveFees() {
    if (!selected) return
    const payload = {
      meta: feesForm.meta === '' ? null : Number(feesForm.meta),
      google: feesForm.google === '' ? null : Number(feesForm.google),
      yandex: feesForm.yandex === '' ? null : Number(feesForm.yandex),
      tiktok: feesForm.tiktok === '' ? null : Number(feesForm.tiktok),
      telegram: feesForm.telegram === '' ? null : Number(feesForm.telegram),
      monochrome: feesForm.monochrome === '' ? null : Number(feesForm.monochrome),
    }
    try {
      const res = await adminRouteFetch(`/api/admin/clients/${selected.id}/fees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save fees.')
      const data = await res.json()
      setClientFees(data)
      setModalStatus('Fees saved.')
    } catch (e) {
      setModalStatus(e?.message || 'Failed to save fees.')
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  async function downloadClientDocument(row) {
    if (!selected) return
    try {
      const query = new URLSearchParams()
      if (row?.document_type) query.set('document_type', row.document_type)
      if (row?.document_number) query.set('document_number', row.document_number)
      if (row?.title) query.set('title', row.title)
      if (row?.file_name) query.set('file_name', row.file_name)
      const suffix = query.toString() ? `?${query.toString()}` : ''
      const res = await adminRouteFetch(`/api/admin/clients/${selected.id}/documents/${row.id}${suffix}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || 'Failed to download document.')
      }

      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = row?.file_name || row?.title || `document-${row.id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch (e) {
      setModalStatus(e?.message || 'Failed to download document.')
    }
  }

  const summary = clientSummary || {
    pendingCount: clientRequests.length,
    completedTotalKzt: Number(selected?.completed_total_kzt || 0),
    accountsCount: clientAccounts.length,
    profitTotalKzt: 0,
  }

  return (
    <AdminShell title="Clients" subtitle="Requests, completed topups and client account operations.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Clients</p>
            <h2>Clients and requests</h2>
          </div>
          <span className="chip chip-ghost">clients</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Requests</th>
                <th>Completed</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={4}>No data.</td></tr>
              ) : (
                rows.map((row) => {
                  const pending = Number(row.pending_requests || 0)
                  const completedTotal = Number(row.completed_total_kzt ?? row.completed_total ?? 0)
                  return (
                    <tr key={row.id}>
                      <td>{row.email || '—'}</td>
                      <td>{pending ? <span className="dot">{pending}</span> : '—'}</td>
                      <td>{completedTotal ? `${formatMoney(completedTotal)} KZT` : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="inline-actions">
                          <button className="btn primary small" type="button" onClick={() => impersonateClient(row.id, row.email)}>Impersonate</button>
                          <button className="btn ghost small" type="button" onClick={() => openClientModal(row)}>Open</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="muted">{status}</p>
      </section>

      {modalOpen && selected ? (
        <div className="modal show" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-dialog modal-large">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Client</p>
                <h3>{selected.email || 'Client'}</h3>
              </div>
              <button className="btn ghost small" type="button" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" id="client-summary">
                <div className="stat">
                  <p className="muted">Client</p>
                  <h3>{selected.email || '—'}</h3>
                  <p className="muted small">{clientProfile?.company || '—'}</p>
                </div>
                <div className="stat">
                  <p className="muted">Requests</p>
                  <h3>{summary.pendingCount}</h3>
                  <p className="muted small">Waiting for review</p>
                </div>
                <div className="stat">
                  <p className="muted">Completed funding</p>
                  <h3>{summary.completedTotalKzt ? `${formatMoney(summary.completedTotalKzt)} KZT` : '—'}</h3>
                  <p className="muted small">Completed topups only, shown in KZT</p>
                </div>
                <div className="stat">
                  <p className="muted">Accounts</p>
                  <h3>{summary.accountsCount}</h3>
                  <p className="muted small">Available ad accounts</p>
                </div>
                <div className="stat">
                  <p className="muted">Profit</p>
                  <h3>{summary.profitTotalKzt ? `${formatMoney(summary.profitTotalKzt)} KZT` : '—'}</h3>
                  <p className="muted small">FX spread plus fees</p>
                </div>
              </div>

              <div className="tabs">
                <div className="tab-buttons">
                  <button className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')} type="button">Requests</button>
                  <button className={`tab-button ${activeTab === 'topups' ? 'active' : ''}`} onClick={() => setActiveTab('topups')} type="button">Topups</button>
                  <button className={`tab-button ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">Accounts</button>
                  <button className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')} type="button">Documents</button>
                  <button className={`tab-button ${activeTab === 'fees' ? 'active' : ''}`} onClick={() => setActiveTab('fees')} type="button">Fees</button>
                  <button className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} type="button">Profile</button>
                </div>

                {activeTab === 'requests' ? (
                  <div className="tab-panel active">
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th><th>Platform</th><th>Account</th><th>Invoice amount</th><th>FX Rate</th><th>Net funding</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!clientRequests.length ? (
                            <tr><td colSpan={8} className="muted">No requests.</td></tr>
                          ) : (
                            clientRequests.map((row) => {
                              const breakdown = row.breakdown || {}
                              const edit = requestEdits[String(row.id)] || { fx_rate: '', amount_net: '' }
                              return (
                                <tr key={row.id}>
                                  <td>{formatDate(row.created_at)}</td>
                                  <td>{row.account_platform || '—'}</td>
                                  <td>{row.account_name || '—'}</td>
                                  <td>{formatMoney(row.amount_input)} {row.currency || ''}</td>
                                  <td>
                                    <input className="field-input small" type="number" step="0.0001" value={edit.fx_rate} onChange={(e) => setRequestEdits((s) => ({ ...s, [String(row.id)]: { ...s[String(row.id)], fx_rate: e.target.value } }))} />
                                  </td>
                                  <td>
                                    <input className="field-input small" type="number" step="0.01" value={edit.amount_net} onChange={(e) => setRequestEdits((s) => ({ ...s, [String(row.id)]: { ...s[String(row.id)], amount_net: e.target.value } }))} /> {breakdown.accountCurrency}
                                  </td>
                                  <td>{row.status || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button className="btn ghost small" type="button" onClick={() => updateTopup(row.id, 'save')}>Save</button>{' '}
                                    <button className="btn primary small" type="button" onClick={() => updateTopup(row.id, 'complete')}>Complete</button>{' '}
                                    <button className="btn ghost small" type="button" onClick={() => updateTopup(row.id, 'reject')}>Reject</button>
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

                {activeTab === 'topups' ? (
                  <div className="tab-panel active">
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Date</th><th>Platform</th><th>Account</th><th>Invoice amount</th><th>Client FX</th><th>Internal FX</th><th>Net funding</th><th>FX profit</th><th>Fee profit</th><th>Total profit</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!clientTopups.length ? (
                            <tr><td colSpan={11} className="muted">No completed topups.</td></tr>
                          ) : (
                            clientTopups.map((row) => {
                              const breakdown = row.breakdown || {}
                              return (
                                <tr key={row.id}>
                                  <td>{formatDate(row.created_at)}</td>
                                  <td>{row.account_platform || '—'}</td>
                                  <td>{row.account_name || '—'}</td>
                                  <td>{formatMoney(breakdown.inputAmount)} {breakdown.inputCurrency}</td>
                                  <td>{breakdown.fxRate ?? '—'}</td>
                                  <td>{row.our_rate != null ? formatMoney(Number(row.our_rate || 0)) : '—'}</td>
                                  <td>{`${formatMoney(breakdown.netAccountFunding)} ${breakdown.accountCurrency}`}</td>
                                  <td>{formatMoney(Number(row.fx_profit_kzt || 0))} KZT</td>
                                  <td>{formatMoney(Number(row.fee_amount_kzt || 0))} KZT</td>
                                  <td>{formatMoney(Number(row.profit_total_kzt || 0))} KZT</td>
                                  <td>{row.status || '—'}</td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="table-wrapper" style={{ marginTop: 14 }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>Wallet operations</h4>
                      <table className="table">
                        <thead>
                          <tr><th>Date</th><th>Type</th><th>Platform</th><th>Account</th><th>Amount</th><th>USD</th><th>Note</th></tr>
                        </thead>
                        <tbody>
                          {!clientWalletOps.length ? (
                            <tr><td colSpan={7} className="muted">No wallet operations.</td></tr>
                          ) : (
                            clientWalletOps.map((row) => (
                              <tr key={row.id}>
                                <td>{formatDate(row.created_at)}</td>
                                <td>{walletTypeLabel(row.type)}</td>
                                <td>{row.account_platform || '—'}</td>
                                <td>{row.account_name || '—'}</td>
                                <td>{formatMoney(Number(row.amount || 0))} {row.currency || ''}</td>
                                <td>{row.amount_usd == null ? '—' : `${formatMoney(Number(row.amount_usd || 0))} USD`}</td>
                                <td>{row.note || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'accounts' ? (
                  <div className="tab-panel active">
                    <div className="table-wrapper">
                      <table className="table">
                        <thead><tr><th>Platform</th><th>Account</th><th>Agreement</th><th>Currency</th><th>Budget</th><th>Spend</th></tr></thead>
                        <tbody>
                          {!clientAccounts.length ? (
                            <tr><td colSpan={6} className="muted">No accounts.</td></tr>
                          ) : (
                            clientAccounts.map((row) => (
                              <tr key={row.id}>
                                <td>{row.platform_label || '—'}</td>
                                <td>{row.name || '—'}</td>
                                <td>{row.account_code || '—'}</td>
                                <td>{row.currency || '—'}</td>
                                <td>{row.budget_total != null ? `${formatMoney(row.budget_total)} ${row.currency || ''}` : '—'}</td>
                                <td>{row.live_billing_summary?.label || 'No data'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'documents' ? (
                  <div className="tab-panel active">
                    <div className="form-grid">
                      <label className="field">
                        <span>Document type</span>
                        <select value={documentsForm.document_type} onChange={(e) => setDocumentsForm((s) => ({ ...s, document_type: e.target.value }))}>
                          <option value="invoice">Invoice</option>
                          <option value="avr">Completion Act</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Title</span>
                        <input type="text" value={documentsForm.title} onChange={(e) => setDocumentsForm((s) => ({ ...s, title: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Number</span>
                        <input type="text" value={documentsForm.document_number} onChange={(e) => setDocumentsForm((s) => ({ ...s, document_number: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Document date</span>
                        <input type="date" value={documentsForm.document_date} onChange={(e) => setDocumentsForm((s) => ({ ...s, document_date: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Amount</span>
                        <input type="number" step="0.01" value={documentsForm.amount} onChange={(e) => setDocumentsForm((s) => ({ ...s, amount: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Currency</span>
                        <input type="text" value={documentsForm.currency} onChange={(e) => setDocumentsForm((s) => ({ ...s, currency: e.target.value }))} />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Note</span>
                        <input type="text" value={documentsForm.note} onChange={(e) => setDocumentsForm((s) => ({ ...s, note: e.target.value }))} />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>File</span>
                        <input
                          type="file"
                          onChange={(e) => setDocumentsForm((s) => ({ ...s, file: e.target.files?.[0] || null }))}
                        />
                      </label>
                    </div>
                    <div className="panel-actions" style={{ marginTop: 12 }}>
                      <button className="btn primary" type="button" onClick={uploadClientDocument}>Upload document</button>
                    </div>

                    <div className="table-wrapper" style={{ marginTop: 14 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Title</th>
                            <th>Number</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>File</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!clientDocuments.length ? (
                            <tr><td colSpan={7} className="muted">No documents.</td></tr>
                          ) : (
                            clientDocuments.map((row) => {
                              return (
                                <tr key={row.id}>
                                  <td>{financeDocumentTypeLabel(row.document_type)}</td>
                                  <td>{row.title || '—'}</td>
                                  <td>{row.document_number || '—'}</td>
                                  <td>{formatDate(row.document_date || row.created_at)}</td>
                                  <td>{row.amount != null ? `${formatMoney(row.amount)} ${row.currency || ''}` : '—'}</td>
                                  <td>{row.file_name || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                                      <button className="btn ghost small" type="button" onClick={() => downloadClientDocument(row)}>Download</button>
                                      <button className="btn ghost small" type="button" onClick={() => deleteClientDocument(row.id)}>Delete</button>
                                    </div>
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

                {activeTab === 'fees' ? (
                  <div className="tab-panel active">
                    <div className="form-grid">
                      <label className="field"><span>Meta, %</span><input id="fee-meta" type="number" step="0.01" value={feesForm.meta} onChange={(e) => setFeesForm((s) => ({ ...s, meta: e.target.value }))} /></label>
                      <label className="field"><span>Google, %</span><input id="fee-google" type="number" step="0.01" value={feesForm.google} onChange={(e) => setFeesForm((s) => ({ ...s, google: e.target.value }))} /></label>
                      <label className="field"><span>Yandex, %</span><input id="fee-yandex" type="number" step="0.01" value={feesForm.yandex} onChange={(e) => setFeesForm((s) => ({ ...s, yandex: e.target.value }))} /></label>
                      <label className="field"><span>TikTok, %</span><input id="fee-tiktok" type="number" step="0.01" value={feesForm.tiktok} onChange={(e) => setFeesForm((s) => ({ ...s, tiktok: e.target.value }))} /></label>
                      <label className="field"><span>Telegram, %</span><input id="fee-telegram" type="number" step="0.01" value={feesForm.telegram} onChange={(e) => setFeesForm((s) => ({ ...s, telegram: e.target.value }))} /></label>
                      <label className="field"><span>Monochrome, %</span><input id="fee-monochrome" type="number" step="0.01" value={feesForm.monochrome} onChange={(e) => setFeesForm((s) => ({ ...s, monochrome: e.target.value }))} /></label>
                    </div>
                    <div className="panel-actions" style={{ marginTop: 12 }}>
                      <button className="btn primary" type="button" onClick={saveFees}>Save</button>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'profile' ? (
                  <div className="tab-panel active">
                    <div className="details-grid">
                      <div className="details-section">
                        <h4>Contacts</h4>
                        <div className="details-row"><span className="details-label">Email</span><span>{clientProfile?.email || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Phone</span><span>{clientProfile?.whatsapp_phone || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Telegram</span><span>{clientProfile?.telegram_handle || '—'}</span></div>
                      </div>
                      <div className="details-section">
                        <h4>Profile data</h4>
                        <div className="details-row"><span className="details-label">Name</span><span>{clientProfile?.name || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Company</span><span>{clientProfile?.company || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Language</span><span>{clientProfile?.language || 'ru'}</span></div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {clientIssues.length ? (
                <p className="muted" style={{ margin: 0 }}>
                  Partial data: {clientIssues.map((item) => `${item.source} (${item.status})`).join(', ')}
                </p>
              ) : null}
              {modalStatus ? <p className="muted" style={{ marginTop: 10 }}>{modalStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  )
}
