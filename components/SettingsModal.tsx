import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  // Sync state when settings prop changes (e.g. initial load)
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuration
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">API Endpoint URL</label>
            <input 
              type="text" 
              required
              value={formData.apiUrl}
              onChange={e => setFormData({...formData, apiUrl: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Authentication Token (X-User-Token)</label>
            <input 
              type="text" 
              required
              value={formData.userToken}
              onChange={e => setFormData({...formData, userToken: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Project UUID</label>
            <input 
              type="text" 
              required
              value={formData.projectUuid}
              onChange={e => setFormData({...formData, projectUuid: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Workflow UUID</label>
            <input 
              type="text" 
              required
              value={formData.workflowUuid}
              onChange={e => setFormData({...formData, workflowUuid: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Creator ID</label>
            <input 
              type="text" 
              required
              value={formData.creatorId}
              onChange={e => setFormData({...formData, creatorId: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="pt-4 flex gap-3">
             <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
             >
               Cancel
             </button>
             <button 
                type="submit"
                className="flex-1 py-2 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase transition-colors shadow-lg shadow-cyan-900/50"
             >
               Save Changes
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};