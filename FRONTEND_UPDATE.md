# Frontend Update — Nūr LMS Design System

## Overview

This document covers the visual redesign applied to the **admin**, **teacher**, and **parent** portals in `lacm-v1.2/frontend/`. The **student** portal retains its separate "Kiddo" child-friendly theme.

The new design system is named **Nūr LMS** (نور — "light" in Arabic). It uses an indigo-primary palette with a dark sidebar, clean typography, and role-colored accent tones throughout.

---

## Files Changed / Created

### New files

| File | Purpose |
|------|---------|
| `src/components/NurUI.jsx` | Shared component library: Icon, PageHeader, StatCard, Avatar, ToastProvider |

### Modified files

| File | Change summary |
|------|---------------|
| `index.html` | Added Google Fonts (Plus Jakarta Sans, Cairo, JetBrains Mono) |
| `src/index.css` | Full Nūr token system, sidebar redesign, updated cards/buttons/badges/tables |
| `src/components/Layout.jsx` | Dark sidebar with ن logo, icon nav links, avatar initials, styled logout |
| `src/pages/teacher/TeacherDashboard.jsx` | Real stats from API, subject group cards with track stripes |
| `src/pages/admin/Invitations.jsx` | Icon buttons, token box, cleaner layout |
| `src/pages/admin/RegistrationRequests.jsx` | Icon approve/reject buttons, Nūr page header |
| `src/pages/admin/Users.jsx` | Avatar initials per user, role filter pills, stat cards |
| `src/pages/admin/UserProfile.jsx` | PageHeader with back navigation |
| `src/pages/admin/StudentRequests.jsx` | Icon buttons, surface-2 inline credential form |
| `src/pages/parent/Students.jsx` | Credential cards with monospace username, copy button |

---

## Design Tokens

All tokens are defined as CSS custom properties in `src/index.css` under `:root`.

### Color palette

```css
/* Backgrounds */
--bg:         #F6F7FB   /* page background */
--surface:    #FFFFFF   /* card / panel surface */
--surface-2:  #F0F2F8   /* subtle inner surface (table head, form inner) */

/* Typography */
--ink:        #0F172A   /* primary text */
--ink-2:      #334155   /* secondary text */
--ink-soft:   #64748B   /* muted / placeholder text */
--line:       #E5E8F0   /* borders and dividers */

/* Primary — Indigo */
--primary:       #4F46E5
--primary-dark:  #3730A3
--primary-light: #EEF0FF

/* Accent tones (each with a light variant) */
--teal:    #0F9488    --teal-l:    #CCFBF1
--amber:   #D97706    --amber-l:   #FEF3C7
--rose:    #E11D48    --rose-l:    #FFE4E6
--emerald: #059669    --emerald-l: #D1FAE5
--violet:  #7C3AED    --violet-l:  #EDE9FE
```

### Shadows & radii

```css
--shadow-sm: 0 1px 2px rgba(15,23,42,.05)
--shadow:    0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)
--shadow-md: 0 4px 6px  rgba(15,23,42,.06), 0 2px 4px  rgba(15,23,42,.04)
--shadow-lg: 0 10px 25px rgba(15,23,42,.08), 0 4px 6px rgba(15,23,42,.04)

--radius:    8px
--radius-lg: 12px
--radius-xl: 16px
```

### Typography

```css
font-family: 'Plus Jakarta Sans', 'Cairo', system-ui, sans-serif;
/* monospace: 'JetBrains Mono' — used in token/credential boxes */
```

---

## Component Library — `NurUI.jsx`

Import from `../../components/NurUI` (admin/teacher/parent pages) or `../components/NurUI` (Layout).

---

### `<Icon name="..." size={18} color="currentColor" />`

SVG icon component. Available names:

| Name | Used for |
|------|----------|
| `dashboard` | Teacher dashboard nav |
| `users` | Users page, My Students |
| `user` | Single user |
| `book` | Subject groups, content |
| `mail` | Invitations |
| `clipboard` | Registration requests |
| `shield` | Permissions / center admin |
| `school` / `academic` | Student requests |
| `check` | Approve actions |
| `x` | Reject / close |
| `plus` | Create actions |
| `search` | Filter inputs |
| `edit` | Edit user button |
| `trash` | Delete user button |
| `logout` | Sign out |
| `copy` | Copy invitation link / username |
| `eye` | Published lessons count |
| `building` | Centers |
| `bell` | Pending count |
| `list` | Lessons list |
| `grid` | Grid view |
| `star` | Ratings (future use) |
| `settings` | Settings |
| `lock` | Lock / credentials |
| `chevronL` | Back arrow |
| `chevron` | Forward arrow |

**Example:**
```jsx
import { Icon } from '../../components/NurUI'

<Icon name="check" size={16} color="#fff" />
```

---

### `<PageHeader title="..." subtitle="..." actions={...} back="..." onBack={fn} />`

Standardized page header used on every portal page.

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | H1-level page title |
| `subtitle` | string | Muted descriptive text below title |
| `actions` | ReactNode | Buttons rendered top-right (e.g. "Create" button) |
| `back` | string | If set, renders a back link with this label |
| `onBack` | function | Click handler for the back link |

**Example:**
```jsx
<PageHeader
  title="Users"
  subtitle="Manage all registered users and their permissions."
  actions={<button className="btn btn-primary btn-sm">+ Invite</button>}
/>

<PageHeader
  title="Edit User"
  back="Back to Users"
  onBack={() => navigate('/admin/users')}
/>
```

---

### `<StatCard icon="..." value={n} label="..." tone="primary" delta="..." />`

Metric card used in dashboard stat rows. Renders a colored icon square alongside a large number and label.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | string | — | Icon name (see Icon component) |
| `value` | number\|string | `—` | The metric value |
| `label` | string | — | Short label below the value |
| `tone` | string | `primary` | Color tone: `primary` `teal` `amber` `rose` `emerald` `violet` |
| `delta` | string | — | Optional trend text below value |

Place inside `.stats-row` for a responsive grid:

```jsx
import { StatCard } from '../../components/NurUI'

<div className="stats-row">
  <StatCard icon="users"    label="Total Users"  value={42}  tone="primary" />
  <StatCard icon="academic" label="Teachers"     value={12}  tone="teal"    />
  <StatCard icon="user"     label="Parents"      value={28}  tone="violet"  />
  <StatCard icon="shield"   label="Admins"       value={2}   tone="amber"   />
</div>
```

---

### `<Avatar name="Sara Doe" size={36} />`

Renders a square avatar with gradient background and initials derived from the name.

| Prop | Type | Default |
|------|------|---------|
| `name` | string | `''` |
| `size` | number | `36` |

```jsx
import { Avatar } from '../../components/NurUI'

<Avatar name={user.name} size={40} />
```

---

### `<ToastProvider>` / `useToast()`

Wrap your app (or page subtree) in `<ToastProvider>` to enable toast notifications. Then call `useToast()` to get the `toast` object.

**Setup** — already applicable at the `<App>` level or per page:
```jsx
import { ToastProvider } from './components/NurUI'

function App() {
  return (
    <ToastProvider>
      {/* ...routes */}
    </ToastProvider>
  )
}
```

**Usage in a page component:**
```jsx
import { useToast } from '../../components/NurUI'

const toast = useToast()

// On successful save:
toast.success('User saved successfully.')

// On error:
toast.error('Failed to delete. Please try again.')

// Informational:
toast.info('Invitation link copied to clipboard.')
```

Toasts auto-dismiss after 3.5 seconds and stack bottom-right.

---

## CSS Class Reference

These existing classes are updated to use Nūr tokens and remain available across all pages.

### Layout

```css
.app-layout          /* flex row: sidebar + main */
.main-content        /* margin-left: 248px; padding: 32px */
```

### Cards

```css
.card                /* white surface, border, shadow */
.card-header         /* padded header with flex-between built in */
.card-body           /* padded body */
```

### Buttons

```css
.btn                 /* base */
.btn-primary         /* indigo fill */
.btn-success         /* emerald fill */
.btn-danger          /* rose fill */
.btn-outline         /* border, white bg */
.btn-sm              /* small padding */
.btn-full            /* width: 100% */
```

### Badges

```css
.badge               /* pill base */
.badge-pending       /* amber */
.badge-approved      /* emerald */
.badge-rejected      /* rose */
.badge-active        /* emerald */
.badge-used          /* gray */
.badge-teacher       /* indigo */
.badge-parent        /* violet */
.badge-center_admin  /* amber */
```

### Stat Row

```css
.stats-row           /* responsive grid, 4 columns */
.stat-card           /* individual card with icon + info */
.stat-icon           /* colored icon square (set bg manually) */
.stat-info           /* text block */
.stat-label          /* uppercase muted label */
.stat-value          /* large number */
.stat-delta          /* small trend text */
```

### Tabs

```css
.tabs                /* flex row with bottom border */
.tab                 /* individual tab button */
.tab.active          /* indigo underline */
```

### Forms

```css
.form-group          /* margin wrapper */
.form-label          /* bold label */
.form-control        /* input / select / textarea */
.form-hint           /* small helper or error text */
```

### Alerts

```css
.alert               /* base */
.alert-success       /* emerald */
.alert-error         /* rose */
.alert-info          /* indigo */
.alert-warning       /* amber */
```

### Token / Monospace Box

```css
.token-box           /* JetBrains Mono, surface-2 bg — for credentials/links */
```

### Toasts

```css
.toast-stack         /* fixed bottom-right stack */
.toast               /* individual toast */
.toast-success / .toast-error / .toast-info
```

---

## Sidebar

The sidebar is rendered by `Layout.jsx`. It is **fixed, dark** (`--ink` background, 248 px wide).

Structure:
```
┌─────────────────────────┐
│  ن  Nūr LMS             │  ← logo mark + wordmark
│     Learning Management │
├─────────────────────────┤
│  [avatar]  User Name    │  ← gradient initials avatar
│            Role label   │
├─────────────────────────┤
│  SECTION LABEL          │  ← .sidebar-nav-section
│  ▪ Icon  Nav Item       │  ← .sidebar-link (+ .active)
│  ...                    │
├─────────────────────────┤
│  ↩ Sign Out             │  ← .sidebar-logout-btn
└─────────────────────────┘
```

Nav items shown are gated by the user's role and permissions (same logic as before).

---

## Student Portal

The student portal (`/student`, `/student/content`, `/student/lessons/:id`) uses a **separate "Kiddo" design system** and is not affected by this update.

Files:
- `src/pages/student/kiddo-theme.css` — Kiddo CSS variables + animations
- `src/pages/student/kiddo-components.jsx` — KiddoMascot, KiddoIcon, KProgress, KSpinner, KPill

---

## Tone Mapping by Role / Context

| Context | Tone | Color |
|---------|------|-------|
| Admin / Primary actions | `primary` | Indigo `#4F46E5` |
| Teachers / Content | `teal` | `#0F9488` |
| Parents / Personal | `violet` | `#7C3AED` |
| Approved / Success | `emerald` | `#059669` |
| Pending / Warning | `amber` | `#D97706` |
| Rejected / Error | `rose` | `#E11D48` |

---

## Browser Support

Targets modern browsers (Chrome 90+, Firefox 90+, Safari 15+). Uses CSS custom properties and native `font-family` fallbacks; no polyfills required.
