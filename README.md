# AMHUB

This repo is split into two apps:

## frontend (Next.js)
- Location: `frontend/`
- Purpose: UI + server-side proxy routes for DJI APIs

Run locally:
```bash
cd frontend
npm install
npm run dev
```

## backend (FastAPI)
- Location: `backend/`
- Purpose: Optional realtime telemetry gateway (polling + websocket)

Run locally:
```bash
cd backend
python3 -m pip install -r requirements.txt
python3 Run.py
```

Notes:
- `backend/Secret/secrets.json` holds local defaults for the FastAPI app.
- `frontend/.env.local` holds Next.js server-side env vars.
- `frontend/index.html`, `frontend/index.tsx`, and `frontend/vite.config.ts` are legacy Vite files and can be removed if you want a lean Next.js-only frontend.
- FastAPI provides `GET /api/topology`, `GET /api/state`, and `WS /ws/telemetry` for the frontend.
