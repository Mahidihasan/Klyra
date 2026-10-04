import React, { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface FloatingCopilotLauncherProps {
  onOpen: () => void;
}

export const FloatingCopilotLauncher: React.FC<FloatingCopilotLauncherProps> = ({ onOpen }) => {
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    let nextTimer: number | undefined;
    let cancelled = false;

    const schedule = () => {
      nextTimer = window.setTimeout(() => {
        if (cancelled) return;
        setShowBubble(true);
        hideTimer = window.setTimeout(() => {
          setShowBubble(false);
          schedule();
        }, 4200);
      }, 5000 + Math.round(Math.random() * 2000));
    };

    schedule();
    return () => {
      cancelled = true;
      if (nextTimer) window.clearTimeout(nextTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div
      className="klyra-copilot-launcher-wrap"
      style={{
        position: 'fixed',
        right: 22,
        bottom: 22,
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* Speech / Message Bubble */}
      <div
        aria-hidden="true"
        className="klyra-copilot-bubble"
        style={{
          position: 'absolute',
          right: 64,
          bottom: 6,
          boxSizing: 'border-box',
          width: 'min(252px, calc(100vw - 96px))',
          minWidth: 0,
          padding: '11px 15px',
          border: '1px solid rgba(167, 139, 250, 0.42)',
          borderRadius: '16px 16px 4px 16px',
          color: '#ffffff',
          background:
            'radial-gradient(ellipse 130% 90% at 20% -10%, rgba(99, 102, 241, 0.32) 0%, transparent 65%), linear-gradient(135deg, rgba(29, 24, 72, 0.97) 0%, rgba(39, 23, 86, 0.97) 48%, rgba(22, 19, 56, 0.98) 100%)',
          backdropFilter: 'blur(16px) saturate(190%)',
          WebkitBackdropFilter: 'blur(16px) saturate(190%)',
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 0 16px rgba(99, 102, 241, 0.15), 0 18px 40px -6px rgba(4, 3, 18, 0.75), 0 0 28px -2px rgba(99, 102, 241, 0.32), 0 0 8px rgba(139, 92, 246, 0.22)',
          fontSize: 12.5,
          lineHeight: 1.45,
          textAlign: 'left',
          overflowWrap: 'break-word',
          wordBreak: 'normal',
          opacity: showBubble ? 1 : 0,
          transform: showBubble
            ? 'translate3d(0, 0, 0) scale(1)'
            : 'translate3d(6px, 4px, 0) scale(0.95)',
          transformOrigin: 'right bottom',
          transition: 'opacity .32s ease, transform .36s cubic-bezier(.16, 1, .3, 1)',
          whiteSpace: 'normal',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              border: '1.5px solid #161338',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#e0e7ff',
              fontFamily: 'var(--font-sans)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
            }}
          >
            Klyra Copilot
          </span>
          <Sparkles
            size={11}
            color="#c4b5fd"
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              filter: 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.6))',
            }}
          />
        </div>
        <div
          style={{
            color: '#ffffff',
            fontSize: 12.5,
            fontWeight: 600,
            lineHeight: 1.45,
            letterSpacing: '-0.01em',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
          }}
        >
          Hey! I’m Klyra Copilot ✨ Need a hand?
        </div>
      </div>

      {/* Floating Copilot Launcher Button */}
      <button
        type="button"
        className="klyra-copilot-launcher"
        onClick={onOpen}
        aria-label="Open Klyra Copilot"
        title="Open Klyra Copilot"
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          border: '1px solid rgba(196, 181, 253, 0.45)',
          borderRadius: '50%',
          color: '#ffffff',
          background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 52%, #4338ca 100%)',
          boxShadow:
            '0 8px 24px -2px rgba(99, 102, 241, 0.45), 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(167, 139, 250, 0.35), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          animation: 'klyra-copilot-float 4.8s ease-in-out infinite',
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.32) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <Bot size={22} strokeWidth={1.9} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }} />
        <span
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles
            size={12}
            strokeWidth={2.2}
            style={{
              color: '#fbcfe8',
              filter: 'drop-shadow(0 0 4px rgba(244, 114, 182, 0.6))',
            }}
          />
        </span>
      </button>

      <style>{`
        .klyra-copilot-launcher:hover {
          transform: translateY(-2px) scale(1.05) !important;
          border-color: rgba(221, 214, 254, 0.7) !important;
          box-shadow: 0 12px 32px -2px rgba(99, 102, 241, 0.65), 0 0 28px -2px rgba(168, 85, 247, 0.45), 0 0 0 1px rgba(196, 181, 253, 0.55), inset 0 1px 1px 0 rgba(255, 255, 255, 0.45) !important;
        }
        .klyra-copilot-launcher:active {
          transform: translateY(0) scale(0.96) !important;
        }
        .klyra-copilot-bubble::after {
          content: '';
          position: absolute;
          right: -5px;
          bottom: 12px;
          width: 9px;
          height: 9px;
          background: #1c1543;
          border-right: 1px solid rgba(167, 139, 250, 0.42);
          border-bottom: 1px solid rgba(167, 139, 250, 0.42);
          transform: rotate(-45deg);
          pointer-events: none;
          box-shadow: 2px 2px 4px rgba(4, 3, 18, 0.35);
        }
        @keyframes klyra-copilot-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        @media (max-width: 600px) {
          .klyra-copilot-launcher-wrap { right: 14px !important; bottom: 14px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .klyra-copilot-launcher { animation: none !important; }
        }
      `}</style>
    </div>
  );
};
