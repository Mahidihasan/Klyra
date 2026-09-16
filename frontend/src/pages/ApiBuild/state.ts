import { useEffect, useState } from 'react';
import type { CreateProjectInput, DetectionResult, ProjectTab, ProviderProject, SourceConfig } from '../../types/apibuild';
import { apiBuildService } from '../../services/apiBuild';
import { DUMMY_PROJECT } from './dummyApi';

export type BuildView = 'dash' | 'new' | 'source' | 'detect' | 'configure' | 'deploy' | 'product' | 'pricing' | 'publish' | 'success' | 'workspace';

export function useApiBuild(onPlayground: () => void) {
  // The backend is the single source of truth — start empty and hydrate.
  const [projects, setProjects] = useState<ProviderProject[]>([]);
  const [view, setView] = useState<BuildView>('dash');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [draft, setDraft] = useState<CreateProjectInput>({ name: '', description: '', category: 'AI / Developer Tools' });
  const [source, setSource] = useState<SourceConfig>({ kind: 'existing', baseUrl: '', openApiUrl: '', upstreamAuth: 'Bearer Token', branch: 'main', dockerPort: 8080 });
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [manual, setManual] = useState(false);
  const [phase, setPhase] = useState(0);
  const active = projects.find((p) => p.id === activeId) || null;

  /** Re-fetches the project list from the backend. */
  const refresh = async (): Promise<ProviderProject[]> => {
    const remote = await apiBuildService.hydrate();
    const next = remote.length ? remote : [DUMMY_PROJECT];
    setProjects(next);
    return next;
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { projects, view, setView, activeId, setActiveId, tab, setTab, draft, setDraft, source, setSource, busy, setBusy, detecting, setDetecting, detection, setDetection, manual, setManual, phase, setPhase, active, refresh, onPlayground };
}
export type ApiBuildState = ReturnType<typeof useApiBuild>;