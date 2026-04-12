'use client'

import { useMemo, useState } from 'react'
import AppShell from '../../components/layout/AppShell'

const PRESETS = {
  meta: { source: 'meta', medium: 'cpc' },
  google: { source: 'google', medium: 'cpc' },
  tiktok: { source: 'tiktok', medium: 'cpc' },
  yandex: { source: 'yandex', medium: 'cpc' },
  telegram: { source: 'telegram', medium: 'cpm' },
  monochrome: { source: 'monochrome', medium: 'cpm' },
}

function nowTokens() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return {
    date: `${y}-${m}-${d}`,
    dateYmd: `${y}-${m}-${d}`,
    dateYm: `${y}-${m}`,
    time: `${hh}${mm}`,
    rand4: Math.random().toString(36).slice(2, 6),
    rand6: Math.random().toString(36).slice(2, 8),
  }
}

function replaceMacros(value, context) {
  if (!value) return ''
  const t = nowTokens()
  return String(value)
    .replaceAll('{platform}', context.platform || '')
    .replaceAll('{source}', context.source || '')
    .replaceAll('{medium}', context.medium || '')
    .replaceAll('{date}', t.date)
    .replaceAll('{date_ymd}', t.dateYmd)
    .replaceAll('{date_ym}', t.dateYm)
    .replaceAll('{time}', t.time)
    .replaceAll('{rand4}', t.rand4)
    .replaceAll('{rand6}', t.rand6)
}

function buildUrl(base, params) {
  const clean = String(base || '').trim().split('#')[0]
  const url = new URL(clean)
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v)
  })
  return url.toString()
}

function csvEscape(v) {
  return `"${String(v || '').replaceAll('"', '""')}"`
}

export default function ToolsPage() {
  const [tab, setTab] = useState('single')
  const [status, setStatus] = useState('')

  const [singlePreset, setSinglePreset] = useState('')
  const [single, setSingle] = useState({
    url: '',
    source: '',
    medium: '',
    campaign: '',
    content: '',
    term: '',
    result: '',
  })

  const [bulkPreset, setBulkPreset] = useState('')
  const [bulk, setBulk] = useState({
    urls: '',
    source: '',
    medium: '',
    campaign: '',
    content: '',
    term: '',
    result: '',
  })

  const placeholder = useMemo(
    () =>
      'Auto replacements: {platform}, {source}, {medium}, {date}, {date_ymd}, {date_ym}, {time}, {rand4}, {rand6}',
    []
  )

  function applyPreset(type, key) {
    const preset = PRESETS[key]
    if (!preset) return
    if (type === 'single') {
      setSinglePreset(key)
      setSingle((s) => ({
        ...s,
        source: preset.source,
        medium: preset.medium,
        campaign: s.campaign || '{platform}_{date_ymd}',
        content: s.content || '{platform}_{rand4}',
      }))
    } else {
      setBulkPreset(key)
      setBulk((s) => ({
        ...s,
        source: preset.source,
        medium: preset.medium,
        campaign: s.campaign || '{platform}_{date_ymd}',
        content: s.content || '{platform}_{rand4}',
      }))
    }
  }

  function buildSingle() {
    if (!single.url.trim()) {
      setStatus('Enter a base URL.')
      return
    }
    try {
      const ctx = { platform: singlePreset, source: single.source.trim(), medium: single.medium.trim() }
      const params = {
        utm_source: replaceMacros(single.source.trim(), ctx),
        utm_medium: replaceMacros(single.medium.trim(), ctx),
        utm_campaign: replaceMacros(single.campaign.trim(), ctx),
        utm_content: replaceMacros(single.content.trim(), ctx),
        utm_term: replaceMacros(single.term.trim(), ctx),
      }
      const result = buildUrl(single.url, params)
      setSingle((s) => ({ ...s, result }))
      setStatus('URL generated.')
    } catch {
      setStatus('Invalid base URL.')
    }
  }

  async function copyText(text, okMessage) {
    if (!text) {
      setStatus('Generate URLs first.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus(okMessage)
    } catch {
      setStatus('Failed to copy.')
    }
  }

  function buildBulk() {
    const lines = bulk.urls
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean)
    if (!lines.length) {
      setStatus('Add at least one URL.')
      return
    }
    const ctx = { platform: bulkPreset, source: bulk.source.trim(), medium: bulk.medium.trim() }
    const params = {
      utm_source: replaceMacros(bulk.source.trim(), ctx),
      utm_medium: replaceMacros(bulk.medium.trim(), ctx),
      utm_campaign: replaceMacros(bulk.campaign.trim(), ctx),
      utm_content: replaceMacros(bulk.content.trim(), ctx),
      utm_term: replaceMacros(bulk.term.trim(), ctx),
    }
    const out = lines.map((line) => {
      try {
        return buildUrl(line, params)
      } catch {
        return `${line}  # invalid_url`
      }
    })
    setBulk((s) => ({ ...s, result: out.join('\n') }))
    setStatus(`Generated: ${out.length}`)
  }

  function exportCsv() {
    const rows = bulk.result
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean)
    if (!rows.length) {
      setStatus('Generate URLs first.')
      return
    }
    const csvRows = ['base_url,utm_url']
    rows.forEach((line) => {
      const base = line.split('?')[0] || ''
      csvRows.push(`${csvEscape(base)},${csvEscape(line)}`)
    })
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'utm_links.csv'
    link.click()
    URL.revokeObjectURL(link.href)
    setStatus('CSV exported.')
  }

  return (
    <AppShell eyebrow="Envidicy · Tools" title="Tools" subtitle="UTM generator and future short-link tool.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Tools</p>
            <h2>UTM Generator</h2>
          </div>
          <span className="chip chip-ghost">utm</span>
        </div>

        <div className="tabs">
          <div className="tab-buttons">
            <button className={`tab-button ${tab === 'single' ? 'active' : ''}`} type="button" onClick={() => setTab('single')}>
              Single URL
            </button>
            <button className={`tab-button ${tab === 'bulk' ? 'active' : ''}`} type="button" onClick={() => setTab('bulk')}>
              Bulk
            </button>
          </div>

          {tab === 'single' ? (
            <div className="tab-panel active">
              <div className="preset-row">
                {Object.keys(PRESETS).map((k) => (
                  <button key={k} className="chip chip-ghost" type="button" onClick={() => applyPreset('single', k)}>
                    {k}
                  </button>
                ))}
              </div>
              <p className="muted small">{placeholder}</p>

              <div className="form-grid">
                <label className="field"><span>Base URL</span><input value={single.url} onChange={(e) => setSingle((s) => ({ ...s, url: e.target.value }))} type="url" placeholder="https://example.com/landing" /></label>
                <label className="field"><span>Source (utm_source)</span><input value={single.source} onChange={(e) => setSingle((s) => ({ ...s, source: e.target.value }))} type="text" placeholder="google" /></label>
                <label className="field"><span>Medium (utm_medium)</span><input value={single.medium} onChange={(e) => setSingle((s) => ({ ...s, medium: e.target.value }))} type="text" placeholder="cpc" /></label>
                <label className="field"><span>Campaign (utm_campaign)</span><input value={single.campaign} onChange={(e) => setSingle((s) => ({ ...s, campaign: e.target.value }))} type="text" placeholder="brand_launch" /></label>
                <label className="field"><span>Content (utm_content)</span><input value={single.content} onChange={(e) => setSingle((s) => ({ ...s, content: e.target.value }))} type="text" placeholder="banner_a" /></label>
                <label className="field"><span>Keyword (utm_term)</span><input value={single.term} onChange={(e) => setSingle((s) => ({ ...s, term: e.target.value }))} type="text" placeholder="buy_now" /></label>
              </div>

              <div className="panel-actions">
                <button className="btn primary" type="button" onClick={buildSingle}>Generate</button>
                <button className="btn ghost" type="button" onClick={() => copyText(single.result, 'URL copied.')}>Copy</button>
                <button className="btn ghost" type="button" onClick={() => setSingle({ url: '', source: '', medium: '', campaign: '', content: '', term: '', result: '' })}>Clear</button>
              </div>

              <label className="field">
                <span>Result</span>
                <textarea className="field-input textarea utm-result" readOnly value={single.result} />
              </label>
            </div>
          ) : (
            <div className="tab-panel active">
              <div className="preset-row">
                {Object.keys(PRESETS).map((k) => (
                  <button key={k} className="chip chip-ghost" type="button" onClick={() => applyPreset('bulk', k)}>
                    {k}
                  </button>
                ))}
              </div>
              <p className="muted small">{placeholder}</p>

              <div className="form-grid">
                <label className="field"><span>URLs (one per line)</span><textarea value={bulk.urls} onChange={(e) => setBulk((s) => ({ ...s, urls: e.target.value }))} className="field-input small textarea" placeholder={'https://site.com/one\nhttps://site.com/two'} /></label>
                <label className="field"><span>Source (utm_source)</span><input value={bulk.source} onChange={(e) => setBulk((s) => ({ ...s, source: e.target.value }))} type="text" placeholder="google" /></label>
                <label className="field"><span>Medium (utm_medium)</span><input value={bulk.medium} onChange={(e) => setBulk((s) => ({ ...s, medium: e.target.value }))} type="text" placeholder="cpc" /></label>
                <label className="field"><span>Campaign (utm_campaign)</span><input value={bulk.campaign} onChange={(e) => setBulk((s) => ({ ...s, campaign: e.target.value }))} type="text" placeholder="brand_launch" /></label>
                <label className="field"><span>Content (utm_content)</span><input value={bulk.content} onChange={(e) => setBulk((s) => ({ ...s, content: e.target.value }))} type="text" placeholder="banner_a" /></label>
                <label className="field"><span>Keyword (utm_term)</span><input value={bulk.term} onChange={(e) => setBulk((s) => ({ ...s, term: e.target.value }))} type="text" placeholder="buy_now" /></label>
              </div>

              <div className="panel-actions">
                <button className="btn primary" type="button" onClick={buildBulk}>Generate</button>
                <button className="btn ghost" type="button" onClick={() => copyText(bulk.result, 'URLs copied.')}>Copy all</button>
                <button className="btn ghost" type="button" onClick={exportCsv}>Export CSV</button>
              </div>

              <label className="field">
                <span>Result</span>
                <textarea className="field-input textarea utm-result" readOnly value={bulk.result} />
              </label>
            </div>
          )}
        </div>

        <p className="muted small">{status || 'Short-link tool will be added here soon.'}</p>
      </section>
    </AppShell>
  )
}
