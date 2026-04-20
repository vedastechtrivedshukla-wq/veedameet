# Vedameet — Production Readiness Report

## Verdict: ❌ NOT production-ready

The project is a solid **development prototype** with a well-thought-out architecture (FastAPI + Janus WebRTC + Redis + MySQL + React). However, it has several **critical blockers** and many **high-priority gaps** that must be resolved before any real-world deployment.

---

## 🔴 Critical Blockers (Must Fix Before Deploy)

### 1. Secret Key Hardcoded as Fallback
**File:** `backend/app/core/config.py` — Line 7
```python
SECRET_KEY: str = "super_secret_key_change_in_production_1234567890"  # TODO: Load from env
```
The `SECRET_KEY` falls back to a hardcoded string if the `.env` isn't loaded. This means **anyone can forge JWT tokens** if the app starts without the `.env` file. The config class should have NO default for `SECRET_KEY`.

**Fix:**
```python
SECRET_KEY: str  # No default — will raise error if missing from env
```

---

### 2. CORS Wildcard `allow_origins=["*"]`
**File:** `backend/app/main.py` — Line 12
```python
allow_origins=["*"],  # TODO: restrict in production
```
This allows any website on the internet to make credentialed requests to your API — a classic CSRF/data-exfiltration risk. There's even a `# TODO` comment acknowledging this.

**Fix:** Set `allow_origins` to your exact frontend domain(s):
```python
allow_origins=["https://yourdomain.com"]
```

---

### 3. Janus Gateway Has No Authentication/Security
**File:** `docker-compose.yml` — Line 23-29

The Janus container is launched with `canyan/janus-gateway:latest` with **no authentication config at all**. Any external actor can create/join rooms on your Janus server. There is also **no TURN server configured**, so WebRTC will fail for users behind strict NATs/firewalls (the majority of corporate/mobile users).

**Fix:** Mount a custom `janus.jcfg` that enables `token_auth` and configure a TURN server (e.g., via Coturn).

---

### 4. Database Credentials Are Root/Root in Docker
**File:** `docker-compose.yml` — Lines 7-10
```yaml
MYSQL_ROOT_PASSWORD: root
MYSQL_USER: root
MYSQL_PASSWORD: root
```
Running MySQL with `root` as the application user with the password `root` is a critical security anti-pattern. The app user should have minimal privileges on the `vedameet` database only.

---

### 5. `.env` File Committed to Repo Risk
**File:** `.gitignore` — Line 4: `.env` is gitignored ✅

However, `backend/.env.example` contains the **same values** as the real `.env` (including the `SECRET_KEY`). Anyone who clones the repo and copies `.env.example` → `.env` unknowingly gets an insecure setup.

**Fix:** Make `.env.example` use clear placeholder values like `SECRET_KEY=REPLACE_WITH_STRONG_RANDOM_SECRET`.

---

### 6. WebSocket Token Exposed in URL Query String
**File:** `frontend/src/services/socket.js` — Line 11
```js
this.ws = new WebSocket(`${wsUrl}/${this.meetingId}?token=${this.token}`);
```
Passing JWT tokens in the URL sends them in plaintext in server access logs, browser history, and Referer headers. This is a known security anti-pattern.

**Fix:** Send the token in the first WebSocket message after connection (via a standard "auth" handshake message), not in the URL.

---

### 7. No Rate Limiting on Auth Endpoints
**File:** `backend/app/routes/auth.py`

The `/register` and `/login` endpoints have **no rate limiting**. This makes the API wide-open to brute-force and credential-stuffing attacks.

**Fix:** Use `slowapi` (a FastAPI-compatible rate limiter) or put a reverse proxy (NGINX/Cloudflare) with rate limits in front.

---

## 🟠 High Priority Issues

### 8. Invite System Is a Stub (`alert()`)
**File:** `frontend/src/pages/MeetingRoom.jsx` — Lines 656-659
```js
// Mock sending invite
alert(`Invitation sent to: ${inviteInput}`);
```
The "Add others" modal just fires a `window.alert()`. No email is sent. This feature is entirely non-functional.

---

### 9. Recording Feature Is Client-Side Only
**File:** `frontend/src/pages/MeetingRoom.jsx` — Line 307

Recordings are done via `MediaRecorder` entirely in the browser (`video/webm` format), saved as a local file download. This means:
- Recordings stop if the browser tab is closed.
- There is no cloud storage for meetings.
- The recording uses `alert("Could not start recording...")` as its error handler.

---

### 10. Controls Bar Shows Static Time
**File:** `frontend/src/components/Controls.jsx` — Line 76
```jsx
<span>12:00 PM | Vedameet Room</span>
```
The time is **hardcoded as `12:00 PM`** and never updates. This is clearly a placeholder that was never wired up.

---

### 11. No Database Migrations (Alembic Not Used)
**File:** `backend/requirements.txt` — `alembic>=1.12.0` is listed, but there is **no `alembic/` directory** in the backend.

The app uses `Base.metadata.create_all` via SQLAlchemy directly at startup, which is only suitable for development. Production needs proper versioned Alembic migrations for safe schema changes.

---

### 12. `echo=True` on SQLAlchemy Engine in Production
**File:** `backend/app/database.py` — Line 5
```python
engine = create_async_engine(settings.async_database_url, echo=True)
```
`echo=True` logs every SQL query to stdout. This is a performance hit and a potential data-leak risk in production (query parameters may contain sensitive data).

**Fix:** `echo=settings.DEBUG` or just `echo=False`.

---

### 13. No Health Check Endpoints / Monitoring
The API has no `/health` or `/readiness` endpoint. This means load balancers, Kubernetes, and platforms like Render cannot verify liveness. There is also no structured logging, metrics (Prometheus), or error tracking (Sentry).

---

### 14. `render.yaml` Has Placeholder Janus URL
**File:** `render.yaml` — Line 24
```yaml
value: "http://your-janus-vps:8088/janus"  # To be replaced by user
```
Janus cannot run on Render (it needs UDP ports for RTP). The deploy config acknowledges this with a comment but provides no guidance. Janus needs to be self-hosted on a VPS with proper firewall rules for `10000-10200/udp`.

---

### 15. No Input Validation / Sanitization in Chat
**File:** `backend/app/routes/websockets.py` — Lines 60-63

Incoming WebSocket messages are parsed and broadcast without any size limit or content validation. A malicious user can send huge payloads, crashing other clients.

---

## 🟡 Medium Priority Issues

| # | Issue | File |
|---|-------|------|
| 16 | `on_event("startup")` is **deprecated** in FastAPI — use `lifespan` context manager | `main.py` |
| 17 | `datetime.utcnow()` is **deprecated** in Python 3.12+ — use `datetime.now(timezone.utc)` | `security.py` |
| 18 | No `connection_pool_size` or `pool_recycle` set on DB engine — risks `MySQL server has gone away` errors in production | `database.py` |
| 19 | `useWebRTC` polls connection status every 500ms with `setInterval` instead of using event callbacks | `useWebRTC.js` |
| 20 | Remote participant names are `User {feedId}` (Janus feed ID) — not real user names | `useWebRTC.js` |
| 21 | `build.log` and `build.txt` are committed to the repo | `frontend/` |
| 22 | No HTTPS enforced — `docker-compose.yml` exposes plain HTTP on all ports | `docker-compose.yml` |
| 23 | Redis has no password set and ports are exposed publicly in Docker | `docker-compose.yml` |
| 24 | WebSocket signaling and Janus media are **not integrated** — participants see each other in the list but video may not flow end-to-end | `MeetingRoom.jsx` / `useWebRTC.js` |

---

## 🟢 What's Done Well

- ✅ Password hashing with bcrypt (`passlib`)
- ✅ JWT-based auth with proper expiry
- ✅ Async FastAPI + async SQLAlchemy (correct pattern)
- ✅ Docker Compose for local dev with all services
- ✅ Separate `.env` / `.env.example` files
- ✅ Redis pub/sub architecture designed for horizontal scaling
- ✅ Clean component structure in React frontend
- ✅ Pre-join camera/mic preview screen
- ✅ Screen sharing + track swap via `replaceLocalTrack` (correct WebRTC approach)
- ✅ `render.yaml` deployment plan for backend

---

## Summary Scorecard

| Category | Status | Score |
|----------|--------|-------|
| Security | ❌ Critical issues | 2 / 10 |
| Authentication | ⚠️ JWT works but insecure delivery | 5 / 10 |
| Configuration | ⚠️ Env vars work, but fallbacks are insecure | 4 / 10 |
| WebRTC / Video | ⚠️ Partially working (signaling ✅, Janus media integration unclear) | 5 / 10 |
| Database | ⚠️ Works, no migrations, root credentials | 4 / 10 |
| Deployment | ⚠️ Docker Compose ready, Render partial | 5 / 10 |
| Testing | ❌ Zero tests | 0 / 10 |
| Monitoring | ❌ No health checks, no logging, no error tracking | 0 / 10 |
| Feature Completeness | ⚠️ Invite stub, recording is basic | 5 / 10 |
| **Overall** | **❌ Not Production Ready** | **~33 / 100** |

---

## Recommended Path to Production

1. **Week 1 — Security Hardening**: Fix CORS, `SECRET_KEY`, MySQL credentials, WebSocket token delivery, add rate limiting.
2. **Week 2 — Infrastructure**: Set up Alembic migrations, add health check endpoint, configure HTTPS via NGINX/Caddy, add TURN server.
3. **Week 3 — Feature Completion**: Wire up real email invites (e.g., SendGrid), fix the static clock in Controls, implement structured logging + Sentry error tracking.
4. **Week 4 — Testing & QA**: Write unit tests for auth routes, integration tests for WebSocket flows, end-to-end WebRTC test with multiple browsers.
