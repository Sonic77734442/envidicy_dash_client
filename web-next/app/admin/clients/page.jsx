'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../../components/layout/AppShell'
import { apiFetch } from '../../../lib/api'
import { clearAuth, getAuthToken } from '../../../lib/auth'

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

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
  return String(value || '').toLowerCase() === 'avr' ? 'АВР' : 'Счет'
}

function walletTypeLabel(value) {
  const key = String(value || '')
  if (key === 'adjustment') return 'Ручная корректировка'
  if (key === 'topup_hold') return 'Холд пополнения'
  if (key === 'topup_hold_release') return 'Возврат холда'
  if (key === 'topup') return 'Списание пополнения'
  return key || '—'
}

function getTopupAccountAmount(row) {
  if (row?.amount_account != null) return Number(row.amount_account)
  return row?.amount_net != null ? Number(row.amount_net) : Number(row?.amount_input || 0)
}

function getTopupAccountDisplayCurrency(row) {
  const inputCurrency = String(row?.currency || 'KZT').toUpperCase()
  const accountCurrency = String(row?.account_currency || inputCurrency || 'USD').toUpperCase()
  const fx = Number(row?.fx_rate || 0)
  if (inputCurrency !== accountCurrency && !(Number.isFinite(fx) && fx > 0)) return inputCurrency
  return accountCurrency
}

function formatLiveBillingCell(liveBilling, fallbackCurrency) {
  if (!liveBilling) return '—'
  if (liveBilling.error) return 'Ошибка API'
  const currency = liveBilling.currency || fallbackCurrency || ''
  const spend = liveBilling.spend
  const limit = liveBilling.limit
  if (spend == null && limit == null) return 'Нет данных'
  if (spend != null && limit != null) return `${formatMoney(spend)} / ${formatMoney(limit)} ${currency}`
  if (spend != null) return `${formatMoney(spend)} ${currency}`
  return `${formatMoney(limit)} ${currency}`
}

export default function AdminClientsPage() {
  const router = useRouter()

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Загрузка клиентов...')
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

  async function safeFetch(path, options = {}) {
    const res = await apiFetch(path, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    if (res.status === 403) throw new Error('Нет доступа к админке.')
    return res
  }

  async function fetchClients() {
    try {
      const res = await safeFetch('/admin/clients')
      if (!res.ok) throw new Error('Ошибка загрузки клиентов.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки клиентов.')
    }
  }

  async function fetchClientDetails(userId) {
    const [requestsRes, topupsRes, walletRes, accountsRes, profileRes, feesRes, documentsRes] = await Promise.all([
      safeFetch(`/admin/clients/${userId}/requests`),
      safeFetch(`/admin/clients/${userId}/topups`),
      safeFetch(`/admin/clients/${userId}/wallet-transactions`),
      safeFetch(`/admin/clients/${userId}/accounts`),
      safeFetch(`/admin/clients/${userId}/profile`),
      safeFetch(`/admin/users/${userId}/fees`),
      safeFetch(`/admin/clients/${userId}/documents`),
    ])

    const requests = requestsRes.ok ? await requestsRes.json() : []
    const topups = topupsRes.ok ? await topupsRes.json() : []
    const wallet = walletRes.ok ? await walletRes.json() : []
    const accounts = accountsRes.ok ? await accountsRes.json() : []
    const profile = profileRes.ok ? await profileRes.json() : null
    const fees = feesRes.ok ? await feesRes.json() : null
    const documents = documentsRes.ok ? await documentsRes.json() : []

    setClientRequests(Array.isArray(requests) ? requests : [])
    setClientTopups(Array.isArray(topups) ? topups : [])
    setClientWalletOps(Array.isArray(wallet) ? wallet : [])
    setClientAccounts(Array.isArray(accounts) ? accounts : [])
    setClientProfile(profile || null)
    setClientFees(fees || null)
    setClientDocuments(Array.isArray(documents) ? documents : [])
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
      setModalStatus('Укажите название документа.')
      return
    }
    if (!documentsForm.file) {
      setModalStatus('Выберите файл для загрузки.')
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
      const res = await safeFetch(`/admin/clients/${selected.id}/documents/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Ошибка загрузки документа.')
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
      setModalStatus('Документ загружен.')
    } catch (e) {
      setModalStatus(e?.message || 'Ошибка загрузки документа.')
    }
  }

  async function deleteClientDocument(docId) {
    if (!selected) return
    const ok = window.confirm('Удалить документ?')
    if (!ok) return
    try {
      const res = await safeFetch(`/admin/clients/${selected.id}/documents/${docId}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Ошибка удаления документа.')
      setClientDocuments((prev) => prev.filter((row) => row.id !== docId))
      setModalStatus('Документ удален.')
    } catch (e) {
      setModalStatus(e?.message || 'Ошибка удаления документа.')
    }
  }

  async function openClientModal(row) {
    setSelected(row)
    setModalOpen(true)
    setModalStatus('Загрузка карточки клиента...')
    try {
      await fetchClientDetails(row.id)
      setModalStatus('')
      await safeFetch(`/admin/clients/${row.id}/mark-seen`, { method: 'POST' })
      await fetchClients()
    } catch (e) {
      setModalStatus(e?.message || 'Ошибка загрузки карточки клиента.')
    }
  }

  async function impersonateClient(userId, email) {
    try {
      const res = await safeFetch(`/admin/users/${userId}/impersonate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Не удалось войти как клиент')
      const params = new URLSearchParams({
        impersonate_token: data.token,
        impersonate_email: data.email || email || '',
        impersonate_user_id: String(data.id || userId),
        impersonation_return: '/admin/clients',
      })
      window.open(`/dashboard?${params.toString()}`, '_blank', 'noopener')
    } catch (e) {
      setStatus(e?.message || 'Не удалось войти в кабинет клиента.')
    }
  }

  async function updateTopup(topupId, action) {
    if (!selected) return
    const edit = requestEdits[String(topupId)] || {}
    const fxRate = edit.fx_rate === '' ? null : Number(edit.fx_rate)
    const amountNet = edit.amount_net === '' ? null : Number(edit.amount_net)

    try {
      if (fxRate !== null || amountNet !== null) {
        const patchRes = await safeFetch(`/admin/topups/${topupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fx_rate: fxRate, amount_net: amountNet }),
        })
        if (!patchRes.ok) throw new Error('Ошибка сохранения параметров пополнения.')
      }

      if (action === 'complete') {
        const res = await safeFetch(`/admin/topups/${topupId}/status?status=completed`, { method: 'POST' })
        if (!res.ok) throw new Error('Ошибка подтверждения пополнения.')
      } else if (action === 'reject') {
        const ok = window.confirm('Отклонить заявку на пополнение? Средства в холде будут возвращены клиенту.')
        if (!ok) return
        const res = await safeFetch(`/admin/topups/${topupId}/status?status=failed`, { method: 'POST' })
        if (!res.ok) throw new Error('Ошибка отклонения пополнения.')
      }

      await fetchClientDetails(selected.id)
      await fetchClients()
    } catch (e) {
      setModalStatus(e?.message || 'Ошибка обновления заявки.')
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
      const res = await safeFetch(`/admin/users/${selected.id}/fees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Ошибка сохранения комиссий.')
      const data = await res.json()
      setClientFees(data)
      setModalStatus('Комиссии сохранены.')
    } catch (e) {
      setModalStatus(e?.message || 'Ошибка сохранения комиссий.')
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const summary = useMemo(() => {
    const topupCompletedTotal = clientTopups.reduce((sum, row) => {
      const value = Number(row?.amount_input || 0)
      if (!Number.isFinite(value) || value <= 0) return sum
      return sum + value
    }, 0)
    const profitTotal = clientTopups.reduce((sum, row) => {
      const value = Number(row?.profit_total_kzt || 0)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)
    return {
      pendingCount: clientRequests.length,
      completedTotal:
        Number.isFinite(Number(selected?.completed_total_kzt)) && Number(selected?.completed_total_kzt) > 0
          ? Number(selected.completed_total_kzt)
          : topupCompletedTotal,
      accountsCount: clientAccounts.length,
      profitTotal,
    }
  }, [clientRequests, clientTopups, clientAccounts, selected])

  return (
    <AppShell
      area="admin"
      eyebrow="Envidicy · Admin"
      title="Клиенты"
      subtitle="Заявки, подтверждённые пополнения и аккаунты клиентов."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Клиенты</p>
            <h2>Клиенты и заявки</h2>
          </div>
          <span className="chip chip-ghost">clients</span>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Заявки</th>
                <th>Пополнено</th>
                <th style={{ textAlign: 'right' }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={4}>Нет данных</td></tr>
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
                          <button className="btn primary small" type="button" onClick={() => impersonateClient(row.id, row.email)}>Войти как клиент</button>
                          <button className="btn ghost small" type="button" onClick={() => openClientModal(row)}>Открыть</button>
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
                <p className="eyebrow">Клиент</p>
                <h3>{selected.email || 'Клиент'}</h3>
              </div>
              <button className="btn ghost small" type="button" onClick={() => setModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" id="client-summary">
                <div className="stat">
                  <p className="muted">Клиент</p>
                  <h3>{selected.email || '—'}</h3>
                  <p className="muted small">{clientProfile?.company || '—'}</p>
                </div>
                <div className="stat">
                  <p className="muted">Заявки</p>
                  <h3>{summary.pendingCount}</h3>
                  <p className="muted small">Ожидают подтверждения</p>
                </div>
                <div className="stat">
                  <p className="muted">Пополнено</p>
                  <h3>{summary.completedTotal ? `${formatMoney(summary.completedTotal)} KZT` : '—'}</h3>
                  <p className="muted small">По подтверждённым пополнениям (completed), в KZT</p>
                </div>
                <div className="stat">
                  <p className="muted">Аккаунты</p>
                  <h3>{summary.accountsCount}</h3>
                  <p className="muted small">Доступные кабинеты</p>
                </div>
                <div className="stat">
                  <p className="muted">Заработок</p>
                  <h3>{summary.profitTotal ? `${formatMoney(summary.profitTotal)} KZT` : '—'}</h3>
                  <p className="muted small">Курс + комиссия</p>
                </div>
              </div>

              <div className="tabs">
                <div className="tab-buttons">
                  <button className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')} type="button">Заявки</button>
                  <button className={`tab-button ${activeTab === 'topups' ? 'active' : ''}`} onClick={() => setActiveTab('topups')} type="button">Пополнения</button>
                  <button className={`tab-button ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')} type="button">Аккаунты</button>
                  <button className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')} type="button">Документы</button>
                  <button className={`tab-button ${activeTab === 'fees' ? 'active' : ''}`} onClick={() => setActiveTab('fees')} type="button">Комиссии</button>
                  <button className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} type="button">Профиль</button>
                </div>

                {activeTab === 'requests' ? (
                  <div className="tab-panel active">
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Дата</th><th>Платформа</th><th>Аккаунт</th><th>Счёт</th><th>Курс</th><th>В аккаунт</th><th>Статус</th><th style={{ textAlign: 'right' }}>Действие</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!clientRequests.length ? (
                            <tr><td colSpan={8} className="muted">Нет заявок.</td></tr>
                          ) : (
                            clientRequests.map((row) => {
                              const accountCurrency = getTopupAccountDisplayCurrency(row)
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
                                    <input className="field-input small" type="number" step="0.01" value={edit.amount_net} onChange={(e) => setRequestEdits((s) => ({ ...s, [String(row.id)]: { ...s[String(row.id)], amount_net: e.target.value } }))} /> {accountCurrency}
                                  </td>
                                  <td>{row.status || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button className="btn ghost small" type="button" onClick={() => updateTopup(row.id, 'save')}>Сохранить</button>{' '}
                                    <button className="btn primary small" type="button" onClick={() => updateTopup(row.id, 'complete')}>Подтвердить</button>{' '}
                                    <button className="btn ghost small" type="button" onClick={() => updateTopup(row.id, 'reject')}>Отклонить</button>
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
                            <th>Дата</th><th>Платформа</th><th>Аккаунт</th><th>Счёт</th><th>Курс</th><th>Наш курс</th><th>В аккаунт</th><th>Доход курс</th><th>Комиссия (от В аккаунт)</th><th>Итого доход</th><th>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!clientTopups.length ? (
                            <tr><td colSpan={11} className="muted">Нет подтверждённых пополнений.</td></tr>
                          ) : (
                            clientTopups.map((row) => {
                              const accountCurrency = getTopupAccountDisplayCurrency(row)
                              const accountAmount = getTopupAccountAmount(row)
                              return (
                                <tr key={row.id}>
                                  <td>{formatDate(row.created_at)}</td>
                                  <td>{row.account_platform || '—'}</td>
                                  <td>{row.account_name || '—'}</td>
                                  <td>{formatMoney(row.amount_input)} {row.currency || ''}</td>
                                  <td>{row.fx_rate ?? '—'}</td>
                                  <td>{row.our_rate != null ? formatMoney(Number(row.our_rate || 0)) : '—'}</td>
                                  <td>{accountAmount == null ? '—' : `${formatMoney(accountAmount)} ${accountCurrency}`}</td>
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
                      <h4 style={{ margin: '0 0 8px 0' }}>Операции по балансу клиента</h4>
                      <table className="table">
                        <thead>
                          <tr><th>Дата</th><th>Тип</th><th>Платформа</th><th>Аккаунт</th><th>Сумма</th><th>В USD</th><th>Примечание</th></tr>
                        </thead>
                        <tbody>
                          {!clientWalletOps.length ? (
                            <tr><td colSpan={7} className="muted">Нет операций по балансу.</td></tr>
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
                        <thead><tr><th>Платформа</th><th>Аккаунт</th><th>Договор</th><th>Валюта</th><th>Бюджет</th><th>Потрачено</th></tr></thead>
                        <tbody>
                          {!clientAccounts.length ? (
                            <tr><td colSpan={6} className="muted">Нет аккаунтов.</td></tr>
                          ) : (
                            clientAccounts.map((row) => (
                              <tr key={row.id}>
                                <td>{row.platform || '—'}</td>
                                <td>{row.name || '—'}</td>
                                <td>{row.account_code || '—'}</td>
                                <td>{row.currency || '—'}</td>
                                <td>{row.budget_total != null ? `${formatMoney(row.budget_total)} ${row.currency || ''}` : '—'}</td>
                                <td>{formatLiveBillingCell(row.live_billing, row.currency)}</td>
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
                        <span>Тип документа</span>
                        <select value={documentsForm.document_type} onChange={(e) => setDocumentsForm((s) => ({ ...s, document_type: e.target.value }))}>
                          <option value="invoice">Счет</option>
                          <option value="avr">АВР</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Название</span>
                        <input type="text" value={documentsForm.title} onChange={(e) => setDocumentsForm((s) => ({ ...s, title: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Номер</span>
                        <input type="text" value={documentsForm.document_number} onChange={(e) => setDocumentsForm((s) => ({ ...s, document_number: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Дата документа</span>
                        <input type="date" value={documentsForm.document_date} onChange={(e) => setDocumentsForm((s) => ({ ...s, document_date: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Сумма</span>
                        <input type="number" step="0.01" value={documentsForm.amount} onChange={(e) => setDocumentsForm((s) => ({ ...s, amount: e.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Валюта</span>
                        <input type="text" value={documentsForm.currency} onChange={(e) => setDocumentsForm((s) => ({ ...s, currency: e.target.value }))} />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Комментарий</span>
                        <input type="text" value={documentsForm.note} onChange={(e) => setDocumentsForm((s) => ({ ...s, note: e.target.value }))} />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Файл</span>
                        <input
                          type="file"
                          onChange={(e) => setDocumentsForm((s) => ({ ...s, file: e.target.files?.[0] || null }))}
                        />
                      </label>
                    </div>
                    <div className="panel-actions" style={{ marginTop: 12 }}>
                      <button className="btn primary" type="button" onClick={uploadClientDocument}>Загрузить документ</button>
                    </div>

                    <div className="table-wrapper" style={{ marginTop: 14 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Тип</th>
                            <th>Название</th>
                            <th>Номер</th>
                            <th>Дата</th>
                            <th>Сумма</th>
                            <th>Файл</th>
                            <th style={{ textAlign: 'right' }}>Действие</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!clientDocuments.length ? (
                            <tr><td colSpan={7} className="muted">Нет документов.</td></tr>
                          ) : (
                            clientDocuments.map((row) => {
                              const href = `${(process.env.NEXT_PUBLIC_API_BASE || 'https://envidicy-dash-client.onrender.com').replace(/\/$/, '')}/admin/clients/${selected.id}/documents/${row.id}`
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
                                      <a className="btn ghost small" href={href} target="_blank" rel="noopener">Скачать</a>
                                      <button className="btn ghost small" type="button" onClick={() => deleteClientDocument(row.id)}>Удалить</button>
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
                      <label className="field"><span>Яндекс, %</span><input id="fee-yandex" type="number" step="0.01" value={feesForm.yandex} onChange={(e) => setFeesForm((s) => ({ ...s, yandex: e.target.value }))} /></label>
                      <label className="field"><span>TikTok, %</span><input id="fee-tiktok" type="number" step="0.01" value={feesForm.tiktok} onChange={(e) => setFeesForm((s) => ({ ...s, tiktok: e.target.value }))} /></label>
                      <label className="field"><span>Telegram, %</span><input id="fee-telegram" type="number" step="0.01" value={feesForm.telegram} onChange={(e) => setFeesForm((s) => ({ ...s, telegram: e.target.value }))} /></label>
                      <label className="field"><span>Monochrome, %</span><input id="fee-monochrome" type="number" step="0.01" value={feesForm.monochrome} onChange={(e) => setFeesForm((s) => ({ ...s, monochrome: e.target.value }))} /></label>
                    </div>
                    <div className="panel-actions" style={{ marginTop: 12 }}>
                      <button className="btn primary" type="button" onClick={saveFees}>Сохранить</button>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'profile' ? (
                  <div className="tab-panel active">
                    <div className="details-grid">
                      <div className="details-section">
                        <h4>Контакты</h4>
                        <div className="details-row"><span className="details-label">Email</span><span>{clientProfile?.email || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Телефон</span><span>{clientProfile?.whatsapp_phone || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Telegram</span><span>{clientProfile?.telegram_handle || '—'}</span></div>
                      </div>
                      <div className="details-section">
                        <h4>Данные</h4>
                        <div className="details-row"><span className="details-label">Имя</span><span>{clientProfile?.name || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Компания</span><span>{clientProfile?.company || '—'}</span></div>
                        <div className="details-row"><span className="details-label">Язык</span><span>{clientProfile?.language || 'ru'}</span></div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {modalStatus ? <p className="muted" style={{ marginTop: 10 }}>{modalStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
