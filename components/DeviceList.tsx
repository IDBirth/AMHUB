import React, { useState } from 'react';
import { Device } from '../types';

interface DeviceListProps {
  devices: Device[];
  isLoading: boolean;
  onRefresh: () => void;
  className?: string;
  onSelectDevice: (device: Device) => void;
}

export const DeviceList: React.FC<DeviceListProps> = ({ devices, isLoading, onRefresh, className = '', onSelectDevice }) => {
  // Group devices to match the screenshot structure roughly
  const onlineDevices = devices.filter(d => d.status);
  const offlineDevices = devices.filter(d => !d.status);

  // Accordion state
  const [isOnlineOpen, setIsOnlineOpen] = useState(true);
  const [isOfflineOpen, setIsOfflineOpen] = useState(false);

  const getBatteryColor = (percent: number) => {
    if (percent > 60) return 'text-emerald-400';
    if (percent > 20) return 'text-yellow-400';
    return 'text-red-500';
  };

  const handleDeviceClick = (device: Device) => {
      // Only trigger if valid coordinates exist (either from telemetry or offline position)
      if (device.telemetry && (device.telemetry.latitude !== 0 || device.telemetry.longitude !== 0)) {
          onSelectDevice(device);
      }
  };

  const renderDeviceRow = (device: Device) => (
    <div 
        key={device.device_sn} 
        onClick={() => handleDeviceClick(device)}
        className="pl-4 pr-2 py-2 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors group cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${device.status ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`}></div>
           <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                {device.nickname}
              </span>
              <span className="text-[10px] font-mono text-slate-500">{device.device_model}</span>
           </div>
        </div>
        <span className="text-[9px] font-mono text-slate-600">{device.device_sn.substring(0, 4)}</span>
      </div>

      {device.status && device.telemetry && (
        <div className="flex items-center gap-3 mt-1 pl-3.5 opacity-70 group-hover:opacity-100 transition-opacity">
           <div className="flex items-center gap-1">
              <svg className={`w-3 h-3 ${getBatteryColor(device.telemetry.battery_percent)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] font-mono text-slate-300">{device.telemetry.battery_percent?.toFixed(0)}%</span>
           </div>
           <div className="flex items-center gap-1">
             <span className="text-[10px] text-slate-500 font-mono">H:</span>
             <span className="text-[10px] font-mono text-slate-300">{device.telemetry.height?.toFixed(0)}m</span>
           </div>
           <div className="flex items-center gap-1">
             <span className="text-[10px] text-slate-500 font-mono">S:</span>
             <span className="text-[10px] font-mono text-slate-300">{device.telemetry.speed?.toFixed(1)}m/s</span>
           </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[600px] ${className}`}>
      
      {/* Header / Refresh */}
      <div className="flex justify-between items-center bg-slate-900/80 p-3 border-b border-slate-800">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">FlightHub Fleet</span>
         <button 
          onClick={onRefresh} 
          disabled={isLoading}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1">
        
        {/* Call Sign (Mock for visual similarity) */}
        <div className="border-b border-slate-800/50">
           <div className="px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-slate-800/30">
              <span className="text-xs font-semibold text-slate-300">My Call Sign</span>
              <span className="text-[10px] text-slate-500">AMT</span>
           </div>
        </div>

        {/* Online Devices Section */}
        <div className="border-b border-slate-800/50">
          <div 
            className="px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-slate-800/30 bg-slate-900/40"
            onClick={() => setIsOnlineOpen(!isOnlineOpen)}
          >
             <div className="flex items-center gap-2">
                <svg className={`w-3 h-3 text-slate-500 transform transition-transform ${isOnlineOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-semibold text-slate-300">Online Devices</span>
             </div>
             <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded-full">{onlineDevices.length}</span>
          </div>
          
          {isOnlineOpen && (
            <div className="bg-slate-900/20">
               {onlineDevices.length === 0 ? (
                 <div className="p-3 text-[10px] text-slate-600 italic">No devices online</div>
               ) : (
                 onlineDevices.map(renderDeviceRow)
               )}
            </div>
          )}
        </div>

        {/* Offline Devices Section */}
        <div className="border-b border-slate-800/50">
          <div 
            className="px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-slate-800/30 bg-slate-900/40"
            onClick={() => setIsOfflineOpen(!isOfflineOpen)}
          >
             <div className="flex items-center gap-2">
                <svg className={`w-3 h-3 text-slate-500 transform transition-transform ${isOfflineOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-xs font-semibold text-slate-300">Offline History</span>
             </div>
             <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded-full">{offlineDevices.length}</span>
          </div>
          
          {isOfflineOpen && (
            <div className="bg-slate-900/20">
               {offlineDevices.map(renderDeviceRow)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};