# Exercise System — Complete Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Exercise JSON Schema](#exercise-json-schema)
4. [Data Flow](#data-flow)
5. [Step 1 — Django: ExerciseSubmission Model](#step-1--django-exercisesubmission-model)
6. [Step 2 — Django: Views](#step-2--django-views)
7. [Step 3 — Django: URL Patterns](#step-3--django-url-patterns)
8. [Step 4 — Django: Admin](#step-4--django-admin)
9. [Step 5 — Frontend: API Helpers](#step-5--frontend-api-helpers)
10. [Step 6 — Frontend: ExerciseBuilder (Teacher UI)](#step-6--frontend-exercisebuilder-teacher-ui)
11. [Step 7 — Frontend: Replace Survey Creator in LessonEditor](#step-7--frontend-replace-survey-creator-in-lessoneditor)
12. [Step 8 — Frontend: Upgrade Student Exercise Viewer](#step-8--frontend-upgrade-student-exercise-viewer)
13. [Step 9 — Frontend: Performance Tracking Page](#step-9--frontend-performance-tracking-page)
14. [Step 10 — Frontend: App Routes](#step-10--frontend-app-routes)
15. [API Reference](#api-reference)
16. [Deployment on Linux](#deployment-on-linux)
17. [Files Changed Summary](#files-changed-summary)

---

## Overview

The exercise system is a fully self-hosted, auto-graded quiz engine built on top of the existing `LessonSection` infrastructure. It uses **SurveyJS Form Library** (`survey-react-ui`) for student-facing rendering and a **custom React teacher UI** (`ExerciseBuilder`) to replace Survey Creator entirely.

**Key design goals:**
- No external services — all data stays on your server
- Correct answers are **never sent to the student's browser** — grading is server-side only
- Students aged 3–17 are shown instant, visual feedback after submission
- Teachers see a per-student × per-exercise performance grid
- Images for questions are uploaded to Django's media storage and served locally

**What this system adds to the existing project:**
- `ExerciseSubmission` Django model — stores every graded attempt
- 4 new REST endpoints — submit, my-result, teacher-results, lesson-stats
- `ExerciseBuilder.jsx` — custom teacher UI (replaces Survey Creator)
- Enhanced `ExerciseViewer` in student portal — grading + result display
- `ExercisePerformance.jsx` — teacher dashboard

**What already existed and is reused unchanged:**
- `LessonSection` with `type='exercise'` + `content_body` JSONField — the exercise is stored here
- `SectionMediaUploadView` at `POST /api/content/media/` — image upload
- `StudentTokenAuthentication` — student authentication
- `survey-react-ui` + `survey-core` — already installed, used by student player

---

## Architecture Decisions

### Why custom JSON schema instead of native SurveyJS JSON?

The exercise data is stored in our own schema (not SurveyJS's `pages/elements` format). Reasons:

1. **Correct answer isolation** — our schema has a `correct` field per question. SurveyJS's native schema has no standard `correctAnswer` concept. By owning the schema, we can cleanly strip correct answers before sending to students.
2. **Teacher UI simplicity** — the custom ExerciseBuilder only needs to understand our simple schema, not the full SurveyJS JSON grammar.
3. **Grading control** — grading runs in Python against our schema. No SurveyJS logic is needed server-side.
4. **Future flexibility** — adding new question types, difficulty levels, or hints is schema changes only.

The student player converts our schema to SurveyJS JSON at render time (in the browser).

### Why server-side grading?

Grading in the browser would expose correct answers in the JavaScript payload. Children aged 3–17 could trivially read them (e.g., via browser dev tools). All grading happens in `ExerciseSubmitView` — the correct answers in `content_body` are stripped from the published lesson response.

### Why allow multiple attempts?

Young learners benefit from repetition. Every submission is stored, and the latest one is shown to the student. Teachers see the best/latest score per student.

---

## Exercise JSON Schema

Stored in `LessonSection.content_body` when `section.type == 'exercise'`.

```json
{
  "title": "Animals Quiz",
  "description": "Can you name these animals?",
  "questions": [
    {
      "id": "abc123def456",
      "type": "multiple_choice",
      "text": "What animal is in the picture?",
      "image": "/media/section_media/cat.jpg",
      "choices": ["Cat", "Dog", "Bird", "Rabbit"],
      "correct": "Cat"
    },
    {
      "id": "ghi789jkl012",
      "type": "true_false",
      "text": "A whale is a fish.",
      "correct": "false"
    },
    {
      "id": "mno345pqr678",
      "type": "text",
      "text": "Name the largest ocean on Earth.",
      "correct": "pacific ocean",
      "caseSensitive": false
    }
  ]
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes | Exercise heading shown to student |
| `description` | string | no | Instructions shown under the title |
| `questions` | array | yes | One or more question objects |
| `questions[].id` | string | yes | Unique ID within this exercise (12-char hex) |
| `questions[].type` | string | yes | `multiple_choice`, `true_false`, or `text` |
| `questions[].text` | string | yes | The question text |
| `questions[].image` | string | no | Absolute URL from Django media (e.g. `/media/section_media/...`) |
| `questions[].choices` | array | MC only | Answer options |
| `questions[].correct` | string | yes | The correct answer value |
| `questions[].caseSensitive` | bool | text only | Default `false` — comparison is case-insensitive |

### What the student receives (correct fields stripped)

The `PublishedLessonDetailView` strips `correct` and `caseSensitive` before sending:

```json
{
  "id": "abc123def456",
  "type": "multiple_choice",
  "text": "What animal is in the picture?",
  "image": "/media/section_media/cat.jpg",
  "choices": ["Cat", "Dog", "Bird", "Rabbit"]
}
```

---

## Data Flow

```
Teacher opens LessonEditor
       ↓
Teacher clicks "+ Section" → selects type "Exercise"
       ↓
ExerciseBuilder opens → teacher fills title, adds questions, uploads images
       ↓
Teacher clicks "Save Exercise"
       ↓
PATCH /api/content/sections/<id>/  { content_body: { title, questions: [...] } }
       ↓
Django stores full JSON (including correct answers) in LessonSection.content_body

─────────────────────────────────────────────────

Student opens lesson
       ↓
GET /api/content/published/lessons/<id>/
       ↓
Django strips { correct, caseSensitive } from all exercise sections
       ↓
StudentPortalLesson renders ExerciseViewer
       ↓
ExerciseViewer checks GET /api/content/sections/<id>/my-result/
  → if attempted: show ExerciseResult immediately
  → if not: convert schema to SurveyJS JSON, render Survey component
       ↓
Student completes survey → onComplete fires
       ↓
POST /api/content/sections/<id>/submit/  { answers: { q_id: value, ... } }
       ↓
Django grades server-side → creates ExerciseSubmission record
       ↓
Response: { score, total, percentage, details: [{ is_correct, correct_answer, ... }] }
       ↓
ExerciseResult component renders with correct/wrong highlighting

─────────────────────────────────────────────────

Teacher clicks "📊 Performance" in LessonEditor
       ↓
ExercisePerformance page opens
       ↓
GET /api/content/lessons/<id>/exercise-stats/
       ↓
Student × Exercise grid with percentage badges
       ↓
Teacher clicks exercise column header → DetailModal
       ↓
GET /api/content/sections/<id>/results/
       ↓
Per-student score table
```

---

## Step 1 — Django: ExerciseSubmission Model

**File:** `content/models.py`

Add at the bottom of the file, after the `BookFile` class:

```python
class ExerciseSubmission(models.Model):
    """One graded attempt by a student on an exercise (LessonSection type='exercise')."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section     = models.ForeignKey(
        LessonSection,
        on_delete=models.CASCADE,
        related_name='submissions',
        limit_choices_to={'type': 'exercise'},
    )
    student     = models.ForeignKey(
        'accounts.Student',
        on_delete=models.CASCADE,
        related_name='exercise_submissions',
    )
    answers     = models.JSONField(default=dict)   # {question_id: answer_string}
    score       = models.PositiveIntegerField(default=0)
    total       = models.PositiveIntegerField(default=0)
    details     = models.JSONField(default=list)   # list of per-question result dicts
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    @property
    def percentage(self):
        return round(self.score / self.total * 100) if self.total else 0

    def __str__(self):
        return f"{self.student} — {self.section} — {self.score}/{self.total}"
```

**Run migration:**

```bash
cd lacm-v1.2
python manage.py makemigrations content
python manage.py migrate
```

---

## Step 2 — Django: Views

**File:** `content/views.py`

### 2a — Update the models import

```python
# Replace existing models import with:
from .models import BookFile, ExerciseSubmission, Lesson, LessonSection, SubjectGroup
```

### 2b — Add grading helper

Add after the `_student_from_request` helper function (around line 41):

```python
def _grade_exercise(exercise_body, answers):
    """
    Compare student answers against the stored correct answers.
    Returns (score: int, total: int, details: list).
    Only questions with a non-None 'correct' field count toward the score.
    """
    questions = exercise_body.get('questions', [])
    details, score, total = [], 0, 0

    for q in questions:
        qid         = q.get('id')
        correct     = q.get('correct')
        student_ans = str(answers.get(qid, '')).strip()

        if correct is None:
            details.append({
                'id': qid, 'text': q.get('text', ''), 'type': q.get('type', ''),
                'image': q.get('image'), 'choices': q.get('choices'),
                'student_answer': student_ans, 'correct_answer': None, 'is_correct': None,
            })
            continue

        total += 1

        if q.get('type') == 'text':
            is_correct = (
                student_ans == str(correct).strip()
                if q.get('caseSensitive')
                else student_ans.lower() == str(correct).strip().lower()
            )
        else:
            is_correct = student_ans == str(correct)

        if is_correct:
            score += 1

        details.append({
            'id': qid, 'text': q.get('text', ''), 'type': q.get('type', ''),
            'image': q.get('image'), 'choices': q.get('choices'),
            'student_answer': student_ans, 'correct_answer': correct,
            'is_correct': is_correct,
        })

    return score, total, details
```

### 2c — Add four new view classes

Add before `PublishedSubjectGroupListView` (around line 570):

```python
# ---------------------------------------------------------------------------
# Exercise submission and results
# ---------------------------------------------------------------------------

class ExerciseSubmitView(APIView):
    """
    POST /content/sections/<section_pk>/submit/
    Authenticated student submits answers. Grades server-side. Returns full result.
    Body: { "answers": { "<question_id>": "<answer_value>", ... } }
    """
    permission_classes = [CanViewContent]

    def post(self, request, section_pk):
        student = _student_from_request(request)
        if not student:
            return Response(
                {'error': 'Only students can submit exercises.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            section = LessonSection.objects.select_related(
                'lesson__subject_group'
            ).get(pk=section_pk, type='exercise', active=True)
        except LessonSection.DoesNotExist:
            return Response({'error': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.center_id and not section.lesson.subject_group.centers.filter(
            id=request.user.center_id
        ).exists():
            return Response({'error': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        answers = request.data.get('answers', {})
        if not isinstance(answers, dict):
            return Response(
                {'error': 'answers must be an object.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        score, total, details = _grade_exercise(section.content_body or {}, answers)
        sub = ExerciseSubmission.objects.create(
            section=section, student=student,
            answers=answers, score=score, total=total, details=details,
        )
        return Response({
            'id': str(sub.id), 'score': score, 'total': total,
            'percentage': sub.percentage, 'details': details,
            'submitted_at': sub.submitted_at,
        }, status=status.HTTP_201_CREATED)


class ExerciseMyResultView(APIView):
    """
    GET /content/sections/<section_pk>/my-result/
    Returns the authenticated student's latest submission for this exercise.
    Response includes { attempted: false } when no submission exists.
    """
    permission_classes = [CanViewContent]

    def get(self, request, section_pk):
        student = _student_from_request(request)
        if not student:
            return Response(
                {'error': 'Only students can view their results.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        sub = ExerciseSubmission.objects.filter(
            section_id=section_pk, student=student
        ).first()
        if not sub:
            return Response({'attempted': False})
        return Response({
            'attempted': True, 'id': str(sub.id),
            'score': sub.score, 'total': sub.total, 'percentage': sub.percentage,
            'details': sub.details, 'submitted_at': sub.submitted_at,
        })


class ExerciseResultsView(APIView):
    """
    GET /content/sections/<section_pk>/results/
    Teacher only. Returns all submissions for one exercise section.
    Each student's latest submission is flagged with is_latest=True.
    """
    permission_classes = [CanManageContent]

    def get(self, request, section_pk):
        try:
            section = LessonSection.objects.get(
                pk=section_pk, type='exercise', active=True,
                lesson__teacher=request.user,
            )
        except LessonSection.DoesNotExist:
            return Response({'error': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        subs = (
            ExerciseSubmission.objects
            .filter(section=section)
            .select_related('student')
            .order_by('-submitted_at')
        )
        seen, data = set(), []
        for s in subs:
            is_latest = s.student_id not in seen
            if is_latest:
                seen.add(s.student_id)
            data.append({
                'id': str(s.id), 'student_name': s.student.name,
                'student_grade': s.student.grade, 'score': s.score,
                'total': s.total, 'percentage': s.percentage,
                'submitted_at': s.submitted_at, 'is_latest': is_latest,
            })
        return Response({
            'section_title': section.title or 'Untitled Exercise',
            'total_students': len(seen),
            'submissions': data,
        })


class ExerciseStatsView(APIView):
    """
    GET /content/lessons/<lesson_pk>/exercise-stats/
    Teacher only. Returns a student × exercise performance grid for the whole lesson.
    Each cell is the student's best (latest) result for that exercise, or null if not attempted.
    """
    permission_classes = [CanManageContent]

    def get(self, request, lesson_pk):
        try:
            lesson = Lesson.objects.get(pk=lesson_pk, teacher=request.user)
        except Lesson.DoesNotExist:
            return Response({'error': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        sections = list(
            lesson.sections.filter(type='exercise', active=True).order_by('sort_order')
        )
        exercises_meta = [
            {'id': str(s.id), 'title': s.title or f'Exercise {i + 1}'}
            for i, s in enumerate(sections)
        ]

        from collections import defaultdict
        student_map = defaultdict(lambda: {'name': '', 'grade': '', 'results': {}})

        for sec in sections:
            subs = (
                ExerciseSubmission.objects
                .filter(section=sec)
                .select_related('student')
                .order_by('student_id', '-submitted_at')
            )
            seen_students = set()
            for sub in subs:
                if sub.student_id not in seen_students:
                    seen_students.add(sub.student_id)
                    sid = sub.student_id
                    student_map[sid]['name']  = sub.student.name
                    student_map[sid]['grade'] = sub.student.grade
                    student_map[sid]['results'][str(sec.id)] = {
                        'score': sub.score, 'total': sub.total,
                        'percentage': sub.percentage,
                    }

        students_list = sorted([
            {
                'name': v['name'], 'grade': v['grade'],
                'results': [v['results'].get(ex['id']) for ex in exercises_meta],
            }
            for v in student_map.values()
        ], key=lambda x: x['name'])

        return Response({
            'lesson_title': lesson.title,
            'exercises': exercises_meta,
            'students': students_list,
        })
```

### 2d — Patch PublishedLessonDetailView to strip correct answers

Find the last line of `PublishedLessonDetailView.get()`:

```python
        return Response(LessonDetailSerializer(lesson).data)
```

Replace with:

```python
        data = dict(LessonDetailSerializer(lesson).data)

        def _strip(sections):
            """Recursively remove correct answers from exercise sections."""
            stripped = []
            for raw in sections:
                s = dict(raw)
                if s.get('type') == 'exercise' and isinstance(s.get('content_body'), dict):
                    body = dict(s['content_body'])
                    body['questions'] = [
                        {k: v for k, v in q.items() if k not in ('correct', 'caseSensitive')}
                        for q in body.get('questions', [])
                    ]
                    s['content_body'] = body
                if s.get('children'):
                    s['children'] = _strip(s['children'])
                stripped.append(s)
            return stripped

        data['sections'] = _strip(data.get('sections', []))
        return Response(data)
```

---

## Step 3 — Django: URL Patterns

**File:** `content/urls.py`

### 3a — Update imports

```python
from .views import (
    BookFileDetailView,
    BookFileListCreateView,
    ChildSectionReorderView,
    ExerciseMyResultView,
    ExerciseResultsView,
    ExerciseStatsView,
    ExerciseSubmitView,
    LessonDetailView,
    LessonListCreateView,
    LessonReorderView,
    PublishedLessonDetailView,
    PublishedLessonListView,
    PublishedSubjectGroupListView,
    SectionDetailView,
    SectionListCreateView,
    SectionMediaUploadView,
    SectionReorderView,
    SubjectGroupDetailView,
    SubjectGroupListCreateView,
)
```

### 3b — Add URL patterns

Add after the existing section URL patterns:

```python
    # -----------------------------------------------------------------------
    # Exercise submission and results
    # -----------------------------------------------------------------------
    path(
        'sections/<uuid:section_pk>/submit/',
        ExerciseSubmitView.as_view(),
        name='exercise-submit',
    ),
    path(
        'sections/<uuid:section_pk>/my-result/',
        ExerciseMyResultView.as_view(),
        name='exercise-my-result',
    ),
    path(
        'sections/<uuid:section_pk>/results/',
        ExerciseResultsView.as_view(),
        name='exercise-results',
    ),
    path(
        'lessons/<uuid:lesson_pk>/exercise-stats/',
        ExerciseStatsView.as_view(),
        name='exercise-stats',
    ),
```

---

## Step 4 — Django: Admin

**File:** `content/admin.py`

Update the import and add the new admin class:

```python
from .models import BookFile, ExerciseSubmission, Lesson, LessonSection, SubjectGroup


@admin.register(ExerciseSubmission)
class ExerciseSubmissionAdmin(admin.ModelAdmin):
    list_display    = ['student', 'section', 'score', 'total', 'pct', 'submitted_at']
    list_filter     = ['submitted_at']
    search_fields   = ['student__name', 'section__title']
    ordering        = ['-submitted_at']
    readonly_fields = ['id', 'answers', 'details', 'submitted_at']

    @admin.display(description='%')
    def pct(self, obj):
        return f'{obj.percentage}%'
```

---

## Step 5 — Frontend: API Helpers

**File:** `frontend/src/api/exercises.js` *(create new file)*

```javascript
import client from './client'
import studentClient from './studentClient'

// Teacher: all submissions for one exercise section (latest per student flagged)
export const getExerciseResults = (sectionId) =>
  client.get(`/content/sections/${sectionId}/results/`)

// Teacher: student × exercise performance grid for an entire lesson
export const getExerciseStats = (lessonId) =>
  client.get(`/content/lessons/${lessonId}/exercise-stats/`)

// Student: submit answers and receive graded result
// answers: { [questionId]: answerValue, ... }
export const submitExercise = (sectionId, answers) =>
  studentClient.post(`/content/sections/${sectionId}/submit/`, { answers })

// Student: check if already attempted; returns { attempted: bool, ...resultFields }
export const getMyResult = (sectionId) =>
  studentClient.get(`/content/sections/${sectionId}/my-result/`)
```

> Image upload for exercise questions reuses `uploadSectionMedia` from the existing
> `frontend/src/api/content.js`. No duplicate function needed.

---

## Step 6 — Frontend: ExerciseBuilder (Teacher UI)

**File:** `frontend/src/pages/teacher/ExerciseBuilder.jsx` *(create new file)*

This component replaces Survey Creator entirely. Teachers build exercises by:
1. Entering an exercise title and optional instructions
2. Clicking "Add Question ▾" and choosing a question type
3. Filling in question text, uploading an optional image, setting answer choices and marking the correct one
4. Clicking "Save Exercise" — which calls `onSave(sectionId, { title, content_body })` provided by `LessonEditor`

```jsx
import { useRef, useState } from 'react'
import { uploadSectionMedia } from '../../api/content'

const TYPE_LABELS = {
  multiple_choice: 'Multiple Choice',
  true_false:      'True / False',
  text:            'Text Answer',
}

// ── Add Question dropdown ─────────────────────────────────────────────────────

function AddQuestionMenu({ onAdd }) {
  const [open, setOpen] = useState(false)
  const TYPES = [
    { id: 'multiple_choice', label: 'Multiple Choice', icon: '⊙' },
    { id: 'true_false',      label: 'True / False',    icon: '✓' },
    { id: 'text',            label: 'Text Answer',     icon: 'T' },
  ]
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(o => !o)}>
        + Add Question ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200,
          background: '#fff', border: '1px solid var(--gray-200)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.13)',
          minWidth: 200, marginTop: 4,
        }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              style={{
                display: 'block', width: '100%', padding: '10px 16px',
                textAlign: 'left', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 14, color: 'var(--gray-800)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onClick={() => { onAdd(t.id); setOpen(false) }}
            >
              {t.icon}  {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Multiple Choice editor ────────────────────────────────────────────────────

function MultipleChoiceEditor({ choices, correct, onChange }) {
  const updateChoice = (idx, val) => {
    const updated = choices.map((c, i) => i === idx ? val : c)
    onChange(updated, correct === choices[idx] ? val : correct)
  }
  const removeChoice = (idx) => {
    const updated = choices.filter((_, i) => i !== idx)
    onChange(updated, updated.includes(correct) ? correct : '')
  }
  return (
    <div className="form-group">
      <label className="form-label">Answer Choices — click the circle to mark correct</label>
      {choices.map((choice, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="radio"
            checked={correct === choice && choice !== ''}
            onChange={() => choice.trim() && onChange(choices, choice)}
            title="Mark as correct answer"
            style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
          />
          <input
            className="form-control"
            value={choice}
            style={{ flex: 1 }}
            placeholder={`Choice ${idx + 1}`}
            onChange={e => updateChoice(idx, e.target.value)}
          />
          {choices.length > 2 && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              onClick={() => removeChoice(idx)}
              title="Remove choice"
            >×</button>
          )}
        </div>
      ))}
      {correct && (
        <div style={{ fontSize: 12, color: 'var(--success, #059669)', marginTop: 2 }}>
          ✓ Correct answer marked: <strong>{correct}</strong>
        </div>
      )}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ marginTop: 8, fontSize: 13 }}
        onClick={() => onChange([...choices, ''], correct)}
      >
        + Add Choice
      </button>
    </div>
  )
}

// ── Single question card ──────────────────────────────────────────────────────

function QuestionCard({ question: q, index, onChange, onDelete, onImageUpload, uploading }) {
  const imgRef = useRef(null)
  return (
    <div className="card" style={{ marginBottom: 16, border: '1px solid var(--gray-200)' }}>
      <div className="card-header"
           style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          Q{index + 1} — {TYPE_LABELS[q.type]}
        </span>
        <button
          type="button"
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}
        >
          Delete
        </button>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Question text */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Question text *</label>
          <input
            className="form-control"
            value={q.text}
            onChange={e => onChange({ text: e.target.value })}
            placeholder="Type your question here…"
          />
        </div>

        {/* Image upload */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Image (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {q.image && (
              <img src={q.image} alt="question"
                   style={{ height: 72, borderRadius: 8, objectFit: 'cover',
                            border: '1px solid var(--gray-200)' }} />
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={uploading}
              onClick={() => imgRef.current?.click()}
            >
              {uploading
                ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Uploading…</>
                : q.image ? '🖼 Replace' : '🖼 Upload Image'}
            </button>
            {q.image && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ color: 'var(--danger)', fontSize: 12 }}
                onClick={() => onChange({ image: null })}
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onImageUpload(f)
              e.target.value = ''
            }}
          />
        </div>

        {/* Multiple Choice */}
        {q.type === 'multiple_choice' && (
          <MultipleChoiceEditor
            choices={q.choices}
            correct={q.correct}
            onChange={(choices, correct) => onChange({ choices, correct })}
          />
        )}

        {/* True / False */}
        {q.type === 'true_false' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Correct Answer</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {['true', 'false'].map(val => (
                <label
                  key={val}
                  style={{ display: 'flex', alignItems: 'center', gap: 8,
                           cursor: 'pointer', userSelect: 'none' }}
                >
                  <input
                    type="radio"
                    checked={q.correct === val}
                    onChange={() => onChange({ correct: val })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{
                    padding: '5px 18px', borderRadius: 20, fontWeight: 600, fontSize: 14,
                    background: q.correct === val ? 'var(--primary-light, #ede9fe)' : 'var(--gray-100)',
                    color: q.correct === val ? 'var(--primary, #7c3aed)' : 'var(--gray-600)',
                    transition: 'all .15s',
                  }}>
                    {val === 'true' ? 'True' : 'False'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Text Answer */}
        {q.type === 'text' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Correct Answer</label>
            <input
              className="form-control"
              value={q.correct}
              onChange={e => onChange({ correct: e.target.value })}
              placeholder="The expected answer (case-insensitive by default)"
            />
            <p className="form-hint">Comparison trims whitespace and ignores case.</p>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Main ExerciseBuilder ──────────────────────────────────────────────────────

export default function ExerciseBuilder({ section, onSave }) {
  const initial = section.content_body || {}

  const [sectionTitle, setSectionTitle] = useState(section.title || '')
  const [exTitle,      setExTitle]      = useState(initial.title       || '')
  const [exDesc,       setExDesc]       = useState(initial.description || '')
  const [questions,    setQuestions]    = useState(initial.questions   || [])
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [uploading,    setUploading]    = useState({})
  const [error,        setError]        = useState('')

  const newQuestion = (type) => ({
    id:            crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    type,
    text:          '',
    image:         null,
    choices:       type === 'multiple_choice' ? ['', ''] : [],
    correct:       type === 'true_false' ? 'true' : '',
    caseSensitive: false,
  })

  const addQuestion    = (type) => setQuestions(qs => [...qs, newQuestion(type)])
  const removeQuestion = (id)   => setQuestions(qs => qs.filter(q => q.id !== id))
  const updateQuestion = (id, changes) =>
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...changes } : q))

  const handleImageUpload = async (qId, file) => {
    setUploading(u => ({ ...u, [qId]: true }))
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await uploadSectionMedia(form)
      updateQuestion(qId, { image: res.data.url })
    } catch {
      setError('Image upload failed. Please try again.')
    } finally {
      setUploading(u => ({ ...u, [qId]: false }))
    }
  }

  const validate = () => {
    if (!exTitle.trim()) return 'Exercise title is required.'
    if (questions.length === 0) return 'Add at least one question.'
    for (const q of questions) {
      if (!q.text.trim()) return 'Every question needs text.'
      if (q.type === 'multiple_choice') {
        if (q.choices.filter(c => c.trim()).length < 2)
          return 'Multiple choice questions need at least 2 choices.'
        if (!q.correct)
          return 'Mark the correct answer for every multiple choice question.'
      }
      if (q.type === 'text' && !q.correct.trim())
        return 'Text answer questions need a correct answer.'
    }
    return null
  }

  const handleSave = async () => {
    setError('')
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      await onSave(section.id, {
        title:        sectionTitle,
        content_body: { title: exTitle, description: exDesc, questions },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Section title — shown in the TOC sidebar */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Section title (shown in lesson outline)</label>
        <input
          className="form-control"
          value={sectionTitle}
          onChange={e => setSectionTitle(e.target.value)}
          placeholder="e.g. Exercise 1: Animals"
        />
      </div>

      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--gray-100)' }} />

      {/* Exercise title and description */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Exercise title *</label>
        <input
          className="form-control"
          value={exTitle}
          onChange={e => setExTitle(e.target.value)}
          placeholder="e.g. Animals Quiz"
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Instructions (optional)</label>
        <input
          className="form-control"
          value={exDesc}
          onChange={e => setExDesc(e.target.value)}
          placeholder="e.g. Look at each picture and choose the correct answer."
        />
      </div>

      {/* Questions */}
      {questions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 10 }}>
            Questions ({questions.length})
          </div>
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              onChange={changes => updateQuestion(q.id, changes)}
              onDelete={() => removeQuestion(q.id)}
              onImageUpload={file => handleImageUpload(q.id, file)}
              uploading={!!uploading[q.id]}
            />
          ))}
        </div>
      )}

      <AddQuestionMenu onAdd={addQuestion} />

      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b',
                      borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="flex-between" style={{ marginTop: 8 }}>
        <span style={{ fontSize: 12, color: saved ? 'var(--success)' : 'transparent' }}>
          ✓ Saved
        </span>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : 'Save Exercise'}
        </button>
      </div>

    </div>
  )
}
```

---

## Step 7 — Frontend: Replace Survey Creator in LessonEditor

**File:** `frontend/src/pages/teacher/LessonEditor.jsx`

### 7a — Remove Survey Creator imports

Delete these three lines:

```javascript
import { SurveyCreator, SurveyCreatorComponent } from 'survey-creator-react'
import 'survey-creator-core/survey-creator-core.css'
import 'survey-core/survey-core.css'
```

### 7b — Add ExerciseBuilder import

```javascript
import ExerciseBuilder from './ExerciseBuilder'
```

### 7c — Delete ExerciseEditor function

Remove the entire block from:

```javascript
// ── SurveyJS exercise creator ─────────────────────────────────────────────────
function ExerciseEditor({ section, onSave }) {
```

…to just before `// ── Title-only section editor`.

### 7d — Replace ExerciseEditor in the render section

Find:

```jsx
              {selectedSection.type === 'exercise' && (
                <ExerciseEditor section={selectedSection} onSave={handleSaveSection} />
              )}
```

Replace with:

```jsx
              {selectedSection.type === 'exercise' && (
                <ExerciseBuilder section={selectedSection} onSave={handleSaveSection} />
              )}
```

### 7e — Update the section type hint text

Find:

```javascript
                    {newType === 'exercise' && 'SurveyJS builder — create quizzes and exercises.'}
```

Replace with:

```javascript
                    {newType === 'exercise' && 'Custom quiz builder — create auto-graded exercises with images.'}
```

### 7f — Add Performance button to the top bar

Inside the top bar `<div>`, alongside the Publish button:

```jsx
<button
  className="btn btn-outline btn-sm"
  onClick={() => navigate(`/teacher/lessons/${lessonId}/performance`)}
  title="Student performance on exercises in this lesson"
>
  📊 Performance
</button>
```

### 7g — Optional: Remove unused Survey Creator packages

In `frontend/package.json`, remove from `dependencies`:

```json
"survey-creator-core": "^2.5.20",
"survey-creator-react": "^2.5.20",
```

Then run `npm install` inside the `frontend/` directory.

> Keep `survey-core` and `survey-react-ui` — these are the Form Library used by the student player.

---

## Step 8 — Frontend: Upgrade Student Exercise Viewer

**File:** `frontend/src/pages/student/StudentPortalLesson.jsx`

### 8a — Add import

```javascript
import { submitExercise, getMyResult } from '../../api/exercises'
```

### 8b — Add helper functions before ExerciseViewer

Add these two functions before the existing `ExerciseViewer` function:

```javascript
function exerciseToSurveyJSON(exercise) {
  return {
    title:               exercise.title       || '',
    description:         exercise.description || '',
    showProgressBar:     'top',
    showQuestionNumbers: 'on',
    pages: [{
      name: 'page1',
      elements: (exercise.questions || []).map(q => {
        const base = { name: q.id, title: q.text || '', isRequired: true }
        if (q.image) {
          base.description         = `<img src="${q.image}" style="max-width:280px;max-height:220px;border-radius:8px;display:block;margin:6px 0" />`
          base.descriptionLocation = 'underTitle'
        }
        if (q.type === 'multiple_choice')
          return { ...base, type: 'radiogroup', choices: q.choices || [], colCount: 1 }
        if (q.type === 'true_false')
          return {
            ...base, type: 'radiogroup', colCount: 2,
            choices: [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }],
          }
        return { ...base, type: 'text', placeholder: 'Type your answer here…' }
      }),
    }],
  }
}

function ExerciseResult({ result, exercise, onRetry }) {
  const pct   = result.percentage || 0
  const emoji = pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '📚'
  const bg    = pct >= 70 ? '#d1fae5' : pct >= 40 ? '#fef3c7' : '#fee2e2'
  const color = pct >= 70 ? '#065f46' : pct >= 40 ? '#92400e' : '#991b1b'

  return (
    <div>
      {/* Score banner */}
      <div style={{ textAlign: 'center', padding: '24px 16px', background: bg,
                    borderRadius: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{emoji}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color }}>{result.score}/{result.total}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color }}>{pct}%</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          {pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good job!' : 'Keep practicing!'}
        </div>
      </div>

      {/* Per-question review */}
      {result.details.map((d, i) => {
        const isCorrect   = d.is_correct
        const borderColor = isCorrect === true ? '#a7f3d0' : isCorrect === false ? '#fecaca' : 'var(--gray-200)'
        const bgColor     = isCorrect === true ? '#f0fdf4' : isCorrect === false ? '#fff5f5' : '#fff'
        return (
          <div key={d.id} style={{ padding: 14, marginBottom: 10, borderRadius: 12,
                                    border: `2px solid ${borderColor}`, background: bgColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-800)', flex: 1 }}>
                Q{i + 1}: {d.text}
              </span>
              {isCorrect !== null && (
                <span style={{ fontSize: 22, marginLeft: 8 }}>{isCorrect ? '✅' : '❌'}</span>
              )}
            </div>
            {d.image && (
              <img src={d.image} alt=""
                   style={{ maxWidth: 200, borderRadius: 8, marginBottom: 8, display: 'block' }} />
            )}
            <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>
              Your answer: <strong>{d.student_answer || '(no answer)'}</strong>
            </div>
            {isCorrect === false && d.correct_answer && (
              <div style={{ fontSize: 13, color: '#065f46', marginTop: 3 }}>
                Correct answer:{' '}
                <strong>
                  {d.correct_answer === 'true'  ? 'True'
                   : d.correct_answer === 'false' ? 'False'
                   : d.correct_answer}
                </strong>
              </div>
            )}
          </div>
        )
      })}

      <button className="btn btn-primary" onClick={onRetry}
              style={{ width: '100%', marginTop: 8, fontSize: 15, padding: '12px 0' }}>
        Try Again
      </button>
    </div>
  )
}
```

### 8c — Replace the ExerciseViewer function

Replace the existing `ExerciseViewer` (the one that starts `function ExerciseViewer({ contentBody })`) with:

```javascript
function ExerciseViewer({ section }) {
  const exercise = section?.content_body || {}
  const [phase,       setPhase]       = useState('loading') // 'loading' | 'ready' | 'submitting' | 'done'
  const [result,      setResult]      = useState(null)
  const [surveyModel, setSurveyModel] = useState(null)

  useEffect(() => {
    if (!section?.id) return
    setPhase('loading')
    getMyResult(section.id)
      .then(res => {
        if (res.data.attempted) {
          setResult(res.data)
          setPhase('done')
        } else {
          if (exercise.questions) {
            setSurveyModel(new Model(exerciseToSurveyJSON(exercise)))
          }
          setPhase('ready')
        }
      })
      .catch(() => {
        if (exercise.questions) {
          setSurveyModel(new Model(exerciseToSurveyJSON(exercise)))
        }
        setPhase('ready')
      })
  }, [section?.id])

  useEffect(() => {
    if (!surveyModel) return
    surveyModel.onComplete.add(async (sender) => {
      setPhase('submitting')
      try {
        const res = await submitExercise(section.id, sender.data)
        setResult(res.data)
        setPhase('done')
      } catch {
        setPhase('done')
      }
    })
  }, [surveyModel, section?.id])

  const handleRetry = () => {
    setSurveyModel(new Model(exerciseToSurveyJSON(exercise)))
    setResult(null)
    setPhase('ready')
  }

  if (phase === 'loading') return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
    </div>
  )

  if (phase === 'submitting') return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--gray-600)' }}>
      <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      <p style={{ marginTop: 12, fontWeight: 600 }}>Checking your answers…</p>
    </div>
  )

  if (phase === 'done' && result) return (
    <ExerciseResult result={result} exercise={exercise} onRetry={handleRetry} />
  )

  if (!surveyModel) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>
      This exercise has no questions yet.
    </div>
  )

  return <Survey model={surveyModel} />
}
```

### 8d — Update SectionView to pass the full section object

Find in `SectionView`:

```jsx
      {section.type === 'exercise' && section.content_body && (
        <ExerciseViewer key={section.id} contentBody={section.content_body} />
      )}
```

Replace with:

```jsx
      {section.type === 'exercise' && section.content_body && (
        <ExerciseViewer key={section.id} section={section} />
      )}
```

---

## Step 9 — Frontend: Performance Tracking Page

**File:** `frontend/src/pages/teacher/ExercisePerformance.jsx` *(create new file)*

```jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getExerciseResults, getExerciseStats } from '../../api/exercises'

const TH = {
  padding: '9px 14px', background: 'var(--gray-50)',
  borderBottom: '2px solid var(--gray-200)', textAlign: 'left',
  whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700,
}
const TD = {
  padding: '9px 14px', borderBottom: '1px solid var(--gray-100)',
  verticalAlign: 'middle', fontSize: 14,
}

function ScoreBadge({ r }) {
  if (!r) return <span style={{ color: 'var(--gray-300)', fontSize: 13 }}>—</span>
  const bg    = r.percentage >= 70 ? '#d1fae5' : r.percentage >= 40 ? '#fef3c7' : '#fee2e2'
  const color = r.percentage >= 70 ? '#065f46' : r.percentage >= 40 ? '#92400e' : '#991b1b'
  return (
    <span style={{ padding: '3px 11px', borderRadius: 20, fontWeight: 700,
                   fontSize: 13, background: bg, color }}>
      {r.percentage}%
    </span>
  )
}

function DetailModal({ sectionId, title, onClose }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    getExerciseResults(sectionId).then(res => setData(res.data))
  }, [sectionId])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
               zIndex: 1000, display: 'flex', alignItems: 'center',
               justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="card-header"
             style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     fontSize: 22, color: 'var(--gray-400)', lineHeight: 1 }}
          >×</button>
        </div>
        {!data ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <span className="spinner spinner-dark" />
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
              {data.total_students} student(s) attempted
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Student</th>
                  <th style={TH}>Grade</th>
                  <th style={TH}>Score</th>
                  <th style={TH}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.filter(s => s.is_latest).map(s => (
                  <tr key={s.id}>
                    <td style={TD}>{s.student_name}</td>
                    <td style={TD}>{s.student_grade}</td>
                    <td style={TD}><ScoreBadge r={s} /></td>
                    <td style={TD}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExercisePerformance() {
  const { lessonId }    = useParams()
  const navigate        = useNavigate()
  const [data,          setData]      = useState(null)
  const [loading,       setLoading]   = useState(true)
  const [error,         setError]     = useState('')
  const [detailId,      setDetailId]  = useState(null)

  useEffect(() => {
    getExerciseStats(lessonId)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load.'))
      .finally(() => setLoading(false))
  }, [lessonId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="spinner spinner-dark" style={{ width: 36, height: 36 }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 28 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
          {data?.lesson_title || 'Exercise Performance'}
        </h2>
      </div>

      {error && (
        <div style={{ padding: 16, background: '#fee2e2', color: '#991b1b',
                      borderRadius: 10, marginBottom: 20 }}>{error}</div>
      )}

      {data?.exercises.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p>No exercises in this lesson yet.</p>
        </div>
      ) : data?.students.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p>No students have attempted any exercises yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12,
                      border: '1px solid var(--gray-200)',
                      boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Student</th>
                <th style={{ ...TH, width: 72 }}>Grade</th>
                {data.exercises.map(ex => (
                  <th
                    key={ex.id}
                    style={{ ...TH, textAlign: 'center', cursor: 'pointer',
                             color: 'var(--primary)', maxWidth: 140 }}
                    title={ex.title}
                    onClick={() => setDetailId(ex.id)}
                  >
                    {ex.title.length > 16 ? ex.title.slice(0, 14) + '…' : ex.title}
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--gray-400)',
                                  marginTop: 2 }}>
                      click for details
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={i}>
                  <td style={{ ...TD, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ ...TD, textAlign: 'center', color: 'var(--gray-500)' }}>
                    {s.grade}
                  </td>
                  {s.results.map((r, j) => (
                    <td key={j} style={{ ...TD, textAlign: 'center' }}>
                      <ScoreBadge r={r} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <DetailModal
          sectionId={detailId}
          title={data.exercises.find(e => e.id === detailId)?.title || 'Exercise Details'}
          onClose={() => setDetailId(null)}
        />
      )}

    </div>
  )
}
```

---

## Step 10 — Frontend: App Routes

**File:** `frontend/src/App.jsx`

Add import near the other teacher imports:

```javascript
import ExercisePerformance from './pages/teacher/ExercisePerformance'
```

Add route inside `<Routes>`:

```jsx
<Route
  path="/teacher/lessons/:lessonId/performance"
  element={<ProtectedRoute><ExercisePerformance /></ProtectedRoute>}
/>
```

---

## API Reference

All endpoints are under `/api/content/`.
Student endpoints require `Authorization: StudentToken <hex>`.
Teacher endpoints require `Authorization: Token <drf-token>`.

---

### POST `/api/content/sections/<section_pk>/submit/`

Submit student answers for an exercise. Grades server-side. Stores result.

**Auth:** StudentToken  
**Permission:** `can_view_content`

**Request body:**
```json
{
  "answers": {
    "abc123def456": "Cat",
    "ghi789jkl012": "false",
    "mno345pqr678": "Pacific Ocean"
  }
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "score": 2,
  "total": 3,
  "percentage": 67,
  "submitted_at": "2026-04-26T10:30:00Z",
  "details": [
    {
      "id": "abc123def456",
      "text": "What animal is in the picture?",
      "type": "multiple_choice",
      "image": "/media/section_media/cat.jpg",
      "choices": ["Cat", "Dog", "Bird", "Rabbit"],
      "student_answer": "Cat",
      "correct_answer": "Cat",
      "is_correct": true
    },
    {
      "id": "ghi789jkl012",
      "text": "A whale is a fish.",
      "type": "true_false",
      "image": null,
      "choices": null,
      "student_answer": "false",
      "correct_answer": "false",
      "is_correct": true
    },
    {
      "id": "mno345pqr678",
      "text": "Name the largest ocean on Earth.",
      "type": "text",
      "image": null,
      "choices": null,
      "student_answer": "Pacific Ocean",
      "correct_answer": "pacific ocean",
      "is_correct": true
    }
  ]
}
```

---

### GET `/api/content/sections/<section_pk>/my-result/`

Returns the student's latest result. Returns `{ attempted: false }` if not yet attempted.

**Auth:** StudentToken  
**Permission:** `can_view_content`

**Response 200 (not attempted):**
```json
{ "attempted": false }
```

**Response 200 (attempted):**
```json
{
  "attempted": true,
  "id": "uuid",
  "score": 2,
  "total": 3,
  "percentage": 67,
  "details": [ ... ],
  "submitted_at": "2026-04-26T10:30:00Z"
}
```

---

### GET `/api/content/sections/<section_pk>/results/`

Teacher views all submissions for an exercise. Each student's most recent submission is flagged `is_latest: true`.

**Auth:** Token (teacher)  
**Permission:** `can_manage_content`

**Response 200:**
```json
{
  "section_title": "Exercise 1: Animals",
  "total_students": 3,
  "submissions": [
    {
      "id": "uuid",
      "student_name": "Ahmed",
      "student_grade": "Grade 2",
      "score": 3,
      "total": 3,
      "percentage": 100,
      "submitted_at": "2026-04-26T10:30:00Z",
      "is_latest": true
    }
  ]
}
```

---

### GET `/api/content/lessons/<lesson_pk>/exercise-stats/`

Teacher views a student × exercise performance grid for an entire lesson.

**Auth:** Token (teacher)  
**Permission:** `can_manage_content`

**Response 200:**
```json
{
  "lesson_title": "Lesson 3: Nature",
  "exercises": [
    { "id": "uuid-1", "title": "Animals Quiz" },
    { "id": "uuid-2", "title": "Plants Quiz" }
  ],
  "students": [
    {
      "name": "Ahmed",
      "grade": "Grade 2",
      "results": [
        { "score": 3, "total": 3, "percentage": 100 },
        { "score": 2, "total": 4, "percentage": 50 }
      ]
    },
    {
      "name": "Sara",
      "grade": "Grade 1",
      "results": [
        { "score": 1, "total": 3, "percentage": 33 },
        null
      ]
    }
  ]
}
```

`null` in `results` means that student has not attempted that exercise.

---

## Deployment on Linux

### Prerequisites

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker nginx
```

### Nginx configuration

Create `/etc/nginx/sites-available/lms`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # React frontend (Vite dev or static build)
    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
    }

    # Django REST API
    location /api/ {
        proxy_pass       http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Django Admin panel
    location /admin/ {
        proxy_pass       http://localhost:8000;
        proxy_set_header Host $host;
    }

    # Media files — exercise images, avatars, book files
    # Served directly by Nginx (faster, bypasses Django/Gunicorn)
    location /media/ {
        alias   /opt/lms/lacm-v1.2/media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Django static files (admin CSS/JS)
    location /static/ {
        alias   /opt/lms/lacm-v1.2/staticfiles/;
        expires 30d;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Environment variables

Create `/opt/lms/lacm-v1.2/.env`:

```dotenv
DEBUG=False
SECRET_KEY=<generate-with-python-secrets.token_hex-32>
DATABASE_URL=postgres://lms_user:password@db:5432/lms_db
ALLOWED_HOSTS=yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com
```

### Deploy

```bash
cd /opt/lms/lacm-v1.2
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py createsuperuser
```

### HTTPS (free, auto-renewing)

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot automatically edits the Nginx config to add SSL and sets up a cron job for auto-renewal.

### Data backup

Exercise submissions and uploaded images are the most critical data. Back them up daily:

```bash
# Database dump
docker compose exec db pg_dump -U lms_user lms_db > backup_$(date +%F).sql

# Media files (exercise images, avatars)
tar -czf media_$(date +%F).tar.gz lacm-v1.2/media/
```

---

## Files Changed Summary

| File | Action | What changed |
|---|---|---|
| `content/models.py` | Modified | Added `ExerciseSubmission` class |
| `content/views.py` | Modified | Added `_grade_exercise()` helper; added `ExerciseSubmitView`, `ExerciseMyResultView`, `ExerciseResultsView`, `ExerciseStatsView`; patched `PublishedLessonDetailView` to strip correct answers |
| `content/urls.py` | Modified | Registered 4 new URL patterns; updated imports |
| `content/admin.py` | Modified | Registered `ExerciseSubmissionAdmin` |
| `frontend/src/api/exercises.js` | Created | API helpers: `getExerciseResults`, `getExerciseStats`, `submitExercise`, `getMyResult` |
| `frontend/src/pages/teacher/ExerciseBuilder.jsx` | Created | Custom teacher exercise creation UI (replaces Survey Creator) |
| `frontend/src/pages/teacher/LessonEditor.jsx` | Modified | Removed Survey Creator imports and `ExerciseEditor`; added `ExerciseBuilder`; added Performance button |
| `frontend/src/pages/student/StudentPortalLesson.jsx` | Modified | Replaced `ExerciseViewer` with grading + result display; added `exerciseToSurveyJSON` and `ExerciseResult` |
| `frontend/src/pages/teacher/ExercisePerformance.jsx` | Created | Student × exercise performance grid with detail modal |
| `frontend/src/App.jsx` | Modified | Added `/teacher/lessons/:lessonId/performance` route |
| `frontend/package.json` | Modified (optional) | Remove `survey-creator-core` and `survey-creator-react` |
