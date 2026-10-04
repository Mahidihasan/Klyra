import React, { useEffect, useState } from 'react';
import { Activity, Sparkles } from 'lucide-react';

const DEMO_MESSAGES = [
  'Alex just purchased the Pro plan for Weather API · 2 min ago',
  'Maya just tested Weather API using POST · 4 min ago',
  'Rahim just published a new API · 6 min ago',
  'Jordan just subscribed to Payments API · 3 min ago',
  'Sami just tested an API using GET · 5 min ago',
  'Noah just hosted a new API · 7 min ago',
  'Priya just upgraded their Analytics API plan · 4 min ago',
  'Liam just shared a new Finance API · 8 min ago',
  'Zara just tried the Weather API tester · 2 min ago',
];

interface DummyActivityNotificationProps {
  enabled?: boolean;
}

export const DummyActivityNotification: React.FC<DummyActivityNotificationProps> = ({
  enabled = true,
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
  if (!enabled) return;

  let hideTimer: number | undefined;
  let showTimer: number | undefined;
  let cancelled = false;

  const scheduleNext = () => {
    showTimer = window.setTimeout(() => {
      if (cancelled) return;

      setMessageIndex((index) => (index + 1) % DEMO_MESSAGES.length);
      setIsVisible(true);

      hideTimer = window.setTimeout(() => {
        setIsVisible(false);
        scheduleNext();
      }, 5600);
    }, 10000);
  };

  scheduleNext();

  return () => {
    cancelled = true;

    if (showTimer) window.clearTimeout(showTimer);
    if (hideTimer) window.clearTimeout(hideTimer);
  };
}, [enabled]);

  const rawMessage = DEMO_MESSAGES[messageIndex];
  const [content, time] = rawMessage.includes(' · ')
    ? rawMessage.split(' · ')
    : [rawMessage, ''];

  return (
    <div
      aria-hidden="true"
      className="klyra-activity-toast-wrap"
      style={{
        position: 'fixed',
        left: 20,
        bottom: 20,
        zIndex: 110,
        width: 'min(370px, calc(100vw - 40px))',
        pointerEvents: 'none',
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'translate3d(0, 0, 0) scale(1)'
          : 'translate3d(-14px, 8px, 0) scale(0.96)',
        transition: 'opacity .38s ease, transform .42s cubic-bezier(.16, 1, .3, 1)',
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 1,
          borderRadius: 14,
          boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.75), 0 4px 16px rgba(15, 10, 40, 0.5), 0 0 32px -4px rgba(99, 102, 241, 0.3)',
        }}
      >
        {/* Subtle Luminous Neon Border Track */}
        <span
          aria-hidden="true"
          className="klyra-demo-notification-neon"
          style={{
            position: 'absolute',
            inset: -40,
            borderRadius: 14,
            background:
              'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(99, 102, 241, 0.15) 295deg, rgba(139, 92, 246, 0.85) 325deg, rgba(217, 70, 239, 0.95) 345deg, rgba(196, 181, 253, 0.9) 355deg, transparent 360deg)',
            animation: 'klyra-demo-notification-neon 6.2s linear infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Card Body */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 15px',
            border: '1px solid rgba(167, 139, 250, 0.38)',
            borderRadius: 13,
            color: '#ffffff',
            background:
              'radial-gradient(ellipse 120% 90% at 20% -10%, rgba(99, 102, 241, 0.3) 0%, transparent 65%), linear-gradient(135deg, rgba(27, 23, 66, 0.97) 0%, rgba(37, 22, 79, 0.97) 48%, rgba(20, 18, 51, 0.98) 100%)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            boxShadow:
              'inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 0 16px rgba(99, 102, 241, 0.12), 0 0 24px -2px rgba(99, 102, 241, 0.32)',
          }}
        >
          {/* Activity Icon Badge with Live Dot */}
          <div
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              color: '#ffffff',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.38) 0%, rgba(139, 92, 246, 0.22) 100%)',
              border: '1px solid rgba(196, 181, 253, 0.45)',
              boxShadow: '0 0 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Activity size={17} />
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
                border: '1.5px solid #1a1642',
              }}
            />
          </div>

          {/* Text Content with Clear Hierarchy */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 12.5,
                lineHeight: 1.45,
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
              }}
            >
              {content}
            </span>
            {time && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 500 }}>{time}</span>
                <span
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: 'rgba(196, 181, 253, 0.4)',
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(139, 92, 246, 0.28)',
                    color: '#f5f3ff',
                    border: '1px solid rgba(167, 139, 250, 0.35)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Live
                </span>
              </div>
            )}
          </div>

          {/* Subtle Accent Sparkle */}
          <Sparkles
            size={14}
            color="#c4b5fd"
            style={{
              flexShrink: 0,
              alignSelf: 'flex-start',
              marginTop: 2,
              filter: 'drop-shadow(0 0 6px rgba(167, 139, 250, 0.6))',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes klyra-demo-notification-neon {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 600px) {
          .klyra-activity-toast-wrap {
            left: 14px !important;
            bottom: 14px !important;
            width: calc(100vw - 28px) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .klyra-demo-notification-neon { animation: none !important; }
        }
      `}</style>
    </div>
  );
};
