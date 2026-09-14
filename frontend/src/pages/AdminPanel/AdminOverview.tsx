import React, { useState } from 'react';
import { RealTimeTrafficWidget, ActiveTasksWidget, GatewayStatsWidget, LiveGatewayFeedWidget, AiInsightsWidget } from './components/DashboardWidgets';
import { GripHorizontal, CheckCircle, FileText, Settings } from 'lucide-react';
import './AdminOverview.css';

const WIDGET_REGISTRY = {
  insights: <AiInsightsWidget />,
  traffic: <RealTimeTrafficWidget />,
  tasks: <ActiveTasksWidget />,
  gateway: <GatewayStatsWidget />,
  terminal: <LiveGatewayFeedWidget />
};

type WidgetKey = keyof typeof WIDGET_REGISTRY;

export const AdminOverview = () => {
  // Widget order layout
  const [layout, setLayout] = useState<{ id: WidgetKey, span: 'col-span-12' | 'col-span-8' | 'col-span-4' }>([
    { id: 'insights', span: 'col-span-12' },
    { id: 'traffic', span: 'col-span-8' },
    { id: 'tasks', span: 'col-span-4' },
    { id: 'gateway', span: 'col-span-12' },
    { id: 'terminal', span: 'col-span-12' }
  ]);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow the drag image to capture the current state,
    // before we apply dragging styles.
    setTimeout(() => {
      // e.target is the element being dragged
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;

    const newLayout = [...layout];
    const draggedItem = newLayout[draggedIdx];
    
    // Remove from old pos
    newLayout.splice(draggedIdx, 1);
    // Insert at new pos
    newLayout.splice(index, 0, draggedItem);
    
    setLayout(newLayout);
    setDraggedIdx(null);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header" style={{ marginBottom: 40, letterSpacing: '-0.02em' }}>
        <h1 style={{ 
          fontSize: 32, 
          fontWeight: 800, 
          margin: 0, 
          background: 'var(--accent-gradient)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.04em'
        }}>
          Platform Overview
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 16 }}>
          Command Center: High-level observability and real-time metrics.
        </p>
      </div>

      <div className="dashboard-grid">
        {layout.map((item, index) => (
          <div 
            key={item.id}
            className={`dashboard-widget-wrapper ${item.span} spring-in ${draggedIdx === index ? 'is-dragging' : ''}`}
            style={{ animationDelay: `${index * 0.1}s` }}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={() => setDraggedIdx(null)}
          >
            <div className="drag-handle">
              <GripHorizontal size={16} />
            </div>
            {WIDGET_REGISTRY[item.id]}
          </div>
        ))}
      </div>
      <div className="quick-action-dock">
        <button className="dock-btn">
          <CheckCircle size={20} style={{ minWidth: 20 }} />
          <span>Approve APIs</span>
        </button>
        <button className="dock-btn">
          <FileText size={20} style={{ minWidth: 20 }} />
          <span>View Reports</span>
        </button>
        <button className="dock-btn">
          <Settings size={20} style={{ minWidth: 20 }} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};
