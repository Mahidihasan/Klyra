import React, { useState, useMemo, useEffect } from 'react';
import { ProviderProject, ProjectTab, PricingPlan, ProviderApiKey, ApiConsumer } from '../../types/apibuild';
import { DetailedEndpoint, ExtendedVersion, DeploymentRecord, ExtendedLogEntry } from './types';
import {
  getMockEndpoints, getMockVersions, getMockDeployments,
  getMockLogs, getMockInsights, getMockIncidents, getMockAlertRules
} from './mockExtendedData';

import { HeaderCommandBar } from './components/HeaderCommandBar';
import { EndpointDrawer } from './components/EndpointDrawer';
import { DeploymentDrawer } from './components/DeploymentDrawer';
import { ConsumerDrawer } from './components/ConsumerDrawer';
import { RequestLogDrawer } from './components/RequestLogDrawer';
import { CreateKeyModal } from './components/CreateKeyModal';
import { CreatePlanModal } from './components/CreatePlanModal';
import { OpenApiImportModal } from './components/OpenApiImportModal';
import { VersionMigrationModal } from './components/VersionMigrationModal';
import { ProjectCommandPalette } from './components/ProjectCommandPalette';
import { apiBuildService } from '../../services/apiBuild';

import { TabOverview } from './tabs/TabOverview';
import { TabApi } from './tabs/TabApi';
import { TabDeployments } from './tabs/TabDeployments';
import { TabVersions } from './tabs/TabVersions';
import { TabPlans } from './tabs/TabPlans';
import { TabConsumers } from './tabs/TabConsumers';
import { TabKeys } from './tabs/TabKeys';
import { TabUsage } from './tabs/TabUsage';
import { TabAnalytics } from './tabs/TabAnalytics';
import { TabLogs } from './tabs/TabLogs';
import { TabMonitoring } from './tabs/TabMonitoring';
import { TabSettings } from './tabs/TabSettings';

import './styles-professional.css';

interface WorkspaceRedesignProps {
  project: ProviderProject;
  projectsList: ProviderProject[];
  tab: ProjectTab;
  setTab: (t: ProjectTab) => void;
  onBackToDashboard: () => void;
  onOpenPlayground: () => void;
  onPauseToggle: () => void;
  onDeleteProject: () => void;
  onSelectProject: (p: ProviderProject) => void;
  onUpdateProject: (patch: Partial<ProviderProject>) => void;
}

export const WorkspaceRedesign: React.FC<WorkspaceRedesignProps> = ({
  project,
  projectsList,
  tab,
  setTab,
  onBackToDashboard,
  onOpenPlayground,
  onPauseToggle,
  onDeleteProject,
  onSelectProject,
  onUpdateProject
}) => {
  // Selected Version state
  const [selectedVersion, setSelectedVersion] = useState<string>(project.version || 'v2.4.1');

  // Extended domain datasets
  const [endpoints, setEndpoints] = useState<DetailedEndpoint[]>(() => getMockEndpoints(project, selectedVersion));
  const [versions, setVersions] = useState<ExtendedVersion[]>(() => getMockVersions(project));
  const [deployments, setDeployments] = useState<DeploymentRecord[]>(() => getMockDeployments(project));
  const [logs, setLogs] = useState<ExtendedLogEntry[]>(() => getMockLogs(project));
  const [insights, setInsights] = useState(() => getMockInsights(project));
  const [incidents, setIncidents] = useState(() => getMockIncidents(project));
  const [alertRules, setAlertRules] = useState(() => getMockAlertRules());

  // Mutable collections initialized from project
  const [plans, setPlans] = useState<PricingPlan[]>(project.plans || []);
  const [consumers, setConsumers] = useState<ApiConsumer[]>(project.consumersList || []);
  const [apiKeys, setApiKeys] = useState<ProviderApiKey[]>(project.apiKeys || []);

  // Drawers state
  const [selectedEndpoint, setSelectedEndpoint] = useState<DetailedEndpoint | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentRecord | null>(null);
  const [selectedConsumer, setSelectedConsumer] = useState<ApiConsumer | null>(null);
  const [selectedLog, setSelectedLog] = useState<ExtendedLogEntry | null>(null);

  // Modals state
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [isOpenApiImportOpen, setIsOpenApiImportOpen] = useState(false);
  const [isMigrationOpen, setIsMigrationOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Toast notifications queue
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);

  const showToast = (msg: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev: { id: string; msg: string }[]) => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts((prev: { id: string; msg: string }[]) => prev.filter((t: { id: string; msg: string }) => t.id !== id));
    }, 3200);
  };

  // Keyboard shortcut Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const handleTriggerRedeploy = () => {
    showToast('Deployment queued: building container image on cluster [sg-edge-pool-01]...');
    const newDep: DeploymentRecord = {
      id: `dep-${Date.now().toString().slice(-4)}`,
      version: selectedVersion === 'all' ? project.version : selectedVersion,
      environment: 'production',
      source: project.sourceKind === 'existing' ? 'External API' : project.sourceKind === 'github' ? 'GitHub' : 'Docker',
      region: 'Singapore (ap-southeast-1)',
      status: 'building',
      url: project.baseUrl || 'https://api.kickonass.com',
      deployedAt: 'Just now',
      durationSec: 12,
      author: 'Mahidi Hasan (Lead)',
      logs: [
        'Ingress proxy refresh triggered',
        'Validating SSL certificate and upstream TCP health...',
        'Warming edge cache and deploying route tables...',
        'Zero-downtime cutover complete'
      ],
      envVars: []
    };
    setDeployments((prev: DeploymentRecord[]) => [newDep, ...prev]);
    onUpdateProject({
      status: 'deploying',
      deployment: { ...project.deployment, status: 'queued', lastHealthCheck: 'queued', log: [...project.deployment.log, 'Deployment queued from project controls'] }
    });
    void apiBuildService.requestDeploy(project.id).then(async ({ jobId }) => {
      showToast(`Deployment queued securely (${jobId.slice(0, 8)}).`);
      const status = await apiBuildService.waitForDeploy(jobId);
      if (status !== 'completed') {
        showToast(status === 'failed' ? 'Deployment failed. Review deployment logs.' : 'Deployment is still processing in the queue.');
        return;
      }
      const remoteProject = await apiBuildService.getRemoteProject(project.id);
      onUpdateProject(remoteProject);
      setDeployments((prev: DeploymentRecord[]) =>
        prev.map((d: DeploymentRecord) => (d.id === newDep.id ? { ...d, status: 'healthy', deployedAt: '1 minute ago' } : d))
      );
      showToast('Deployment healthy: traffic is live on 42 edge locations');
    }).catch(() => showToast('Saved locally — deployment queue will retry when the backend is online.'));
  };

  const handleCreateKey = (key: ProviderApiKey) => {
    setApiKeys((prev: ProviderApiKey[]) => [key, ...prev]);
    onUpdateProject({ apiKeys: [key, ...apiKeys] });
  };

  const handleRotateKey = (keyId: string) => {
    setApiKeys((prev: ProviderApiKey[]) =>
      prev.map((k: ProviderApiKey) => (k.id === keyId ? { ...k, prefix: 'kly_live_' + Math.random().toString(36).slice(2, 6), lastUsed: 'Just now' } : k))
    );
  };

  const handleRevokeKey = (keyId: string) => {
    setApiKeys((prev: ProviderApiKey[]) => prev.map((k: ProviderApiKey) => (k.id === keyId ? { ...k, revoked: true } : k)));
  };

  const handleCreatePlan = (plan: PricingPlan) => {
    const updated = [...plans, plan];
    setPlans(updated);
    onUpdateProject({ plans: updated });
  };

  const handleChangeConsumerPlan = (consumerId: string, newPlan: string) => {
    setConsumers((prev: ApiConsumer[]) => prev.map((c: ApiConsumer) => (c.id === consumerId ? { ...c, plan: newPlan } : c)));
  };

  const handleOpenConsumerByName = (name: string) => {
    const found = consumers.find((c: ApiConsumer) => c.name.toLowerCase() === name.toLowerCase()) || consumers[0];
    if (found) setSelectedConsumer(found);
  };

  return (
    <div className="kly-workspace">
      {/* 1. Global Compact Project Command Bar */}
      <HeaderCommandBar
        project={project}
        projectsList={projectsList}
        onSelectProject={onSelectProject}
        selectedVersion={selectedVersion}
        onSelectVersion={setSelectedVersion}
        versions={versions}
        activeTab={tab}
        onSelectTab={setTab}
        onBackToDashboard={onBackToDashboard}
        onOpenPlayground={onOpenPlayground}
        onOpenDocs={() => {
          setTab('api');
          showToast('Navigated to interactive API Documentation & Schemas');
        }}
        onTriggerRedeploy={handleTriggerRedeploy}
        onPauseToggle={onPauseToggle}
        onOpenOpenApiImport={() => setIsOpenApiImportOpen(true)}
        onShowToast={showToast}
      />

      {/* 2. Main Tab View Container */}
      <main className="kly-main-container">
        {tab === 'overview' && (
          <TabOverview
            project={project}
            endpoints={endpoints}
            insights={insights}
            selectedVersion={selectedVersion}
            onSelectTab={setTab}
            onSelectEndpoint={setSelectedEndpoint}
            onOpenConsumer={handleOpenConsumerByName}
            onTriggerRedeploy={handleTriggerRedeploy}
            onOpenPlayground={onOpenPlayground}
            onOpenMigration={() => setIsMigrationOpen(true)}
            onShowToast={showToast}
          />
        )}

        {tab === 'api' && (
          <TabApi
            project={project}
            endpoints={endpoints}
            onSelectEndpoint={setSelectedEndpoint}
            onOpenPlayground={onOpenPlayground}
            onOpenImportModal={() => setIsOpenApiImportOpen(true)}
            onShowToast={showToast}
          />
        )}

        {tab === 'deployments' && (
          <TabDeployments
            project={project}
            deployments={deployments}
            onSelectDeployment={setSelectedDeployment}
            onTriggerRedeploy={handleTriggerRedeploy}
            onShowToast={showToast}
          />
        )}

        {tab === 'versions' && (
          <TabVersions
            project={project}
            versions={versions}
            selectedVersion={selectedVersion}
            onSelectVersion={setSelectedVersion}
            onOpenMigrationModal={() => setIsMigrationOpen(true)}
            onShowToast={showToast}
          />
        )}

        {tab === 'plans' && (
          <TabPlans
            plans={plans}
            onOpenCreatePlan={() => setIsCreatePlanOpen(true)}
            onShowToast={showToast}
          />
        )}

        {tab === 'consumers' && (
          <TabConsumers
            consumers={consumers}
            onSelectConsumer={setSelectedConsumer}
            onShowToast={showToast}
          />
        )}

        {tab === 'keys' && (
          <TabKeys
            apiKeys={apiKeys}
            onOpenCreateKey={() => setIsCreateKeyOpen(true)}
            onRotateKey={handleRotateKey}
            onRevokeKey={handleRevokeKey}
            onShowToast={showToast}
          />
        )}

        {tab === 'usage' && (
          <TabUsage
            project={project}
            endpoints={endpoints}
            onShowToast={showToast}
          />
        )}

        {tab === 'analytics' && (
          <TabAnalytics project={project} />
        )}

        {tab === 'logs' && (
          <TabLogs
            project={project}
            logs={logs}
            onSelectLog={setSelectedLog}
            onShowToast={showToast}
          />
        )}

        {tab === 'monitoring' && (
          <TabMonitoring
            project={project}
            incidents={incidents}
            alertRules={alertRules}
            onShowToast={showToast}
          />
        )}

        {tab === 'settings' && (
          <TabSettings
            project={project}
            onUpdateProject={onUpdateProject}
            onDeleteProject={onDeleteProject}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* 3. Global Drawers */}
      <EndpointDrawer
        endpoint={selectedEndpoint}
        onClose={() => setSelectedEndpoint(null)}
        onOpenPlayground={(ep) => {
          setSelectedEndpoint(null);
          onOpenPlayground();
        }}
        onViewLogs={(path) => {
          setSelectedEndpoint(null);
          setTab('logs');
        }}
        onShowToast={showToast}
      />

      <DeploymentDrawer
        deployment={selectedDeployment}
        onClose={() => setSelectedDeployment(null)}
        onRedeploy={(dep) => {
          setSelectedDeployment(null);
          handleTriggerRedeploy();
        }}
        onRollback={(dep) => {
          setSelectedDeployment(null);
          showToast(`Rolled back to deployment ${dep.id} (${dep.version})`);
        }}
        onShowToast={showToast}
      />

      <ConsumerDrawer
        consumer={selectedConsumer}
        keys={apiKeys}
        onClose={() => setSelectedConsumer(null)}
        onRotateKey={handleRotateKey}
        onRevokeKey={handleRevokeKey}
        onChangePlan={handleChangeConsumerPlan}
        onShowToast={showToast}
      />

      <RequestLogDrawer
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onShowToast={showToast}
      />

      {/* 4. Global Modals */}
      <CreateKeyModal
        consumers={consumers}
        isOpen={isCreateKeyOpen}
        onClose={() => setIsCreateKeyOpen(false)}
        onCreateKey={handleCreateKey}
        onShowToast={showToast}
      />

      <CreatePlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        onCreatePlan={handleCreatePlan}
        onShowToast={showToast}
      />

      <OpenApiImportModal
        isOpen={isOpenApiImportOpen}
        onClose={() => setIsOpenApiImportOpen(false)}
        onImportSuccess={(cnt) => {
          showToast(`Imported ${cnt} endpoints into specification`);
        }}
        onShowToast={showToast}
      />

      <VersionMigrationModal
        isOpen={isMigrationOpen}
        onClose={() => setIsMigrationOpen(false)}
        versions={versions}
        onExecuteMigration={(from, to) => {
          showToast(`Migration executed from ${from} to ${to}`);
        }}
        onShowToast={showToast}
      />

      {/* 5. Command Palette (Ctrl+K) */}
      <ProjectCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        project={project}
        endpoints={endpoints}
        onSelectTab={setTab}
        onSelectEndpoint={setSelectedEndpoint}
        onOpenPlayground={onOpenPlayground}
      />

      {/* 6. Toast System */}
      <div className="kly-toast-container">
        {toasts.map((t: { id: string; msg: string }) => (
          <div key={t.id} className="kly-toast">
            <span className="kly-pulse-dot" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
