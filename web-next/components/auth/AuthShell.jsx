export default function AuthShell({ eyebrow, title, status, children, right }) {
  return (
    <div className="auth-page">
      <div className="auth-blur" />
      <div className="auth-card">
        <div className="auth-head">
          <div>
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {right ? <span className="auth-chip">{right}</span> : null}
        </div>
        {children}
        <p className="auth-status">{status}</p>
      </div>
    </div>
  )
}
