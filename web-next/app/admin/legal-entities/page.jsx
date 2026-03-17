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

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

export default function AdminLegalEntitiesPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Загрузка контрагентов...')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('Новый контрагент')
  const [notice, setNotice] = useState('')
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    user_email: '',
    bin: '',
    short_name: '',
    full_name: '',
    legal_address: '',
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

  async function fetchEntities() {
    try {
      const res = await safeFetch('/admin/legal-entities')
      if (!res.ok) throw new Error('Ошибка загрузки контрагентов.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки контрагентов.')
    }
  }

  function resetModal() {
    setEditId(null)
    setModalTitle('Новый контрагент')
    setForm({
      user_email: '',
      bin: '',
      short_name: '',
      full_name: '',
      legal_address: '',
    })
    setNotice('')
  }

  function openCreateModal() {
    resetModal()
    setModalOpen(true)
  }

  function openEditModal(row) {
    setEditId(row.id)
    setModalTitle('Редактирование контрагента')
    setForm({
      user_email: row.user_email || '',
      bin: row.bin || '',
      short_name: row.short_name || row.name || '',
      full_name: row.full_name || row.name || '',
      legal_address: row.legal_address || row.address || '',
    })
    setNotice('')
    setModalOpen(true)
  }

  async function saveEntity() {
    const payload = {
      user_email: form.user_email.trim(),
      bin: form.bin.trim(),
      short_name: form.short_name.trim(),
      full_name: form.full_name.trim(),
      legal_address: form.legal_address.trim(),
    }
    if (!payload.user_email || !payload.bin || !payload.short_name || !payload.full_name || !payload.legal_address) {
      setNotice('Заполните все поля.')
      return
    }

    try {
      const res = await safeFetch(editId ? `/admin/legal-entities/${editId}` : '/admin/legal-entities', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Не удалось сохранить контрагента.')
      setModalOpen(false)
      await fetchEntities()
    } catch (e) {
      setNotice(e?.message || 'Не удалось сохранить контрагента.')
    }
  }

  useEffect(() => {
    fetchEntities()
  }, [])

  return (
    <AppShell area="admin" eyebrow="Envidicy · Admin" title="Контрагенты" subtitle="Добавление и изменение данных контрагентов клиентов.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Админка</p>
            <h2>Контрагенты клиентов</h2>
          </div>
          <div className="panel-actions">
            <button className="btn primary small" type="button" onClick={openCreateModal}>Добавить</button>
            <span className="chip chip-ghost">legal_entities</span>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Дата</th><th>Клиент</th><th>БИН/ИИН</th><th>Краткое имя</th><th>Полное имя</th><th>Юридический адрес</th><th style={{ textAlign: 'right' }}>Действия</th></tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={7}>Нет данных</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.user_email || '—'}</td>
                    <td>{row.bin || '—'}</td>
                    <td>{row.short_name || row.name || '—'}</td>
                    <td>{row.full_name || row.name || '—'}</td>
                    <td>{row.legal_address || row.address || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost small" type="button" onClick={() => openEditModal(row)}>Изменить</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="muted">{status}</p>
      </section>

      {modalOpen ? (
        <div className="modal show" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-dialog">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Контрагент</p>
                <h3>{modalTitle}</h3>
              </div>
              <button className="btn ghost small" type="button" onClick={() => setModalOpen(false)}>Закрыть</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <label className="field"><span>Email клиента</span><input type="email" value={form.user_email} onChange={(e) => setForm((s) => ({ ...s, user_email: e.target.value }))} /></label>
                <label className="field"><span>БИН или ИИН</span><input value={form.bin} onChange={(e) => setForm((s) => ({ ...s, bin: e.target.value }))} /></label>
                <label className="field"><span>Краткое наименование</span><input value={form.short_name} onChange={(e) => setForm((s) => ({ ...s, short_name: e.target.value }))} /></label>
                <label className="field"><span>Полное наименование</span><input value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} /></label>
                <label className="field" style={{ gridColumn: '1 / -1' }}><span>Юридический адрес</span><input value={form.legal_address} onChange={(e) => setForm((s) => ({ ...s, legal_address: e.target.value }))} /></label>
              </div>
              <p className="muted">{notice}</p>
            </div>
            <div className="modal-actions">
              <button className="btn primary" type="button" onClick={saveEntity}>Сохранить</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
