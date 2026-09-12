import { useEffect, useState } from 'react';
import type { CreateProjectInput, DetectionResult, ProjectTab, ProviderProject, SourceConfig } from '../../types/apibuild';
import { apiBuildService } from '../../services/apiBuild';

export type BuildView = 'dash' | 'new' | 'source' | 'detect' | 'configure' | 'deploy' | 'product' | 'pricing' | 'publish' | 'success' | 'workspace';

export function useApiBuild(onPlayground: () => void) {
  const [projects, setProjects] = useState<ProviderProject[]>(() => apiBuildService.list());
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
  const refresh = () => setProjects(apiBuildService.list());
  useEffect(() => {
    let mounted = true;
    void apiBuildService.hydrate().then((remote) => { if (mounted && remote) setProjects(remote); });
    return () => { mounted = false; };
  }, []);
  return { projects, view, setView, activeId, setActiveId, tab, setTab, draft, setDraft, source, setSource, busy, setBusy, detecting, setDetecting, detection, setDetection, manual, setManual, phase, setPhase, active, refresh, onPlayground };
}
export type ApiBuildState = ReturnType<typeof useApiBuild>;
