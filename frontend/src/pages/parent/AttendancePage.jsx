import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, StatCard } from '../../components/NurUI'
import { getParentAttendance } from '../../api/content'

const STATUS_COLOR = {
  present: 'var(--emerald)',
  absent:  'var(--rose)',
  late:    'var(--amber)',
  excused: 'var(--gray-400)',
}

export default function ParentAttendancePage() {
  const { t } = useTranslation()
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    getParentAttendance()
      .then(res => setStudents(res.data))
      .catch(() => setError('Failed to load attendance data.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const totalSessions = students.reduce((a, s) => a + s.total_sessions, 0)
  const totalPresent  = students.reduce((a, s) => {
    return a + s.history.filter(h => h.status === 'present').length
  }, 0)
  const overallPct = totalSessions > 0 ? Math.round(totalPresent / totalSessions * 100) : 0

  return (
    <div>
      <PageHeader title={t('parent.attendance.title')} subtitle={t('parent.attendance.subtitle')} />

      {loading && <div className="spinner" />}
      {error   && <div className="alert alert-error">{error}</div>}

      {!loading && !error && students.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-soft)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>No attendance records yet.</div>
        </div>
      )}

      {!loading && !error && students.length > 0 && (
        <>
          {/* Overview stats */}
          <div className="stats-row" style={{ marginBottom: 28 }}>
            <StatCard icon="users"    value={students.length}   label="Students"        tone="primary" />
            <StatCard icon="check"    value={`${overallPct}%`}  label="Overall Attendance" tone="emerald" />
            <StatCard icon="academic" value={totalSessions}     label="Total Sessions"  tone="teal" />
          </div>

          {/* Per-student cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {students.map(s => (
              <div key={s.student_id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card header */}
                <div
                  onClick={() => toggle(s.student_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, flexShrink: 0,
                  }}>
                    {s.student_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>
                      {s.student_name}
                    </div>
                    {s.grade_name && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{s.grade_name}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div style={{
                      fontSize: 22, fontWeight: 700,
                      color: s.overall_pct >= 75 ? 'var(--emerald)' : s.overall_pct >= 50 ? 'var(--amber)' : 'var(--rose)',
                    }}>
                      {s.overall_pct}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      {s.total_sessions} sessions
                    </div>
                  </div>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 18, lineHeight: 1 }}>
                    {expanded[s.student_id] ? '▲' : '▼'}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: 'var(--gray-100)', margin: '0 18px' }}>
                  <div style={{
                    height: '100%',
                    width: `${s.overall_pct}%`,
                    background: s.overall_pct >= 75 ? 'var(--emerald)' : s.overall_pct >= 50 ? 'var(--amber)' : 'var(--rose)',
                    borderRadius: 2,
                    transition: 'width 0.4s',
                  }} />
                </div>

                {/* History table (expandable) */}
                {expanded[s.student_id] && (
                  <div style={{ padding: '12px 18px 16px' }}>
                    {s.history.length === 0 ? (
                      <div style={{ color: 'var(--ink-soft)', fontSize: 13, padding: '8px 0' }}>
                        No records yet.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--gray-200)' }}>
                            {['Date', 'Subject', 'Status'].map(h => (
                              <th key={h} style={{
                                padding: '6px 10px', textAlign: 'left', fontSize: 11,
                                fontWeight: 600, color: 'var(--ink-soft)',
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.history.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                              <td style={{ padding: '7px 10px', fontSize: 13, color: 'var(--ink-soft)' }}>
                                {row.date}
                              </td>
                              <td style={{ padding: '7px 10px', fontSize: 13, color: 'var(--ink)' }}>
                                {row.subject}
                              </td>
                              <td style={{ padding: '7px 10px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 9px', borderRadius: 10,
                                  fontSize: 11, fontWeight: 600,
                                  background: `${STATUS_COLOR[row.status]}20`,
                                  color: STATUS_COLOR[row.status],
                                }}>
                                  {row.status === 'present' ? t('parent.attendance.present')
                                    : row.status === 'absent'  ? t('parent.attendance.absent')
                                    : row.status === 'late'    ? t('parent.attendance.late')
                                    : row.status === 'excused' ? t('parent.attendance.excused')
                                    : row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
