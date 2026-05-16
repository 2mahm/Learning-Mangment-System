import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import {
  createLesson,
  deleteBookFile,
  deleteLesson,
  getBookFiles,
  getGrades,
  getGroupStudents,
  getLessons,
  getSubjectGroups,
  reorderLessons,
  updateLesson,
  uploadBookFile,
} from '../../api/content'

const TRACK_COLORS = {
  arabic:  { background: 'var(--primary-light)', color: 'var(--primary-dark)' },
  quran:   { background: 'var(--success-light)', color: '#065f46' },
  culture: { background: '#ede9fe',              color: '#5b21b6' },
}

const FILE_TYPE_OPTS = [
  { value: 'pdf',   label: 'PDF' },
  { value: 'doc',   label: 'Word Document' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
  { value: 'other', label: 'Other' },
]

function StudentDropdown({ students, selectedIds, onChange }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const label = selectedIds.length === 0
    ? 'Select students...'
    : `${selectedIds.length} student${selectedIds.length > 1 ? 's' : ''} selected`

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 180 }}>
      <button
        type="button"
        className="form-control"
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: selectedIds.length === 0 ? 'var(--gray-400)' : 'inherit',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <span>{label}</span>
        <span style={{ fontSize: 10, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', maxHeight: 260,
        }}>
          <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid var(--gray-100)' }}>
            <input
              autoFocus
              className="form-control"
              placeholder="Search student name..."
              style={{ fontSize: 12 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gray-400)' }}>
                No students found.
              </div>
            ) : filtered.map(s => (
              <label
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  background: selectedIds.includes(s.id) ? 'var(--primary-light)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={e => onChange(
                    e.target.checked
                      ? [...selectedIds, s.id]
                      : selectedIds.filter(id => id !== s.id)
                  )}
                />
                <span style={{ flex: 1 }}>{s.name}</span>
                {s.grade_name && (
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.grade_name}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SubjectGroupDetail() {
  const { groupId } = useParams()
  const navigate    = useNavigate()
  const { t }       = useTranslation()

  const [group,    setGroup]    = useState(null)
  const [lessons,  setLessons]  = useState([])
  const [files,    setFiles]    = useState([])
  const [tab,      setTab]      = useState('lessons')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Grade objects: [{ id, name, center, center_name }]
  const [availableGrades, setAvailableGrades] = useState([])
  // Students in this group's centers: [{ id, name, grade }]
  const [groupStudents, setGroupStudents] = useState([])

  // lesson create form
  const [showLessonForm, setShowLessonForm]   = useState(false)
  const [lessonTitle,    setLessonTitle]       = useState('')
  const [lessonGrades,   setLessonGrades]      = useState([])   // grade IDs
  const [lessonStudents, setLessonStudents]    = useState([])   // student IDs
  const [creatingLesson, setCreatingLesson]    = useState(false)

  // per-lesson grade/student editing
  const [editingGradesId,   setEditingGradesId]   = useState(null)
  const [editingGradesVal,  setEditingGradesVal]  = useState([])   // grade IDs
  const [editingStudentsId, setEditingStudentsId] = useState(null)
  const [editingStudentsVal,setEditingStudentsVal]= useState([])   // student IDs

  // student grade filter
  const [createGradeFilter, setCreateGradeFilter] = useState('')
  const [editGradeFilter,   setEditGradeFilter]   = useState('')

  // file upload
  const [fileTitle,  setFileTitle]  = useState('')
  const [fileType,   setFileType]   = useState('pdf')
  const [fileObj,    setFileObj]    = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const fileInputRef = useRef(null)

  const loadAll = async () => {
    try {
      const [groupsRes, lessonsRes, filesRes] = await Promise.all([
        getSubjectGroups(),
        getLessons(groupId),
        getBookFiles(groupId),
      ])
      const found = groupsRes.data.find(g => g.id === groupId)
      setGroup(found || null)
      setLessons(lessonsRes.data)
      setFiles(filesRes.data)
    } catch {
      setError('Failed to load content.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [groupId])

  useEffect(() => {
    getGrades().then(res => setAvailableGrades(res.data)).catch(() => {})
    getGroupStudents(groupId).then(res => setGroupStudents(res.data)).catch(() => {})
  }, [groupId])

  // ── Lessons ───────────────────────────────────────────────────────────────

  const handleCreateLesson = async (e) => {
    e.preventDefault()
    if (!lessonTitle.trim()) return
    setCreatingLesson(true)
    try {
      await createLesson(groupId, {
        title: lessonTitle,
        target_grades: lessonGrades,
        assigned_students: lessonStudents,
      })
      setLessonTitle('')
      setLessonGrades([])
      setLessonStudents([])
      setCreateGradeFilter('')
      setShowLessonForm(false)
      const res = await getLessons(groupId)
      setLessons(res.data)
    } catch {
      setError('Failed to create lesson.')
    } finally {
      setCreatingLesson(false)
    }
  }

  const handleSaveLessonGrades = async (lessonId) => {
    try {
      await updateLesson(lessonId, { target_grades: editingGradesVal })
      setLessons(ls => ls.map(l =>
        l.id === lessonId
          ? { ...l, target_grade_details: availableGrades.filter(g => editingGradesVal.includes(g.id)) }
          : l
      ))
      setEditingGradesId(null)
    } catch {
      setError('Failed to update lesson grades.')
    }
  }

  const handleSaveLessonStudents = async (lessonId) => {
    try {
      await updateLesson(lessonId, { assigned_students: editingStudentsVal })
      setLessons(ls => ls.map(l =>
        l.id === lessonId
          ? { ...l, assigned_student_names: groupStudents.filter(s => editingStudentsVal.includes(s.id)).map(s => ({ id: s.id, name: s.name })) }
          : l
      ))
      setEditingStudentsId(null)
    } catch {
      setError('Failed to update lesson students.')
    }
  }

  const handleTogglePublish = async (lesson) => {
    try {
      await updateLesson(lesson.id, { published: !lesson.published })
      setLessons(ls => ls.map(l => l.id === lesson.id ? { ...l, published: !l.published } : l))
    } catch {
      setError('Failed to update lesson.')
    }
  }

  const handleDeleteLesson = async (id) => {
    if (!window.confirm('Delete this lesson and all its sections?')) return
    try {
      await deleteLesson(id)
      setLessons(ls => ls.filter(l => l.id !== id))
    } catch {
      setError('Failed to delete lesson.')
    }
  }

  const handleMoveLesson = async (lesson, direction) => {
    const idx  = lessons.findIndex(l => l.id === lesson.id)
    const next = direction === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= lessons.length) return
    const reordered = [...lessons]
    ;[reordered[idx], reordered[next]] = [reordered[next], reordered[idx]]
    setLessons(reordered)
    try {
      await reorderLessons(groupId, reordered.map(l => l.id))
    } catch {
      setError('Reorder failed.')
      loadAll()
    }
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!fileTitle.trim() || !fileObj) return
    const fd = new FormData()
    fd.append('title', fileTitle)
    fd.append('file_type', fileType)
    fd.append('file', fileObj)
    setUploading(true)
    try {
      await uploadBookFile(groupId, fd)
      setFileTitle('')
      setFileType('pdf')
      setFileObj(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      const res = await getBookFiles(groupId)
      setFiles(res.data)
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (id) => {
    if (!window.confirm('Delete this file?')) return
    try {
      await deleteBookFile(id)
      setFiles(fs => fs.filter(f => f.id !== id))
    } catch {
      setError('Failed to delete file.')
    }
  }

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', padding: 80 }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    </Layout>
  )

  return (
    <Layout>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => navigate('/teacher/subject-groups')}
          style={{ marginBottom: 12 }}
        >
          ← {t('teacher.subjectGroupDetail.back')}
        </button>

        {group && (
          <div className="flex-between">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 className="page-title" style={{ margin: 0 }}>{group.title}</h1>
                <span className="badge" style={TRACK_COLORS[group.subject_track]}>
                  {group.subject_track}
                </span>
              </div>
              {group.description && (
                <p className="page-subtitle">{group.description}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Tabs */}
      <div className="card">
        <div className="tabs" style={{ padding: '0 24px' }}>
          <button className={`tab${tab === 'lessons' ? ' active' : ''}`} onClick={() => setTab('lessons')}>
            {t('teacher.subjectGroupDetail.lessons')} ({lessons.length})
          </button>
          <button className={`tab${tab === 'files' ? ' active' : ''}`} onClick={() => setTab('files')}>
            {t('teacher.subjectGroupDetail.files')} ({files.length})
          </button>
        </div>

        {/* ── LESSONS TAB ── */}
        {tab === 'lessons' && (
          <div className="card-body">
            <div className="flex-between mb-16">
              <p className="text-sm text-muted">
                Drag or use arrows to reorder. Only published lessons are visible to students.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowLessonForm(s => !s)}>
                {showLessonForm ? t('common.cancel') : `+ ${t('teacher.subjectGroupDetail.addLesson')}`}
              </button>
            </div>

            {showLessonForm && (
              <form onSubmit={handleCreateLesson} style={{ marginBottom: 20, padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    className="form-control"
                    placeholder="Lesson title"
                    value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    required
                    autoFocus
                  />
                  <button type="submit" className="btn btn-success" disabled={creatingLesson}>
                    {creatingLesson ? <span className="spinner" /> : 'Create'}
                  </button>
                </div>

                {availableGrades.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
                      Target grades (optional — blank = all students):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                      {availableGrades.map(grade => (
                        <label key={grade.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={lessonGrades.includes(grade.id)}
                            onChange={e => setLessonGrades(gs =>
                              e.target.checked ? [...gs, grade.id] : gs.filter(id => id !== grade.id)
                            )}
                          />
                          {grade.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {groupStudents.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
                      Also assign to specific students (overrides grade restriction):
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="form-control"
                        style={{ maxWidth: 180, fontSize: 13, flexShrink: 0 }}
                        value={createGradeFilter}
                        onChange={e => setCreateGradeFilter(e.target.value)}
                      >
                        <option value="">All grades</option>
                        {availableGrades.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <StudentDropdown
                        students={groupStudents.filter(s => !createGradeFilter || s.grade_id === Number(createGradeFilter))}
                        selectedIds={lessonStudents}
                        onChange={setLessonStudents}
                      />
                    </div>
                  </div>
                )}
              </form>
            )}

            {lessons.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <p className="empty-state-text">No lessons yet. Add your first lesson above.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lessons.map((lesson, idx) => (
                  <div key={lesson.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', background: 'var(--gray-50)',
                    borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)',
                  }}>
                    {/* Reorder arrows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => handleMoveLesson(lesson, 'up')}
                        disabled={idx === 0}
                      >▲</button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => handleMoveLesson(lesson, 'down')}
                        disabled={idx === lessons.length - 1}
                      >▼</button>
                    </div>

                    <span style={{ fontSize: 13, color: 'var(--gray-400)', minWidth: 20, paddingTop: 2 }}>
                      {idx + 1}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{lesson.title}</span>

                      {/* Grade display / editor */}
                      {editingGradesId === lesson.id ? (
                        <div style={{ marginTop: 8 }}>
                          <p style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>
                            Target grades (blank = all):
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 8 }}>
                            {availableGrades.map(grade => (
                              <label key={grade.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                                <input
                                  type="checkbox"
                                  checked={editingGradesVal.includes(grade.id)}
                                  onChange={e => setEditingGradesVal(gs =>
                                    e.target.checked ? [...gs, grade.id] : gs.filter(id => id !== grade.id)
                                  )}
                                />
                                {grade.name}
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleSaveLessonGrades(lesson.id)}>{t('common.save')}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingGradesId(null)}>{t('common.cancel')}</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gray-500)' }}>
                          🎓 {lesson.target_grade_details?.length > 0
                            ? lesson.target_grade_details.map(g => g.name).join(', ')
                            : 'All grades'}
                        </div>
                      )}

                      {/* Student assignment display / editor */}
                      {editingStudentsId === lesson.id ? (
                        <div style={{ marginTop: 8 }}>
                          <p style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>
                            Assign to specific students (overrides grade restriction):
                          </p>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <select
                              className="form-control"
                              style={{ maxWidth: 160, fontSize: 12, flexShrink: 0 }}
                              value={editGradeFilter}
                              onChange={e => setEditGradeFilter(e.target.value)}
                            >
                              <option value="">All grades</option>
                              {availableGrades.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                            <StudentDropdown
                              students={groupStudents.filter(s => !editGradeFilter || s.grade_id === Number(editGradeFilter))}
                              selectedIds={editingStudentsVal}
                              onChange={setEditingStudentsVal}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleSaveLessonStudents(lesson.id)}>{t('common.save')}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingStudentsId(null)}>{t('common.cancel')}</button>
                          </div>
                        </div>
                      ) : (
                        lesson.assigned_student_names?.length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gray-500)' }}>
                            👤 {lesson.assigned_student_names.map(s => s.name).join(', ')}
                          </div>
                        )
                      )}
                    </div>

                    {/* Grade edit button */}
                    {availableGrades.length > 0 && editingGradesId !== lesson.id && editingStudentsId !== lesson.id && (
                      <button
                        className="btn btn-outline btn-sm"
                        title="Set target grades"
                        onClick={() => {
                          setEditingGradesId(lesson.id)
                          setEditingGradesVal((lesson.target_grade_details || []).map(g => g.id))
                          setEditingStudentsId(null)
                        }}
                      >
                        🎓
                      </button>
                    )}

                    {/* Student assignment button */}
                    {groupStudents.length > 0 && editingStudentsId !== lesson.id && editingGradesId !== lesson.id && (
                      <button
                        className="btn btn-outline btn-sm"
                        title="Assign to specific students"
                        onClick={() => {
                          setEditingStudentsId(lesson.id)
                          setEditingStudentsVal((lesson.assigned_student_names || []).map(s => s.id))
                          setEditGradeFilter('')
                          setEditingGradesId(null)
                        }}
                      >
                        👤
                      </button>
                    )}

                    <span
                      className={`badge ${lesson.published ? 'badge-approved' : 'badge-pending'}`}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => handleTogglePublish(lesson)}
                      title="Click to toggle publish status"
                    >
                      {lesson.published ? t('teacher.subjectGroupDetail.publishLesson') : 'Draft'}
                    </span>

                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => navigate(`/teacher/lessons/${lesson.id}/edit`)}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)', flexShrink: 0 }}
                      onClick={() => handleDeleteLesson(lesson.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FILES TAB ── */}
        {tab === 'files' && (
          <div className="card-body">
            {/* Upload form */}
            <form onSubmit={handleUpload} style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--gray-700)' }}>
                Upload a file
              </h4>
              <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">File title *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Chapter 1 PDF"
                    value={fileTitle}
                    onChange={e => setFileTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">File type</label>
                  <select
                    className="form-control"
                    value={fileType}
                    onChange={e => setFileType(e.target.value)}
                  >
                    {FILE_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="form-control"
                  onChange={e => setFileObj(e.target.files[0] || null)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? <><span className="spinner" /> {t('common.loading')}</> : t('teacher.subjectGroupDetail.uploadFile')}
              </button>
            </form>

            {/* Files list */}
            {files.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📎</div>
                <p className="empty-state-text">No files uploaded yet.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Uploaded</th>
                      <th>Download</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 600 }}>{f.title}</td>
                        <td><span className="badge badge-used">{f.file_type}</span></td>
                        <td className="text-muted text-sm">
                          {new Date(f.uploaded_at).toLocaleDateString()}
                        </td>
                        <td>
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            Download
                          </a>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => handleDeleteFile(f.id)}
                          >
                            {t('common.delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
