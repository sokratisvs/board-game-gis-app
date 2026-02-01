import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { AuthContext } from '../../context/Auth.context'
import PathConstants from '../../routes/pathConstants'
import { useUserStats } from '../../hooks/useUsersQueries'
import PageLayout from '../PageLayout/PageLayout'
import Section from '../ui/Section'
import Alert from '../ui/Alert'
import LoadingMessage from '../ui/LoadingMessage'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const [recentErrors, setRecentErrors] = useState<
    { id: string; message: string; source: string; at: string }[]
  >([])

  const isAdmin = user?.role === 'admin'
  const {
    data: userStats,
    isLoading: statsLoading,
    error: statsError,
  } = useUserStats(Boolean(isAdmin))

  useEffect(() => {
    if (!isAdmin) {
      navigate(PathConstants.MAP, { replace: true })
      return
    }
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const chartData = userStats
    ? [
        { type: 'User', count: userStats.user },
        { type: 'Shop', count: userStats.shop },
        { type: 'Event', count: userStats.event },
        { type: 'Admin', count: userStats.admin },
      ]
    : []

  return (
    <PageLayout
      title="Admin Dashboard"
      description="Overview of users, errors and client requests."
    >
      <Section id="errors-heading" title="Recent errors & client requests">
        {recentErrors.length === 0 ? (
          <p className="text-sm text-slate-500 m-0">
            No recent errors or client requests.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {recentErrors.map((e) => (
              <li
                key={e.id}
                className="px-3 py-2 rounded bg-red-50 text-red-800 text-sm"
              >
                <span className="font-medium">{e.source}</span>: {e.message}{' '}
                <span className="text-slate-500">{e.at}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="users-chart-heading" title="Users by type">
        {statsError && <Alert>{(statsError as Error).message}</Alert>}
        {statsLoading ? (
          <LoadingMessage>Loading…</LoadingMessage>
        ) : chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#2563eb"
                  name="Count"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Section>

      <Section id="events-heading" title="Upcoming events">
        <p className="text-sm text-slate-500 m-0">
          Event data can be wired here when an events API is available.
        </p>
      </Section>

      <Section id="games-heading" title="Popular games">
        <p className="text-sm text-slate-500 m-0">
          Popular games can be wired here from board games config data.
        </p>
      </Section>
    </PageLayout>
  )
}
