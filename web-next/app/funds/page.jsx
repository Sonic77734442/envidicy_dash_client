'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { clearAuth, getAuthToken } from '../../lib/auth'
import AppShell from '../../components/layout/AppShell'

function fmtDate(value) {
  if (!value) return ''
  const s = String(value)
  if (s.includes('T')) return s.split('T')[0]
  if (s.includes(' ')) return s.split(' ')[0]
  return s.slice(0, 10)
}

function fmtAmt(v, ccy) {
  const sign = Number(v || 0) < 0 ? '-' : ''
  return `${sign}${Math.abs(Number(v || 0)).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${ccy || ''}`
}

function platformLabel(key) {
  if (key === 'meta') return 'Meta'
  if (key === 'google') return 'Google'
  if (key === 'tiktok') return 'TikTok'
  if (key === 'yandex') return 'Яндекс'
  if (key === 'telegram') return 'Telegram'
  if (key === 'monochrome') return 'Monochrome'
  return key || '—'
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function FundsPage() {
  const router = useRouter()

  const [tab, setTab] = useState('invoices')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [platform, setPlatform] = useState('')
  const [accountFilter, setAccountFilter] = useState('')

  const [funds, setFunds] = useState([])
  const [topups, setTopups] = useState([])
  const [invoices, setInvoices] = useState([])
  const [legalEntities, setLegalEntities] = useState([])

  const [status, setStatus] = useState('Загрузка...')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalState, setModalState] = useState({
    legal_entity_id: '',
    amount: '',
    note: '',
    creatingEntity: false,
    entityNotice: '',
    entityName: '',
    entityBin: '',
    entityAddress: '',
    entityEmail: '',
  })

  async function safeFetch(path, options = {}) {
    const res = await apiFetch(path, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    return res
  }

  async function loadTopups() {
    try {
      const res = await safeFetch('/topups')
      if (!res.ok) throw new Error('Failed to load topups')
      const data = await res.json()
      setTopups(Array.isArray(data) ? data : [])
    } catch {
      setTopups([])
    }
  }

  async function loadFunds() {
    const res = await safeFetch('/wallet/transactions')
    if (!res.ok) throw new Error('Failed to load wallet transactions')
    const data = await res.json()
    const feeMap = new Map()
    topups
      .filter((t) => t.status === 'completed')
      .forEach((t) => {
        const fee = Number(t.amount_input || 0) * (Number(t.fee_percent || 0) / 100)
        const vat = Number(t.amount_input || 0) * (Number(t.vat_percent || 0) / 100)
        const gross = Number(t.amount_input || 0) + fee + vat
        const key = `${t.account_id}:${gross.toFixed(2)}`
        const current = feeMap.get(key) || []
        current.push({ feePercent: Number(t.fee_percent || 0), feeAmount: fee, createdAt: t.created_at || '' })
        feeMap.set(key, current)
      })

    const mapped = (Array.isArray(data) ? data : []).map((row) => {
      let acqPercent = null
      let acqAmount = null
      if (row.type === 'topup' && Number(row.amount || 0) < 0) {
        const key = `${row.account_id}:${Math.abs(Number(row.amount || 0)).toFixed(2)}`
        const bucket = feeMap.get(key) || []
        if (bucket.length) {
          bucket.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          const match = bucket.shift()
          feeMap.set(key, bucket)
          acqPercent = match.feePercent
          acqAmount = match.feeAmount
        }
      }
      return {
        date: fmtDate(row.created_at),
        platform: row.account_platform || '',
        account: row.account_name || '—',
        type: row.type === 'topup' ? 'Списание' : 'Пополнение',
        amount: Number(row.amount || 0),
        currency: row.currency || 'KZT',
        fx: row.fx_rate ?? '-',
        note: row.note || '',
        acqPercent,
        acqAmount,
      }
    })
    setFunds(mapped)
  }

  async function loadInvoices() {
    const res = await safeFetch('/wallet/topup-requests')
    if (!res.ok) throw new Error('Failed to load wallet invoices')
    const data = await res.json()
    const mapped = (Array.isArray(data) ? data : []).map((row) => ({
      id: row.id,
      date: fmtDate(row.created_at),
      counterparty: row.legal_entity_name || row.client_name || '—',
      amount: row.invoice_amount ?? row.amount ?? 0,
      currency: row.invoice_currency || row.currency || 'KZT',
      number: row.invoice_number || row.invoice_number_text || '',
    }))
    setInvoices(mapped)
  }

  async function loadLegalEntities() {
    try {
      const res = await safeFetch('/legal-entities')
      if (!res.ok) throw new Error('Failed to load legal entities')
      const data = await res.json()
      const rows = Array.isArray(data) ? data : []
      setLegalEntities(rows)
      setModalState((s) => ({ ...s, legal_entity_id: rows[0] ? String(rows[0].id) : '' }))
    } catch {
      setLegalEntities([])
    }
  }

  async function reloadAll() {
    setStatus('Загрузка...')
    try {
      await loadTopups()
      await Promise.all([loadInvoices(), loadLegalEntities()])
      setStatus('Данные обновлены.')
    } catch {
      setStatus('Ошибка загрузки данных.')
    }
  }

  useEffect(() => {
    const now = new Date()
    const start = new Date()
    start.setDate(now.getDate() - 30)
    setDateFrom(start.toISOString().slice(0, 10))
    setDateTo(now.toISOString().slice(0, 10))
    reloadAll()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') !== 'topup-balance') return
    setModalOpen(true)
  }, [])

  useEffect(() => {
    if (!topups.length && status === 'Загрузка...') return
    loadFunds().catch(() => setFunds([]))
  }, [topups])

  const filteredFunds = useMemo(() => {
    return funds.filter((r) => {
      if (platform && r.platform !== platform) return false
      if (accountFilter && !String(r.account || '').toLowerCase().includes(accountFilter.toLowerCase().trim())) return false
      if (dateFrom && r.date < dateFrom) return false
      if (dateTo && r.date > dateTo) return false
      return true
    })
  }, [funds, platform, accountFilter, dateFrom, dateTo])

  const summary = useMemo(() => {
    const totalUsd = filteredFunds.filter((r) => r.currency === 'USD').reduce((acc, r) => acc + r.amount, 0)
    const totalKzt = filteredFunds.filter((r) => r.currency === 'KZT').reduce((acc, r) => acc + r.amount, 0)
    const acq = filteredFunds.reduce((acc, r) => acc + Number(r.acqAmount || 0), 0)
    return { totalUsd, totalKzt, acq }
  }, [filteredFunds])

  async function submitTopupRequest() {
    const amount = Number(modalState.amount || 0)
    if (!amount || amount <= 0) {
      setModalState((s) => ({ ...s, entityNotice: 'Введите сумму пополнения.' }))
      return
    }
    try {
      const res = await safeFetch('/wallet/topup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'KZT',
          note: modalState.note?.trim() || null,
          legal_entity_id: modalState.legal_entity_id ? Number(modalState.legal_entity_id) : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to create topup request')

      if (data?.invoice_url) {
        const token = getAuthToken()
        const withToken = token ? `${data.invoice_url}?token=${encodeURIComponent(token)}` : data.invoice_url
        window.open(`${(process.env.NEXT_PUBLIC_API_BASE || 'https://envidicy-dash-client.onrender.com').replace(/\/$/, '')}${withToken}`, '_blank', 'noopener')
      }

      setModalOpen(false)
      setModalState((s) => ({ ...s, amount: '', note: '', entityNotice: '' }))
      await loadInvoices()
    } catch (e) {
      setModalState((s) => ({ ...s, entityNotice: e?.message || 'Ошибка отправки.' }))
    }
  }

  async function createLegalEntity() {
    if (!modalState.entityName.trim()) {
      setModalState((s) => ({ ...s, entityNotice: 'Укажите наименование контрагента.' }))
      return
    }
    try {
      const res = await safeFetch('/legal-entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modalState.entityName.trim(),
          bin: modalState.entityBin.trim() || null,
          address: modalState.entityAddress.trim() || null,
          email: modalState.entityEmail.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to create legal entity')
      setLegalEntities((prev) => [data, ...prev])
      setModalState((s) => ({
        ...s,
        legal_entity_id: String(data.id),
        creatingEntity: false,
        entityNotice: 'Контрагент добавлен.',
        entityName: '',
        entityBin: '',
        entityAddress: '',
        entityEmail: '',
      }))
    } catch (e) {
      setModalState((s) => ({ ...s, entityNotice: e?.message || 'Ошибка создания контрагента.' }))
    }
  }

  return (
    <AppShell
      eyebrow="Envidicy · Billing Desk"
      title="Финансы"
      subtitle="Отслеживайте пополнения и возвраты по аккаунтам, с суммами и курсом."
    >

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Фильтры</p>
            <h2>Период и аккаунты</h2>
          </div>
          <div className="panel-actions">
            <button className="btn primary" onClick={() => setModalOpen(true)} type="button">Пополнить баланс</button>
            <button className="btn ghost" onClick={reloadAll} type="button">Обновить</button>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>С</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>По</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="field">
            <span>Платформа</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">Все</option>
              <option value="meta">Meta</option>
              <option value="google">Google</option>
              <option value="tiktok">TikTok</option>
              <option value="yandex">Яндекс</option>
              <option value="telegram">Telegram</option>
              <option value="monochrome">Monochrome</option>
            </select>
          </label>
          <label className="field">
            <span>Аккаунт</span>
            <input type="text" placeholder="meta-001" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} />
          </label>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{status}</p>
      </section>

      <section className="panel">
        <div className="tabs">
          <div className="tab-buttons">
            <button className={`tab-button ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')} type="button">Счета</button>
            <button className={`tab-button ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')} type="button">Транзакции</button>
            <button className={`tab-button ${tab === 'docs' ? 'active' : ''}`} onClick={() => setTab('docs')} type="button">Закрывающие документы</button>
          </div>

          {tab === 'invoices' ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Контрагент</th>
                    <th>Сумма</th>
                    <th>Номер</th>
                    <th style={{ textAlign: 'right' }}>Файл</th>
                  </tr>
                </thead>
                <tbody>
                  {!invoices.length ? (
                    <tr>
                      <td colSpan={5}>Нет данных</td>
                    </tr>
                  ) : (
                    invoices.map((r) => {
                      const token = getAuthToken()
                      const pdfUrl = `${(process.env.NEXT_PUBLIC_API_BASE || 'https://envidicy-dash-client.onrender.com').replace(/\/$/, '')}/wallet/topup-requests/${r.id}/pdf-generated${token ? `?token=${encodeURIComponent(token)}` : ''}`
                      return (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td>{r.counterparty}</td>
                          <td>{fmtAmt(r.amount, r.currency)}</td>
                          <td>{r.number || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <a className="btn ghost" href={pdfUrl} target="_blank" rel="noopener">PDF</a>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'transactions' ? (
            <>
              <div className="panel-head" style={{ marginTop: 8 }}>
                <div>
                  <p className="eyebrow">Сводка</p>
                  <h2>Итого по выборке</h2>
                </div>
                <div className="chips">
                  <span className="chip chip-ghost">USD итого: {fmtAmt(summary.totalUsd, 'USD')}</span>
                  <span className="chip chip-ghost">KZT итого: {fmtAmt(summary.totalKzt, 'KZT')}</span>
                  <span className="chip chip-ghost">Эквайринг удержано: {fmtAmt(summary.acq, 'KZT')}</span>
                </div>
              </div>
              <div className="table-wrapper table-wrapper-tight">
                <table className="table table-funds-transactions">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Платформа</th>
                      <th>Аккаунт</th>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Эквайринг %</th>
                      <th>Эквайринг сумма</th>
                      <th>Курс</th>
                      <th>Валюта</th>
                      <th>Примечание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredFunds.length ? (
                      <tr>
                        <td colSpan={10}>Нет данных</td>
                      </tr>
                    ) : (
                      filteredFunds.map((r, idx) => (
                        <tr key={`${r.date}-${r.account}-${idx}`}>
                          <td>{r.date}</td>
                          <td>{platformLabel(r.platform)}</td>
                          <td>{r.account}</td>
                          <td>{r.type}</td>
                          <td>{fmtAmt(r.amount, r.currency)}</td>
                          <td>{r.acqPercent != null ? `${Number(r.acqPercent).toFixed(2)}%` : '—'}</td>
                          <td>{r.acqAmount != null ? fmtAmt(r.acqAmount, r.currency) : '—'}</td>
                          <td>{r.fx ?? '-'}</td>
                          <td>{r.currency}</td>
                          <td>{r.note || ''}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {tab === 'docs' ? (
            <div className="empty-state">
              <p className="muted">Пока нет закрывающих документов. Они появятся после подтверждения оплат.</p>
            </div>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="modal show">
          <div className="modal-dialog">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Баланс платформы</p>
                <h3>Пополнение баланса</h3>
              </div>
              <button className="btn ghost" onClick={() => setModalOpen(false)} type="button">Закрыть</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>Контрагент</span>
                <select value={modalState.legal_entity_id} onChange={(e) => setModalState((s) => ({ ...s, legal_entity_id: e.target.value }))}>
                  <option value="">Не выбран</option>
                  {legalEntities.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.name}
                      {e.bin ? ` · ${e.bin}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-actions" style={{ marginBottom: 10 }}>
                <button className="btn ghost" onClick={() => setModalState((s) => ({ ...s, creatingEntity: !s.creatingEntity }))} type="button">
                  Добавить контрагента
                </button>
              </div>

              {modalState.creatingEntity ? (
                <div className="modal-step" style={{ marginBottom: 10 }}>
                  <label className="field">
                    <span>Наименование контрагента</span>
                    <input value={modalState.entityName} onChange={(e) => setModalState((s) => ({ ...s, entityName: e.target.value }))} type="text" />
                  </label>
                  <label className="field">
                    <span>БИН/ИИН</span>
                    <input value={modalState.entityBin} onChange={(e) => setModalState((s) => ({ ...s, entityBin: e.target.value }))} type="text" />
                  </label>
                  <label className="field">
                    <span>Адрес</span>
                    <input value={modalState.entityAddress} onChange={(e) => setModalState((s) => ({ ...s, entityAddress: e.target.value }))} type="text" />
                  </label>
                  <label className="field">
                    <span>E-mail</span>
                    <input value={modalState.entityEmail} onChange={(e) => setModalState((s) => ({ ...s, entityEmail: e.target.value }))} type="email" />
                  </label>
                  <div className="inline-actions">
                    <button className="btn primary" onClick={createLegalEntity} type="button">Сохранить</button>
                  </div>
                </div>
              ) : null}

              <label className="field">
                <span>Сумма пополнения, ₸</span>
                <input type="number" min="0" step="100" value={modalState.amount} onChange={(e) => setModalState((s) => ({ ...s, amount: e.target.value }))} />
              </label>
              <label className="field">
                <span>Комментарий (опционально)</span>
                <input type="text" value={modalState.note} onChange={(e) => setModalState((s) => ({ ...s, note: e.target.value }))} />
              </label>
              {modalState.entityNotice ? <p className="muted">{modalState.entityNotice}</p> : null}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setModalOpen(false)} type="button">Отмена</button>
              <button className="btn primary" onClick={submitTopupRequest} type="button">Сформировать счет</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
