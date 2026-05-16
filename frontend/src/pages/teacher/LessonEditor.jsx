import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'

// Extend Image to persist a width attribute (stored as inline style)
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '300px',
        renderHTML: ({ width }) => width ? { style: `width: ${width}` } : {},
        parseHTML: el => el.style.width || '300px',
      },
    }
  },
})

const IMAGE_SIZES = [['S', '160px'], ['M', '300px'], ['L', '480px'], ['↔', '100%']]

function Divider() {
  return <span style={{ width: 1, background: 'var(--gray-200)', margin: '0 4px', alignSelf: 'stretch' }} />
}
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExerciseBuilder from './ExerciseBuilder'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createSection,
  deleteSection,
  getLessonDetail,
  reorderChildSections,
  reorderSections,
  updateLesson,
  updateSection,
  uploadSectionMedia,
} from '../../api/content'
import { getSurahs } from '../../api/quran'

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICON  = { title: 'T', content: '¶', exercise: '?', quran_display: '☪' }
const TYPE_LABEL = { title: 'Title', content: 'Content', exercise: 'Exercise', quran_display: 'Quran Block' }

// ── Rich text editor (TipTap) ─────────────────────────────────────────────────

function ContentEditor({ section, onSave }) {
  const { t }         = useTranslation()
  const [title,       setTitle]       = useState(section.title || '')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [direction,   setDirection]   = useState(section.content_body?.direction || 'ltr')
  const imageInputRef = useRef(null)
  const colorInputRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      ResizableImage.configure({ inline: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: section.content_body?.html || '',
  })

  const handleSetLink = () => {
    if (editor?.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('Enter URL:')
    if (url) editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
  }

  const handleSave = async () => {
    if (!editor) return
    setSaving(true)
    try {
      await onSave(section.id, {
        title,
        content_body: { html: editor.getHTML(), direction },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleImagePicked = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await uploadSectionMedia(form)
      editor.chain().focus().setImage({ src: res.data.url }).run()
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''   // allow re-selecting the same file
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Section title</label>
        <input
          className="form-control"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Section heading"
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <label className="form-label">Content</label>
        <div className="tiptap-wrapper">
          <div className="tiptap-toolbar">

            {/* Undo / Redo */}
            <button type="button" className="tiptap-btn" title="Undo" onClick={() => editor?.chain().focus().undo().run()}>↩</button>
            <button type="button" className="tiptap-btn" title="Redo" onClick={() => editor?.chain().focus().redo().run()}>↪</button>

            <Divider />

            {/* Inline formatting */}
            <button type="button" className={`tiptap-btn${editor?.isActive('bold')      ? ' active' : ''}`} title="Bold"          onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></button>
            <button type="button" className={`tiptap-btn${editor?.isActive('italic')    ? ' active' : ''}`} title="Italic"        onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></button>
            <button type="button" className={`tiptap-btn${editor?.isActive('underline') ? ' active' : ''}`} title="Underline"     onClick={() => editor?.chain().focus().toggleUnderline().run()}><u>U</u></button>
            <button type="button" className={`tiptap-btn${editor?.isActive('strike')    ? ' active' : ''}`} title="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()}><s>S</s></button>

            <Divider />

            {/* Headings */}
            <button type="button" className={`tiptap-btn${editor?.isActive('heading', { level: 2 }) ? ' active' : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button type="button" className={`tiptap-btn${editor?.isActive('heading', { level: 3 }) ? ' active' : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>

            <Divider />

            {/* Lists */}
            <button type="button" className={`tiptap-btn${editor?.isActive('bulletList')  ? ' active' : ''}`} title="Bullet list"   onClick={() => editor?.chain().focus().toggleBulletList().run()}>• List</button>
            <button type="button" className={`tiptap-btn${editor?.isActive('orderedList') ? ' active' : ''}`} title="Ordered list"  onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. List</button>

            <Divider />

            {/* Alignment */}
            <button type="button" className={`tiptap-btn${editor?.isActive({ textAlign: 'left' })    ? ' active' : ''}`} title="Align left"    onClick={() => editor?.chain().focus().setTextAlign('left').run()}>«</button>
            <button type="button" className={`tiptap-btn${editor?.isActive({ textAlign: 'center' })  ? ' active' : ''}`} title="Align center"  onClick={() => editor?.chain().focus().setTextAlign('center').run()}>⊙</button>
            <button type="button" className={`tiptap-btn${editor?.isActive({ textAlign: 'right' })   ? ' active' : ''}`} title="Align right"   onClick={() => editor?.chain().focus().setTextAlign('right').run()}>»</button>
            <button type="button" className={`tiptap-btn${editor?.isActive({ textAlign: 'justify' }) ? ' active' : ''}`} title="Justify"       onClick={() => editor?.chain().focus().setTextAlign('justify').run()}>≡</button>

            <Divider />

            {/* Block formatting */}
            <button type="button" className={`tiptap-btn${editor?.isActive('blockquote') ? ' active' : ''}`} title="Blockquote" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>"</button>
            <button type="button" className={`tiptap-btn${editor?.isActive('code')       ? ' active' : ''}`} title="Inline code" onClick={() => editor?.chain().focus().toggleCode().run()}>&lt;/&gt;</button>
            <button type="button" className="tiptap-btn" title="Horizontal rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>―</button>

            <Divider />

            {/* Color & Highlight */}
            <button
              type="button"
              className="tiptap-btn"
              title="Text color"
              onClick={() => colorInputRef.current?.click()}
            >
              <span style={{ borderBottom: `3px solid ${editor?.getAttributes('textStyle').color || '#000'}`, paddingBottom: 1 }}>A</span>
            </button>
            <input
              ref={colorInputRef}
              type="color"
              style={{ display: 'none' }}
              onInput={e => editor?.chain().focus().setColor(e.target.value).run()}
            />
            <button
              type="button"
              className={`tiptap-btn${editor?.isActive('highlight') ? ' active' : ''}`}
              title="Highlight"
              onClick={() => editor?.chain().focus().toggleHighlight().run()}
            >
              ▓
            </button>

            <Divider />

            {/* Link */}
            <button
              type="button"
              className={`tiptap-btn${editor?.isActive('link') ? ' active' : ''}`}
              title={editor?.isActive('link') ? 'Remove link' : 'Insert link'}
              onClick={handleSetLink}
            >
              🔗
            </button>

            <Divider />

            {/* Image upload */}
            <button
              type="button"
              className="tiptap-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              title="Insert image"
            >
              {uploading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🖼'}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleImagePicked}
            />

            {/* Image size presets — active only when an image node is selected */}
            {IMAGE_SIZES.map(([label, width]) => (
              <button
                key={label}
                type="button"
                className={`tiptap-btn${editor?.isActive('image') && editor?.getAttributes('image').width === width ? ' active' : ''}`}
                onClick={() => editor?.chain().focus().updateAttributes('image', { width }).run()}
                disabled={!editor?.isActive('image')}
                title={`Image width: ${width}`}
              >
                {label}
              </button>
            ))}

            <Divider />

            {/* Direction */}
            <button
              type="button"
              className={`tiptap-btn${direction === 'ltr' ? ' active' : ''}`}
              title="Left-to-right"
              onClick={() => setDirection('ltr')}
            >
              {t('teacher.lessonEditor.directionLTR')}
            </button>
            <button
              type="button"
              className={`tiptap-btn${direction === 'rtl' ? ' active' : ''}`}
              title="Right-to-left"
              onClick={() => setDirection('rtl')}
            >
              {t('teacher.lessonEditor.directionRTL')}
            </button>
          </div>

          {uploadError && (
            <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)', background: 'var(--danger-light, #fee2e2)' }}>
              {uploadError}
            </div>
          )}

          <EditorContent editor={editor} className="tiptap-editor" style={{ direction }} />
        </div>
      </div>

      <div className="flex-between">
        <span style={{ fontSize: 12, color: saved ? 'var(--success)' : 'transparent' }}>
          ✓ {t('teacher.lessonEditor.saved')}
        </span>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" /> {t('teacher.lessonEditor.saving')}</> : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Title-only section editor ─────────────────────────────────────────────────

function TitleSectionEditor({ section, onSave }) {
  const { t }    = useTranslation()
  const [title,  setTitle]  = useState(section.title || '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(section.id, { title, content_body: null })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Heading text</label>
        <input
          className="form-control"
          style={{ fontSize: 18, fontWeight: 700 }}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Section heading"
          autoFocus
        />
        <p className="form-hint">This section displays as a heading only — no body content.</p>
      </div>
      <div className="flex-between">
        <span style={{ fontSize: 12, color: saved ? 'var(--success)' : 'transparent' }}>✓ {t('teacher.lessonEditor.saved')}</span>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" /> {t('teacher.lessonEditor.saving')}</> : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Quran block editor ────────────────────────────────────────────────────────

function QuranBlockEditor({ section, onSave }) {
  const { t }    = useTranslation()
  const body = section.content_body || {}
  const [title,     setTitle]     = useState(section.title || '')
  const [surahNum,  setSurahNum]  = useState(body.surah      || 1)
  const [ayahStart, setAyahStart] = useState(body.ayah_start || 1)
  const [ayahEnd,   setAyahEnd]   = useState(body.ayah_end   || 7)
  const [surahs,    setSurahs]    = useState([])
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    getSurahs().then(data => setSurahs(data)).catch(() => {})
  }, [])

  const selectedSurah = surahs.find(s => s.number === surahNum)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(section.id, {
        title,
        content_body: { surah: surahNum, ayah_start: ayahStart, ayah_end: ayahEnd },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Section title</label>
        <input
          className="form-control"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Recitation — Al-Fatiha"
        />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Surah</label>
        <select
          className="form-control"
          value={surahNum}
          onChange={e => { setSurahNum(+e.target.value); setAyahStart(1); setAyahEnd(1) }}
        >
          {surahs.map(s => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.englishName} — {s.name}
            </option>
          ))}
        </select>
        {selectedSurah && (
          <p className="form-hint">{selectedSurah.numberOfAyahs} ayahs · {selectedSurah.englishNameTranslation}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ margin: 0, flex: 1 }}>
          <label className="form-label">First ayah</label>
          <input
            type="number" min={1} max={selectedSurah?.numberOfAyahs || 286}
            className="form-control"
            value={ayahStart}
            onChange={e => setAyahStart(Math.max(1, +e.target.value))}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1 }}>
          <label className="form-label">Last ayah</label>
          <input
            type="number" min={ayahStart} max={selectedSurah?.numberOfAyahs || 286}
            className="form-control"
            value={ayahEnd}
            onChange={e => setAyahEnd(Math.max(ayahStart, +e.target.value))}
          />
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--gray-50, #f9fafb)', border: '1px solid var(--gray-200)', fontSize: 12, color: 'var(--gray-500)' }}>
        Will display ayahs {ayahStart}–{ayahEnd} of Surah {surahNum} with Arabic text, English translation, audio, and tafsir toggle.
      </div>

      <div className="flex-between">
        <span style={{ fontSize: 12, color: saved ? 'var(--success)' : 'transparent' }}>✓ {t('teacher.lessonEditor.saved')}</span>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" /> {t('teacher.lessonEditor.saving')}</> : t('common.save')}
        </button>
      </div>
    </div>
  )
}

// ── Section tree item (recursive) ─────────────────────────────────────────────

function SectionTreeItem({ section, siblings, parentId, selectedId, onSelect, onDelete, onMove, onAddChild, depth }) {
  const isSelected = selectedId === section.id
  const idx        = siblings.findIndex(s => s.id === section.id)

  return (
    <div>
      <div
        className={`toc-item${isSelected ? ' active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        <span
          className="toc-item-type"
          title={TYPE_LABEL[section.type]}
        >
          {TYPE_ICON[section.type]}
        </span>

        <span
          className="toc-item-title"
          onClick={() => onSelect(section)}
        >
          {section.title || <em style={{ color: 'var(--gray-400)' }}>untitled</em>}
        </span>

        <div className="toc-item-actions">
          <button
            title="Move up"
            onClick={() => onMove(section, 'up', siblings, parentId)}
            disabled={idx === 0}
          >▲</button>
          <button
            title="Move down"
            onClick={() => onMove(section, 'down', siblings, parentId)}
            disabled={idx === siblings.length - 1}
          >▼</button>
          <button
            title="Add child section"
            onClick={() => onAddChild(section)}
          >+</button>
          <button
            title="Delete section"
            style={{ color: 'var(--danger)' }}
            onClick={() => onDelete(section)}
          >×</button>
        </div>
      </div>

      {section.children?.map(child => (
        <SectionTreeItem
          key={child.id}
          section={child}
          siblings={section.children}
          parentId={section.id}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onMove={onMove}
          onAddChild={onAddChild}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

// ── Main LessonEditor ─────────────────────────────────────────────────────────

export default function LessonEditor() {
  const { lessonId } = useParams()
  const navigate     = useNavigate()
  const { t }        = useTranslation()

  const [lesson,          setLesson]          = useState(null)
  const [sections,        setSections]        = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')

  // new-section form
  const [mode,           setMode]           = useState('view')   // 'view' | 'create'
  const [pendingParent,  setPendingParent]  = useState(null)     // parent section for child add
  const [newTitle,       setNewTitle]       = useState('')
  const [newType,        setNewType]        = useState('content')
  const [creating,       setCreating]       = useState(false)

  // lesson header editing
  const [editingTitle,   setEditingTitle]   = useState(false)
  const [lessonTitle,    setLessonTitle]    = useState('')
  const [savingTitle,    setSavingTitle]    = useState(false)
  const [publishing,     setPublishing]     = useState(false)

  const load = async () => {
    try {
      const res = await getLessonDetail(lessonId)
      setLesson(res.data)
      setLessonTitle(res.data.title)
      setSections(res.data.sections || [])
    } catch {
      setError('Failed to load lesson.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [lessonId])

  // ── Lesson header ──────────────────────────────────────────────────────────

  const handleSaveTitle = async () => {
    setSavingTitle(true)
    try {
      await updateLesson(lessonId, { title: lessonTitle })
      setLesson(l => ({ ...l, title: lessonTitle }))
      setEditingTitle(false)
    } catch {
      setError('Failed to update title.')
    } finally {
      setSavingTitle(false)
    }
  }

  const handleTogglePublish = async () => {
    setPublishing(true)
    try {
      const updated = await updateLesson(lessonId, { published: !lesson.published })
      setLesson(l => ({ ...l, published: updated.data.published }))
    } catch {
      setError('Failed to update publish status.')
    } finally {
      setPublishing(false)
    }
  }

  // ── Section actions ────────────────────────────────────────────────────────

  const handleSaveSection = async (id, data) => {
    await updateSection(id, data)
    // patch the section in the local tree so the title updates in the TOC
    const patchTree = (items) => items.map(s =>
      s.id === id
        ? { ...s, ...data, children: s.children }
        : { ...s, children: patchTree(s.children || []) }
    )
    setSections(patchTree)
    setSelectedSection(s => s?.id === id ? { ...s, ...data } : s)
  }

  const handleDeleteSection = async (section) => {
    if (!window.confirm(`Delete "${section.title || 'this section'}" and all its children?`)) return
    try {
      await deleteSection(section.id)
      if (selectedSection?.id === section.id) setSelectedSection(null)
      load()
    } catch {
      setError('Failed to delete section.')
    }
  }

  const handleMoveSection = async (section, direction, siblings, parentId) => {
    const idx  = siblings.findIndex(s => s.id === section.id)
    const next = direction === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= siblings.length) return

    const reordered = [...siblings]
    ;[reordered[idx], reordered[next]] = [reordered[next], reordered[idx]]
    const order = reordered.map(s => s.id)

    try {
      if (!parentId) {
        await reorderSections(lessonId, order)
      } else {
        await reorderChildSections(parentId, order)
      }
      load()
    } catch {
      setError('Reorder failed.')
    }
  }

  // start "add child" mode for a specific parent
  const handleAddChild = (parentSection) => {
    setPendingParent(parentSection)
    setNewTitle('')
    setNewType('content')
    setMode('create')
    setSelectedSection(null)
  }

  const handleAddTopLevel = () => {
    setPendingParent(null)
    setNewTitle('')
    setNewType('content')
    setMode('create')
    setSelectedSection(null)
  }

  const handleCreateSection = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await createSection(lessonId, {
        title:  newTitle,
        type:   newType,
        parent: pendingParent?.id || null,
      })
      setMode('view')
      await load()
    } catch {
      setError('Failed to create section.')
    } finally {
      setCreating(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="editor-shell">
      {/* ── Top bar ── */}
      <div className="editor-topbar">
        <button
          className="btn btn-outline btn-sm"
          onClick={() => navigate(`/teacher/subject-groups/${lesson?.subject_group}`)}
        >
          ← {t('common.back')}
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {editingTitle ? (
            <>
              <input
                className="form-control"
                style={{ maxWidth: 340 }}
                value={lessonTitle}
                onChange={e => setLessonTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                autoFocus
              />
              <button className="btn btn-success btn-sm" onClick={handleSaveTitle} disabled={savingTitle}>
                {savingTitle ? <span className="spinner" /> : t('common.save')}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingTitle(false)}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)' }}>
                {lesson?.title}
              </h2>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setEditingTitle(true)}
                style={{ fontSize: 11 }}
              >
                Rename
              </button>
            </>
          )}
        </div>

        {error && (
          <span style={{ fontSize: 12, color: 'var(--danger)', marginRight: 8 }}>{error}</span>
        )}

        <button
          className="btn btn-outline btn-sm"
          onClick={() => navigate('/teacher/lessons/performance', { state: { lessonId } })}
          title="Student performance on exercises in this lesson"
        >
          📊 Performance
        </button>

        <button
          className={`btn btn-sm ${lesson?.published ? 'btn-outline' : 'btn-success'}`}
          onClick={handleTogglePublish}
          disabled={publishing}
        >
          {publishing
            ? <span className="spinner" />
            : lesson?.published ? t('teacher.subjectGroupDetail.unpublishLesson') : t('teacher.subjectGroupDetail.publishLesson')}
        </button>
      </div>

      {/* ── Body (TOC + Editor) ── */}
      <div className="editor-body">

        {/* ── TOC sidebar ── */}
        <div className="editor-toc">
          <div className="toc-header">
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)' }}>
              Contents ({sections.length})
            </span>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: 11 }}
              onClick={handleAddTopLevel}
            >
              + {t('teacher.lessonEditor.addSection')}
            </button>
          </div>

          <div className="toc-scroll">
            {sections.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                No sections yet.<br />Click "+ Section" to start.
              </div>
            ) : (
              sections.map(section => (
                <SectionTreeItem
                  key={section.id}
                  section={section}
                  siblings={sections}
                  parentId={null}
                  selectedId={mode === 'view' ? selectedSection?.id : null}
                  onSelect={(s) => { setSelectedSection(s); setMode('view') }}
                  onDelete={handleDeleteSection}
                  onMove={handleMoveSection}
                  onAddChild={handleAddChild}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Editor panel ── */}
        <div className="editor-panel">
          {mode === 'create' ? (
            /* New section form */
            <div style={{ maxWidth: 480 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gray-800)' }}>
                {pendingParent
                  ? `Add child section under "${pendingParent.title || 'untitled'}"`
                  : 'Add new top-level section'}
              </h3>
              <form onSubmit={handleCreateSection} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Title</label>
                  <input
                    className="form-control"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Section title"
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Type</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['title', 'content', 'exercise', 'quran_display'].map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`btn btn-sm ${newType === t ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setNewType(t)}
                      >
                        {TYPE_ICON[t]} {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                  <p className="form-hint" style={{ marginTop: 6 }}>
                    {newType === 'title'         && 'Displays as a heading. No content body.'}
                    {newType === 'content'        && 'Rich text editor — write theory, explanations, notes.'}
                    {newType === 'exercise'       && 'SurveyJS builder — create quizzes and exercises.'}
                    {newType === 'quran_display'  && 'Shows Arabic ayahs with translation, audio, and tafsir toggle.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? <><span className="spinner" /> {t('common.loading')}</> : t('teacher.lessonEditor.addSection')}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setMode('view')}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          ) : selectedSection ? (
            /* Section editor — keyed so it fully remounts per section */
            <div key={selectedSection.id} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="badge"
                  style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}
                >
                  {TYPE_ICON[selectedSection.type]} {TYPE_LABEL[selectedSection.type]}
                </span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  depth {selectedSection.depth}
                </span>
              </div>

              {selectedSection.type === 'title' && (
                <TitleSectionEditor section={selectedSection} onSave={handleSaveSection} />
              )}
              {selectedSection.type === 'content' && (
                <ContentEditor section={selectedSection} onSave={handleSaveSection} />
              )}
              {selectedSection.type === 'exercise' && (
                <ExerciseBuilder section={selectedSection} onSave={handleSaveSection} />
              )}
              {selectedSection.type === 'quran_display' && (
                <QuranBlockEditor section={selectedSection} onSave={handleSaveSection} />
              )}
            </div>
          ) : (
            /* Empty state */
            <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
              <p style={{ fontSize: 15 }}>Select a section from the left to edit it,<br />or click "+ Section" to add one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
