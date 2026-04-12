import Link from 'next/link'
import styles from './client.module.css'

const NAV_ITEMS = [
  { key: 'overview', href: '/dashboard', label: 'Overview', icon: 'O' },
  { key: 'accounts', href: '/dashboard#accounts-overview', label: 'Accounts', icon: 'A' },
  { key: 'performance', href: '/performance', label: 'Performance', icon: 'P' },
  { key: 'finance', href: '/funds', label: 'Finance', icon: 'F' },
  { key: 'planning', href: '/plan', label: 'Planning', icon: 'P' },
  { key: 'settings', href: '/settings', label: 'Settings', icon: 'S' },
]

export default function ClientShell({
  activeNav,
  pageTitle,
  pageSubtitle,
  pageActionLabel,
  pageActionHref = '#',
  pageActionOnClick,
  headerActionLabel = 'Create Request',
  headerActionHref = '#',
  headerActionOnClick,
  searchPlaceholder = '',
  ticks = [],
  entityLabel = 'Entity Switcher',
  statusAlerts = '2 Alerts',
  statusRows = [],
  children,
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <h1 className={styles.brandTitle}>Architectural Ledger</h1>
            <p className={styles.brandSubtitle}>Elite Financial Ops</p>
          </div>

          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.navLink} ${activeNav === item.key ? styles.navLinkActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className={styles.statusRail}>
            <p className={styles.statusLabel}>Status Rail</p>
            <div className={styles.alertCard}>
              <span className={styles.alertDot} />
              <span>{statusAlerts}</span>
            </div>
            <div className={styles.statusRows}>
              {statusRows.map((row) => (
                <div className={styles.statusRow} key={row.label}>
                  <span className={styles.statusBullet}>{row.icon}</span>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
              {searchPlaceholder ? (
                <label className={styles.searchWrap}>
                  <span className={styles.searchIcon}>⌕</span>
                  <input className={styles.searchInput} placeholder={searchPlaceholder} readOnly value="" />
                </label>
              ) : null}
            </div>

            <div className={styles.topbarRight}>
              {ticks.length ? (
                <div className={styles.infoTicks}>
                  {ticks.map((tick) => (
                    <div className={styles.tick} key={tick.label}>
                      <span className={styles.tickLabel}>{tick.label}</span>
                      <strong>{tick.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={styles.entityPill}>
                <span>{entityLabel}</span>
                <span>▾</span>
              </div>
              {headerActionLabel ? (
                headerActionOnClick ? (
                  <button className={styles.topbarActionButton} onClick={headerActionOnClick} type="button">
                    {headerActionLabel}
                  </button>
                ) : (
                  <Link className={styles.topbarAction} href={headerActionHref}>
                    {headerActionLabel}
                  </Link>
                )
              ) : null}
              <div className={styles.iconRow}>
                <span className={styles.iconButton}>◦</span>
                <span className={styles.avatar}>AL</span>
              </div>
            </div>
          </header>

          <main className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <h2 className={styles.pageTitle}>{pageTitle}</h2>
                <p className={styles.pageSubtitle}>{pageSubtitle}</p>
              </div>
              {pageActionLabel ? (
                pageActionOnClick ? (
                  <button className={styles.secondaryActionButton} onClick={pageActionOnClick} type="button">
                    {pageActionLabel}
                  </button>
                ) : (
                  <Link className={styles.secondaryAction} href={pageActionHref}>
                    {pageActionLabel}
                  </Link>
                )
              ) : null}
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
