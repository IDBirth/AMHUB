import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface ConsoleLogProps {
  logs: LogEntry[];
}

export const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col h-full shadow-inner shadow-black/50">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
        <span className="text-xs font-mono text-slate-400">SYSTEM LOGS</span>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2 relative">
        {logs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600">
            [No activity recorded]
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="border-b border-slate-800/50 pb-2 last:border-0 last:pb-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex gap-3 mb-1">
              <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
              <span className={`font-bold shrink-0 ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-emerald-400' : 
                log.type === 'request' ? 'text-blue-400' : 'text-slate-300'
              }`}>
                {log.type.toUpperCase()}
              </span>
              <span className="text-slate-200">{log.message}</span>
            </div>
            {log.details && (
              <pre className="ml-[9.5rem] text-[10px] text-slate-500 bg-slate-950/50 p-2 rounded overflow-x-auto border-l-2 border-slate-700">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};