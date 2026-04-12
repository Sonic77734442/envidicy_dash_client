'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import styles from '../../../components/admin/admin.module.css'
import { adminFetch } from '../../../lib/admin'

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

function StatCard({ label, value, hint }) {
  return (
    <article className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      <div className={styles.statHint}>{hint}</div>
    </article>
  )
}

export default function AdminLegalEntitiesPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Loading legal entities...')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('New legal entity')
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
    return adminFetch(router, path, options)
  }

  async function fetchEntities() {
    try {
      const res = await safeFetch('/admin/legal-entities')
      if (!res.ok) throw new Error('Failed to load legal entities.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load legal entities.')
    }
  }

  function resetModal() {
    setEditId(null)
    setModalTitle('New legal entity')
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
    setModalTitle('Edit legal entity')
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
      setNotice('Fill in all fields.')
      return
    }

    try {
      const res = await safeFetch(editId ? `/admin/legal-entities/${editId}` : '/admin/legal-entities', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save legal entity.')
      setModalOpen(false)
      await fetchEntities()
    } catch (e) {
      setNotice(e?.message || 'Failed to save legal entity.')
    }
  }

  useEffect(() => {
    fetchEntities()
  }, [])

  const stats = useMemo(() => {
    const uniqueClients = new Set(rows.map((row) => row.user_email).filter(Boolean)).size
    return {
      total: rows.length,
      uniqueClients,
      withBin: rows.filter((row) => row.bin).length,
    }
  }, [rows])

  return (
    <AdminShell title="Legal Entities" subtitle="Create and maintain client billing identities.">
      <section className={styles.statsGrid}>
        <StatCard label="Legal Entities" value={stats.total} hint="Total records stored for invoicing" />
        <StatCard label="Clients Covered" value={stats.uniqueClients} hint="Unique client emails linked to entities" />
        <StatCard label="With BIN/IIN" value={stats.withBin} hint="Records ready for billing documents" />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Client Legal Entities</h3>
            <p className={styles.cardSubtle}>Manage billing identities used for invoices and legal paperwork.</p>
          </div>
          <div className={styles.tableActions}>
            <button className={styles.buttonPrimary} type="button" onClick={openCreateModal}>Add Entity</button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Date</th><th>Client</th><th>BIN / IIN</th><th>Short Name</th><th>Full Name</th><th>Legal Address</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={7}>No legal entities found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <span className={styles.tableStrong}>{row.user_email || '—'}</span>
                      <span className={styles.tableMeta}>Entity #{row.id}</span>
                    </td>
                    <td>{row.bin || '—'}</td>
                    <td>{row.short_name || row.name || '—'}</td>
                    <td>{row.full_name || row.name || '—'}</td>
                    <td>{row.legal_address || row.address || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className={styles.buttonGhost} type="button" onClick={() => openEditModal(row)}>Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.cardHeader}>
          <p className={styles.muted}>{status || 'Entity records are synced with the billing backend.'}</p>
        </div>
      </section>

      {modalOpen ? (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="legal-entity-title">
            <div className={styles.modalHeader}>
              <div>
                <h3 id="legal-entity-title" className={styles.modalTitle}>{modalTitle}</h3>
                <p className={styles.modalSubtitle}>Create or update legal entity data used for client invoices.</p>
              </div>
              <button className={styles.buttonGhost} type="button" onClick={() => setModalOpen(false)}>Close</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalMain}>
                <div className={styles.detailSection}>
                  <div className={styles.filters}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Client Email</span>
                      <input className={styles.input} type="email" value={form.user_email} onChange={(e) => setForm((s) => ({ ...s, user_email: e.target.value }))} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>BIN or IIN</span>
                      <input className={styles.input} value={form.bin} onChange={(e) => setForm((s) => ({ ...s, bin: e.target.value }))} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Short Name</span>
                      <input className={styles.input} value={form.short_name} onChange={(e) => setForm((s) => ({ ...s, short_name: e.target.value }))} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Full Name</span>
                      <input className={styles.input} value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
                    </label>
                  </div>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Legal Address</span>
                    <textarea className={styles.textarea} value={form.legal_address} onChange={(e) => setForm((s) => ({ ...s, legal_address: e.target.value }))} />
                  </label>
                </div>
              </div>

              <aside className={styles.sidePanel}>
                <div className={styles.sideSnapshot}>
                  <div>
                    <span className={styles.sideSnapshotLabel}>Entity Mode</span>
                    <strong className={styles.sideSnapshotValue}>{editId ? 'Editing' : 'Creating'}</strong>
                  </div>
                  <span className={styles.statusChipMuted}>{editId ? 'Existing' : 'New'}</span>
                </div>

                <div className={styles.buttonRow}>
                  <button className={styles.buttonPrimary} type="button" onClick={saveEntity}>Save Entity</button>
                  <button className={styles.buttonGhost} type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                </div>

                <div className={styles.sideNote}>
                  Keep legal entity identity separate from wallet and funding state. This record should only represent invoice-ready client details.
                </div>

                <div className={styles.muted}>{notice}</div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  )
}
