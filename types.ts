
export interface WorkflowParams {
  creator: string;
  latitude: number;
  longitude: number;
  level: number;
  desc: string;
}

export interface WorkflowRequest {
  workflow_uuid: string;
  trigger_type: number;
  name: string;
  params: WorkflowParams;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'request';
  message: string;
  details?: unknown;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  SENDING = 'SENDING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface AppSettings {
  userToken: string;
  projectUuid: string;
  workflowUuid: string;
  creatorId: string;
  apiUrl: string;
}

// --- Topology / Device Types ---

export interface DeviceTelemetry {
  latitude: number;
  longitude: number;
  height: number;
  speed: number;
  battery_percent: number;
  link_signal_quality: number; // 0-100
  flight_time: number; // seconds
  yaw: number;
  pitch: number;
  roll: number;
}

export interface Device {
  device_sn: string;
  nickname: string;
  device_model: string;
  status: boolean; // true = online, false = offline
  domain: number; // 0 = drone, 1 = dock, etc.
  telemetry?: DeviceTelemetry; // Optional, might be null if offline
  raw?: any; // For debugging API responses
}

export interface TopologyResponse {
  code: number;
  message: string;
  data: Device[];
}
