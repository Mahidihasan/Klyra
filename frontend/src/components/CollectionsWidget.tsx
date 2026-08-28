import React from 'react';
import { Folder, ChevronRight, ShoppingBag, Share2, Cpu, CreditCard, Terminal } from 'lucide-react';
import { CollectionItem } from '../types/api';

interface CollectionsWidgetProps {
  collections: CollectionItem[];
  onSelectCollection: (col: CollectionItem) => void;
  onViewAllCollections: () => void;
}

export const CollectionsWidget: React.FC<CollectionsWidgetProps> = ({
  collections,
  onSelectCollection,
  onViewAllCollections
}) => {

  const renderIcon = (iconName: string, color: string) => {
    return (
      <div className="col-icon-badge" style={{ backgroundColor: `${color}18`, color: color }}>
        <Folder size={16} color={color} />
      </div>
    );
  };

  return (
    <div className="collections-widget card-base">
      <div className="widget-header">
        <h3 className="widget-title">Collections</h3>
        <button className="widget-view-all" onClick={onViewAllCollections}>View all</button>
      </div>

      <div className="collections-list">
        {collections.map((col) => (
          <div 
            key={col.id} 
            className="collection-item"
            onClick={() => onSelectCollection(col)}
          >
            {renderIcon(col.iconName, col.color)}
            <div className="col-info">
              <div className="col-name">{col.name}</div>
              <div className="col-count">{col.apiCount} APIs</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .collections-widget {
          padding: 18px 20px;
        }

        .widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .widget-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .widget-view-all {
          font-size: 12px;
          color: var(--text-accent);
          font-weight: 500;
        }

        .collections-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .collection-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .collection-item:hover {
          background-color: var(--bg-card-hover);
        }

        .col-icon-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .col-info {
          display: flex;
          flex-direction: column;
        }

        .col-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .col-count {
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
};
