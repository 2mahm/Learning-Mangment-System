import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, StatCard, useToast } from '../../components/NurUI'
import {
  getSubjectGroups,
  getGroupStudents,
  getAttendance,
  saveAttendance,
  getAttendanceSummary,
} from '../../api/content'


function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function AttendancePage() {
  const toast  = useToast()
  const { t }  = useTranslation()

  const STATUS_OPTIONS = [
    { value: 'present', label: t('teacher.attendance.present'), color: 'var(--emerald)' },
    { value: 'late',    label: t('teacher.attendance.late'),    color: 'var(--amber)'   },
    { value: 'absent',  label: t('teacher.attendance.absent'),  color: 'var(--rose)'    },
    { value: 'excused', label: t('teacher.attendance.excused'), color: 'var(--gray-400)' },
  ]

  const [groups,   setGroups]   = useState([])
  const [groupId,  setGroupId]  = useState('')
  const [date,     setDate]     = useState(todayISO())
  const [students, setStudents] = useState([])
  const [records,  setRecords]  = useState({})   // { studentId: status }
  const [notes,    setNotes]    = useState({})    // { studentId: noteText }
  const [summary,  setSummary]  = useState([])
  const [tab,      setTab]      = useState('take') // 'take' | 'summary'
  const [saving,   setSaving]   = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Load teacher's subject groups on mount
  useEffect(() => {
    getSubjectGroups()
      .then(res => {
        setGroups(res.data)
        if (res.data.length > 0) setGroupId(res.data[0].id)
      })
      .catch(() => {})
  }, [])

  // Load students + existing attendance records when group or date changes
  useEffect(() => {
    if (!groupId) return
    setLoadingStudents(true)

    Promise.all([
      getGroupStudents(groupId),
      getAttendance(groupId, date),
    ])
      .then(([studRes, attRes]) => {
        const studs = studRes.data
        setStudents(studs)

        // Build a map of existing records for this date
        const existingMap = {}
        const existingNotes = {}
        attRes.data.forEach(r => {
          existingMap[r.student_id]  = r.status
          existingNotes[r.student_id] = r.notes || ''
        })

        // Default all students to 'present' if no record exists
        const defaultMap = {}
        const defaultNotes = {}
        studs.forEach(s => {
          defaultMap[s.id]  = existingMap[s.id]  || 'present'
          defaultNotes[s.id] = existingNotes[s.id] || ''
        })
        setRecords(defaultMap)
        setNotes(defaultNotes)
      })
      .catch(() => toast.error('Failed to load attendance data.'))
      .finally(() => setLoadingStudents(false))
  }, [groupId, date]) // eslint-disable-line

  // Load summary when switching to summary tab
  useEffect(() => {
    if (tab !== 'summary' || !groupId) return
    getAttendanceSummary(groupId)
      .then(res => setSummary(res.data))
      .catch(() => toast.error('Failed to load summary.'))
  }, [tab, groupId]) // eslint-disable-line

  function handleSave() {
    if (!groupId || students.length === 0) return
    setSaving(true)
    const payload = students.map(s => ({
      student_id: s.id,
      status:     records[s.id] || 'present',
      notes:      notes[s.id]   || '',
    }))
    saveAttendance(groupId, date, payload)
      .then(() => toast.success('Attendance saved.'))
      .catch(() => toast.error('Failed to save attendance.'))
      .finally(() => setSaving(false))
  }

  const selectedGroup = groups.find(g => g.id === groupId)

  // Summary stats
  const totalPresentAll  = summary.reduce((a, s) => a + s.present_count, 0)
  const totalSessionsAll = summary.reduce((a, s) => a + s.total_sessions, 0)
  const classAvgPct      = totalSessionsAll > 0
    ? Math.round(totalPresentAll / totalSessionsAll * 100)
    : 0

  return (
    <div>
      <PageHeader
        title={t('teacher.attendance.title')}
        subtitle={t('teacher.attendance.subtitle')}
      />

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--gray-200)',
            fontSize: 14, color: 'var(--ink)', background: '#fff', minWidth: 200,
          }}
        >
          {groups.length === 0 && <option value="">No subject groups</option>}
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--gray-200)',
            fontSize: 14, color: 'var(--ink)', background: '#fff',
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--gray-200)' }}>
        {[['take', 'Take Attendance'], ['summary', 'Summary']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === key ? 'var(--primary)' : 'var(--ink-soft)',
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Take Attendance Tab */}
      {tab === 'take' && (
        <>
          {loadingStudents && <div className="spinner" />}

          {!loadingStudents && students.length === 0 && groupId && (
            <div style={{ color: 'var(--ink-soft)', padding: '24px 0', textAlign: 'center' }}>
              No students assigned to this group yet.
            </div>
          )}

          {!loadingStudents && students.length > 0 && (
            <>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
                {students.length} students · {selectedGroup?.title} · {date}
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {students.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      borderBottom: idx < students.length - 1 ? '1px solid var(--gray-100)' : 'none',
                      background: records[s.id] === 'absent' ? '#fff5f5'
                        : records[s.id] === 'late' ? '#fffbf0' : '#fff',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--primary-light)', color: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{s.name}</div>
                      {s.grade_name && (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{s.grade_name}</div>
                      )}
                    </div>

                    {/* Status buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setRecords(prev => ({ ...prev, [s.id]: opt.value }))}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            border: `1px solid ${records[s.id] === opt.value ? opt.color : 'var(--gray-200)'}`,
                            background: records[s.id] === opt.value ? opt.color : 'transparent',
                            color: records[s.id] === opt.value ? '#fff' : 'var(--ink-soft)',
                            cursor: 'pointer',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('teacher.attendance.saving') : t('teacher.attendance.saveAttendance')}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Summary Tab */}
      {tab === 'summary' && (
        <>
          {summary.length > 0 && (
            <div className="stats-row" style={{ marginBottom: 24 }}>
              <StatCard icon="users"    value={summary.length}   label="Students"       tone="primary" />
              <StatCard icon="check"    value={`${classAvgPct}%`} label="Class Avg Attendance" tone="emerald" />
              <StatCard icon="academic" value={totalSessionsAll > 0 ? Math.round(totalSessionsAll / summary.length) : 0}
                        label="Avg Sessions / Student" tone="teal" />
            </div>
          )}

          {summary.length === 0 ? (
            <div style={{ color: 'var(--ink-soft)', padding: '24px 0', textAlign: 'center' }}>
              No attendance records yet for this group.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Student', 'Present', 'Late', 'Absent', 'Excused', 'Total', '% Present'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12,
                        fontWeight: 600, color: 'var(--ink-soft)', borderBottom: '1px solid var(--gray-200)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={s.student_id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--gray-50)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                        {s.student_name}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--emerald)' }}>
                        {s.present_count}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--amber)' }}>
                        {s.late_count}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--rose)' }}>
                        {s.absent_count}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--gray-400)' }}>
                        {s.excused_count}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-soft)' }}>
                        {s.total_sessions}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1, height: 6, borderRadius: 3, background: 'var(--gray-100)',
                            maxWidth: 80,
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${s.percentage}%`,
                              background: s.percentage >= 75 ? 'var(--emerald)' : s.percentage >= 50 ? 'var(--amber)' : 'var(--rose)',
                            }} />
                          </div>
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: s.percentage >= 75 ? 'var(--emerald)' : s.percentage >= 50 ? 'var(--amber)' : 'var(--rose)',
                          }}>
                            {s.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
