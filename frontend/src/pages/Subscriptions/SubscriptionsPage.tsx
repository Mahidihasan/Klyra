import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Repeat } from 'lucide-react';
import { ApiItem } from '../../types/api';
import { useSubscription } from '../Marketplace/useSubscription';
import { KlyraSubscriptionSegment } from './components/KlyraSubscriptionSegment';
import { ApiSubscriptionsSegment } from './components/ApiSubscriptionsSegment';
import './styles.css';

export type SubscriptionsSegment = 'klyra' | 'api';

interface SubscriptionsPageProps {
  apis?: ApiItem[];
  onOpenTester?: (api?: ApiItem) => void;
  onSelectApi?: (api: ApiItem) => void;
  onNavigateTab?: (tab: string, detail?: any) => void;
}

export const SubscriptionsPage: React.FC<SubscriptionsPageProps> = ({
  apis = [],
  onOpenTester,
  onSelectApi,
  onNavigateTab,
}) => {
  const [activeSegment, setActiveSegment] = useState<SubscriptionsSegment>('klyra');
  const { subscriptions } = useSubscription();

  return (
    <div className="subscriptions-page">
      {/* Page Heading */}
      <div className="subscriptions-title-group">
        <h1>
          <span>Subscriptions</span>
        </h1>
        <p>
          Manage your Klyra platform plan details, billing renewal schedules, and Marketplace API subscriptions.
        </p>
      </div>

      {/* Full-width Tab Bar */}
      <div
        className="sub-tab-bar"
        role="tablist"
        aria-label="Subscription Views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSegment === 'klyra'}
          className={`sub-tab-btn ${activeSegment === 'klyra' ? 'active' : ''}`}
          onClick={() => setActiveSegment('klyra')}
        >
          <Sparkles size={15} className="sub-tab-icon" />
          <span>Klyra Subscription</span>
          {activeSegment === 'klyra' && (
            <motion.div
              layoutId="sub-tab-indicator"
              className="sub-tab-indicator"
              transition={{ type: 'tween', duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSegment === 'api'}
          className={`sub-tab-btn ${activeSegment === 'api' ? 'active' : ''}`}
          onClick={() => setActiveSegment('api')}
        >
          <Repeat size={15} className="sub-tab-icon" />
          <span>API Subscriptions</span>
          {subscriptions && subscriptions.length > 0 && (
            <span className="sub-count-badge">{subscriptions.length}</span>
          )}
          {activeSegment === 'api' && (
            <motion.div
              layoutId="sub-tab-indicator"
              className="sub-tab-indicator"
              transition={{ type: 'tween', duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </button>
      </div>

      {/* Segment Content */}
      <div className="sub-content-container">
        <AnimatePresence mode="wait" initial={false}>
          {activeSegment === 'klyra' ? (
            <motion.div
              key="klyra-segment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <KlyraSubscriptionSegment onNavigateTab={onNavigateTab} />
            </motion.div>
          ) : (
            <motion.div
              key="api-segment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <ApiSubscriptionsSegment
                apis={apis}
                onOpenTester={onOpenTester}
                onSelectApi={onSelectApi}
                onNavigateTab={onNavigateTab}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
