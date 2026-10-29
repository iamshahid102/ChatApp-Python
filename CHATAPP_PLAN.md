# ChatApp — Implementation Plan

**Version:** 1.0
**Status:** Planning (no code written yet)
**Scope:** 1:1 chat + group chat, installable PWA, simple UI matching the provided reference.

---

## 1. Goal

Build a small, production-shaped chat application where a user can:

1. Register / log in.
2. Start a **1:1 chat** with another registered user.
3. Start a **group chat** and add members.
4. Send and receive **text messages in real time**.
5. Use the same app in **three ways**:
   - Browser tab.
   - Installed PWA app (Android / iOS home screen).
   - Desktop app shortcut (Chrome / Edge "Install", opened in its own standalone window).

Everything else is deliberately **out of scope** for v1. Simplicity is a feature here.

### Success criteria (v1)

- Two browsers logged in as different users exchange messages with sub-second delivery.
- A group of 3+ users sees every message without refreshing.
- Lighthouse PWA / installability checks pass (manifest + service worker + HTTPS + icons).
- App installs on Android, iOS (Add to Home Screen) and desktop Chrome/Edge, and opens standalone.
- Message history survives refresh, navigation and app restart.
- One consistent design language across desktop and mobile, matching the reference.

---

## 2. Scope

### In scope (MUST)

| # | Feature | Notes |
|---|---------|-------|
| F1 | Email/username + password auth | Minimal: register, login, logout, "me" endpoint |
| F2 | 1:1 chat | One conversation per user pair, auto-created on first message |
| F3 | Group chat | Create group with name + member selection, add members later |
| F4 | Text messages | Real-time via WebSocket, paginated history, optimistic send |
| F5 | Conversation list | Sorted by last activity, unread badge, active state |
| F6 | Presence (online/offline) | Derived from live WebSocket connections only |
| F7 | PWA | Manifest, service worker, install button, offline shell |
| F8 | Responsive UI | Mobile single pane, desktop 2–3 pane |
| F9 | Basic profile | Display name + avatar initials (no image upload) |

### Out of scope (explicitly NOT in v1)

Attachments / image upload, voice notes, calls, read receipts, typing indicator, message edit/delete, reactions, replies/threads, search, push notifications, email verification, password reset, OAuth/social login, end-to-end encryption, multi-device session management, admin panel, i18n, dark mode toggle.

> Rule for the implementer: if it is not in the F1–F9 table, do not build it. Keep the plan honest.

### Assumptions

- Users are identifiable by a unique `username` (3–24 chars, alphanumeric + `_`), plus a display name.
- Group size cap: 50 members (guard only, not a UI feature).
- Message body: plain text, 1–2000 chars, no HTML. Links are auto-linked on render only.
- One shared MongoDB database; no sharding, no replica-set-only features.
- MVP auth = JWT bearer token (trade-off documented in §12.3).

---

## 3. Tech stack

### Frontend (`/frontend`)

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix primitives, copied into repo) |
| Icons | lucide-react |
| Forms / validation | react-hook-form + zod |
| Server state | TanStack Query v5 |
| Auth/session store | Zustand (small, in-memory) |
| Toasts | sonner |
| PWA | `app/manifest.ts` + Serwist (`@serwist/next`) service worker |
| Fonts | `next/font` → Inter Tight (variable) |

### Backend (`/backend`)

| Concern | Choice |
|---|---|
| Framework | FastAPI (Python 3.12) |
| ASGI server | Uvicorn (dev) / Gunicorn + Uvicorn workers (prod) |
| Validation | Pydantic v2 + pydantic-settings |
| DB driver | Motor (async MongoDB) |
| Auth | PyJWT (HS256) + `passlib[argon2]` password hashing |
| Real-time | FastAPI native WebSockets (`/ws`) |
| Tests | pytest + pytest-asyncio + httpx `AsyncClient` |
| Lint/format | Ruff, mypy (basic) |

### Infra

- MongoDB Atlas (M0 free tier) — single database `chatapp`.
- Frontend: Vercel. Backend: Render (WebSocket supported) or Fly.io/Railway.
- HTTPS everywhere (required for PWA + secure WS).

---

## 4. Architecture

```
┌────────────────────────────┐        HTTPS (REST)         ┌──────────────────────────┐
│ Next.js PWA (Vercel)       │ ──────────────────────────▶ │ FastAPI (Render)         │
│  App Router + RSC          │                             │  /api/v1/*               │
│  TanStack Query            │ ◀────────────────────────── │  JWT auth middleware     │
│  Service Worker (Serwist)  │        WSS (chat)           │  WebSocket hub           │
└────────────────────────────┘ ◀──────────────────────────▶ │        │                 │
                                                            │        ▼                 │
                                                            │  Motor (async)           │
                                                            └────────┬─────────────────┘
                                                                     ▼
                                                            ┌──────────────────────────┐
                                                            │ MongoDB Atlas            │
                                                            │ users / conversations /  │
                                                            │ messages                 │
                                                            └──────────────────────────┘
```

**Key decisions**

1. **REST for data, WebSocket for events.** History and lists are normal GETs (cacheable, testable). The socket only carries new messages, presence, and membership changes.
2. **Server is the source of truth.** Client sends `client_id` (UUID) with each message; server persists once and echoes it back. The client swaps its optimistic bubble for the server copy.
3. **No Redis for v1.** A single backend instance keeps an in-memory `user_id → set[WebSocket]` hub. If we ever scale to >1 instance, swap the hub for Redis pub/sub (documented, not built).
4. **Separate deployables.** `frontend/` and `backend/` are independent apps with their own env, build and deploy. No shared workspace tooling required.
5. **Group membership checked on every send.** Socket broadcast fans out only to current members fetched per conversation.

---

## 5. Repository layout

```
/
├─ CHATAPP_PLAN.md            ← this file
├─ README.md                  ← setup + run instructions (created in Phase 0)
├─ .gitignore
├─ frontend/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ globals.css          ← design tokens (§8)
│  │  ├─ manifest.ts          ← PWA manifest
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (auth)/register/page.tsx
│  │  ├─ (app)/layout.tsx     ← auth guard + app shell
│  │  ├─ (app)/chat/page.tsx  ← empty state ("select a chat")
│  │  └─ (app)/chat/[id]/page.tsx
│  ├─ components/
│  │  ├─ ui/                  ← shadcn generated components
│  │  ├─ chat/MessageBubble.tsx, MessageList.tsx, Composer.tsx, ChatHeader.tsx
│  │  ├─ sidebar/ConversationList.tsx, ConversationItem.tsx, ProfileCard.tsx
│  │  ├─ group/CreateGroupDialog.tsx, AddMembersDialog.tsx
│  │  └─ pwa/InstallPrompt.tsx
│  ├─ lib/api.ts, ws.ts, query-client.ts, utils.ts
│  ├─ hooks/useChatSocket.ts, useMessages.ts, useConversations.ts
│  ├─ store/session.ts
│  ├─ types/api.ts            ← shared TS types mirroring backend schemas
│  ├─ public/icons/           ← 192, 512, maskable, apple-touch
│  ├─ sw.ts                   ← Serwist service worker
│  └─ package.json
└─ backend/
   ├─ app/
   │  ├─ main.py              ← app factory, CORS, routers, lifespan
   │  ├─ core/config.py       ← settings (env)
   │  ├─ core/security.py     ← hash/verify, JWT encode/decode
   │  ├─ db/mongo.py          ← Motor client, index creation on startup
   │  ├─ api/deps.py          ← get_current_user, get_db
   │  ├─ api/routes/auth.py, users.py, conversations.py, messages.py
   │  ├─ ws/router.py         ← /ws endpoint
   │  ├─ ws/hub.py            ← in-memory connection registry
   │  ├─ models/schemas.py    ← Pydantic request/response models
   │  └─ services/chat.py, users.py
   ├─ tests/
   ├─ requirements.txt
   ├─ .env.example
   └─ pyproject.toml          ← ruff + mypy config
```

---

## 6. Data model (MongoDB)

### `users`

```jsonc
{
  "_id": ObjectId,
  "username": "emily",            // unique, lowercase
  "display_name": "Emily Carter",
  "password_hash": "$argon2id...",
  "avatar_color": "#C7F032",      // deterministic from username (7-color palette)
  "created_at": ISODate,
  "last_seen_at": ISODate
}
```

Index: `{ username: 1 }` unique.

### `conversations`

```jsonc
{
  "_id": ObjectId,
  "type": "direct" | "group",
  "name": "Design team",                  // group only
  "owner_id": ObjectId,                   // group only
  "members": [ { "user_id": ObjectId, "joined_at": ISODate } ],
  "direct_key": "id1:id2",                // direct only, sorted ObjectId hex pair
  "last_message": { "text": "…", "sender_id": ObjectId, "created_at": ISODate },
  "created_at": ISODate,
  "updated_at": ISODate
}
```

Indexes:
- `{ "members.user_id": 1, updated_at: -1 }` — sidebar query.
- `{ direct_key: 1 }` unique, partial `{ type: "direct" }` — prevents duplicate DMs.

### `messages`

```jsonc
{
  "_id": ObjectId,
  "conversation_id": ObjectId,
  "sender_id": ObjectId,
  "text": "Hi! My order was supposed to arrive yesterday.",
  "client_id": "uuid-v4",        // idempotency for optimistic send
  "created_at": ISODate
}
```

Indexes:
- `{ conversation_id: 1, created_at: -1, _id: -1 }` — history pagination.
- `{ conversation_id: 1, client_id: 1 }` unique — dedupe retries.

Denormalisation kept intentionally shallow: message sender info is resolved from a `users` map sent alongside the page (avoids per-message lookups).

---

## 7. API contract

Base: `/api/v1`. Auth: `Authorization: Bearer <jwt>` except where noted.
Errors: `{ "detail": "human readable message" }` with proper status codes.

### Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{username, display_name, password}` | `{token, user}` |
| POST | `/auth/login` | `{username, password}` | `{token, user}` |
| GET | `/auth/me` | — | `{user}` |
| POST | `/auth/logout` | — | `204` (client drops token) |

### Users

| Method | Path | Notes |
|---|---|---|
| GET | `/users?q=<text>&limit=20` | Search by username/display name, exclude self; used by "new chat" and group member picker |
| GET | `/users/{id}` | Public profile (`username`, `display_name`, `avatar_color`, `last_seen_at`) |

### Conversations

| Method | Path | Notes |
|---|---|---|
| GET | `/conversations` | List for current user, sorted by `updated_at desc`, includes `last_message`, `unread_count`, member summary |
| POST | `/conversations/direct` | `{user_id}` → get-or-create DM (race-safe via unique `direct_key`) |
| POST | `/conversations/group` | `{name, member_ids[]}` → create group incl. self as owner |
| GET | `/conversations/{id}` | Detail + members |
| POST | `/conversations/{id}/members` | `{user_ids[]}` → owner-only add |
| DELETE | `/conversations/{id}/members/{user_id}` | leave (self) or remove (owner) |

### Messages

| Method | Path | Notes |
|---|---|---|
| GET | `/conversations/{id}/messages?before=<ISO>&limit=30` | Cursor pagination, returns `{messages, users, has_more}` |
| POST | `/conversations/{id}/messages` | `{text, client_id}` → REST fallback for send (socket preferred) |

### WebSocket — `wss://<api>/ws?token=<jwt>`

Server closes with `4401` on invalid/expired token.
Envelope: `{ "type": string, "data": object }`.

**Client → server**

| type | data | Notes |
|---|---|---|
| `message.send` | `{conversation_id, text, client_id}` | Server validates membership + length, persists, fans out |
| `message.ack` | `{conversation_id, message_id}` | Mark conversation read for this user (clears unread) |
| `ping` | `{}` | Keepalive every 25s |

**Server → client**

| type | data | Notes |
|---|---|---|
| `ready` | `{user_id}` | Handshake complete |
| `message.new` | `{message, sender, conversation_id}` | To all online members |
| `message.sent` | `{message, client_id}` | Echo to sender (replaces optimistic bubble) |
| `conversation.updated` | `{conversation}` | New group added, membership change, title change |
| `presence` | `{user_id, online}` | On connect/disconnect |
| `error` | `{code, message, client_id?}` | e.g. `not_a_member`, `rate_limited`, `empty_message` |

Reconnect: exponential backoff 1s → 2s → 5s → 10s (cap), then on reconnect the client calls `GET /conversations` + refetches the open conversation's messages to fill gaps. No offline outbox in v1 — composer is disabled while disconnected.

---

## 8. UI/UX specification

Reference-driven. The goal is a calm, light "sage + lime + black" interface with big rounded cards, pill buttons, generous whitespace and zero visual noise.

### 8.1 Design tokens (`app/globals.css`)

```css
:root {
  /* surfaces */
  --page:        #B9BFB2;  /* sage page background */
  --surface:     #F1F1EE;  /* primary light card / chat panel */
  --surface-2:   #E4E5E0;  /* muted rows, inputs on surface */
  --surface-3:   #FFFFFF;  /* bubbles, pills, buttons */
  --ink:         #0D0D0D;  /* primary text, dark bubble, send button */
  --ink-soft:    #6B6F66;  /* secondary text, timestamps */
  --line:        #D8DAD3;
  --lime:        #C7F032;  /* accent: active item, header card, primary CTA */
  --lime-deep:   #B5DE22;  /* hover/pressed */
  --danger:      #C4472E;
  --online:      #7ED321;

  /* shape */
  --r-card: 24px;
  --r-bubble: 20px;
  --r-pill: 999px;

  /* type */
  --font-sans: "Inter Tight", ui-sans-serif, system-ui, sans-serif;
}
```

Tailwind mapping (v4 `@theme`): `--color-page`, `--color-surface`, `--color-ink`, `--color-lime`, `--radius-card`, etc. All components use tokens only — **no hardcoded hex in components**.

Semantics:
- **Lime** = "where you are / do this next" (active conversation, primary CTA, profile card).
- **Black** = high-emphasis surfaces + your own message bubble.
- **Off-white** = everything neutral. Never mix lime and black at equal weight inside one card.

### 8.2 Typography

- Family: **Inter Tight** (fallback system sans), loaded with `next/font/local`-style variable via `next/font/google`.
- Display / chat title: 30–34px, weight 600, `letter-spacing: -0.02em`.
- Section title ("Chats"): 20px / 600.
- Body & messages: 15px / 450–500, line-height 1.45.
- Meta (username, time, "#48213"): 12.5px / 450, `--ink-soft`.
- Sentence case everywhere. No ALL CAPS, no heavy shadows.

### 8.3 Components (shadcn + custom)

| Element | Spec |
|---|---|
| Profile / header card | Lime bg, `--r-card`, black circular avatar (initials, 40px), name 17/600, subtitle 12.5, optional thin progress bar like reference (used for PWA install progress? no — omit; keep just name + status) |
| Conversation row | Pill (`--r-pill`), 56px min-height. Active: black bg, white text, lime unread dot. Default: `--surface-2`. Hover: slightly darker. |
| Message bubble (own) | `--ink` bg, white text, radius 20px with bottom-right 6px, max-width 78% |
| Message bubble (other) | `--surface-3` bg, `--ink` text, radius 20px with bottom-left 6px; sender name only in groups |
| Message meta | 11.5px `--ink-soft`, below bubble, right-aligned for own |
| Day divider | centered 12px label in `--ink-soft` |
| Composer | `--surface-3` pill, `+` icon button (disabled/decorative slot), input, 44px black circular send button with light arrow-up. Enter sends, Shift+Enter newline |
| Empty state | Centered, 24px icon, one-line headline, one-line hint, no illustration |
| Buttons | Primary = lime pill w/ black text; Secondary = white pill w/ black text; Destructive = `--danger` text on `--surface-2` |
| Dialogs / sheets | Desktop: centered `--r-card` dialog. Mobile: bottom sheet (`Sheet` from shadcn) |

Component library usage: `button`, `input`, `textarea`, `avatar`, `dialog`, `sheet`, `scroll-area`, `dropdown-menu`, `skeleton`, `separator`, `form`, `sonner`. Nothing else.

### 8.4 Layout — desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  page bg: sage                                                        │
│  ┌───────────────┐  ┌──────────────────────────────────────────────┐ │
│  │ lime profile  │  │  chat panel (--surface, radius 28)           │ │
│  │ card          │  │  ┌ header: title 34/600 + presence + actions │ │
│  ├───────────────┤  │  └─────────────────────────────────────────────│ │
│  │ "Chats" + [+] │  │                                              │ │
│  │ conversation  │  │  scrollable message area                     │ │
│  │ rows (pills)  │  │                                              │ │
│  │               │  │  composer pill                               │ │
│  └───────────────┘  └──────────────────────────────────────────────┘ │
│     320–360px            flexible                                     │
└──────────────────────────────────────────────────────────────────────┘
```

- Page max-width 1400px, padding 24px, grid `360px 1fr`, gap 16px.
- Sidebar column scrolls independently; chat panel fills viewport height minus padding.
- Selected chat reflects in the URL (`/chat/[id]`) so deep links and PWA shortcuts work.
- `/chat` with no selection: chat panel shows empty state ("Pick a conversation").

### 8.5 Layout — mobile (<1024px)

- **Single pane, stacked navigation** using URL routes.
- List screen: sage page, lime profile card at top, then `Chats` list card; a floating black `+` pill button bottom-right opens "New chat / New group".
- Chat screen: **lime header card** at top (back chevron circle, avatar, name, presence, group info `i`), then message sheet (`--surface`, top radius 28) filling the rest, composer pinned above the safe area.
- Safe areas: `env(safe-area-inset-bottom)` padding on the composer; `viewport-fit=cover` in metadata.
- `display: standalone` after install — no browser chrome, so header must include everything needed.
- Tap targets ≥ 44px; no hover-only affordances.

### 8.6 Screens & states

| Screen | Route | Contents |
|---|---|---|
| Login | `/login` | Centered card: app name, username, password, lime "Sign in" pill, link to register |
| Register | `/register` | Display name, username, password, lime "Create account" |
| Chats list | `/chat` | Profile card, conversation list, new-chat action |
| Chat | `/chat/[id]` | Header, messages, composer |
| New chat | dialog/sheet | User search list, tap → create/get DM → navigate |
| New group | dialog/sheet | Group name + multi-select members → create → navigate |
| Group info | dialog/sheet | Member list, add members (owner), leave group |
| Install | inline banner + settings row | "Install app" button, hidden when `display-mode: standalone` |

States required for every data screen: **loading** (skeletons, no spinners), **empty**, **error** (retry pill), **offline** (top banner "You're offline — reconnecting…", composer disabled), **unauthorized** (redirect to `/login`).

### 8.7 Motion

Minimal: 120–180ms ease-out on hover/press, 200ms fade + 8px slide for new messages, 200ms sheet/dialog. Respect `prefers-reduced-motion`. No bounce, no spring, no parallax.

---

## 9. PWA specification

### 9.1 Manifest (`app/manifest.ts`)

```ts
{
  name: "ChatApp",
  short_name: "Chat",
  description: "Simple 1:1 and group chat.",
  start_url: "/chat",
  scope: "/",
  display: "standalone",
  orientation: "portrait-primary",
  background_color: "#B9BFB2",
  theme_color: "#B9BFB2",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ],
  shortcuts: [
    { name: "New chat", url: "/chat?new=1" },
    { name: "New group", url: "/chat?new=group" }
  ]
}
```

Icon art: black rounded-square tile, lime chat glyph — matches the palette, legible at 48px. Maskable icon keeps 20% safe padding.

### 9.2 Service worker (Serwist)

- `sw.ts` with:
  - **Precache** app shell: `/`, `/login`, `/chat` shell, offline page, fonts, icons.
  - **Runtime caching**:
    - Navigations → network-first, fallback to cached shell → `/offline`.
    - `GET /api/v1/conversations` + messages → network-first, 5s timeout, cache 24h (stale read only).
    - Static `/_next/static/*` → stale-while-revalidate.
  - **Never cache**: `POST/PATCH/DELETE`, `/ws`, `/auth/*`.
- Update flow: `skipWaiting` off by default; show a non-blocking "New version available — Refresh" toast via `SerwistProvider` registration callback.

### 9.3 Installability requirements checklist

- [ ] HTTPS (localhost exception for dev)
- [ ] Valid manifest with name, short_name, 192 + 512 icons, `start_url`, `display: standalone`
- [ ] Service worker registered with a `fetch` handler
- [ ] `<meta name="theme-color">`, `apple-mobile-web-app-capable`, `apple-touch-icon` (180×180)
- [ ] iOS meta: `apple-mobile-web-app-status-bar-style = default`, `apple-mobile-web-app-title`
- [ ] `viewport-fit=cover` + safe-area CSS
- [ ] Custom install UI: capture `beforeinstallprompt` (Chrome/Edge/Android), call `prompt()` from our lime "Install app" pill; on iOS show an instruction sheet (Share → Add to Home Screen) since no API exists
- [ ] Hide install UI when `window.matchMedia('(display-mode: standalone)').matches`
- [ ] Desktop: installed app opens in its own window; `start_url` lands on the chat list, never a blank screen

### 9.4 Offline behaviour (v1)

Read-only: cached conversation list + last fetched messages are viewable; a sage/gray banner states the app is offline; composer is disabled with placeholder "Reconnecting…". No queued sends. Reconnect auto-refetches.

---

## 10. Implementation phases

Each phase ends with something runnable and checkable. No phase starts before the previous one's exit criteria pass.

### Phase 0 — Scaffold (0.5 day)
- `git init`, root `.gitignore`, root `README.md` with run instructions.
- `frontend`: `create-next-app` (TS, Tailwind, App Router, `src/` off), shadcn init, add listed components, Inter Tight font.
- `backend`: venv, `requirements.txt`, FastAPI skeleton with `/health`, Ruff/mypy config, `.env.example`.
- **Exit:** `GET /health → {"ok": true}`; frontend renders a sage page with lime pill.

### Phase 1 — Auth & session (1 day)
- Mongo connection + index bootstrap on startup lifespan.
- `POST /auth/register`, `/auth/login`, `GET /auth/me`; argon2 hashing; JWT (7d).
- Frontend login/register pages (react-hook-form + zod), token in Zustand + `localStorage`, axios/fetch wrapper injecting the header, 401 interceptor → `/login`.
- `(app)/layout.tsx` guard.
- **Exit:** register → login → refresh keeps session → logout works; pytest covers happy path + duplicate username + bad password.

### Phase 2 — Conversations & REST history (1.5 days)
- Users search, direct get-or-create (race-safe), group create, list, detail, members add/remove.
- Messages list with cursor pagination; send via REST.
- Frontend: sidebar list, chat panel, message list, composer (REST send + optimistic insert with `client_id`), skeletons.
- **Exit:** two accounts can DM each other after refresh; group of 3 shows all members; pagination loads older messages.

### Phase 3 — Real-time (1.5 days)
- WebSocket hub, JWT handshake, membership guard, broadcast to members, `message.sent` ack, presence, ping/pong.
- Frontend `useChatSocket`: single connection per app, reconnect with backoff, query invalidation/prepend on `message.new`, dedupe by `client_id`/`_id`.
- Unread counts + `message.ack`.
- **Exit:** two browsers, message appears < 1s without refresh; kill socket → auto reconnect → no duplicates/missing; non-member cannot receive.

### Phase 4 — Group UI & polish (1 day)
- Create-group sheet, add-members dialog, group member list, leave group.
- Empty/loading/error/offline states for every screen.
- Responsive pass: 360px, 768px, 1024px, 1440px; tap targets; focus rings; keyboard nav.
- **Exit:** UI parity with §8 on both mobile and desktop; no horizontal scroll at 360px.

### Phase 5 — PWA (1 day)
- Manifest, icons, Serwist, offline page, install prompt + iOS instructions, update toast, safe-area CSS, standalone layout audit.
- Lighthouse PWA + "installable" audit checks; test install on Chrome desktop, Android Chrome, iOS Safari.
- **Exit:** app installs on all three; standalone launch → chat list; offline shows cached shell.

### Phase 6 — Hardening & deploy (1 day)
- Rate limit auth + message send (slowapi or simple in-memory counter), input trimming/length validation, CORS lock to frontend origin, no stack traces in prod.
- Deploy: Atlas + backend + frontend, env vars set, WSS verified.
- Final acceptance pass against §1 and §15.
- **Exit:** production URL passes the full flow with two real devices/browsers.

**Total:** ~7.5 focused dev days.

---

## 11. Environment & local setup

### Backend `.env`

```env
APP_ENV=development
MONGODB_URI=mongodb://localhost:27017/chatapp
MONGODB_DB=chatapp
JWT_SECRET=change-me-32-bytes-min
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000
```

Run: `uvicorn app.main:app --reload --port 8000`

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

Run: `pnpm dev` (port 3000)

### Notes
- PWA service worker must be tested with `pnpm build && pnpm start`; dev mode SW is disabled.
- Local install testing on a phone requires HTTPS → use a tunnel (ngrok/cloudflared) or `next dev --experimental-https`.

---

## 12. Non-functional requirements

### 12.1 Performance
- Chat list + open conversation initial paint < 1.5s on mid-range mobile (4G).
- Socket message round-trip (send → broadcast) < 300ms same region.
- Message page size 30; infinite scroll upward with virtualization only if a thread exceeds ~200 rendered items (then use `react-virtuoso`; do not add it preemptively).
- No polling. One socket per tab.

### 12.2 Accessibility
- Contrast: `--ink` on `--surface` ≈ 16:1; black text on lime ≈ 14:1. Lime is never used as text on light surfaces (fails contrast).
- All interactive elements keyboard-reachable with visible focus (`ring-2 ring-black ring-offset-2`).
- `aria-live="polite"` region for incoming messages; `aria-label` on icon-only buttons; dialogs trap focus (Radix default).
- Message list is a `<ul>`/`<li>`; composer labelled "Message".

### 12.3 Security (MVP, documented trade-offs)
- Passwords: argon2id. Minimum 8 chars, max 72.
- JWT HS256, 7-day expiry, no refresh token in v1 — on expiry the user logs in again. Token in `localStorage` (XSS-aware: React escapes text, no `dangerouslySetInnerHTML`, strict CSP recommended) — **known trade-off**; upgrade path = httpOnly refresh cookie + short-lived access token in memory.
- Every conversation/message route re-checks membership server-side; never trust `conversation_id` from the client alone.
- Validate and trim text server-side; reject empty/whitespace, cap 2000 chars.
- CORS allowlist only; credentials not required for v1.
- Basic rate limits: 10 login attempts / 5 min / IP; 20 messages / 10s / user.
- No secrets in the repo; `.env*` gitignored.

### 12.4 Reliability
- Mongo unique indexes are the concurrency guard, not app-level checks.
- Socket send is idempotent on `(conversation_id, client_id)`.
- All DB calls awaited; connection pool defaults from Motor.
- Health endpoint checks the DB ping.

---

## 13. Testing strategy

### Backend (pytest)
- Fixtures: async app client + fresh test database (`chatapp_test`), wiped per test.
- Coverage targets:
  - Auth: register/login/me/duplicate/bad password/expired token.
  - Conversations: direct get-or-create idempotency, group create permissions, non-member access → 403/404.
  - Messages: pagination cursors, ordering, length validation, `client_id` dedupe.
  - WebSocket: `TestClient.websocket_connect` → handshake auth, broadcast to members, non-member gets `error`, reconnect/presence events.

### Frontend
- Vitest + React Testing Library: message bubble rendering (own vs other, group sender label), composer send + validation, conversation row active/unread states.
- Playwright (happy path only): register two users, DM, create group, send message in both, reload persistence, install prompt visibility.
- Manual matrix: Chrome desktop, Edge desktop, Android Chrome (installed + browser), iOS Safari (Add to Home Screen).

### Definition of Done for every PR
- Typecheck (`tsc --noEmit`), lint, backend tests green.
- No `console.log` in shipped code.
- New UI state covered by at least a screenshot review, not just a component test.

---

## 14. Deployment

| Piece | Target | Config |
|---|---|---|
| Frontend | Vercel | Root `frontend/`, env `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` (wss) |
| Backend | Render Web Service (or Fly.io) | Root `backend/`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health `/health` |
| DB | MongoDB Atlas M0 | IP allowlist 0.0.0.0/0 (MVP), dedicated app user, daily backup |
| Domain | e.g. `chat.example.com` | Frontend apex; API at `api.chat.example.com` |

Post-deploy checks: CORS preflight from the real origin, WSS handshake without mixed-content errors, manifest served with `application/manifest+json`, SW scope `/`, install prompt appears in incognito after 2 visits.

---

## 15. Acceptance criteria (final)

1. New user registers, logs in, and sees an empty chat list.
2. User A starts a chat with user B; B receives it live without refresh; both messages persist across reload and app restart.
3. Group created with 3 members; every member sees messages live; a 4th member added later sees full history.
4. Non-member cannot read or post to a group (verified by API test).
5. Sidebar sorts by last activity and shows correct unread badge; opening a chat clears it.
6. Desktop layout matches the reference: sage page, lime profile card, pill conversation rows, large rounded chat panel, black bubbles, pill composer with black circular send.
7. Mobile layout matches the reference: lime header card, message sheet, standalone-friendly header, 44px targets, no horizontal scroll at 360px.
8. App installs on Android, iOS home screen and desktop Chrome/Edge; installed app opens standalone to the chat list; shortcuts appear.
9. Offline: cached shell + last messages render, "reconnecting" banner shows, composer disabled; reconnect restores sending.
10. `pytest` suite passes; `tsc --noEmit` clean; Lighthouse installability audit passes.

---

## 16. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| In-memory hub blocks horizontal scaling | Medium | Ship single instance; document Redis pub/sub swap; do not pretend it's clustered |
| Render free tier sleep / WS drops | Medium | Client reconnect with backoff + gap refetch; keepalive ping every 25s |
| iOS PWA quirks (no `beforeinstallprompt`, aggressive SW/cache) | Medium | iOS instruction sheet, conservative caching, test on real device early (Phase 5, not at the end) |
| Cross-origin WS blocked by proxy/mixed content | High | Always `wss://`, same-site domain, verify in staging before launch |
| Group duplicate membership / duplicate DMs under concurrency | Medium | Unique `direct_key` + `$addToSet`, index-based guarantees |
| Design drift from reference | Low | Tokens in §8.1 only; screenshot review each phase |

---

## 17. Future (explicitly not now)

Attachments, push notifications, read receipts, typing indicator, message search, reactions, replies, edit/delete, Redis-scaled sockets, refresh-token rotation, dark mode, internationalisation.

---

## 18. Working agreement

- Plan is the contract: any scope addition updates this file first, then the code.
- Every phase stays shippable; no half-migrated states on `main`.
- Prefer deleting code over adding abstractions. Three collections, one socket, one design token file.
