'use client'

import { useEffect, useState } from 'react'
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

export default function AdminWalletPage() {
  const router = useRouter()

  const [wallets, setWallets] = useState([])
  const [walletsLow, setWalletsLow] = useState([])
  const [transactions, setTransactions] = useState([])
  const [profitSummary, setProfitSummary] = useState({ by_platform: [], overall: [] })
  const [status, setStatus] = useState('Загрузка кошельков...')

  const [form, setForm] = useState({ user_email: '', amount: '', note: '' })

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

  async function fetchWallets() {
    const [walletsRes, lowRes, txRes, profitRes] = await Promise.all([
      safeFetch('/admin/wallets'),
      safeFetch('/admin/wallets?low_only=1'),
      safeFetch('/admin/wallet-transactions'),
      safeFetch('/admin/topups/profit-summary'),
    ])

    if (!walletsRes.ok || !lowRes.ok || !txRes.ok || !profitRes.ok) throw new Error('Ошибка загрузки данных кошелька.')

    const [walletsData, lowData, txData, profitData] = await Promise.all([
      walletsRes.json(),
      lowRes.json(),
      txRes.json(),
      profitRes.json(),
    ])
    setWallets(Array.isArray(walletsData) ? walletsData : [])
    setWalletsLow(Array.isArray(lowData) ? lowData : [])
    setTransactions(Array.isArray(txData) ? txData : [])
    setProfitSummary({
      by_platform: Array.isArray(profitData?.by_platform) ? profitData.by_platform : [],
      overall: Array.isArray(profitData?.overall) ? profitData.overall : [],
    })
  }

  async function loadAll() {
    try {
      await fetchWallets()
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки кошельков.')
    }
  }

  async function adjustWallet(sign) {
    const email = form.user_email.trim()
    const amountRaw = Number(form.amount || 0)
    if (!email || !amountRaw) {
      setStatus('Укажите email и сумму.')
      return
    }
    try {
      const res = await safeFetch('/admin/wallets/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: email,
          amount: sign * amountRaw,
          note: form.note.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Ошибка обновления баланса.')
      setStatus('Баланс обновлен.')
      setForm((s) => ({ ...s, amount: '', note: '' }))
      await loadAll()
    } catch (e) {
      setStatus(e?.message || 'Ошибка обновления баланса.')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  return (
    <AppShell
      area="admin"
      eyebrow="Envidicy · Admin"
      title="Кошелек"
      subtitle="Балансы, операции и уведомления."
    >
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Кошелек</p>
            <h2>Ручная корректировка</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field"><span>Email клиента</span><input value={form.user_email} onChange={(e) => setForm((s) => ({ ...s, user_email: e.target.value }))} placeholder="client@email.com" /></label>
          <label className="field"><span>Сумма (KZT)</span><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} /></label>
          <label className="field"><span>Примечание</span><input value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} /></label>
        </div>
        <div className="panel-actions">
          <button className="btn primary" type="button" onClick={() => adjustWallet(1)}>Пополнить</button>
          <button className="btn ghost" type="button" onClick={() => adjustWallet(-1)}>Списать</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Балансы</p><h2>Кошельки клиентов</h2></div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Клиент</th><th>Баланс</th><th>Порог</th><th>Обновлено</th></tr></thead>
            <tbody>
              {!wallets.length ? (
                <tr><td colSpan={4}>Нет данных</td></tr>
              ) : (
                wallets.map((row) => (
                  <tr key={row.user_id} className={Number(row.balance) <= Number(row.low_threshold) ? 'row-warn' : ''}>
                    <td>{row.user_email || '—'}</td>
                    <td>₸{formatMoney(row.balance)}</td>
                    <td>₸{formatMoney(row.low_threshold)}</td>
                    <td>{(row.updated_at || '').split(' ')[0] || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Уведомления</p><h2>Низкий баланс</h2></div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Клиент</th><th>Баланс</th><th>Порог</th><th>Обновлено</th></tr></thead>
            <tbody>
              {!walletsLow.length ? (
                <tr><td colSpan={4}>Нет предупреждений.</td></tr>
              ) : (
                walletsLow.map((row) => (
                  <tr key={`low-${row.user_id}`} className="row-warn">
                    <td>{row.user_email || '—'}</td>
                    <td>₸{formatMoney(row.balance)}</td>
                    <td>₸{formatMoney(row.low_threshold)}</td>
                    <td>{(row.updated_at || '').split(' ')[0] || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">Финансы</p><h2>Операции и прибыль</h2></div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Дата</th><th>Клиент</th><th>Тип</th><th>Сумма</th><th>Примечание</th></tr></thead>
            <tbody>
              {!transactions.length ? (
                <tr><td colSpan={5}>Нет операций</td></tr>
              ) : (
                transactions.map((row) => (
                  <tr key={row.id}>
                    <td>{(row.created_at || '').split(' ')[0] || '—'}</td>
                    <td>{row.user_email || '—'}</td>
                    <td>{row.type || '—'}</td>
                    <td>{Number(row.amount) >= 0 ? '+' : ''}{formatMoney(row.amount)} {row.currency || ''}</td>
                    <td>{row.note || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-wrapper" style={{ marginTop: 14 }}>
          <table className="table">
            <thead><tr><th>Платформа</th><th>Валюта</th><th>Кол-во</th><th>Сумма вход</th><th>Комиссия</th></tr></thead>
            <tbody>
              {!profitSummary.by_platform.length ? (
                <tr><td colSpan={5}>Нет данных.</td></tr>
              ) : (
                profitSummary.by_platform.map((row, idx) => (
                  <tr key={`${row.platform}-${row.currency}-${idx}`}>
                    <td>{row.platform || '—'}</td>
                    <td>{row.currency || '—'}</td>
                    <td>{row.completed_count || 0}</td>
                    <td>{formatMoney(row.amount_input_total)} {row.currency || ''}</td>
                    <td>{formatMoney(row.fee_total)} {row.currency || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-actions" style={{ marginTop: 12 }}>
          {profitSummary.overall.map((row, idx) => (
            <span className="chip chip-ghost" key={`${row.currency}-${idx}`}>{row.currency}: {formatMoney(row.fee_total)}</span>
          ))}
        </div>
      </section>

      <p className="muted">{status}</p>
    </AppShell>
  )
}
