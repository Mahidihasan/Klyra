import React from 'react';
import { CreditCard } from 'lucide-react';

interface PendingTabProps {
  kind: 'methods';
}

const COPY = {
  methods: {
    title: 'Payment methods',
    body: 'Cards are held by Stripe rather than in the Klyra database, so this screen needs the Stripe integration and API keys before it can list or add a card.',
    blockers: [
      'Stripe secret key is not in the environment yet',
      'No payment_methods table — card data stays with Stripe by design',
      'Needs a decision on who owns the Stripe integration',
    ],
  },
} as const;

export const PendingTab: React.FC<PendingTabProps> = ({ kind }) => {
  const copy = COPY[kind];

  return (
    <div className="card-base pending-card">
      <div className="pending-icon">
        <CreditCard size={22} color="var(--text-muted)" />
      </div>
      <h3>{copy.title}</h3>
      <p className="pending-body">{copy.body}</p>

      <ul className="pending-list">
        {copy.blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>

      <style>{`
        .pending-card {
          padding: 40px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          border-style: dashed;
        }

        .pending-card:hover {
          transform: none;
        }

        .pending-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background-color: var(--bg-pill);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pending-card h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .pending-body {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          max-width: 52ch;
        }

        .pending-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin-top: 6px;
          text-align: left;
        }

        .pending-list li {
          font-size: 12px;
          color: var(--text-muted);
          padding-left: 14px;
          position: relative;
          line-height: 1.5;
        }

        .pending-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};
