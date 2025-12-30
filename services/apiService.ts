import { WorkflowRequest, AppSettings, TopologyResponse, Device, DeviceTelemetry } from '../types';

const PROXY_BASE = "https://corsproxy.io/?";

/**
 * Transmits the workflow trigger to the DJI API via a CORS proxy.
 */
export const sendWorkflowAlert = async (payload: WorkflowRequest, settings: AppSettings): Promise<any> => {
  try {
    const targetUrl = PROXY_BASE + encodeURIComponent(settings.apiUrl);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': settings.userToken,
        'x-project-uuid': settings.projectUuid
      },
      body: JSON.stringify(payload)
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

/**
 * Direct Parser for the DJI FlightHub 2 Topology Response.
 * Strictly follows the structure: data.list -> item.host
 */
export const getProjectTopology = async (settings: AppSettings): Promise<TopologyResponse> => {
  try {
    const urlObj = new URL(settings.apiUrl);
    const domain = urlObj.origin; 
    const topologyPath = `${domain}/manage/api/v1.0/projects/${settings.projectUuid}/topologies`;
    const targetUrl = PROXY_BASE + encodeURIComponent(topologyPath);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': settings.userToken,
        'x-project-uuid': settings.projectUuid
      }
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        let code = response.status;
        try {
            const errJson = JSON.parse(errText);
            if (errJson.code) code = errJson.code;
        } catch(e) {}
        
        return { 
            code: code, 
            message: `Topology API Error: ${response.status} - ${errText.substring(0, 50)}`, 
            data: [] 
        };
    }

    const rawData = await response.json().catch(() => null);
    
    if (!rawData || !rawData.data || !Array.isArray(rawData.data.list)) {
        throw new Error("Invalid topology response structure");
    }
    
    const processedDevices: Device[] = [];

    // Map strictly through the list of host devices
    rawData.data.list.forEach((item: any) => {
        const d = item.host;
        if (!d) return;

        // 1. Identify if it's a Drone (Domain 0)
        let domainVal = d.domain ?? d.device_model?.domain;
        if (domainVal === undefined && d.device_model_key) {
            domainVal = parseInt(d.device_model_key.split('-')[0]);
        }

        // Strictly only process drones (domain 0)
        if (Number(domainVal) !== 0) return;

        const sn = d.device_sn || d.sn;
        if (!sn) return;

        // 2. Determine Online Status
        const isOnline = d.device_online_status === true || d.device_online_status === 1;

        // 3. Extract Model Name
        const modelName = d.device_model?.name || d.device_model?.key || "Drone";

        // 4. Resolve Nickname
        const nickname = d.device_project_callsign || d.device_organization_callsign || modelName;

        // 5. Parse Telemetry (from device_state)
        const state = d.device_state || {};
        
        let lat = Number(state.latitude || 0);
        let lng = Number(state.longitude || 0);
        
        if (lat === 0 && lng === 0 && d.device_offline_position) {
            lat = Number(d.device_offline_position.latitude || 0);
            lng = Number(d.device_offline_position.longitude || 0);
        }

        // Battery
        let batteryPercent = 0;
        if (state.battery) {
            batteryPercent = state.battery.capacity_percent ?? 0;
            if (batteryPercent === 0 && Array.isArray(state.battery.batteries) && state.battery.batteries.length > 0) {
                batteryPercent = state.battery.batteries[0].capacity_percent ?? 0;
            }
        }

        // Build Telemetry object
        let telemetry: DeviceTelemetry | undefined = undefined;
        if (lat !== 0 || lng !== 0 || isOnline) {
            telemetry = {
                latitude: lat,
                longitude: lng,
                height: Number(state.height || state.elevation || 0),
                speed: Number(state.horizontal_speed || 0),
                battery_percent: batteryPercent,
                link_signal_quality: Number(state.wireless_link?.sdr_quality || 0),
                flight_time: Number(state.total_flight_time || 0),
                yaw: Number(state.attitude_head || state.heading || 0),
                pitch: Number(state.attitude_pitch || 0),
                roll: Number(state.attitude_roll || 0)
            };
        }

        processedDevices.push({
            device_sn: String(sn),
            nickname: String(nickname),
            device_model: String(modelName),
            status: isOnline,
            domain: 0,
            telemetry,
            raw: d
        });
    });

    return {
        code: rawData.code || 0,
        message: processedDevices.length === 0 ? "No drones detected" : "Success",
        data: processedDevices
    };

  } catch (error) {
    console.error("Topology Error:", error);
    return { code: -1, message: String(error), data: [] };
  }
};