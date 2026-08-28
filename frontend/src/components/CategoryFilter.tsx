import React from 'react';
import {
  Grid,
  Brain,
  Wallet,
  CloudSun,
  Terminal,
  MessageSquare,
  ShoppingBag,
  MoreHorizontal,
  Newspaper
} from 'lucide-react';
import { CATEGORIES_LIST } from '../data/mockData';

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory
}) => {

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'All Categories': return <Grid size={13} />;
      case 'AI & ML': return <Brain size={13} />;
      case 'Finance': return <Wallet size={13} />;
      case 'Weather': return <CloudSun size={13} />;
      case 'Developer Tools': return <Terminal size={13} />;
      case 'Communication': return <MessageSquare size={13} />;
      case 'E-commerce': return <ShoppingBag size={13} />;
      case 'News': return <Newspaper size={13} />;
      case 'More': return <MoreHorizontal size={13} />;
      default: return <Grid size={13} />;
    }
  };

  return (
    <div className="category-filter-container">
      <div className="category-scroll">
        {CATEGORIES_LIST.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              className={`category-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat)}
            >
              <span className="category-icon">{getCategoryIcon(cat)}</span>
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        .category-filter-container {
            width: 100%;
            overflow-x: auto;
            padding: 2px 0 8px 0;

            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .category-filter-container::-webkit-scrollbar {
            display: none;
        }

        .category-scroll {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: max-content;
        }

        .category-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 2px 12px;
          border-radius: var(--radius-lg);
          background-color: var(--bg-card);
          border: 1px solid var(--border-card);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .category-btn:hover {
          color: var(--text-primary);
          border-color: rgba(139, 92, 246, 0.3);
          background-color: var(--bg-card-hover);
        }

        .category-btn.active {
          background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%);
          color: #ffffff;
          border-color: transparent;
          font-weight: 600;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
        }

        .category-icon {
          display: flex;
          align-items: center;
          color: inherit;
        }
      `}</style>
    </div>
  );
};
