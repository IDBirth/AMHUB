<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your FlightHub console

This is a Next.js (App Router) app that uses the FastAPI backend for telemetry and topology data.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. (Recommended) Create `.env.local` with the following:
   - `DJI_WORKFLOW_URL` (for workflow triggers)
   - `DJI_USER_TOKEN` (for workflow triggers)
   - `NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN` (optional)
   - `NEXT_PUBLIC_LIVE_HTTP_BASE` (e.g. `http://localhost:8000`)
   - `NEXT_PUBLIC_LIVE_WS_URL` (e.g. `ws://localhost:8000/ws/telemetry`)
3. Run the app:
   `npm run dev`
