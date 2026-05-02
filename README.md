# Campus Notifications Microservice

> Affordmed Evaluation — Campus Notifications Microservice

## Repository Structure

```
campus-notifications/
├── stage1/
│   └── priority_inbox.py          # Priority Inbox algorithm (Stage 1)
├── stage2/                        # React/Next.js frontend (Stage 2)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx               # All Notifications page
│   │   └── priority/
│   │       └── page.tsx           # Priority Inbox page
│   ├── components/
│   │   ├── ThemeRegistry.tsx
│   │   ├── Navbar.tsx
│   │   └── NotificationCard.tsx
│   ├── lib/
│   │   ├── logger.ts              # Logging Middleware
│   │   └── notifications.ts       # Fetch + priority engine
│   ├── package.json
│   ├── next.config.js
│   └── tsconfig.json
├── Notification_System_Design.md  # Design document (Stage 1 + beyond)
└── README.md
```

---

## Stage 1 — Priority Inbox

### Running

```bash
cd stage1

# Default: top 10
python priority_inbox.py

# Custom N
python priority_inbox.py 15

# Verbose logs
LOG_LEVEL=DEBUG python priority_inbox.py
```

### What it does

1. Fetches notifications from `http://20.207.122.201/evaluation-service/notifications`
2. Ranks them by: **Type weight** (Placement=3 > Result=2 > Event=1) then **Recency**
3. Uses an **O(M log N) min-heap** for efficient top-N selection
4. Displays the priority inbox and demonstrates streaming with `PriorityInboxStream`

See `Notification_System_Design.md` for full algorithm explanation.

---

## Stage 2 — React/Next.js Frontend

### Setup

```bash
cd stage2
npm install
npm run dev
```

App runs at **http://localhost:3000**

### Pages

| Page | Route | Description |
|------|-------|-------------|
| All Notifications | `/` | Full list with type filter, pagination, read/unread state |
| Priority Inbox | `/priority` | Top-N ranked notifications with slider control |

### Features

- **Read/Unread distinction** — unread notifications have a coloured left border + glowing dot; read ones are dimmed. State persists via `localStorage`.
- **Priority Inbox** — adjustable top N (5/10/15/20) via slider, re-ranked instantly using the min-heap algorithm.
- **Type filter** — toggle between All / Placement / Result / Event on the All Notifications page.
- **Mark as read** — per-card and mark-all buttons.
- **Responsive** — works on desktop and mobile.
- **Material UI** — dark theme, no ShadCN or other CSS libraries.
- **Logging Middleware** — all API calls, errors, and state changes are logged via the structured logger in `lib/logger.ts`. No `console.log` used directly in application code.
- **Error handling** — network errors displayed as dismissible alerts.

---

## Logging Middleware

Both stages use a custom logging middleware:

- **Stage 1 (Python)**: `get_logger()` in `priority_inbox.py` — structured `logging` with JSON-like format.
- **Stage 2 (TypeScript)**: `lib/logger.ts` — structured JSON logs to stdout, level-filtered, context-tagged.

No built-in language loggers (`console.log`, Python `print`) are used in application code.

---

## API

```
GET http://20.207.122.201/evaluation-service/notifications
    ?limit=<int>
    &page=<int>
    &notification_type=<Placement|Result|Event>
```

Response:
```json
{
  "notifications": [
    { "ID": "...", "Type": "Placement", "Message": "...", "Timestamp": "2026-04-22 17:51:18" }
  ]
}
```
