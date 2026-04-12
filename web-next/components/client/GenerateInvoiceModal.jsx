'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'

export default function GenerateInvoiceModal({ open, onClose, onCreated, tr, preferredEntityId = null }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [entities, setEntities] = useState([])
  const [entityId, setEntityId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [createEntityOpen, setCreateEntityOpen] = useState(false)
  const [entityForm, setEntityForm] = useState({
    name: '',
    bin: '',
    address: '',
    email: '',
    issuer_type: 'too',
    tax_mode: 'with_vat',
    contract_number: '',
    contract_date: '',
  })

  const amountNum = useMemo(() => Number(amount || 0), [amount])

  useEffect(() => {
    if (!open) return
    const token = getAuthToken()
    if (!token) return

    let cancelled = false
    async function loadEntities() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/client/legal-entities', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => [])
        if (!res.ok) throw new Error(data?.detail || 'Failed to load legal entities')
        if (cancelled) return
        const rows = Array.isArray(data) ? data : []
        setEntities(rows)
        const preferred = preferredEntityId != null ? String(preferredEntityId) : ''
        if (preferred && rows.some((row) => String(row.id) === preferred)) {
          setEntityId(preferred)
        } else if (rows[0]) {
          setEntityId(String(rows[0].id))
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load legal entities')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadEntities()
    return () => {
      cancelled = true
    }
  }, [open, preferredEntityId])

  useEffect(() => {
    if (!open) return
    if (!preferredEntityId) return
    const preferred = String(preferredEntityId)
    if (entities.some((row) => String(row.id) === preferred)) {
      setEntityId(preferred)
    }
  }, [open, preferredEntityId, entities])

  useEffect(() => {
    if (!open) {
      setSaving(false)
      setError('')
      setCreateEntityOpen(false)
      setEntityForm({
        name: '',
        bin: '',
        address: '',
        email: '',
        issuer_type: 'too',
        tax_mode: 'with_vat',
        contract_number: '',
        contract_date: '',
      })
      setAmount('')
      setNote('')
    }
  }, [open])

  function openInvoicePage(requestId) {
    const href = `/api/client/wallet-topup-requests/${requestId}/invoice`
    const popup = window.open(href, '_blank', 'noopener')
    if (!popup) throw new Error('Popup blocked while opening invoice')
  }

  async function createEntity() {
    const token = getAuthToken()
    if (!token) return
    if (!entityForm.name.trim()) {
      setError(tr('Entity name is required', 'Укажите наименование контрагента'))
      return
    }
    setSaving(true)
    setError('')
    const issuerType = entityForm.issuer_type === 'ip' ? 'ip' : 'too'
    const taxMode = issuerType === 'ip' ? 'without_vat' : 'with_vat'
    try {
      const res = await fetch('/api/client/legal-entities', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: entityForm.name.trim(),
          bin: entityForm.bin.trim() || null,
          address: entityForm.address.trim() || null,
          email: entityForm.email.trim() || null,
          issuer_type: issuerType,
          tax_mode: taxMode,
          contract_number: entityForm.contract_number.trim() || null,
          contract_date: entityForm.contract_date.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to create legal entity')
      const next = [data, ...entities]
      setEntities(next)
      setEntityId(String(data.id))
      setCreateEntityOpen(false)
      setEntityForm({
        name: '',
        bin: '',
        address: '',
        email: '',
        issuer_type: 'too',
        tax_mode: 'with_vat',
        contract_number: '',
        contract_date: '',
      })
    } catch (e) {
      setError(e?.message || 'Failed to create legal entity')
    } finally {
      setSaving(false)
    }
  }

  async function submitInvoiceRequest() {
    const token = getAuthToken()
    if (!token) return
    if (!(Number.isFinite(amountNum) && amountNum > 0)) {
      setError(tr('Enter a valid amount', 'Введите корректную сумму'))
      return
    }
    if (!entityId) {
      setError(tr('Select legal entity with contract details', 'Выберите контрагента с договором'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/client/wallet-topup-requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountNum,
          currency: 'KZT',
          legal_entity_id: entityId ? Number(entityId) : null,
          note: note.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to generate invoice request')
      if (data?.id) openInvoicePage(data.id)
      if (onCreated) await onCreated(data)
      onClose()
    } catch (e) {
      setError(e?.message || 'Failed to generate invoice request')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.fundingOverlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.invoiceModal} role="dialog" aria-modal="true" aria-labelledby="invoice-title">
        <div className={styles.fundingHeader}>
          <div>
            <p className={styles.fundingEyebrow}>{tr('Billing', 'Биллинг')}</p>
            <h3 className={styles.fundingTitle} id="invoice-title">
              {tr('Generate Invoice', 'Сгенерировать счет')}
            </h3>
            <p className={styles.fundingSubtitle}>
              {tr('Creates invoice request only. Ledger cash movement appears after payment confirmation.', 'Создается только запрос на счет. Движение денег в ledger будет только после подтверждения оплаты.')}
            </p>
          </div>
          <button className={styles.fundingClose} onClick={onClose} type="button" aria-label={tr('Close', 'Закрыть')}>
            ×
          </button>
        </div>

        {loading ? <div className={styles.fundingLoading}>{tr('Loading legal entities…', 'Загрузка контрагентов…')}</div> : null}

        <div className={styles.invoiceBody}>
          <label className={styles.invoiceField}>
            <span>{tr('Legal Entity', 'Контрагент')}</span>
            <select value={entityId} onChange={(event) => setEntityId(event.target.value)}>
              <option value="">{tr('Not selected', 'Не выбран')}</option>
              {entities.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.name}
                  {row.bin ? ` · ${row.bin}` : ''}
                </option>
              ))}
            </select>
          </label>

          <button className={styles.invoiceLinkButton} onClick={() => setCreateEntityOpen((prev) => !prev)} type="button">
            {createEntityOpen ? tr('Hide entity form', 'Скрыть форму контрагента') : tr('Add legal entity', 'Добавить контрагента')}
          </button>

          {createEntityOpen ? (
            <div className={styles.invoiceEntityGrid}>
              <label className={styles.invoiceField}>
                <span>{tr('Entity Name', 'Наименование')}</span>
                <input
                  onChange={(event) => setEntityForm((prev) => ({ ...prev, name: event.target.value }))}
                  type="text"
                  value={entityForm.name}
                />
              </label>
              <label className={styles.invoiceField}>
                <span>{tr('BIN/IIN', 'БИН/ИИН')}</span>
                <input
                  onChange={(event) => setEntityForm((prev) => ({ ...prev, bin: event.target.value }))}
                  type="text"
                  value={entityForm.bin}
                />
              </label>
              <label className={styles.invoiceField}>
                <span>{tr('Address', 'Адрес')}</span>
                <input
                  onChange={(event) => setEntityForm((prev) => ({ ...prev, address: event.target.value }))}
                  type="text"
                  value={entityForm.address}
                />
              </label>
              <label className={styles.invoiceField}>
                <span>{tr('Email', 'Email')}</span>
                <input
                  onChange={(event) => setEntityForm((prev) => ({ ...prev, email: event.target.value }))}
                  type="email"
                  value={entityForm.email}
                />
              </label>
              <label className={styles.invoiceField}>
                <span>{tr('Issuer Type', 'Тип эмитента')}</span>
                <select
                  onChange={(event) => {
                    const issuerType = event.target.value
                    setEntityForm((prev) => ({
                      ...prev,
                      issuer_type: issuerType,
                      tax_mode: issuerType === 'ip' ? 'without_vat' : 'with_vat',
                    }))
                  }}
                  value={entityForm.issuer_type}
                >
                  <option value="too">{tr('TOO (With VAT)', 'ТОО (с НДС)')}</option>
                  <option value="ip">{tr('IP (Without VAT)', 'ИП (без НДС)')}</option>
                </select>
              </label>
              <label className={styles.invoiceField}>
                <span>{tr('Contract Number', 'Номер договора')}</span>
                <input
                  onChange={(event) => setEntityForm((prev) => ({ ...prev, contract_number: event.target.value }))}
                  type="text"
                  value={entityForm.contract_number}
                />
              </label>
              <label className={styles.invoiceField}>
                <span>{tr('Contract Date', 'Дата договора')}</span>
                <input
                  onChange={(event) => setEntityForm((prev) => ({ ...prev, contract_date: event.target.value }))}
                  type="date"
                  value={entityForm.contract_date}
                />
              </label>
              <button className={styles.invoiceAddButton} disabled={saving} onClick={createEntity} type="button">
                {saving ? tr('Saving…', 'Сохраняем…') : tr('Save Entity', 'Сохранить контрагента')}
              </button>
            </div>
          ) : null}

          <label className={styles.invoiceField}>
            <span>{tr('Amount (KZT)', 'Сумма (KZT)')}</span>
            <input inputMode="decimal" min="0" onChange={(event) => setAmount(event.target.value)} step="1" type="number" value={amount} />
          </label>

          <label className={styles.invoiceField}>
            <span>{tr('Comment', 'Комментарий')}</span>
            <textarea onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
          </label>
        </div>

        {error ? <div className={styles.fundingError}>{error}</div> : null}

        <div className={styles.fundingFooter}>
          <button className={styles.fundingCancel} onClick={onClose} type="button">
            {tr('Cancel', 'Отмена')}
          </button>
          <button className={styles.fundingConfirm} disabled={saving} onClick={submitInvoiceRequest} type="button">
            {saving ? tr('Generating…', 'Генерация…') : tr('Generate Invoice', 'Сгенерировать счет')}
          </button>
        </div>
      </section>
    </div>
  )
}
