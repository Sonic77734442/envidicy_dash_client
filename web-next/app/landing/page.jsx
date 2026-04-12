'use client'

import { useState } from 'react'

export default function LandingPage() {
  const [magnetStatus, setMagnetStatus] = useState('')
  const [ctaStatus, setCtaStatus] = useState('')

  return (
    <div className="auth-page" style={{ padding: '24px' }}>
      <div className="auth-blur" />
      <main className="panel" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Digital Launch Lab</p>
            <h2>We launch traffic that sells courses, webinars, and memberships</h2>
            <p className="muted">Landing page migrated to Next.js. Primary product entry: /login</p>
          </div>
          <a className="btn primary" href="/login">Open workspace</a>
        </div>

        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <article className="panel">
            <p className="eyebrow">01 · Audit</p>
            <h3>Hook audience attention in the first 3 seconds</h3>
            <p className="muted">CustDev, objections map, and content scenarios.</p>
          </article>
          <article className="panel">
            <p className="eyebrow">02 · Launch</p>
            <h3>Intensive testing week</h3>
            <p className="muted">10-15 creative + offer + landing combinations.</p>
          </article>
          <article className="panel">
            <p className="eyebrow">03 · Scale</p>
            <h3>Stable leads and sales</h3>
            <p className="muted">Scale only ROI-positive channels.</p>
          </article>
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <label className="field">
            <span>Email for media kit</span>
            <input type="email" placeholder="you@example.com" />
          </label>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setMagnetStatus('Done! We will send the PDF and checklist in a few minutes.')}
          >
            Get media kit
          </button>
        </div>
        <p className="muted small">{magnetStatus}</p>

        <div className="form-grid" style={{ marginTop: 8 }}>
          <label className="field">
            <span>Contact</span>
            <input type="text" placeholder="Telegram / WhatsApp" />
          </label>
          <button
            className="btn primary"
            type="button"
            onClick={() => setCtaStatus('Request received. We will contact you in messenger within 15 minutes.')}
          >
            Book strategy call
          </button>
        </div>
        <p className="muted small">{ctaStatus}</p>
      </main>
    </div>
  )
}
