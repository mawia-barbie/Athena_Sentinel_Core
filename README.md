# Athena Sentinel
## Project summary

Athena Sentinel is a compact SOC (Security Operations Center) simulator: a full‑stack cybersecurity platform combining threat ingestion, a real‑time dashboard, user auth, and an AI assistant to help analyze and explain security events.
Vision

Provide a lightweight SOC analyst workstation for exploring threat intelligence, monitoring alerts, and experimenting with retrieval‑based AI assistance — all in a single, local MVP.
MVP features

### Authentication

secure user registration/login with password policy and hashed storage (Argon2 recommended), JWT sessions, basic brute‑force protection.
User profiles: editable username, bio, profile image and analyst badge later.
SOC Dashboard: overview metrics, quick search, filters (CVE, Malware, Phishing, Ransomware), and a real‑time (or polling) threat feed.
Threat Intelligence Scraper: ingestion engine that scrapes CVE databases, RSS/security blogs and structures entries with title, description, source, severity, timestamp and tags.
Live feed: near‑real‑time updates via polling or WebSocket.
Analytics: basic charts and exportable reports (future).
AI assistant: retrieval‑based chatbot that explains CVEs and mitigation steps.
Architecture (recommended)

### Frontend: 

React (Vite) + Tailwind CSS — SPA with pages: /login, /register, /dashboard, /profile, /threats.
Backend: FastAPI (Python) — responsibilities: auth, API endpoints, scraper, realtime WebSocket endpoint, AI endpoint.
Database: SQLite for MVP (Postgres recommended later).
Auth: JWT access + refresh tokens (refresh in httpOnly cookie).
Getting started (MVP)

### Frontend:
cd frontend
npm install
npm run dev

### Backend (Python / FastAPI):
create and activate a venv
pip install -r requirements.txt (or use poetry)
export SECRET_KEY and other env vars
uvicorn app.main:app --reload --port 8000

### How data flows

User registers → hashed credentials stored in DB
User logs in → JWT tokens issued
Dashboard queries backend for threats; scraper periodically populates DB
Scraper/broadcast sends events to dashboard clients via polling or WebSocket
AI assistant queries DB and returns human‑friendly explanations

### Success criteria for the MVP

Secure user registration/login
Dashboard shows scraped or ingested threat data
Scraper actively populates the DB (even mocked)
AI assistant can answer basic cybersecurity questions
Basic analytics and trend charts present meaningful information
