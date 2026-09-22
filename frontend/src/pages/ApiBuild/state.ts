import { useEffect, useState } from 'react';
import type { CreateProjectInput, DetectionResult, ProjectTab, ProviderProject, SourceConfig } from '../../types/apibuild';
import { apiBuildService } from '../../services/apiBuild';

export type BuildView = 'dash' | 'new' | 'source' | 'detect' | 'configure' | 'deploy' | 'product' | 'pricing' | 'publish' | 'success' | 'workspace';

/**
 * Live view of the durable deploy operation backing the wizard's Deploy step.
 * `progress` and `logs` come straight from the backend operation row, so the
 * step can show a real percentage and the real pipeline output.
 */
export interface DeployOperationView {
  id: string;
  state: string;
  progress: number;
  logs: string[];
  error: string | null;
}

export function useApiBuild(onPlayground: () => void, initialView?: BuildView) {
  // The backend is the single source of truth — start empty and hydrate.
  const [projects, setProjects] = useState<ProviderProject[]>([]);
  const [view, setView] = useState<BuildView>(initialView || 'dash');

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [draft, setDraft] = useState<CreateProjectInput>({ name: '', description: '', category: 'AI / Developer Tools' });
  const [source, setSource] = useState<SourceConfig>({ kind: 'existing', baseUrl: '', openApiUrl: '', upstreamAuth: 'Bearer Token', branch: 'main', dockerPort: 8080 });
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [manual, setManual] = useState(false);
  const [phase, setPhase] = useState(0);
  /** Percentage shown while the Detect step is working (0–100). */
  const [detectProgress, setDetectProgress] = useState(0);
  /** Live deploy operation: real progress, real logs, real failure state. */
  const [deployOp, setDeployOp] = useState<DeployOperationView | null>(null);
  /** Bumped by the Deploy step's Retry action to start a fresh attempt. */
  const [deployAttempt, setDeployAttempt] = useState(0);
  const active = projects.find((p) => p.id === activeId) || null;

  /** Re-fetches the project list from the backend. */
  const refresh = async (): Promise<ProviderProject[]> => {
    const remote = await apiBuildService.hydrate();
    setProjects(remote);
    return remote;
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { projects, view, setView, activeId, setActiveId, tab, setTab, draft, setDraft, source, setSource, busy, setBusy, detecting, setDetecting, detection, setDetection, manual, setManual, phase, setPhase, detectProgress, setDetectProgress, deployOp, setDeployOp, deployAttempt, setDeployAttempt, active, refresh, onPlayground };
}
export type ApiBuildState = ReturnType<typeof useApiBuild>;