import { WorkflowRequest, AppSettings, TopologyResponse, Device, DeviceTelemetry, BackendDock, BackendDrone } from '../types';

const LIVE_HTTP_BASE = process.env.NEXT_PUBLIC_LIVE_HTTP_BASE;
const LIVE_WS_URL = process.env.NEXT_PUBLIC_LIVE_WS_URL;

const buildLiveHttpBase = (): string => {
  if (LIVE_HTTP_BASE) return LIVE_HTTP_BASE;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

const buildLiveWsUrl = (): string => {
  if (LIVE_WS_URL) return LIVE_WS_URL;
  if (typeof window !== 'undefined' && window.location?.host) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws/telemetry`;
  }
  return 'ws://localhost:8000/ws/telemetry';
};

interface LiveTelemetryDevice {
  sn?: string;
  nickname?: string;
  online?: boolean;
  lat?: number;
  lng?: number;
  alt_m?: number;
  height_m?: number;
  heading_deg?: number;
  yaw_deg?: number;
  pitch_deg?: number;
  roll_deg?: number;
  battery_pct?: number;
  battery_percent?: number;
  h_speed_mps?: number;
  v_speed_mps?: number;
  speed?: number;
  live?: { capable?: boolean; active?: boolean };
  live_capable?: boolean;
  live_active?: boolean;
}

interface LiveTelemetryMessage {
  type?: string;
  devices?: LiveTelemetryDevice[];
}

const mapLiveTelemetryDevice = (device: LiveTelemetryDevice): Device => {
  const sn = String(device.sn || 'UNKNOWN');
  const hSpeed = toNumber(device.h_speed_mps ?? device.speed ?? 0);
  const vSpeed = toNumber(device.v_speed_mps ?? 0);

  return {
    device_sn: sn,
    nickname: String(device.nickname || sn),
    device_model: 'DJI Drone',
    status: toBool(device.online),
    domain: 0,
    telemetry: {
      latitude: toNumber(device.lat),
      longitude: toNumber(device.lng),
      height: toNumber(device.alt_m ?? device.height_m),
      speed: hSpeed,
      h_speed_mps: hSpeed,
      v_speed_mps: vSpeed,
      battery_percent: toNumber(device.battery_pct ?? device.battery_percent),
      link_signal_quality: 0,
      flight_time: 0,
      yaw: toNumber(device.heading_deg ?? device.yaw_deg),
      pitch: toNumber(device.pitch_deg),
      roll: toNumber(device.roll_deg),
      live_active: toBool(device.live?.active ?? device.live_active),
      live_capable: toBool(device.live?.capable ?? device.live_capable)
    },
    raw: device
  };
};

type BackendDevice = BackendDock | BackendDrone;

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toBool = (value: unknown): boolean => {
  return value === true || value === 1 || value === 'true';
};

const isBackendDevice = (item: any): item is BackendDevice => {
  return Boolean(item && typeof item === 'object' && 'sn' in item && ('lat' in item || 'lng' in item));
};

const isBackendDrone = (item: BackendDevice): item is BackendDrone => {
  return (
    'yaw_deg' in item ||
    'pitch_deg' in item ||
    'roll_deg' in item ||
    'h_speed_mps' in item ||
    'v_speed_mps' in item ||
    'live' in item
  );
};

const extractBackendDevices = (rawData: any): BackendDevice[] | null => {
  if (!rawData) return null;

  if (Array.isArray(rawData) && rawData.every(isBackendDevice)) {
    return rawData;
  }

  if (Array.isArray(rawData?.data) && rawData.data.every(isBackendDevice)) {
    return rawData.data;
  }

  if (Array.isArray(rawData?.docks) || Array.isArray(rawData?.drones)) {
    const merged = [...(rawData?.docks || []), ...(rawData?.drones || [])];
    return merged.every(isBackendDevice) ? merged : null;
  }

  if (rawData?.dock || rawData?.drone) {
    const merged = [rawData?.dock, rawData?.drone].filter(Boolean);
    return merged.every(isBackendDevice) ? merged : null;
  }

  return null;
};

const mapBackendDevice = (device: BackendDevice): Device => {
  const isDrone = isBackendDrone(device);
  const telemetry: DeviceTelemetry = {
    latitude: toNumber(device.lat),
    longitude: toNumber(device.lng),
    height: toNumber(device.height_m),
    speed: toNumber(isDrone ? device.h_speed_mps : 0),
    battery_percent: 0,
    link_signal_quality: 0,
    flight_time: 0,
    yaw: toNumber(isDrone ? device.yaw_deg : 0),
    pitch: toNumber(isDrone ? device.pitch_deg : 0),
    roll: toNumber(isDrone ? device.roll_deg : 0)
  };

  return {
    device_sn: String(device.sn),
    nickname: String(device.callsign || device.sn),
    device_model: isDrone ? 'DJI Drone' : 'DJI Dock',
    status: toBool(device.online),
    domain: isDrone ? 0 : 3,
    telemetry,
    raw: device
  };
};

const extractFlightHubTopologyDevices = (rawData: any): { dock?: any; drone?: any } => {
  const list = Array.isArray(rawData?.data)
    ? rawData.data
    : Array.isArray(rawData)
      ? rawData
      : [rawData];

  for (const node of list) {
    const dock = (node?.parents || []).find((p: any) => p?.device_model?.class === 'airport');
    const drone = node?.host?.device_model?.class === 'drone' ? node.host : undefined;
    if (dock || drone) {
      return { dock, drone };
    }
  }

  return {};
};

export const sendWorkflowAlert = async (payload: WorkflowRequest, settings: AppSettings): Promise<any> => {
  try {
    const response = await fetch('/api/workflow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectUuid: settings.projectUuid,
        userToken: settings.userToken,
        payload
      })
    });

    let responseData;
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = { message: text || response.statusText };
    }

    if (!response.ok) {
      throw new Error(responseData.message || `HTTP Error: ${response.status}`);
    }

    return responseData;
  } catch (error) {
    console.error("API Service Error:", error);
    throw error;
  }
};

export const getLiveSnapshot = async (): Promise<Device[]> => {
  const response = await fetch(`${buildLiveHttpBase()}/api/state`, { method: 'GET' });
  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText);
    throw new Error(`Live snapshot error: ${response.status} - ${errText.substring(0, 100)}`);
  }
  const data = await response.json().catch(() => null);
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  return devices.map(mapLiveTelemetryDevice);
};

export const connectLiveTelemetry = (handlers: {
  onDevices: (devices: Device[], type: 'snapshot' | 'telemetry_update') => void;
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error', detail?: string) => void;
  onError?: (error: Error) => void;
}) => {
  let ws: WebSocket | null = null;
  let retryMs = 1000;
  let shouldReconnect = true;

  const connect = () => {
    const url = buildLiveWsUrl();
    handlers.onStatus?.('connecting', url);
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryMs = 1000;
      handlers.onStatus?.('open', url);
    };

    ws.onmessage = (event) => {
      try {
        const msg: LiveTelemetryMessage = JSON.parse(event.data);
        const devices = Array.isArray(msg.devices) ? msg.devices.map(mapLiveTelemetryDevice) : [];
        if (msg.type === 'snapshot' || msg.type === 'telemetry_update') {
          handlers.onDevices(devices, msg.type);
        }
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error('Invalid live telemetry message'));
      }
    };

    ws.onclose = () => {
      handlers.onStatus?.('closed');
      if (shouldReconnect) {
        setTimeout(connect, retryMs);
        retryMs = Math.min(10000, retryMs * 1.6);
      }
    };

    ws.onerror = () => {
      handlers.onStatus?.('error');
    };
  };

  connect();

  return {
    close: () => {
      shouldReconnect = false;
      ws?.close();
    }
  };
};

// Helper: Recursively traverse the entire JSON tree to find ALL device-like objects
// This fixes the issue where map() only checked the top-level containers (like Workspaces) 
// and missed the actual devices inside them.
const collectAllDevices = (node: any, collected: any[]) => {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach(item => collectAllDevices(item, collected));
    return;
  }

  // 1. Check if the current node IS a device
  // Heuristic: Must have some identifier like device_sn, sn, or child_device_sn.
  // We use a looser check for UUID but require other device indicators to avoid picking up Folders/Projects.
  const sn = node.device_sn || node.sn || node.child_device_sn;
  const hasDeviceIndicators = node.device_model || node.model || node.domain !== undefined || node.online !== undefined || node.battery || node.position || node.telemetry;

  if (sn || (node.uuid && hasDeviceIndicators)) {
     collected.push(node);
  }

  // 2. Recurse into known container properties
  // We explicitly check common keys where devices hide
  const keysToTraverse = ['children', 'list', 'data', 'host', 'drone', 'payload', 'devices', 'sub_devices'];
  
  keysToTraverse.forEach(key => {
     if (node[key]) {
         collectAllDevices(node[key], collected);
     }
  });
};

// Helper to check if a name is a generic system ID (e.g., 0-100-1 or 0-0-1)
const isGenericId = (name: string): boolean => {
    if (!name) return true;
    return /^\d+-\d+-\d+$/.test(name) || /^\d+$/.test(name);
};

export const getProjectTopology = async (settings: AppSettings): Promise<TopologyResponse> => {
  try {
    const targetUrl = `${buildLiveHttpBase()}/api/topology`;

    console.log("Fetching Topology:", targetUrl);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Topology API Error: ${response.status} - ${errText.substring(0, 100)}`);
    }

    const rawData = await response.json().catch(() => null);
    
    if (!rawData) {
        throw new Error("Invalid JSON response from API");
    }

    const liveDevices = Array.isArray(rawData?.devices) ? rawData.devices : [];
    if (liveDevices.length > 0) {
      return {
        code: 0,
        message: 'Success',
        data: liveDevices.map(mapLiveTelemetryDevice)
      };
    }
    
    // STEP 1: Flatten the tree into a list of potential device objects
    const rawDeviceList: any[] = [];
    collectAllDevices(rawData, rawDeviceList);

    // STEP 2: Map and Deduplicate
    const processedMap = new Map<string, Device>();

    rawDeviceList.forEach((d: any) => {
         try {
             // Basic ID Resolution
             const sn = d.device_sn || d.sn || d.child_device_sn || d.uuid || d.id || `UNKNOWN-${Math.random().toString(36).substr(2, 5)}`;
             
             // If we already processed this SN, skip (unless this one has better data, e.g. online?)
             // Simple dedup: first one wins usually works if tree traversal is top-down
             if (processedMap.has(sn)) return;

             // Status check
             const statusRaw = d.status ?? d.online ?? d.is_online;
             const isOnline = Boolean(statusRaw === true || statusRaw === 1 || statusRaw === 'true');

             // Name Resolution
             const possibleNames = [
                 d.callsign, d.nickname, d.device_name, d.name,
                 // Sometimes name is in a nested config object?
                 d.config?.name
             ];
             
             const bestName = possibleNames.find(n => 
                n && typeof n === 'string' && n.trim().length > 0 && n.trim() !== 'null' && !isGenericId(n)
             );

             // Model Resolution
             let modelRaw = d.device_model || d.model || d.sub_type || d.type;
             let model = 'DJI Device';
             if (modelRaw) {
                if (typeof modelRaw === 'string') {
                    model = modelRaw;
                } else if (typeof modelRaw === 'object') {
                    model = modelRaw.name || modelRaw.key || modelRaw.model || JSON.stringify(modelRaw);
                }
             }

             let finalName = bestName;
             if (!finalName) {
                finalName = `${model} (${String(sn).substring(0, 4)})`;
             } 

             // Telemetry / Position Extraction
             // Prefer FlightHub device_state, fallback to offline position when available.
             const offlinePos = d.device_offline_position || d.offline_position;
             const state = d.device_state ?? {};
             
             let telSource = null;
             if (isOnline) {
                 telSource = state || d; 
             } else if (offlinePos && (offlinePos.latitude || offlinePos.lat)) {
                 telSource = offlinePos;
             } else {
                 telSource = state || d;
             }

             let safeTelemetry: DeviceTelemetry | undefined = undefined;
             
             if (telSource) {
                 const batteryObj = d.battery || state?.battery || telSource.battery || {};
                 const hSpeed = Number(telSource.horizontal_speed ?? telSource.speed ?? telSource.velocity) || 0;
                 const vSpeed = Number(telSource.vertical_speed ?? 0);
                 const batteryVal = Number(
                    batteryObj.capacity_percent ?? 
                    batteryObj.percent ?? 
                    telSource.battery_percent ?? 
                    telSource.capacity_percent ??
                    0
                 );

                 safeTelemetry = {
                   latitude:  Number(telSource.latitude || telSource.lat) || 0,
                   longitude: Number(telSource.longitude || telSource.lng || telSource.lon) || 0,
                   height:    Number(telSource.height || telSource.alt || telSource.altitude) || 0,
                   speed:     hSpeed,
                   h_speed_mps: hSpeed,
                   v_speed_mps: vSpeed,
                   battery_percent: batteryVal,
                   link_signal_quality: Number(telSource.link_signal_quality || telSource.signal) || 0,
                   flight_time: Number(telSource.flight_time) || 0,
                   yaw:   Number(telSource.yaw || telSource.heading) || 0,
                   pitch: Number(telSource.pitch) || 0,
                   roll:  Number(telSource.roll) || 0
                 };
             }

             processedMap.set(String(sn), {
                 device_sn: String(sn),
                 nickname: String(finalName),
                 device_model: String(model),
                 status: isOnline,
                 domain: Number(d.domain) || 0,
                 telemetry: safeTelemetry,
                 raw: d // Keep raw for debugging
             });

         } catch (innerError) {
             console.error("Error parsing individual device:", d, innerError);
         }
    });

    const mappedDevices = Array.from(processedMap.values());

    return {
        code: rawData.code || 0,
        message: rawData.message || "Success",
        data: mappedDevices
    };

  } catch (error) {
    console.error("Topology Fetch Error:", error);
    return { code: -1, message: String(error), data: [] };
  }
};
