'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { sendWorkflowAlert, getProjectTopology, getLiveSnapshot, connectLiveTelemetry } from './services/apiService';
import { WorkflowRequest, LogEntry, ConnectionStatus, AppSettings, Device } from './types';
import { 
  WORKFLOW_UUID, CREATOR_ID, DEFAULT_LAT, DEFAULT_LNG, 
  DEFAULT_LEVEL, DEFAULT_DESC, PROJECT_UUID, USER_TOKEN 
} from './constants';
import { StatusBadge } from './components/StatusBadge';
import { ConsoleLog } from './components/ConsoleLog';
import { MapPicker } from './components/MapPicker';
import { SettingsModal } from './components/SettingsModal';
import { DeviceList } from './components/DeviceList';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [followDeviceSn, setFollowDeviceSn] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed');
  
  // Device/Topology State
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  
  // Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({
    projectUuid: PROJECT_UUID,
    workflowUuid: WORKFLOW_UUID,
    creatorId: CREATOR_ID,
    userToken: USER_TOKEN
  });

  // Local state for editable fields
  const [latitude, setLatitude] = useState(DEFAULT_LAT);
  const [longitude, setLongitude] = useState(DEFAULT_LNG);
  const [desc, setDesc] = useState(DEFAULT_DESC);
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [requesterName, setRequesterName] = useState("");

  // App settings now come from defaults or the settings modal.

  const addLog = useCallback((type: LogEntry['type'], message: string, details?: unknown) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  // Fetch Topology (fallback)
  const fetchDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      if (!appSettings.projectUuid) {
        addLog('error', 'Missing API configuration. Open settings to configure credentials.');
        return;
      }
      const response = await getProjectTopology(appSettings);
      if (response && response.data) {
        setDevices(response.data);
        addLog('info', `Topology Updated: ${response.data.length} devices found.`);
        
        if (response.data.length === 0) {
           addLog('info', 'DEBUG: No devices found. Check API console for "Fetching Topology" output.');
        } else {
          // Check for first device structure
          const first = response.data[0];
          if (first.device_sn.startsWith('UNKNOWN')) {
             addLog('error', 'WARNING: Device structure unrecognized. See raw data:', first.raw);
          }
        }
      }
    } catch (error) {
      console.error(error);
      addLog('error', 'Failed to fetch equipment topology', { error: String(error) });
    } finally {
      setIsLoadingDevices(false);
    }
  }, [appSettings, addLog]);

  // Poll topology (server-side proxy) for Vercel compatibility
  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const load = async () => {
      if (!isMounted) return;
      await fetchDevices();
    };

    load();
    intervalId = window.setInterval(load, 6000);

    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [fetchDevices]);

  // Live telemetry via backend (snapshot + websocket updates)
  useEffect(() => {
    let isActive = true;

    const loadSnapshot = async () => {
      try {
        const snapshot = await getLiveSnapshot();
        if (!isActive) return;
        setDevices(snapshot);
        addLog('info', `Live snapshot loaded (${snapshot.length} devices).`);
      } catch (error) {
        addLog('error', 'Live snapshot failed', { error: String(error) });
      }
    };

    const conn = connectLiveTelemetry({
      onDevices: (nextDevices, type) => {
        if (!isActive) return;
        setDevices(nextDevices);
        if (type === 'snapshot') {
          addLog('info', `Live snapshot received (${nextDevices.length} devices).`);
        }
      },
      onStatus: (status, detail) => {
        if (!isActive) return;
        setLiveStatus(status);
        addLog('info', `Live status: ${status}${detail ? ` (${detail})` : ''}`);
      },
      onError: (error) => {
        if (!isActive) return;
        addLog('error', 'Live telemetry error', { error: error.message });
      }
    });

    loadSnapshot();

    return () => {
      isActive = false;
      conn.close();
    };
  }, [addLog]);

  const handleLocationSelect = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleMapInteract = () => {
    setFollowDeviceSn(null);
  };

  const handleTrigger = async () => {
    if (status === ConnectionStatus.SENDING) return;
    if (!appSettings.projectUuid || !appSettings.workflowUuid || !appSettings.creatorId) {
      addLog('error', 'Missing workflow configuration. Open settings to configure credentials.');
      return;
    }

    setStatus(ConnectionStatus.SENDING);
    
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const alertName = requesterName.trim() ? requesterName.trim() : `Alert-${timestamp}`;

    const payload: WorkflowRequest = {
      workflow_uuid: appSettings.workflowUuid,
      trigger_type: 0,
      name: alertName,
      params: {
        creator: appSettings.creatorId,
        latitude: latitude,
        longitude: longitude,
        level: level,
        desc: desc
      }
    };

    addLog('request', `Initializing Workflow Trigger: ${alertName}`, payload);

    try {
      const result = await sendWorkflowAlert(payload, appSettings);
      addLog('success', 'Workflow Triggered Successfully', result);
      setStatus(ConnectionStatus.SUCCESS);
    } catch (error: any) {
      console.error(error);
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Failed to fetch') {
        errorMessage = 'Network Error: Could not reach API (CORS/Offline)';
      }
      addLog('error', 'Transmission Failed', { error: errorMessage });
      setStatus(ConnectionStatus.ERROR);
    } finally {
      setTimeout(() => {
        setStatus(prev => prev === ConnectionStatus.SENDING ? ConnectionStatus.IDLE : prev);
      }, 2000);
    }
  };

  return (
    <div className="h-screen w-screen app-shell flex flex-col overflow-hidden">
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSave={setAppSettings}
      />

      {/* Compact Header */}
      <header className="panel-strong px-4 py-2 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/50">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">FlightHub Command</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-full panel hover:border-[rgba(143,179,106,0.6)] text-[color:var(--muted)] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content: Map + Overlays */}
      <main className="flex-1 relative overflow-hidden">
        
        {/* Full Screen Map */}
        <div className="absolute inset-0 z-0">
          <MapPicker 
            lat={latitude} 
            lng={longitude} 
            onLocationSelect={handleLocationSelect} 
            isMaximized={true} // Always max style
            devices={devices}
            selectedDeviceSn={followDeviceSn}
            onMapInteract={handleMapInteract}
          />
        </div>

        {/* LEFT OVERLAY: Device List Sidebar */}
        <div className="absolute top-4 left-4 bottom-4 w-72 z-10 flex flex-col pointer-events-none">
          <DeviceList 
             devices={devices} 
             isLoading={isLoadingDevices} 
             onRefresh={fetchDevices} 
             onSelect={(device) => setFollowDeviceSn(device.device_sn)}
             className="pointer-events-auto h-full"
          />
        </div>

        {/* RIGHT OVERLAY: Control Panel */}
        <div className="absolute top-4 right-4 z-10 w-80 pointer-events-auto">
          <div className="panel-strong rounded-lg shadow-2xl p-4 flex flex-col gap-4">
             <div className="border-b border-[color:var(--card-border)] pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider">Mission Config</h2>
             </div>
             
             {/* Coords */}
             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase muted-text font-bold">Lat</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    className="w-full bg-transparent border border-[color:var(--card-border)] rounded px-2 py-1 text-xs font-mono text-[color:var(--accent)] focus:outline-none focus:border-[color:var(--accent)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase muted-text font-bold">Lng</label>
                  <input 
                    type="number" 
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    className="w-full bg-transparent border border-[color:var(--card-border)] rounded px-2 py-1 text-xs font-mono text-[color:var(--accent)] focus:outline-none focus:border-[color:var(--accent)]"
                  />
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[9px] uppercase muted-text font-bold">Requester</label>
                <input 
                  type="text" 
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="ID / Name"
                  className="w-full bg-transparent border border-[color:var(--card-border)] rounded px-2 py-1 text-xs font-mono text-[color:var(--accent)] focus:outline-none focus:border-[color:var(--accent)]"
                />
             </div>

             <div className="space-y-1">
              <label className="text-[9px] uppercase muted-text font-bold">Description</label>
              <textarea 
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-transparent border border-[color:var(--card-border)] rounded px-2 py-1 text-xs text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent-2)] resize-none h-14"
              />
            </div>

            <div className="grid grid-cols-5 gap-1">
                 {[1, 2, 3, 4, 5].map((lvl) => (
                   <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`
                      py-1 rounded font-mono text-xs font-bold border transition-all
                      ${level === lvl 
                        ? 'bg-red-600 border-red-500 text-white' 
                        : 'bg-transparent border-[color:var(--card-border)] muted-text hover:text-[color:var(--text)]'
                      }
                    `}
                   >
                     {lvl}
                   </button>
                 ))}
            </div>

            {/* Trigger Button */}
            <button
              onClick={handleTrigger}
              disabled={status === ConnectionStatus.SENDING}
              className={`
                mt-2 relative overflow-hidden group w-full p-3 rounded-lg border transition-all duration-300
                flex items-center justify-center gap-2 shadow-lg
                ${status === ConnectionStatus.SENDING 
                  ? 'bg-[rgba(12,20,12,0.9)] border-[color:var(--card-border)] cursor-not-allowed opacity-80' 
                  : 'bg-gradient-to-r from-red-600 to-red-800 border-red-500 hover:border-red-400 hover:shadow-red-900/50'
                }
              `}
            >
               {status === ConnectionStatus.SENDING ? (
                 <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               ) : (
                 <>
                   <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                   <span className="text-sm font-bold tracking-widest text-white uppercase">Transmit Alert</span>
                 </>
               )}
            </button>
          </div>
        </div>

      </main>

      {/* Bottom: Logs */}
      <div className="h-48 border-t border-[color:var(--card-border)] shrink-0 z-20">
        <ConsoleLog logs={logs} />
      </div>

    </div>
  );
};

export default App;
