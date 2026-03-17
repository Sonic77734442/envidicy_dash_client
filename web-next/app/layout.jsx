import './globals.css'

export const metadata = {
  title: 'Envidicy Next',
  description: 'Envidicy dashboard migration to Next.js',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
