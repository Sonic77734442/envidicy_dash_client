'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { setAuth } from '../../lib/auth'
import styles from './login.module.css'

const ADMIN_EMAILS = new Set(['romant997@gmail.com', 'kolyadov.denis@gmail.com'])

const FEATURES = [
  {
    icon: 'speed',
    title: 'Real-time Financial Velocity',
    text: 'Instant reconciliation for high-volume advertising spends.',
  },
  {
    icon: 'verified_user',
    title: 'Enterprise Governance',
    text: 'Deep compliance monitoring and immutable audit logs.',
  },
  {
    icon: 'architecture',
    title: 'The Architectural Ledger',
    text: 'Structured financial operations designed for scale.',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('Enter your credentials to access your ledger.')

  const helperText = useMemo(
    () =>
      mode === 'login'
        ? 'Enter your credentials to access your ledger.'
        : 'Set a password for the invited email to activate access.',
    [mode]
  )

  async function onLoginSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '').trim()

    if (!email || !password) {
      setStatus('Fill in both email and password.')
      return
    }

    setPending(true)
    setStatus('Signing in...')
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Could not sign in')
      setAuth(data)
      setStatus('Access granted. Redirecting...')
      const nextEmail = String(data?.email || email || '').toLowerCase()
      router.push(ADMIN_EMAILS.has(nextEmail) ? '/admin/requests' : '/dashboard')
    } catch (error) {
      setStatus(error?.message || 'Could not sign in. Check your email and password.')
    } finally {
      setPending(false)
    }
  }

  async function onSetPasswordSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const next = String(form.get('new_password') || '').trim()
    const confirm = String(form.get('confirm_password') || '').trim()

    if (!email || !next) {
      setStatus('Fill in email and new password.')
      return
    }
    if (next !== confirm) {
      setStatus('Passwords do not match.')
      return
    }

    setPending(true)
    setStatus('Saving password...')
    try {
      const res = await apiFetch('/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Could not set password')
      setMode('login')
      setStatus('Password saved. You can sign in now.')
    } catch (error) {
      setStatus(error?.message || 'Could not set password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.hero}>
        <div className={styles.pattern} />
        <div className={styles.heroInner}>
          <Link className={styles.brand} href="/login">
            Envidicy
          </Link>

          <h1 className={styles.heroTitle}>Control your ad operations</h1>
          <p className={styles.heroSubtitle}>Accounts, funding, planning and reporting in one place</p>

          <div className={styles.featureList}>
            {FEATURES.map((item) => (
              <div className={styles.feature} key={item.title}>
                <span className={`material-symbols-outlined ${styles.featureIcon}`}>{item.icon}</span>
                <div>
                  <p className={styles.featureTitle}>{item.title}</p>
                  <p className={styles.featureText}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroFooter}>
          <span>Trusted by leading platforms</span>
          <div className={styles.heroLine} />
        </div>
      </aside>

      <main className={styles.side}>
        <div className={styles.panel}>
          <span className={styles.mobileBrand}>Envidicy</span>

          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{mode === 'login' ? 'Sign In' : 'Set Password'}</h2>
            <p className={styles.panelText}>{helperText}</p>
          </div>

          <div className={styles.card}>
            {mode === 'login' ? (
              <form className={styles.form} onSubmit={onLoginSubmit}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email Address</span>
                  <input className={styles.fieldInput} name="email" type="email" placeholder="name@company.com" required />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Password</span>
                  <span className={styles.fieldInputWrap}>
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      className={styles.visibilityButton}
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </span>
                </label>

                <button className={styles.submit} type="submit" disabled={pending}>
                  <span>{pending ? 'Signing In...' : 'Sign In'}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </form>
            ) : (
              <form className={styles.form} onSubmit={onSetPasswordSubmit}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email Address</span>
                  <input className={styles.fieldInput} name="email" type="email" placeholder="name@company.com" required />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>New Password</span>
                  <input className={styles.fieldInput} name="new_password" type="password" placeholder="••••••••" required />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Confirm Password</span>
                  <input className={styles.fieldInput} name="confirm_password" type="password" placeholder="••••••••" required />
                </label>

                <button className={styles.submit} type="submit" disabled={pending}>
                  <span>{pending ? 'Saving...' : 'Save Password'}</span>
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </form>
            )}
          </div>

          <div className={styles.bottomLinks}>
            <button type="button" onClick={() => setMode('set-password')}>
              <span>Set password</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <span className={styles.dot} />
            <Link href="/register">
              <span>Need access?</span>
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <p className={styles.status}>{status}</p>
        </div>
      </main>
    </div>
  )
}
