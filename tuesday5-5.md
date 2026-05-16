# Updates — Tuesday 5/5/2026

## Content Direction (RTL / LTR) Support

### Problem
There was no way for instructors to specify the text direction (RTL or LTR) when adding content sections to a lesson. Arabic and other RTL content was not rendered correctly on the student side.

---

### Changes

#### 1. `frontend/src/pages/teacher/LessonEditor.jsx` — Content Editor

- Added `direction` state initialized from `section.content_body?.direction` (defaults to `'ltr'`).
- Added **LTR** and **RTL** toggle buttons at the end of the toolbar (with active highlighting to show the current selection).
- Applied the `direction` style directly to `<EditorContent>` so the editor preview reflects the chosen direction in real time.
- Included `direction` in the save payload: `content_body: { html: editor.getHTML(), direction }`.

#### 2. `frontend/src/pages/student/StudentPortalLesson.jsx` — Section Renderer

- In `SectionView`, the `lesson-prose` div now reads `section.content_body.direction` and applies it as a CSS `direction` property.
- Defaults to `'ltr'` for existing content that has no direction saved.

---

## Quran Learning Features

**Goal:** Integrate a full Quran learning experience into the platform — browse ayahs, search by keyword, memorization quiz, tafsir display — available as a standalone page for all authenticated users and as an embedded content block inside quran-track lessons.

---

### New Files

#### `frontend/src/api/quran.js`

Al-Quran Cloud API client (`https://api.alquran.cloud/v1`). No authentication required — public API called directly from the frontend.

- `getSurahs()` → `GET /v1/surah` — full list of 114 surahs with metadata
- `getSurahEditions(number, editions[])` → `GET /v1/surah/{n}/editions/{e1,e2,...}` — full surah text in multiple editions at once
- `getSurah(number, edition)` → `GET /v1/surah/{n}/{edition}` — single edition
- `searchQuran(keyword)` → `GET /v1/search/{keyword}/all/ar` — Arabic keyword search
- `audioUrl(globalNum)` → returns CDN URL for Alafasy recitation audio
- `mergeEditions(editionsData)` → utility that zips the parallel edition arrays into `{ number, numberInSurah, arabic, english, tafsir }` objects

#### `frontend/src/pages/QuranPage.jsx`

Standalone Quran explorer at `/quran`. Three-tab layout.

**Browse tab**
- Surah dropdown (all 114 surahs, loaded once on mount)
- Colored surah header (name in Arabic and English)
- Per-ayah card: numbered circle, Arabic text (RTL, Amiri font), English translation, ▶ Listen / ⏸ Pause audio button (HTML5 Audio via CDN), collapsible تفسير (ar.muyassar) panel
- Fetches all three editions in a single API call per surah

**Search tab**
- Arabic RTL text input + Search button
- Up to 10 results; each shows surah name, ayah reference, and the Arabic text with the matched keyword highlighted in yellow (`<mark>`)
- Friendly empty/error states for children

**Memorize tab** — "What comes after this ayah?"
- Difficulty selector: **Juz Amma** (random surah 78–114) or **Choose a Surah** (any of 114)
- On start: loads the chosen surah, shuffles eligible ayahs (all except the last), samples up to 10 as questions
- Each question: shows the current ayah (Arabic + English) and 4 options — the correct next ayah + up to 3 distractors from the same surah, all shuffled
- On answer: immediate feedback overlay — encouraging praise on correct (8 rotating messages), gentle correction with "correct answer highlighted in green" on wrong
- Session score badge (correct / total) always visible
- Done screen: emoji + percentage + tailored message; "Try Again" and "New Quiz" buttons
- Entirely client-side — no backend calls, no score persistence

---

### Modified Files

#### `frontend/src/App.jsx`

- Added `import QuranPage from './pages/QuranPage'`
- Added route: `<Route path="/quran" element={<ProtectedRoute><QuranPage /></ProtectedRoute>} />` in the "available to all authenticated users" section (same pattern as `/notifications`)

#### `frontend/src/components/Layout.jsx`

- Added a **Quran** sidebar link (book icon) visible to all authenticated roles, placed between the role-specific nav section and "My Profile"

#### `content/models.py`

- Added `('quran_display', 'Quran Display')` to `LessonSection.SECTION_TYPE_CHOICES`
- No migration needed — Django does not enforce `CharField` choices at the database level; DRF `ModelSerializer` auto-generates the updated `ChoiceField` from the model

#### `frontend/src/pages/teacher/LessonEditor.jsx`

- Added `import { getSurahs } from '../../api/quran'`
- Extended `TYPE_ICON` and `TYPE_LABEL` constants with the `quran_display` entry (`☪` / `'Quran Block'`)
- Added `QuranBlockEditor` component (renders when `selectedSection.type === 'quran_display'`):
  - Section title input
  - Surah dropdown (loaded from Al-Quran Cloud on mount, shows name + translation + ayah count)
  - First ayah / Last ayah number inputs (clamped to surah bounds)
  - Preview hint showing what will be displayed to students
  - Saves `content_body: { surah, ayah_start, ayah_end }` via the existing `updateSection()` API call
- Added `'quran_display'` to the section-type button row in the create form with a matching hint line
- Added `{selectedSection.type === 'quran_display' && <QuranBlockEditor … />}` to the editor panel switch

#### `frontend/src/pages/student/StudentPortalLesson.jsx`

- Added `import { getSurahEditions, mergeEditions, audioUrl } from '../../api/quran'`
- Added `QuranDisplaySection` component (renders when `section.type === 'quran_display'`):
  - Reads `content_body.{ surah, ayah_start, ayah_end }` saved by the teacher
  - On mount: fetches the configured ayah range (ar.uthmani + en.sahih + ar.muyassar) from the Quran API
  - Renders a styled card with a primary-colored header (surah name in Arabic and English)
  - Per-ayah: numbered circle, Arabic text (RTL, Amiri font), English translation, ▶/⏸ audio button, collapsible تفسير panel
  - Loading spinner and graceful error state
- Added `{section.type === 'quran_display' && <QuranDisplaySection … />}` to `SectionView`

---

### Files changed summary

| File | Change |
|---|---|
| `frontend/src/api/quran.js` | **New** — Al-Quran Cloud API client + `mergeEditions` helper |
| `frontend/src/pages/QuranPage.jsx` | **New** — Standalone explorer (Browse / Search / Memorize tabs) |
| `frontend/src/App.jsx` | Added `/quran` route |
| `frontend/src/components/Layout.jsx` | Added Quran sidebar link (all roles) |
| `content/models.py` | Added `quran_display` to `LessonSection.SECTION_TYPE_CHOICES` |
| `frontend/src/pages/teacher/LessonEditor.jsx` | Added `QuranBlockEditor` + wired into section type buttons and editor panel |
| `frontend/src/pages/student/StudentPortalLesson.jsx` | Added `QuranDisplaySection` + wired into `SectionView` |
