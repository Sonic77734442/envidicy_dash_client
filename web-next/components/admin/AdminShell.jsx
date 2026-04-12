'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { clearAuth, getAuthEmail, getAuthToken } from '../../lib/auth'
import styles from './admin.module.css'

const NAV_ITEMS = [
  { key: 'requests', href: '/admin/requests', label: 'Requests', icon: 'R' },
  { key: 'clients', href: '/admin/clients', label: 'Clients', icon: 'C' },
  { key: 'topups', href: '/admin/topups', label: 'Topups', icon: 'T' },
  { key: 'wallet', href: '/admin/wallet', label: 'Wallet', icon: 'W' },
  { key: 'users', href: '/admin/users', label: 'Users', icon: 'U' },
  { key: 'agencies', href: '/admin/agencies', label: 'Agencies', icon: 'G' },
  { key: 'company', href: '/admin/company', label: 'Company', icon: 'Co' },
  { key: 'entities', href: '/admin/legal-entities', label: 'Entities', icon: 'E' },
]

export default function AdminShell({ title, subtitle, actionLabel, actionOnClick, children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [profileName, setProfileName] = useState('Admin')
  const [profileEmail, setProfileEmail] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const token = getAuthToken()
      const email = getAuthEmail()
      if (email) setProfileEmail(email)
      if (!token) return
      try {
        const res = await apiFetch('/profile', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        setProfileName(data.name || data.company || 'Admin')
        setProfileEmail(data.email || email || '')
      } catch {
        // ignore
      }
    }

    loadProfile()
  }, [])

  const activeKey = useMemo(() => {
    const item = NAV_ITEMS.find((entry) => pathname === entry.href)
    return item?.key || ''
  }, [pathname])

  function logout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div>
            <h1 className={styles.brandTitle}>Architectural Ledger</h1>
            <p className={styles.brandSubtitle}>Admin Control</p>
          </div>

          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.navLink} ${activeKey === item.key ? styles.navLinkActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className={styles.sideCard}>
            <p className={styles.sideCardLabel}>Admin Logic</p>
            <p className={styles.sideCardValue}>Finance + Requests</p>
            <p className={styles.sideCardText}>
              Wallet, funding, account requests and client operations should stay aligned with the new backend model.
            </p>
          </div>

          <div className={styles.sidebarFooter}>
            <button className={styles.logoutButton} type="button" onClick={logout}>
              Log out
            </button>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.topbarMeta}>
              <div>
                <div className={styles.topbarEyebrow}>Envidicy Admin</div>
                <div className={styles.topbarTitle}>Operations Backoffice</div>
              </div>
            </div>
            <div className={styles.profileBadge}>
              <span className={styles.avatar}>{(profileEmail || 'A').slice(0, 1).toUpperCase()}</span>
              <span>{profileName}</span>
            </div>
          </header>

          <main className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <h2 className={styles.pageTitle}>{title}</h2>
                <p className={styles.pageSubtitle}>{subtitle}</p>
              </div>
              {actionLabel ? (
                <button className={styles.headerAction} type="button" onClick={actionOnClick}>
                  {actionLabel}
                </button>
              ) : null}
            </div>
            <div className={styles.grid}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
