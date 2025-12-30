import React, { useState, useRef, useEffect } from 'react';

interface DraggablePanelProps {
  title: string;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  className?: string;
  id: string;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({ 
  title, 
  children, 
  initialX = 400, 
  initialY = 100,
  className = "",
  id
}) => {
  // Use a ref to store the latest position to avoid dependency cycles in resize listener
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Correct position if window is resized or if initial position is invalid
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.max(10, Math.min(window.innerWidth - 350, prev.x)),
        y: Math.max(10, Math.min(window.innerHeight - 100, prev.y))
      }));
    };
    
    handleResize(); // Run once on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking the drag handle or the title area
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Boundary checks to prevent window from being lost
      const x = Math.max(0, Math.min(window.innerWidth - 50, newX));
      const y = Math.max(0, Math.min(window.innerHeight - 40, newY));
      
      setPosition({ x, y });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      ref={panelRef}
      style={{ 
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isDragging ? 1001 : 1000,
        position: 'absolute'
      }}
      className={`bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col transition-shadow duration-200 ${isDragging ? 'shadow-cyan-500/40 ring-2 ring-cyan-500/50' : ''} ${className}`}
    >
      {/* Header / Drag Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className="drag-handle cursor-move px-4 py-2.5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 hover:bg-slate-800 transition-colors rounded-t-lg select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="grid grid-cols-2 gap-0.5 opacity-40">
            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
          </div>
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          >
            {isMinimized ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isMinimized ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};
