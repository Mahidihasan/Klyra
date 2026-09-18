import React, { useState, useEffect } from 'react';
import { RealTimeTrafficWidget, ActiveTasksWidget, GatewayStatsWidget, LiveGatewayFeedWidget, AiInsightsWidget } from './components/DashboardWidgets';
import { TrafficNexusWidget } from './components/TrafficNexusWidget';
import { SpotlightCard } from './components/SpotlightCard';
import { GripHorizontal, CheckCircle, FileText, Settings, Download, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './AdminOverview.css';

const WIDGET_REGISTRY = {
  nexus: <TrafficNexusWidget />,
  insights: <AiInsightsWidget />,
  traffic: <RealTimeTrafficWidget />,
  tasks: <ActiveTasksWidget />,
  gateway: <GatewayStatsWidget />,
  terminal: <LiveGatewayFeedWidget />
};

type WidgetKey = keyof typeof WIDGET_REGISTRY;

import { usePermissions } from '../../context/PermissionsContext';

export const AdminOverview = () => {
  const { hasPermission } = usePermissions();

  // Widget order layout
  const [layout, setLayout] = useState<Array<{ id: WidgetKey, span: 'col-span-12' | 'col-span-8' | 'col-span-4' }>>([]);

  useEffect(() => {
    const newLayout: Array<{ id: WidgetKey, span: 'col-span-12' | 'col-span-8' | 'col-span-4' }> = [];
    if (hasPermission('VIEW_ANALYTICS_DASHBOARD') || hasPermission('VIEW_TRANSACTIONS')) {
      newLayout.push({ id: 'nexus', span: 'col-span-12' });
      newLayout.push({ id: 'traffic', span: 'col-span-8' });
    }
    if (hasPermission('VIEW_AI_THREAT_DETECTION') || hasPermission('VIEW_ANALYTICS_DASHBOARD')) {
      newLayout.push({ id: 'insights', span: 'col-span-12' });
    }
    if (hasPermission('VIEW_SYSTEM_LOGS') || hasPermission('VIEW_ANALYTICS_DASHBOARD')) {
      newLayout.push({ id: 'tasks', span: 'col-span-4' });
    }
    if (hasPermission('VIEW_APIS') || hasPermission('CONFIGURE_GATEWAY_LIMITS')) {
      newLayout.push({ id: 'gateway', span: 'col-span-12' });
    }
    if (hasPermission('VIEW_SECURITY_LOGS') || hasPermission('VIEW_SYSTEM_LOGS')) {
      newLayout.push({ id: 'terminal', span: 'col-span-12' });
    }
    setLayout(newLayout);
  }, [hasPermission]);

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

  const handleAcknowledgeAlerts = async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/platform/acknowledge-alerts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to acknowledge alerts');
      const data = await res.json();
      toast.success(data.message || 'Alerts acknowledged', { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
    } catch (err: any) {
      toast.error(err.message, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
    }
  };

  const handleExportCsv = async () => {
    const exportPromise = (async () => {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/platform/export-metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export data');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `klyra_metrics.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })();

    toast.promise(exportPromise, {
      loading: 'Compiling report...',
      success: 'CSV Exported Successfully',
      error: 'Export Failed'
    }, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
  };

  const [isMaintenance, setIsMaintenance] = useState(false);

  const handleToggleMaintenance = async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch('/api/v1/admin/platform/toggle-maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const data = await res.json();
      setIsMaintenance(data.isActive);
      
      const statusText = data.isActive ? 'MAINTENANCE MODE ACTIVE' : 'Maintenance Mode Disabled';
      toast.success(statusText, { 
        style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' },
        iconTheme: { primary: data.isActive ? '#f59e0b' : '#10b981', secondary: '#fff' }
      });
    } catch (err: any) {
      toast.error(err.message, { style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } });
    }
  };

  return (
    <div className="dashboard-container">
      <Toaster position="bottom-right" />
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
        {layout.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '60px',
            textAlign: 'center',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '16px',
            color: 'var(--text-secondary)'
          }}>
            <h2 style={{ fontSize: 24, color: '#fff', marginBottom: 12 }}>No Modules Assigned</h2>
            <p>You have not been granted access to any dashboard widgets. Contact the Super Admin to request permissions.</p>
          </div>
        ) : (
          layout.map((item, index) => (
            <SpotlightCard
              key={item.id}
              className={`dashboard-widget-wrapper ${item.span} spring-in ${draggedIdx === index ? 'is-dragging' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => setDraggedIdx(null)}
            >
              <div className="drag-handle" title="Drag to reorder">
                <GripHorizontal size={16} />
              </div>
              {WIDGET_REGISTRY[item.id]}
            </SpotlightCard>
          ))
        )}
      </div>
      <div className="quick-action-dock">
        <button className="dock-btn" onClick={handleAcknowledgeAlerts} title="Acknowledge Alerts">
          <CheckCircle size={20} style={{ minWidth: 20 }} />
          <span>Acknowledge Alerts</span>
        </button>
        <button className="dock-btn" onClick={handleExportCsv} title="Export CSV">
          <Download size={20} style={{ minWidth: 20 }} />
          <span>Export Metrics CSV</span>
        </button>
        <button className="dock-btn" onClick={handleToggleMaintenance} style={{ color: isMaintenance ? '#f59e0b' : undefined }} title="Toggle Maintenance Mode">
          <AlertTriangle size={20} style={{ minWidth: 20, color: isMaintenance ? '#f59e0b' : undefined }} />
          <span>{isMaintenance ? 'Maintenance Active' : 'Toggle Maintenance'}</span>
        </button>
      </div>
    </div>
  );
};
