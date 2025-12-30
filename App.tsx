import React, { useState, useCallback, useEffect, useRef } from 'react';
import { sendWorkflowAlert, getProjectTopology } from './services/apiService';
import { WorkflowRequest, LogEntry, ConnectionStatus, AppSettings, Device } from './types';
import { 
  WORKFLOW_UUID, CREATOR_ID, DEFAULT_LAT, DEFAULT_LNG, 
  DEFAULT_LEVEL, DEFAULT_DESC, USER_TOKEN, PROJECT_UUID, API_URL 
} from './constants';
import { StatusBadge } from './components/StatusBadge';
import { ConsoleLog } from './components/ConsoleLog';
import { MapPicker } from './components/MapPicker';
import { SettingsModal } from './components/SettingsModal';
import { DeviceList } from './components/DeviceList';
import { DraggablePanel } from './components/DraggablePanel';

const AmhubLogo = () => (
  <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center p-1 shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white">
    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 15L35 35M15 15L10 25M15 15L25 10" stroke="#000000" strokeWidth="8" strokeLinecap="round"/>
      <path d="M85 15L65 35M85 15L90 25M85 15L75 10" stroke="#000000" strokeWidth="8" strokeLinecap="round"/>
      <path d="M15 85L35 65M15 85L10 75M15 85L25 90" stroke="#000000" strokeWidth="8" strokeLinecap="round"/>
      <path d="M85 85L65 65M85 85L90 75M85 85L75 90" stroke="#000000" strokeWidth="8" strokeLinecap="round"/>
      <defs>
        <linearGradient id="gradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A90E2" />
          <stop offset="100%" stopColor="#76D2E1" />
        </linearGradient>
        <linearGradient id="gradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#F8E71C" />
        </linearGradient>
      </defs>
      <path d="M48 22L22 82H40L48 65L48 22Z" fill="url(#gradBlue)"/>
      <path d="M52 22L52 65L60 82H78L52 22Z" fill="url(#gradOrange)"/>
    </svg>
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [flyTo, setFlyTo] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [selectedDeviceSn, setSelectedDeviceSn] = useState<string | null>(null);
  
  const [lastPollTime, setLastPollTime] = useState<number>(0);
  const [isLinkHealthy, setIsLinkHealthy] = useState<boolean | 'unauthorized'>(false);
  
  const [appSettings, setAppSettings] = useState<AppSettings>({
    userToken: USER_TOKEN,
    projectUuid: PROJECT_UUID,
    workflowUuid: WORKFLOW_UUID,
    creatorId: CREATOR_ID,
    apiUrl: API_URL
  });

  const [latitude, setLatitude] = useState(DEFAULT_LAT);
  const [longitude, setLongitude] = useState(DEFAULT_LNG);
  const [desc, setDesc] = useState(DEFAULT_DESC);
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [requesterName, setRequesterName] = useState("");

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

  const fetchDevices = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoadingDevices(true);
    try {
      const response = await getProjectTopology(appSettings);
      if (response && response.code === 0) {
        setDevices(response.data);
        setLastPollTime(Date.now());
        setIsLinkHealthy(true);
      } else if (response && (response.code === 200401 || String(response.message).includes('401'))) {
        setIsLinkHealthy('unauthorized');
      } else {
        setIsLinkHealthy(false);
      }
    } catch (error) {
      setIsLinkHealthy(false);
    } finally {
      if (!isBackground) setIsLoadingDevices(false);
    }
  }, [appSettings]);

  useEffect(() => {
    fetchDevices(false);
    const intervalId = setInterval(() => fetchDevices(true), 1000);
    return () => clearInterval(intervalId);
  }, [fetchDevices]);

  const handleLocationSelect = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleDeviceSelect = (device: Device) => {
      setSelectedDeviceSn(device.device_sn);
      if (device.telemetry && (device.telemetry.latitude !== 0 || device.telemetry.longitude !== 0)) {
          setFlyTo({ lat: device.telemetry.latitude, lng: device.telemetry.longitude });
          addLog('info', `Uplink established with drone: ${device.nickname}`);
      }
  };

  const selectedDevice = devices.find(d => d.device_sn === selectedDeviceSn);

  const handleTrigger = async () => {
    if (status === ConnectionStatus.SENDING) return;
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
    addLog('request', `TRANSMITTING ALERT: ${alertName}`, payload);
    try {
      const result = await sendWorkflowAlert(payload, appSettings);
      addLog('success', 'Workflow Transmission Successful', result);
      setStatus(ConnectionStatus.SUCCESS);
    } catch (error: any) {
      addLog('error', 'Transmission Failed', { error: error instanceof Error ? error.message : 'Unknown' });
      setStatus(ConnectionStatus.ERROR);
    } finally {
      setTimeout(() => setStatus(prev => prev === ConnectionStatus.SENDING ? ConnectionStatus.IDLE : prev), 2000);
    }
  };

  const syncToDrone = () => {
    if (selectedDevice?.telemetry) {
        setLatitude(Number(selectedDevice.telemetry.latitude.toFixed(6)));
        setLongitude(Number(selectedDevice.telemetry.longitude.toFixed(6)));
        addLog('info', `Coordinates synchronized to drone: ${selectedDevice.nickname}`);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col font-sans overflow-hidden">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={appSettings} onSave={setAppSettings} />

      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex justify-between items-center z-20 shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <AmhubLogo />
            <h1 className="text-sm font-black tracking-widest text-white uppercase">AMHUB Command</h1>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-1"></div>
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-950 border border-slate-800">
             <div className={`w-2.5 h-2.5 rounded-full ${isLinkHealthy === 'unauthorized' ? 'bg-amber-500' : isLinkHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-red-600'}`}></div>
             <span className={`text-[10px] font-bold uppercase tracking-widest ${isLinkHealthy === 'unauthorized' ? 'text-amber-500' : isLinkHealthy ? 'text-emerald-500' : 'text-red-500'}`}>
                {isLinkHealthy === 'unauthorized' ? 'UNAUTHORIZED' : isLinkHealthy ? 'Live Link' : 'Offline'}
             </span>
             {isLinkHealthy === true && <span className="text-[9px] text-slate-600 font-mono">1.0s</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-all active:scale-95">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 z-0">
          <MapPicker lat={latitude} lng={longitude} onLocationSelect={handleLocationSelect} isMaximized={true} devices={devices} flyTo={flyTo} />
        </div>

        {/* Fleet Sidebar */}
        <div className="absolute top-4 left-4 bottom-4 w-72 z-10 flex flex-col pointer-events-none">
          <DeviceList devices={devices} isLoading={isLoadingDevices} onRefresh={() => fetchDevices(false)} onSelectDevice={handleDeviceSelect} className="pointer-events-auto h-full shadow-2xl" />
        </div>

        {/* MISSION CONTROL PANEL (DRAGGABLE) */}
        <DraggablePanel 
          id="mission-panel"
          title="Uplink & Mission Target"
          initialX={window.innerWidth - 360}
          initialY={64}
          className="w-80 border-t-cyan-500 border-t-2"
        >
          <div className="flex flex-col gap-5">
             {selectedDevice ? (
               <div className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 shadow-inner shadow-black/40">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                       </span>
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Live Telemetry</span>
                    </div>
                    <button onClick={() => setSelectedDeviceSn(null)} className="text-slate-500 hover:text-white transition-colors">
                       <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="flex flex-col bg-slate-950/80 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-500 uppercase font-black text-[8px] tracking-[0.1em] mb-0.5">Drone Latitude (Live)</span>
                      <span className="font-mono text-cyan-400 text-sm">{selectedDevice.telemetry?.latitude.toFixed(8) || 'NO SIGNAL'}</span>
                    </div>
                    <div className="flex flex-col bg-slate-950/80 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-500 uppercase font-black text-[8px] tracking-[0.1em] mb-0.5">Drone Longitude (Live)</span>
                      <span className="font-mono text-cyan-400 text-sm">{selectedDevice.telemetry?.longitude.toFixed(8) || 'NO SIGNAL'}</span>
                    </div>
                  </div>

                  <button 
                    onClick={syncToDrone}
                    className="w-full mt-3 py-2 px-3 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    Copy to Target
                  </button>
               </div>
             ) : (
               <div className="text-[10px] text-slate-500 italic text-center py-4 bg-slate-900/30 border border-dashed border-slate-800 rounded-lg">
                  Select an active drone to sync target coordinates
               </div>
             )}

             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Target Latitude</label>
                    <input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Target Longitude</label>
                    <input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" />
                  </div>
               </div>

               <div className="space-y-1.5">
                  <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Requester / Mission ID</label>
                  <input type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Enter Mission ID" className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20" />
               </div>

               <div className="space-y-1.5">
                <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Intelligence Report</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 resize-none h-20" />
              </div>

              <div className="space-y-1.5">
                  <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Threat Level</label>
                  <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                      <button key={lvl} onClick={() => setLevel(lvl)} className={`py-1.5 rounded font-mono text-xs font-black border transition-all ${level === lvl ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/40' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}>{lvl}</button>
                      ))}
                  </div>
              </div>

              <button onClick={handleTrigger} disabled={status === ConnectionStatus.SENDING} className={`mt-4 relative overflow-hidden group w-full p-4 rounded-lg border transition-all duration-300 flex flex-col items-center justify-center shadow-xl ${status === ConnectionStatus.SENDING ? 'bg-slate-800 border-slate-700 cursor-not-allowed opacity-80' : 'bg-gradient-to-b from-cyan-600 to-cyan-800 border-cyan-400 hover:from-cyan-500 hover:to-cyan-700 hover:shadow-cyan-500/30 active:scale-[0.98]'}`}>
                 {status === ConnectionStatus.SENDING ? (
                   <div className="flex items-center gap-3">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span className="text-sm font-black tracking-[0.2em] text-white uppercase">Uplinking...</span>
                   </div>
                 ) : (
                   <>
                     <span className="text-sm font-black tracking-[0.3em] text-white uppercase">Transmit Mission</span>
                     <span className="text-[8px] text-cyan-200/50 uppercase mt-1.5 tracking-widest">Encrypted Satellite Channel Alpha</span>
                   </>
                 )}
              </button>
            </div>
          </div>
        </DraggablePanel>
      </main>

      <div className="h-48 border-t border-slate-800 bg-slate-950 shrink-0 z-20">
        <ConsoleLog logs={logs} />
      </div>
    </div>
  );
};

export default App;
