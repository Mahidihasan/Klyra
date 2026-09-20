import React, { useState, useMemo, useEffect } from 'react';
import { ProviderProject, ProjectTab, PricingPlan, ProviderApiKey, ApiConsumer } from '../../types/apibuild';
import { DetailedEndpoint, ExtendedVersion, DeploymentRecord, ExtendedLogEntry, KlyraInsightItem, MonitoringIncident, AlertRule } from './types';

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
import { DUMMY_PROJECT_ID, getDummyDeployments, getDummyEndpoints, getDummyIncidents, getDummyInsights, getDummyLogs, getDummyAlertRules, getDummyVersions } from './dummyApi';

import { TabOverview } from './tabs/TabOverview';
import { TabApi } from './tabs/TabApi';
import { TabDeployments } from './tabs/TabDeployments';
import { TabVersions } from './tabs/TabVersions';
import { TabDevelopment } from './tabs/TabDevelopment';
import { TabAudit } from './tabs/TabAudit';
import { useOperations } from './hooks/useOperations';
import { OperationRecord } from '../../types/operations';
import { OperationDrawer } from './components/OperationDrawer';
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
  /** Optional endpoint lets "Test in Playground" preselect a specific route. */
  onOpenPlayground: (ep?: DetailedEndpoint) => void;
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
  const isDummyProject = project.id === DUMMY_PROJECT_ID;
  const [endpoints, setEndpoints] = useState<DetailedEndpoint[]>(() => isDummyProject ? getDummyEndpoints() : []);
  const [versions, setVersions] = useState<ExtendedVersion[]>(() => isDummyProject ? getDummyVersions() : project.versions.map((version) => ({
    id: version.id,
    semver: version.semver,
    status: version.status === 'deprecated' ? 'Deprecated' : version.status === 'published' ? 'Current' : 'Beta',
    isDefault: version.semver === project.version,
    releasedAt: version.createdAt,
    endpointsCount: version.endpoints,
    consumersCount: project.consumers,
    trafficPercentage: version.semver === project.version ? 100 : 0,
    successRate: project.successRate,
    avgLatencyMs: project.latencyMs,
    runtimeState: version.semver === project.version ? 'running' : 'stopped',
    canaryWeight: version.semver === project.version ? 100 : 0,
    changelog: { added: [], modified: [], deprecated: [], breaking: [] },
  })));
  const [deployments, setDeployments] = useState<DeploymentRecord[]>(() => isDummyProject ? getDummyDeployments() : []);
  const [logs, setLogs] = useState<ExtendedLogEntry[]>(() => isDummyProject ? getDummyLogs() : []);
  const [insights, setInsights] = useState<KlyraInsightItem[]>(() => isDummyProject ? getDummyInsights() : []);
  const [incidents, setIncidents] = useState<MonitoringIncident[]>(() => isDummyProject ? getDummyIncidents() : []);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => isDummyProject ? getDummyAlertRules() : []);

  // Mutable collections initialized from project
  const [plans, setPlans] = useState<PricingPlan[]>(project.plans || []);
  const [consumers, setConsumers] = useState<ApiConsumer[]>(project.consumersList || []);
  const [apiKeys, setApiKeys] = useState<ProviderApiKey[]>(project.apiKeys || []);

  useEffect(() => {
    let mounted = true;
    const loadWorkspaceData = async () => {
      if (isDummyProject) return;
      const [remoteEndpoints, remoteVersions, remoteDeployments, remoteLogs, remoteInsights, remoteIncidents, remoteAlerts] = await Promise.all([
        apiBuildService.listEndpoints<DetailedEndpoint>(project.id).catch(() => []),
        apiBuildService.listVersions<ExtendedVersion>(project.id).catch(() => []),
        apiBuildService.listDeployments<DeploymentRecord>(project.id).catch(() => []),
        apiBuildService.listLogs<ExtendedLogEntry>(project.id, { limit: 200 }).catch(() => []),
        apiBuildService.getInsights<KlyraInsightItem>(project.id).catch(() => []),
        apiBuildService.listIncidents<MonitoringIncident>(project.id).catch(() => []),
        apiBuildService.listAlertRules<AlertRule>(project.id).catch(() => []),
      ]);
      if (!mounted) return;
      setEndpoints(remoteEndpoints);
      if (remoteVersions.length) setVersions(remoteVersions);
      setDeployments(remoteDeployments);
      setLogs(remoteLogs);
      setInsights(remoteInsights);
      setIncidents(remoteIncidents);
      setAlertRules(remoteAlerts);
    };
    void loadWorkspaceData();
    return () => { mounted = false; };
  }, [isDummyProject, project.id]);

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

  // Operations — durable async execution surface (backend rows, polled here).
  // Always attached (hooks cannot be conditional); failed calls simply keep the
  // list empty so the dummy/offline experience stays graceful.
  const ops = useOperations(project.id, { limit: 10 });
  const [selectedOperation, setSelectedOperation] = useState<OperationRecord | null>(null);

  // Environment context — UI-scoped selector (persisted per project). The
  // backend still stores a single environment on the project row; per-environment
  // config overlays are a Phase 2 concern. This selector drives which environment
  // chips/views the UI shows until the env-scoped config API lands.
  const [environment, setEnvironmentState] = useState<string>(() => {
    try { return localStorage.getItem(`kly_env_${project.id}`) || project.environment || 'development'; }
    catch { return project.environment || 'development'; }
  });
  useEffect(() => {
    try { setEnvironmentState(localStorage.getItem(`kly_env_${project.id}`) || project.environment || 'development'); }
    catch { setEnvironmentState(project.environment || 'development'); }
  }, [project.id]);
  const setEnvironment = (env: string) => {
    setEnvironmentState(env);
    try { localStorage.setItem(`kly_env_${project.id}`, env); } catch { /* storage unavailable */ }
    showToast(`Environment context: ${env}`);
  };

  // Actions
  const handleTriggerRedeploy = (strategy = 'rolling') => {
    const version = selectedVersion === 'all' ? project.version : selectedVersion;
    void ops.start({
      type: 'deploy',
      environment: project.environment,
      payload: { version, strategy },
      reason: `Manual redeploy (${strategy}) from project controls`,
    }).then((op) => {
      if (op) {
        setSelectedOperation(op);
        showToast(`Deployment operation ${op.id} queued (${strategy})`);
      } else {
        showToast(!ops.error ? 'Deployment queue unavailable — check backend connectivity.' : ops.error);
      }
    });
  };

  // Rollback to an explicit version from the overview deployment card.
  const handleRollbackVersion = (targetVersion: string) => {
    void ops.start({
      type: 'rollback',
      environment: project.environment,
      payload: { targetVersion },
      reason: `Manual rollback to ${targetVersion}`,
    }).then((op) => {
      if (op) {
        setSelectedOperation(op);
        showToast(`Rollback operation ${op.id} queued → ${targetVersion}`);
      } else {
        showToast(!ops.error ? 'Deployment queue unavailable — check backend connectivity.' : ops.error);
      }
    });
  };

  const handleRollbackDeployment = (dep: DeploymentRecord) => {
    void ops.start({
      type: 'rollback',
      environment: dep.environment,
      payload: { targetVersion: dep.version },
      reason: `Manual rollback to ${dep.version}`,
    }).then((op) => {
      if (op) {
        setSelectedDeployment(null);
        setSelectedOperation(op);
        showToast(`Rollback operation ${op.id} queued to ${dep.version}`);
      } else {
        showToast('Rollback requires backend connectivity.');
      }
    });
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

  const handleUpdateEndpoint = (endpointId: string, patch: Partial<DetailedEndpoint>) => {
    setEndpoints((current) => current.map((endpoint) => endpoint.id === endpointId ? { ...endpoint, ...patch } : endpoint));
    if (!isDummyProject) {
      void apiBuildService.updateEndpoint(project.id, endpointId, patch as Record<string, unknown>).catch(() => showToast('Route policy saved locally; backend sync will retry.'));
    }
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
        environment={environment}
        onSelectEnvironment={setEnvironment}
        onOpenOperations={() => {
          if (ops.operations.length > 0) setSelectedOperation(ops.operations[0]);
          else showToast('No operations recorded yet for this project.');
        }}
        onOpenAudit={() => setTab('audit')}
        operationsCount={ops.operations.filter((o) => o.state === 'running' || o.state === 'queued' || o.state === 'validating').length}
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
            activeOperation={ops.operations.find((o) => ['deploy', 'rollback'].includes(o.type) && ['queued', 'validating', 'running'].includes(o.state)) ?? null}
            versions={versions}
            onRollback={handleRollbackVersion}
            onOpenOperation={setSelectedOperation}
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
            onUpdateEndpoint={handleUpdateEndpoint}
            onUpdateProject={onUpdateProject}
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

        {tab === 'audit' && (
          <TabAudit
            project={project}
            onUpdateProject={onUpdateProject}
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
        gatewayUrl={project.gatewayUrl}
        onClose={() => setSelectedEndpoint(null)}
        onUpdateEndpoint={handleUpdateEndpoint}
        onOpenPlayground={(ep) => {
          setSelectedEndpoint(null);
          onOpenPlayground(ep);
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
          handleRollbackDeployment(dep);
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
        onDeploy={handleTriggerRedeploy}
        onOpenOperations={() => {
          if (ops.operations.length > 0) setSelectedOperation(ops.operations[0]);
          else showToast('No operations recorded yet for this project.');
        }}
        onOpenAudit={() => setTab('audit')}
      />

      {/* 5b. Operations Monitor — real progress for every durable operation */}
      <OperationDrawer
        operation={selectedOperation}
        onClose={() => setSelectedOperation(null)}
        onCancel={async (op) => { await ops.cancel(op.id); }}
        onRetry={async (op) => { await ops.retry(op.id); }}
        onShowToast={showToast}
        onOpenAudit={() => setTab('audit')}
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
