import React from 'react';
import { ConnectionStatus } from '../types';

interface StatusBadgeProps {
  status: ConnectionStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getColors = () => {
    switch (status) {
      case ConnectionStatus.SENDING:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 animate-pulse';
      case ConnectionStatus.SUCCESS:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case ConnectionStatus.ERROR:
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      default:
        return 'bg-[rgba(12,20,12,0.7)] text-[color:var(--muted)] border-[color:var(--card-border)]';
    }
  };

  return (
    <div className={`px-3 py-1 rounded-full border text-xs font-mono uppercase tracking-wider font-bold transition-all duration-300 ${getColors()}`}>
      {status === ConnectionStatus.SENDING ? 'TRANSMITTING...' : status}
    </div>
  );
};
