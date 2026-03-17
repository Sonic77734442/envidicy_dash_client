'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { clearAuth, getAuthToken } from '../../../lib/auth'
import AppShell from '../../../components/layout/AppShell'

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'https://envidicy-dash-client.onrender.com').replace(/\/$/, '')

function statusLabel(status) {
  if (status === 'approved') return 'Открыт'
  if (status === 'processing') return 'В работе'
  if (status === 'rejected') return 'Отклонен'
  return 'Новая'
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function normalizePayload(payload) {
  if (!payload) return {}
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return { raw: payload }
    }
  }
  return payload
}

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function renderDetailsValue(value) {
  if (value == null || value === '') {
    return '—'
  }

  if (Array.isArray(value)) {
    const items = value.filter(Boolean)
    if (!items.length) return '—'
    return (
      <div className="details-value-list">
        {items.map((item, idx) => (
          <div className="details-value-item" key={`${String(item)}-${idx}`}>
            {renderDetailsValue(item)}
          </div>
        ))}
      </div>
    )
  }

  const text = String(value)
  if (looksLikeUrl(text)) {
    return (
      <a className="details-link" href={text} target="_blank" rel="noreferrer">
        {text}
      </a>
    )
  }

  return text
}

function section(title, rows) {
  return (
    <div className="details-section">
      <h4>{title}</h4>
      {rows.map(([label, value]) => (
        <div className="details-row" key={`${title}-${label}`}>
          <div className="details-label">{label}</div>
          <div className="details-value">{renderDetailsValue(value)}</div>
        </div>
      ))}
    </div>
  )
}

export default function AdminRequestsPage() {
  const router = useRouter()

  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Загрузка заявок...')
  const [filters, setFilters] = useState({ status: '', platform: '', email: '' })
  const [codeById, setCodeById] = useState({})
  const [modalRow, setModalRow] = useState(null)
  const [events, setEvents] = useState([])
  const [eventStatus, setEventStatus] = useState('')

  const [modalForm, setModalForm] = useState({
    account_code: '',
    budget_total: '',
    manager_email: '',
    comment: '',
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

  async function fetchRequests() {
    try {
      const res = await safeFetch('/admin/account-requests')
      if (!res.ok) throw new Error('Ошибка загрузки заявок.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки заявок.')
    }
  }

  async function setRowStatus(id, nextStatus, accountCode) {
    try {
      const res = await safeFetch(`/admin/account-requests/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, account_code: accountCode || null }),
      })
      if (!res.ok) throw new Error('Ошибка обновления статуса.')
      await fetchRequests()
    } catch (e) {
      setStatus(e?.message || 'Ошибка обновления статуса.')
    }
  }

  async function fetchEvents(requestId) {
    try {
      const res = await safeFetch(`/admin/account-requests/${requestId}/events`)
      if (!res.ok) throw new Error('Ошибка загрузки лога.')
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
      setEventStatus('')
    } catch (e) {
      setEvents([])
      setEventStatus(e?.message || 'Ошибка загрузки лога.')
    }
  }

  function openModal(row) {
    setModalRow(row)
    setEvents([])
    setEventStatus('Загрузка лога...')
    setModalForm({
      account_code: row.account_code || row.account_code_db || '',
      budget_total: row.budget_total ?? '',
      manager_email: row.manager_email || '',
      comment: row.comment || '',
    })
    fetchEvents(row.id)
  }

  async function submitModalAction(action) {
    if (!modalRow) return
    const id = modalRow.id
    const budgetRaw = String(modalForm.budget_total || '').trim()
    const budgetTotal = budgetRaw === '' ? null : Number(budgetRaw)
    if (budgetRaw !== '' && Number.isNaN(budgetTotal)) {
      setStatus('Введите корректный бюджет.')
      return
    }

    try {
      if (action === 'comment') {
        if (!modalForm.comment.trim() && !modalForm.manager_email.trim()) {
          setStatus('Введите комментарий или менеджера.')
          return
        }
        const res = await safeFetch(`/admin/account-requests/${id}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            comment: modalForm.comment.trim() || null,
            manager_email: modalForm.manager_email.trim() || null,
          }),
        })
        if (!res.ok) throw new Error('Ошибка добавления комментария.')
        await fetchEvents(id)
        return
      }

      const nextStatus = action === 'save' ? modalRow.status || 'processing' : action
      const res = await safeFetch(`/admin/account-requests/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          account_code: modalForm.account_code.trim() || null,
          manager_email: modalForm.manager_email.trim() || null,
          comment: modalForm.comment.trim() || null,
          budget_total: budgetTotal,
        }),
      })
      if (!res.ok) throw new Error('Ошибка обновления заявки.')
      await fetchRequests()
      await fetchEvents(id)
    } catch (e) {
      setStatus(e?.message || 'Ошибка обновления заявки.')
    }
  }

  async function exportRequests() {
    try {
      const token = getAuthToken()
      if (!token) return
      const res = await fetch(`${API_BASE}/admin/export/requests.xlsx`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Экспорт недоступен')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'requests.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setStatus(e?.message || 'Ошибка экспорта.')
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    setCodeById(
      Object.fromEntries(rows.map((row) => [String(row.id), row.account_code || row.account_code_db || '']))
    )
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filters.status && row.status !== filters.status) return false
      if (filters.platform && row.platform !== filters.platform) return false
      if (filters.email && !String(row.user_email || '').toLowerCase().includes(filters.email.toLowerCase())) return false
      return true
    })
  }, [rows, filters])

  const modalPayload = normalizePayload(modalRow?.payload)
  const accessList = Array.isArray(modalPayload?.access)
    ? modalPayload.access.map((item) => [item.email, item.role].filter(Boolean).join(' '))
    : []
  const tiktokIds = Array.isArray(modalPayload?.tiktok_business_ids) ? modalPayload.tiktok_business_ids : []
  const accountCurrency = modalRow?.account_currency || (modalRow?.platform === 'telegram' ? 'EUR' : 'USD')
  const budgetTotal = modalRow?.budget_total != null ? Number(modalRow.budget_total) : null
  const topupTotal = modalRow?.topup_completed_total != null ? Number(modalRow.topup_completed_total) : null
  const formatMoneyCurrency = (value) =>
    value == null || Number.isNaN(value) ? '—' : `${formatMoney(value)} ${accountCurrency}`

  return (
    <AppShell
      area="admin"
      eyebrow="Envidicy · Admin"
      title="Заявки"
      subtitle="Все запросы на открытие аккаунтов."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Админка</p>
            <h2>Заявки на открытие</h2>
          </div>
          <div className="panel-actions">
            <button className="btn ghost" onClick={exportRequests} type="button">Экспорт Excel</button>
            <span className="chip chip-ghost">Только для администратора</span>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Статус</span>
            <select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
              <option value="">Все</option>
              <option value="new">Новые</option>
              <option value="processing">В работе</option>
              <option value="approved">Открыт</option>
              <option value="rejected">Отклонен</option>
            </select>
          </label>
          <label className="field">
            <span>Платформа</span>
            <select value={filters.platform} onChange={(e) => setFilters((s) => ({ ...s, platform: e.target.value }))}>
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
            <span>Клиент (email)</span>
            <input value={filters.email} onChange={(e) => setFilters((s) => ({ ...s, email: e.target.value }))} type="text" placeholder="client@email.com" />
          </label>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th><th>Клиент</th><th>Платформа</th><th>Название</th><th>Договор/код</th><th>Статус</th><th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={7}>Нет данных</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{String(row.created_at || '').split(' ')[0] || '—'}</td>
                    <td>{row.user_email || '—'}</td>
                    <td>{row.platform}</td>
                    <td>{row.name}</td>
                    <td>
                      <input
                        className="field-input small"
                        value={codeById[String(row.id)] ?? ''}
                        onChange={(e) =>
                          setCodeById((s) => ({ ...s, [String(row.id)]: e.target.value }))
                        }
                        onBlur={(e) => {
                          const val = e.target.value.trim()
                          if (val === (row.account_code || row.account_code_db || '')) return
                          setRowStatus(row.id, row.status || 'processing', val)
                        }}
                        type="text"
                        placeholder="Напр. KZ-2024-01"
                      />
                    </td>
                    <td>{statusLabel(row.status)}</td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn ghost" onClick={() => setRowStatus(row.id, 'processing', codeById[String(row.id)] || null)} type="button">В работе</button>
                      <button className="btn primary" onClick={() => setRowStatus(row.id, 'approved', codeById[String(row.id)] || null)} type="button">Одобрить</button>
                      <button className="btn ghost" onClick={() => setRowStatus(row.id, 'rejected', codeById[String(row.id)] || null)} type="button">Отклонить</button>
                      <button className="btn ghost" onClick={() => openModal(row)} type="button">Карточка</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="muted">{status}</p>
      </section>

      {modalRow ? (
        <div className="modal show" onClick={(e) => e.target.classList.contains('modal') && setModalRow(null)}>
          <div className="modal-dialog modal-large">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Карточка заявки</p>
                <h3>{modalRow.platform} · {modalRow.name}</h3>
              </div>
              <button className="btn ghost" onClick={() => setModalRow(null)} type="button">Закрыть</button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                {section('Основное', [
                  ['Клиент', modalRow.user_email || '—'],
                  ['Платформа', modalRow.platform || '—'],
                  ['Название', modalRow.name || '—'],
                  ['Статус', statusLabel(modalRow.status)],
                  ['Менеджер', modalRow.manager_email || '—'],
                  ['Дата', modalRow.created_at || '—'],
                ])}
                {section('Финансы', [
                  ['Бюджет (ручной)', formatMoneyCurrency(budgetTotal)],
                  ['Пополнено (completed)', formatMoneyCurrency(topupTotal)],
                ])}
                {section('Ссылки', [
                  ['Сайт', modalPayload.website || '—'],
                  ['Приложение', modalPayload.app || '—'],
                  ['Facebook', modalPayload.facebook_page || '—'],
                  ['Instagram', modalPayload.instagram_page || '—'],
                  ['Telegram-канал', modalPayload.telegram_channel || '—'],
                ])}
                {section('Доступы', [
                  ['MCC e-mail', modalPayload.mcc_email || '—'],
                  ['Яндекс mail', modalPayload.yandex_email || '—'],
                  ['Access list', accessList.length ? accessList.join(', ') : '—'],
                ])}
                {section('Meta', [
                  ['BM ID', modalPayload.business_manager_id || '—'],
                  ['ГЕО', modalPayload.geo || '—'],
                  ['Конечный рекламодатель', modalPayload.final_advertiser === 'no' ? 'Нет' : 'Да'],
                  ['Конечный рекламодатель (имя)', modalPayload.final_name || '—'],
                  ['Страна', modalPayload.final_country || '—'],
                  ['Налог ID', modalPayload.final_tax_id || '—'],
                  ['Адрес', modalPayload.final_address || '—'],
                  ['Доля владения', modalPayload.final_ownership || '—'],
                ])}
                {section('TikTok', [
                  ['Business IDs', tiktokIds.length ? tiktokIds.join(', ') : '—'],
                  ['Timezone', modalPayload.tiktok_timezone || '—'],
                  ['GEO', modalPayload.tiktok_geo || '—'],
                ])}
                {section('Комментарии', [['Комментарий', modalRow.comment || '—']])}
              </div>

              <details className="field details">
                <summary>Raw payload</summary>
                <pre className="payload-box">{JSON.stringify(modalPayload, null, 2)}</pre>
              </details>

              <div className="details-section">
                <h4>Лог событий</h4>
                {!events.length ? <div className="muted">{eventStatus || 'Нет событий.'}</div> : null}
                {events.map((event) => {
                  const when = String(event.created_at || '').replace('T', ' ')
                  const meta = [
                    event.status ? `Статус: ${statusLabel(event.status)}` : '',
                    event.manager_email ? `Менеджер: ${event.manager_email}` : '',
                    event.comment ? `Комментарий: ${event.comment}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return <div key={event.id || `${when}-${event.type}`}>{`${when} · ${event.type}${meta ? ` · ${meta}` : ''}`}</div>
                })}
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'grid', gap: 8 }}>
              <div className="modal-actions-row">
                <input className="field-input small" type="text" placeholder="Код договора/аккаунта" value={modalForm.account_code} onChange={(e) => setModalForm((s) => ({ ...s, account_code: e.target.value }))} />
                <input className="field-input small" type="number" step="0.01" placeholder="Бюджет" value={modalForm.budget_total} onChange={(e) => setModalForm((s) => ({ ...s, budget_total: e.target.value }))} />
                <input className="field-input small" type="text" placeholder="Менеджер (email)" value={modalForm.manager_email} onChange={(e) => setModalForm((s) => ({ ...s, manager_email: e.target.value }))} />
                <textarea className="field-input small textarea" rows={2} placeholder="Комментарий" value={modalForm.comment} onChange={(e) => setModalForm((s) => ({ ...s, comment: e.target.value }))} />
              </div>
              <div className="modal-actions-buttons">
                <button className="btn ghost" onClick={() => submitModalAction('save')} type="button">Сохранить</button>
                <button className="btn ghost" onClick={() => submitModalAction('processing')} type="button">В работе</button>
                <button className="btn primary" onClick={() => submitModalAction('approved')} type="button">Одобрить</button>
                <button className="btn ghost" onClick={() => submitModalAction('rejected')} type="button">Отклонить</button>
                <button className="btn ghost" onClick={() => submitModalAction('comment')} type="button">Комментарий</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
