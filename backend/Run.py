import os
import json
import asyncio
import webbrowser
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import httpx
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# -------------------------
# Config (secrets.json + ENV)
# -------------------------
SECRETS_PATH = Path(__file__).resolve().parent / "Secret" / "secrets.json"

def load_secrets() -> Dict[str, Any]:
    try:
        with SECRETS_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        return {}

SECRETS = load_secrets()

DJI_BASE_URL = os.getenv(
    "DJI_BASE_URL",
    SECRETS.get("DJI_BASE_URL", "https://es-flight-api-us.djigate.com"),
).rstrip("/")
ORG_KEY = os.getenv(
    "DJI_ORG_KEY",
    SECRETS.get(
        "DJI_ORG_KEY",
        "eyJhbGciOiJIUzUxMiIsImNyaXQiOlsidHlwIiwiYWxnIiwia2lkIl0sImtpZCI6IjBkNzQyMzFmLTgxOWYtNDE3NS04NWUzLTRhZDQxODUzMzEyZiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50IjoiamloYWRAYW10LnR2IiwiZXhwIjoyMDgyNjA3OTgyLCJuYmYiOjE3NjcwNzUxODIsIm9yZ2FuaXphdGlvbl91dWlkIjoiMTYzYTE5YjgtY2JmZS00YzIyLTkyYzItNTRiMjg2MWJkYjk5IiwicHJvamVjdF91dWlkIjoiIiwic3ViIjoiZmgyIiwidXNlcl9pZCI6IjE2MTI3MzQ2ODk5NjEyNjMxMDQifQ.znVmXPrjkf4-BPxi49X_iq1ED7Y_6qGaX0gU-jiE_hlmVPPwO8757XUz-uEShX9uo3MKEoA26IdNibZPXV-ZvA",
    ),
)  # X-Organization-Key
PROJECT_UUID = os.getenv(
    "DJI_PROJECT_UUID",
    SECRETS.get("DJI_PROJECT_UUID", "4149cc35-4491-4249-a050-d0a7f336fa45"),
)  # pick one project to show live
MAPBOX_PUBLIC_TOKEN = os.getenv("MAPBOX_PUBLIC_TOKEN", SECRETS.get("MAPBOX_PUBLIC_TOKEN", ""))
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "2.0"))

if not ORG_KEY:
    print("WARNING: DJI_ORG_KEY is not set (requests will fail).")
if not PROJECT_UUID:
    print("WARNING: DJI_PROJECT_UUID is not set (topologies will fail).")

HEADERS = {
    "X-Organization-Key": ORG_KEY,
    "Content-Type": "application/json",
}

# -------------------------
# App state
# -------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient()
    app.state.poller_task = asyncio.create_task(poller_loop())
    try:
        yield
    finally:
        task: asyncio.Task = app.state.poller_task
        task.cancel()
        try:
            await task
        except Exception:
            pass
        await app.state.http.aclose()

app = FastAPI(title="FlightHub Sync Telemetry Gateway", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR / "dist"

# Backend-only server; frontend is served by Next.js.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

state_lock = asyncio.Lock()
latest_by_sn: Dict[str, Dict[str, Any]] = {}

ws_clients_lock = asyncio.Lock()
ws_clients: Set[WebSocket] = set()


# -------------------------
# Helpers
# -------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def ms_to_iso(ms: Optional[int]) -> Optional[str]:
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).isoformat()


def extract_nodes(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = payload.get("data") or {}
    nodes = data.get("list") or []
    return nodes if isinstance(nodes, list) else []


def normalize_node(node: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    host = node.get("host") or {}
    sn = host.get("device_sn")
    if not sn:
        return None

    online = bool(host.get("device_online_status"))
    nickname = host.get("device_project_callsign") or sn

    ds = host.get("device_state") or {}
    base = ds if isinstance(ds, dict) and "latitude" in ds and "longitude" in ds else None
    module = next(
        (v for v in ds.values() if isinstance(v, dict) and "latitude" in v and "longitude" in v),
        {},
    ) or {}

    lat = (base or module).get("latitude")
    lng = (base or module).get("longitude")

    offline_pos = host.get("device_offline_position") or {}
    if lat is None or lng is None:
        lat = offline_pos.get("latitude")
        lng = offline_pos.get("longitude")

    alt_m = (base or module).get("height")
    heading_deg = (base or module).get("attitude_head") or (base or module).get("heading")

    battery_pct = None
    batt = (base or module).get("battery") or {}
    if isinstance(batt, dict):
        battery_pct = batt.get("capacity_percent")

    flight_state = (base or module).get("mode_code")

    updated_at = ms_to_iso(offline_pos.get("timestamp")) or now_iso()

    return {
        "sn": sn,
        "nickname": nickname,
        "online": online,
        "lat": lat,
        "lng": lng,
        "alt_m": alt_m,
        "heading_deg": heading_deg,
        "battery_pct": battery_pct,
        "flight_state": flight_state,
        "updated_at": updated_at,
    }

async def fetch_topologies(client: httpx.AsyncClient) -> Dict[str, Any]:
    url = f"{DJI_BASE_URL}/manage/api/v1.0/projects/{PROJECT_UUID}/topologies"
    r = await client.get(url, headers=HEADERS, timeout=10.0)
    r.raise_for_status()
    return r.json()

async def broadcast(message: Dict[str, Any]) -> None:
    """Send JSON message to all connected WebSocket clients."""
    dead: List[WebSocket] = []
    data = json.dumps(message)

    async with ws_clients_lock:
        for ws in list(ws_clients):
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)

        for ws in dead:
            ws_clients.discard(ws)


# -------------------------
# Background poller
# -------------------------
async def poller_loop() -> None:
    client: httpx.AsyncClient = app.state.http

    while True:
        try:
            payload = await fetch_topologies(client)
            nodes = extract_nodes(payload)

            updates: Dict[str, Dict[str, Any]] = {}
            for node in nodes:
                dev = normalize_node(node)
                if not dev:
                    continue
                updates[dev["sn"]] = dev

            async with state_lock:
                # store latest
                latest_by_sn.update(updates)

            # Broadcast a compact update packet
            if updates:
                await broadcast({"type": "telemetry_update", "devices": list(updates.values())})

        except httpx.HTTPError as e:
            await broadcast({"type": "error", "message": f"HTTP error: {str(e)}"})
        except Exception as e:
            await broadcast({"type": "error", "message": f"Unexpected error: {str(e)}"})

        await asyncio.sleep(POLL_SECONDS)


# -------------------------
# HTTP endpoints
# -------------------------
STREAM_URL_BY_SN: Dict[str, str] = {
    # "1581F8HGX253J00A04MP": "https://your-hls-server/live/1581F8HGX253J00A04MP/index.m3u8",
}

@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "time": now_iso()}

@app.get("/api/state")
async def api_state() -> JSONResponse:
    async with state_lock:
        return JSONResponse({"type": "snapshot", "devices": list(latest_by_sn.values())})

@app.get("/api/config")
async def api_config() -> Dict[str, Any]:
    return {"mapbox_public_token": MAPBOX_PUBLIC_TOKEN}

@app.get("/api/topology")
async def api_topology() -> JSONResponse:
    async with state_lock:
        return JSONResponse({"type": "snapshot", "devices": list(latest_by_sn.values())})

@app.get("/api/stream")
async def api_stream(sn: str = Query(...)) -> Dict[str, Optional[str]]:
    return {"sn": sn, "url": STREAM_URL_BY_SN.get(sn)}


# -------------------------
# WebSocket endpoint
# -------------------------
@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket) -> None:
    await ws.accept()
    async with ws_clients_lock:
        ws_clients.add(ws)

    # Send a snapshot immediately on connect
    async with state_lock:
        await ws.send_text(json.dumps({"type": "snapshot", "devices": list(latest_by_sn.values())}))

    try:
        # Keep connection alive; we don't require client messages
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        async with ws_clients_lock:
            ws_clients.discard(ws)


if __name__ == "__main__":
    try:
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass
    uvicorn.run("Run:app", host="0.0.0.0", port=8000, reload=True)


# -------------------------
# Frontend (built app)
# -------------------------
@app.get("/")
async def frontend_root() -> JSONResponse:
    return JSONResponse({"ok": True, "service": "flighthub-telemetry-backend"})
