# RivaMeet Web

Angular frontend for **RivaMeet**, a sports coach discovery and booking platform.

It talks to the existing RivaMeet Express API (`../src`) over REST, implements the whole
product surface (discovery, coach profiles, booking requests, client and coach
dashboards) and ships full Arabic / French / English localisation with Arabic RTL as the
default.

> The backend was not modified. Everything the UI needs comes from the API's real routes,
> and anything the API does not support is shown as a disabled / coming-soon state instead
> of being faked.

---

## Requirements

| Tool | Version used |
| --- | --- |
| Node.js | 24.x |
| npm | 11.x |
| Angular CLI | 22.2 (local dev dependency, run through `npx`) |

## Install

```bash
cd frontend
npm install
```

## Run

Start the backend first (from the repository root):

```bash
npm run db:start     # embedded PostgreSQL for development
npm run dev          # API on http://localhost:4000
```

Then start the frontend:

```bash
cd frontend
npm start            # http://localhost:3000
```

`npm start` serves on **port 3000** on purpose: the API's CORS allow-list is driven by the
backend's `FRONTEND_URL` environment variable, whose default is `http://localhost:3000`.
If you serve the frontend from another origin, either add it to `FRONTEND_URL`
(comma-separated list) or the browser will block every request.

### Production build

```bash
cd frontend
npm run build        # outputs dist/rivameet-web/browser
npm run watch        # development build in watch mode
```

---

## Configuring the API URL

The API base URL lives in the Angular environment files:

| File | Used for |
| --- | --- |
| `src/environments/environment.ts` | `ng serve` / development builds |
| `src/environments/environment.production.ts` | production builds (wired through `fileReplacements` in `angular.json`) |

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api/v1', // <-- change this
  enableMockFallback: true,               // development only (see below)
  defaultLanguage: 'ar',
  showDevHints: true,
};
```

* `apiUrl` must include the `/api/v1` prefix. Point it at any deployed instance.
* The Swagger UI link in the footer is derived from the same value (`/docs` on the API
  root), so it follows the configured host automatically.
* **No secrets are stored in the frontend.** The only credential the browser holds is the
  JWT access token returned by `/auth/login`, and the API re-verifies it on every request.
  WebRTC ICE servers (STUN/TURN) are fetched per call from `/calls/config`; short-lived TURN
  credentials are never compiled into the bundle or written to the environment files.
  Off-platform contact moderation is mirrored in the chat composer for instant feedback,
  but every message is re-checked by the backend.

---

## Languages

Three languages ship with the app:

| Code | Language | Direction |
| --- | --- | --- |
| `ar` | العربية | `rtl` (default) |
| `fr` | Français | `ltr` |
| `en` | English | `ltr` |

* **Translation files:** `src/app/i18n/ar.json`, `fr.json`, `en.json`. They are plain
  JSON dictionaries with identical key sets, bundled at build time (no extra HTTP request,
  so switching is instant).
* **Service:** `src/app/core/i18n/locale.service.ts` exposes `t(key, params)`, the language
  and direction signals, CLDR plural selection (`zero` / `one` / `two` / `few` / `many` /
  `other`) and `Intl` formatting helpers for numbers, money, dates and time ranges.
* **Pipe:** `{{ 'nav.coaches' | t }}` and `{{ 'common.reviewCount' | t: { count: 3 } }}`
  (`src/app/core/i18n/translate.pipe.ts`). Components never branch on the language.
* **Selector:** `src/app/shared/language-selector/language-selector.component.ts` — a
  visible, keyboard-accessible dropdown in the header and the footer.
* **Persistence:** the choice is stored under `rivameet.language` in `localStorage`, so it
  survives navigation and reloads.
* **Direction:** `LocaleService` mirrors `lang` + `dir` onto `<html>` (and the root
  component), every layout uses CSS **logical properties** (`inline-start` / `padding-inline`
  / `text-align: start`), and directional icons carry a `.dir-icon` class that is mirrored
  for RTL. Styles are written so both directions look intentional rather than flipped.

### Adding a language

1. Copy `src/app/i18n/en.json` to e.g. `src/app/i18n/es.json` and translate the values.
2. Register it in `src/app/core/i18n/locale.service.ts`:
   `LANGUAGES` (code, endonym label, direction, `Intl` locale) and `DICTIONARIES`.
3. Nothing else — every component picks the language up automatically.

---

## Design system

* Tokens live in `src/styles.scss` (`:root` custom properties): deep navy for heroes and
  dark panels, warm off-white page surfaces, a bright cyan accent, a consistent
  radius/shadow/motion scale, and a type scale with editorial display headings. The legacy
  `--forest-*` / `--lime-*` token names are kept so every component keeps resolving them.
* Reusable primitives are global classes (`.btn`, `.card`, `.chip`, `.badge`, `.field`,
  `.input`, `.alert`, `.skeleton`, `.shell`, `.section`) so pages compose rather than
  re-style.
* Fonts: *Plus Jakarta Sans* for Latin, *IBM Plex Sans Arabic* for Arabic, both loaded from
  Google Fonts with `display=swap` and a complete local fallback stack, so the app stays
  usable offline.
* Icons are hand-drawn inline SVGs (`src/app/shared/icon/icon.component.ts`) — no icon font,
  no emoji, no runtime dependency. The RivaMeet emblem itself is an inline SVG in
  `src/app/shared/brand/brand.component.ts`, mirrored by the `public/favicon.svg` tab icon.
* Photography is decorative only and centralised in `src/app/shared/media.ts`. Every image
  goes through `SmartImageComponent`, which swaps a failed/absent image for a branded
  gradient (with a monogram) instead of a broken-image icon.

---

## Project structure

```
src/app/
├── core/
│   ├── api/            ApiService (envelope unwrapping + error normalisation), ApiError
│   ├── auth/           session + token signals, persisted session
│   ├── guards/         authGuard, guestOnlyGuard, roleGuard
│   ├── i18n/           LocaleService, TranslatePipe, I18nTitleStrategy
│   ├── interceptors/   bearer-token interceptor, session-expiry interceptor
│   ├── models/         API envelopes and domain models (mirror the backend presenters)
│   ├── offline/        development-only sample catalogue + offline preview service
│   ├── services/       sports, coaches, bookings, reviews
│   ├── ui/             toast notifications
│   ├── utils/          JWT decoding, safe storage, URL ⇄ filter mapping
│   └── validators/     validators mirroring the backend auth schema
├── features/           home, coaches, coach-detail, auth, dashboard, coach-studio, not-found
├── layouts/            site layout (header, footer, toasts, offline banner)
└── shared/             header, footer, language selector, coach card, rating, search form,
                        booking status badge, state panel, avatar, icons, smart image
```

---

## Pages

| Route | Description |
| --- | --- |
| `/` | Hero with search, live sport categories, top-rated coaches, how-it-works (client/coach tabs), coach call-to-action, trust section |
| `/coaches` | Search results: sport, city, neighbourhood, price range, minimum rating, opt-in distance filter, sorting and pagination. Filters live in the URL. |
| `/coaches/:id` | Coach profile: bio, sports, location, rating, reviews (paginated), availability windows and a booking request form |
| `/login`, `/register` | Authentication; registration has a client/coach role picker and mirrors the backend's validation rules |
| `/dashboard` | Client area: bookings with status filters and the actions the API allows (cancel, review) |
| `/coach/dashboard` | Coach studio: profile create/edit + publish, sports, availability windows, incoming requests (accept/reject/complete) |
| any other path | Polished 404 page |

---

## Backend integration notes

### Routes actually used

* `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
* `GET /sports`
* `GET /coaches`, `GET /coaches/:id`, `GET /coaches/:id/reviews`
* `GET|POST|PATCH /coaches/me/profile`, `GET|PUT|POST /coaches/me/sports`,
  `DELETE /coaches/me/sports/:sportId`
* `GET|POST /coaches/me/availability`, `DELETE /coaches/me/availability/:availabilityId`
* `POST /bookings`, `GET /bookings/mine`, `GET /bookings/:id`,
  `PATCH /bookings/:id/{accept,reject,cancel,complete}`, `POST /bookings/:id/review`

### Behaviour that follows the API, not the UI

* Money is handled as the 2-decimal **string** the API returns (`"45.00"`) and formatted
  with `Intl`, never parsed into a float.
* Booking statuses, permitted transitions and roles are the backend's: the client sees
  cancel/review, the coach sees accept/reject/complete, and the buttons are derived from
  the booking's current status.
* Session length is bounded to 15 min – 12 h and a request must fit entirely inside one of
  the coach's open availability windows, so the booking form only ever offers start times
  and durations that are valid.
* A 401 on a request that carried a token clears the session and sends the user back to
  the login screen; a 401 from `/auth/login` stays inline as "wrong credentials".
* Backend `VALIDATION_ERROR` details are mapped back onto the matching form fields
  (`errors.fields.<path>`), so server-side validation is translated too.
* Every mutation is followed by a refetch — the UI never assumes the new state.

### Endpoints that do not exist (and what the UI does instead)

| Idea | Status |
| --- | --- |
| Coach photos | There is no photo column on `coach_profiles`. Coach cards render a name-derived monogram avatar; photography is used only for decorative sections. |
| Forgot / reset password | Not implemented in the API. The login page does not link to a dead page. |
| Booking payment | Not implemented. The UI states that payment happens directly with the coach. |
| Update / delete a booking's details | Only the status transitions above exist. There is no edit form. |
| Cancel a review | Reviews are immutable (one per completed booking). |
| Coach profile deletion | Not exposed. |
| Any admin UI | The API has `ADMIN` but exposes no admin routes, so there is no admin area. |

### Development-only offline preview

`environment.enableMockFallback` (development: `true`, production: `false`) allows the
read-only screens to fall back to sample data **when the API is unreachable** (connection
refused / CORS, i.e. HTTP status 0). When that happens:

* a persistent amber banner appears at the top of every page saying the data is not real;
* the fixtures (`src/app/core/offline/mock-catalog.ts`) are loaded through a **dynamic
  import**, so they are a separate lazy chunk and are never part of a production bundle;
* **writes are never mocked** — login, registration, booking requests and profile updates
  always go to the real API and surface its real error, so no action can appear to succeed
  when it did not.

A production build disables the fallback entirely: if the API is down you get an error
state with a retry action, never sample data.

---

## Accessibility & UX

* Semantic landmarks (`header`, `nav`, `main`, `footer`), a skip link, and a visible focus
  ring that adapts to dark sections.
* Labelled form controls, `aria-invalid` + `aria-describedby` for field errors,
  `aria-expanded` / `aria-selected` / `aria-pressed` on menus, tabs, filters and toggles.
* Toasts are `role="status"` (errors act as `alert`) and re-translate on language change.
* `prefers-reduced-motion` disables animation and smooth scrolling.
* Loading, empty and error states exist for every asynchronous view, each with a retry or a
  useful next step.

---

## Build & checks

```bash
npm run build     # production build (also performs the full template + type check)
```

The build is the type/template gate for this project; `ng build` fails on any TypeScript or
Angular template error.
#   R I i v a M e e t _ F r o n t e n d -  
 