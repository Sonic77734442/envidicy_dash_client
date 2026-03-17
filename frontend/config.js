;(function configureApiBase() {
  const host = String(window.location.hostname || '').toLowerCase()

  if (host === 'localhost' || host === '127.0.0.1') {
    window.API_BASE = 'http://127.0.0.1:8010'
    return
  }

  if (host === 'envidicydashclientv20develop.vercel.app') {
    window.API_BASE = 'https://client-dash-staging.onrender.com'
    return
  }

  window.API_BASE = 'https://envidicy-dash-client.onrender.com'
})()
