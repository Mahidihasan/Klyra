import React, { useState, useRef, useEffect } from 'react';
import { Snowflake, ShieldAlert, CheckCircle2, AlertOctagon } from 'lucide-react';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';

// ─── Slide-to-Freeze Slider Component ────────────────────────────────────────

const SlideToFreeze = ({ onExecute }: { onExecute: () => void }) => {
  const [isExecuted, setIsExecuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag physics state
  const x = useMotionValue(0);
  // Calculate text opacity (fades out as you slide right)
  const textOpacity = useTransform(x, [0, 150], [1, 0]);
  // Calculate the "fill" background as the thumb moves
  const fillWidth = useTransform(x, [0, 260], ["36px", "100%"]);

  const THUMB_SIZE = 48; // Size of the draggable thumb
  const MAX_DRAG = 260 - THUMB_SIZE; // Approximate width of the container minus thumb

  const handleDragEnd = (event: any, info: any) => {
    if (isExecuted) return;
    
    // If dragged sufficiently far right (e.g., 90% of the way)
    if (info.offset.x > MAX_DRAG * 0.8) {
      setIsExecuted(true);
      onExecute();
      // Snap to end
      animate(x, MAX_DRAG, { type: 'spring', stiffness: 400, damping: 25 });
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full max-w-[260px] h-[56px] rounded-xl overflow-hidden flex items-center p-1 shadow-inner transition-colors duration-500 select-none ${
        isExecuted ? 'bg-cyan-900/50 border border-cyan-400/50' : 'bg-black/60 border border-white/10'
      }`}
    >
      {/* ── Liquid Fill Background ── */}
      <motion.div 
        style={{ width: fillWidth }}
        className="absolute left-0 top-0 bottom-0 bg-cyan-500/20 mix-blend-screen pointer-events-none"
      />

      {/* ── Idle Text ── */}
      {!isExecuted && (
        <motion.div 
          style={{ opacity: textOpacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none pr-4"
        >
          <span className="text-cyan-500/70 font-mono font-bold text-[12px] uppercase tracking-widest pl-6">
            Slide to Freeze &gt;&gt;
          </span>
        </motion.div>
      )}

      {/* ── Executed State ── */}
      {isExecuted && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span className="text-cyan-300 font-black text-[13px] uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
            <CheckCircle2 size={16} /> ASSETS FROZEN
          </span>
        </motion.div>
      )}

      {/* ── Draggable Thumb ── */}
      {!isExecuted && (
        <motion.div
          drag="x"
          dragConstraints={containerRef}
          dragElastic={0.05}
          dragSnapToOrigin={true}
          onDragEnd={handleDragEnd}
          style={{ x }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative z-10 w-[48px] h-[48px] rounded-lg cursor-grab active:cursor-grabbing flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)] bg-gradient-to-b from-cyan-400 to-cyan-600 border border-cyan-300"
        >
          <Snowflake size={20} className="text-white drop-shadow-md" />
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ActionBoard = () => {
  return (
    <div className="flex flex-col gap-6">
      
      <div className="flex items-center gap-3 shrink-0">
        <AlertOctagon size={20} className="text-cyan-400" />
        <div>
          <h2 className="text-[18px] font-bold text-white tracking-tight">Cyber-Tactical Action Board</h2>
          <p className="text-[12px] text-white/40 mt-0.5">High-stakes overrides for severe financial anomalies.</p>
        </div>
      </div>

      {/* ── The Danger Zone Container (Frost Theme) ── */}
      <div className="relative w-full p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 shadow-[inset_0_0_40px_rgba(6,182,212,0.1)] flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 overflow-hidden">
        
        {/* Subtle Diagonal Hazard Background */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none mix-blend-screen"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 15px, #06b6d4 15px, #06b6d4 30px)'
          }}
        />

        {/* ── Warning Text (Left) ── */}
        <div className="flex flex-col flex-1 min-w-0 z-10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert size={22} className="text-cyan-400 shrink-0" />
            <h3 className="text-cyan-400 font-bold tracking-widest text-lg uppercase font-mono">
              Emergency Asset Freeze
            </h3>
          </div>
          <p className="text-cyan-400/70 text-sm whitespace-normal break-words leading-relaxed mt-1">
            Instantly suspends all outgoing transactions and locks target accounts. Prevents capital flight during active fraud investigations.
          </p>
        </div>

        {/* ── Slide-to-Freeze Mechanism (Right) ── */}
        <div className="w-full xl:w-auto shrink-0 z-10 flex xl:justify-end">
          <SlideToFreeze onExecute={() => console.log('Assets Frozen via Slider')} />
        </div>

      </div>

    </div>
  );
};
