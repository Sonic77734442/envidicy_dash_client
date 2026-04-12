import PerformancePage from '../../components/client/PerformancePage'

export default function PerformanceRoute({ searchParams }) {
  const raw = searchParams?.account_id
  const initialAccountId = Array.isArray(raw) ? String(raw[0] || '') : String(raw || '')
  return <PerformancePage initialAccountId={initialAccountId} />
}
