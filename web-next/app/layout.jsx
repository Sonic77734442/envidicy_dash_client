import './globals.css'
import { I18nProvider } from '../lib/i18n/client'

export const metadata = {
  title: 'Envidicy Next',
  description: 'Envidicy dashboard migration to Next.js',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  )
}
