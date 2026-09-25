import React, { useState, useRef, useEffect } from 'react';

export const ActionBoard = () => {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const maxDragRef = useRef(0);

  useEffect(() => {
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      maxDragRef.current = rect.width - 50; // thumb width offset
      if (isFrozen) {
        setSliderPosition(maxDragRef.current);
      } else {
        setSliderPosition(0);
      }
    }
  }, [isFrozen]);

  const handleTouchMove = (clientX: number) => {
    if (!trackRef.current || isExecuting) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackWidth = maxDragRef.current;
    let x = clientX - rect.left - 25;
    
    // Constrain x
    if (x < 0) x = 0;
    if (x > trackWidth) x = trackWidth;

    setSliderPosition(x);

    if (!isFrozen && x >= trackWidth - 10) {
      triggerEmergencyFreeze();
    } else if (isFrozen && x <= 10) {
      triggerEmergencyUnfreeze();
    }
  };

  const handleMouseDrag = (e: React.MouseEvent) => {
    const onMouseMove = (moveEvent: MouseEvent) => handleTouchMove(moveEvent.clientX);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      // Snap back if threshold not reached
      if (!isExecuting) {
        setSliderPosition(isFrozen ? maxDragRef.current : 0);
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const triggerEmergencyFreeze = async () => {
    if (isFrozen || isExecuting) return;
    setIsFrozen(true);
    setIsExecuting(true);
    setSliderPosition(maxDragRef.current); // Snap to end

    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const response = await fetch('/api/v1/admin/finances/forensics/emergency-freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        alert(json.message);
      }
    } catch (error) {
      console.error("Emergency freeze failed:", error);
      alert("Failed to execute emergency asset freeze.");
      setIsFrozen(false);
      setSliderPosition(0);
    } finally {
      setIsExecuting(false);
    }
  };

  const triggerEmergencyUnfreeze = async () => {
    if (!isFrozen || isExecuting) return;
    setIsFrozen(false);
    setIsExecuting(true);
    setSliderPosition(0); // Snap to start

    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const response = await fetch('/api/v1/admin/finances/forensics/emergency-unfreeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        alert(json.message);
      }
    } catch (error) {
      console.error("Emergency unfreeze failed:", error);
      alert("Failed to execute emergency asset unfreeze.");
      setIsFrozen(true);
      setSliderPosition(maxDragRef.current);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="w-full bg-gray-950 border border-gray-800 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-400">⚠️</span>
          <div>
            <h2 className="text-white font-bold text-lg tracking-wide">Cyber-Tactical Action Board</h2>
            <p className="text-xs text-gray-400">High-stakes overrides for severe financial anomalies.</p>
          </div>
        </div>
        {isFrozen && (
          <button 
            onClick={triggerEmergencyUnfreeze}
            disabled={isExecuting}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-1.5 px-3 rounded border border-gray-700 transition-colors disabled:opacity-50"
          >
            Force Unfreeze
          </button>
        )}
      </div>

      <div className={`relative overflow-hidden ${isFrozen ? 'bg-gradient-to-r from-gray-900 to-emerald-950/30 border-emerald-500/30' : 'bg-gradient-to-r from-gray-900 via-gray-900 to-rose-950/30 border-rose-500/30'} border rounded-xl p-5 flex flex-col gap-4 transition-colors duration-500`}>
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[repeating-linear-gradient(45deg,#000,#000_10px,transparent_10px,transparent_20px)]"></div>

        <div className="relative z-10">
          <div className={`flex items-center gap-2 font-bold text-xs tracking-wider uppercase mb-1 ${isFrozen ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span>{isFrozen ? '✅' : '🛡️'}</span> {isFrozen ? 'SYSTEM SECURED (FROZEN)' : 'EMERGENCY ASSET FREEZE'}
          </div>
          <p className="text-xs text-gray-300">
            {isFrozen 
              ? 'Assets are currently frozen. Slide back to the left to lift the freeze and restore transaction flow.'
              : 'Instantly suspends all outgoing transactions and locks target accounts. Prevents capital flight during active fraud investigations.'}
          </p>
        </div>

        <div 
          ref={trackRef}
          className={`relative z-10 w-full h-12 bg-gray-950/80 border rounded-lg overflow-hidden flex items-center select-none ${isFrozen ? 'border-emerald-500/40' : 'border-rose-500/40'}`}
        >
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-mono tracking-widest uppercase pointer-events-none ${isFrozen ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
            {isExecuting 
              ? (isFrozen ? 'Executing Unfreeze...' : 'Executing Freeze...') 
              : (isFrozen ? '<< Slide back to Unfreeze <<' : '>> Slide to Execute Freeze >>')}
          </span>

          <div
            onMouseDown={handleMouseDrag}
            style={{ transform: `translateX(${sliderPosition}px)` }}
            className={`absolute left-1 w-10 h-10 rounded-md flex items-center justify-center cursor-pointer transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)] ${
              isFrozen ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
            }`}
          >
            <span className="text-white font-bold text-base">{isFrozen ? '🔓' : '❄'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
