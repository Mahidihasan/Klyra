import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Container,
  FolderArchive,
  Github,
  Globe2,
  Loader2,
  ShieldCheck,
  Upload,
  Zap,
} from 'lucide-react';
import { ApiSourceKind, SourceConfig } from '../../types/apibuild';
import { Alert, Field } from './bits';
import { WizardChrome } from './Wizard1';
import { apiBuildService } from '../../services/apiBuild';
import './styles.css';

const STEPS = ['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish'];

export const StepSource: React.FC<{
  init: SourceConfig;
  busy: boolean;
  onNext: (v: SourceConfig) => void;
  onBack: () => void;
}> = ({ init, busy, onNext, onBack }) => {
  const [kind, setKind] = useState<ApiSourceKind>(init.kind);
  const [dockerMode, setDockerMode] = useState<'image' | 'folder'>(init.dockerSourceMode || 'image');
  const [value, setValue] = useState<SourceConfig>({
    ...init,
    dockerPort: init.dockerPort || 8080,
    readinessMode: init.readinessMode || 'auto',
    readinessPath: init.readinessPath || '',
    buildContext: init.buildContext || './',
    dockerfilePath: init.dockerfilePath || './Dockerfile',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(Boolean(init.dockerUploadId));
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadPct(0);
    setError('');
    try {
      const res = await apiBuildService.uploadProjectFolder(file, setUploadPct);
      setValue((prev) => ({
        ...prev,
        dockerSourceMode: 'folder',
        dockerUploadId: res.uploadId,
        dockerfilePath: res.dockerfilePath,
        buildContext: res.buildContext,
        dockerPort: res.detectedPort || prev.dockerPort || 8080,
        projectName: res.projectName,
      }));
      setUploadSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Ensure you select a valid ZIP containing a Dockerfile.');
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const continueSetup = () => {
    if (kind === 'existing' && !value.baseUrl?.trim()) {
      return setError('Enter the upstream API base URL.');
    }
    if (kind === 'github' && !value.repository?.trim()) {
      return setError('Choose a repository to deploy.');
    }
    if (kind === 'docker') {
      if (dockerMode === 'image' && !value.dockerImage?.trim()) {
        return setError('Enter a container image reference.');
      }
      if (dockerMode === 'folder' && !value.dockerUploadId) {
        return setError('Upload a project folder ZIP before continuing.');
      }
    }
    onNext({ ...value, kind, dockerSourceMode: dockerMode });
  };

  const choices: { id: ApiSourceKind; title: string; description: string; Icon: typeof Globe2 }[] = [
    {
      id: 'existing',
      title: 'Connect an existing API',
      description: 'Proxy any HTTPS origin: AWS, GCP, Azure, Render, Railway, Vercel, a VPS, or a private network.',
      Icon: Globe2,
    },
    {
      id: 'github',
      title: 'Deploy from GitHub',
      description: 'Build from a repository with branch-aware releases, environment settings, and repeatable delivery.',
      Icon: Github,
    },
    {
      id: 'docker',
      title: 'Deploy a container',
      description: 'Run an OCI image from any registry or upload a project folder to build and host automatically.',
      Icon: Container,
    },
  ];

  return (
    <WizardChrome step={1} total={8} labels={STEPS}>
      <div className="ab2-wiz-head">
        <div>
          <span className="ab2-eyebrow">
            <Zap size={11} /> Provider connection
          </span>
          <h2>How will you provide this API?</h2>
          <p>Every provider receives the same gateway, live discovery, observability, versioning, and marketplace controls.</p>
        </div>
      </div>

      <div className="ab2-source-grid">
        {choices.map(({ id, title, description, Icon }) => (
          <button
            key={id}
            className={`ab2-source ${kind === id ? 'active' : ''}`}
            onClick={() => {
              setKind(id);
              setError('');
            }}
          >
            <Icon size={20} color="#a78bfa" />
            <h4>{title}</h4>
            <p>{description}</p>
          </button>
        ))}
      </div>

      {kind === 'existing' && (
        <>
          <Field label="API base URL" hint="HTTPS is recommended. Klyra checks reachability before creating a gateway route.">
            <input
              value={value.baseUrl || ''}
              onChange={(e) => setValue({ ...value, baseUrl: e.target.value })}
              placeholder="https://api.example.com"
            />
          </Field>
          <Field label="OpenAPI or Swagger URL (optional)" hint="If omitted, Klyra checks common specification locations automatically.">
            <input
              value={value.openApiUrl || ''}
              onChange={(e) => setValue({ ...value, openApiUrl: e.target.value })}
              placeholder="https://api.example.com/openapi.json"
            />
          </Field>
          <Field label="Upstream authentication">
            <select
              value={value.upstreamAuth || 'Bearer Token'}
              onChange={(e) => setValue({ ...value, upstreamAuth: e.target.value })}
            >
              <option>Bearer Token</option>
              <option>API Key</option>
              <option>OAuth 2.0</option>
              <option>mTLS</option>
              <option>None</option>
            </select>
          </Field>
        </>
      )}

      {kind === 'github' && (
        <>
          <Field label="GitHub repository">
            <input
              value={value.repository || ''}
              onChange={(e) => setValue({ ...value, repository: e.target.value })}
              placeholder="organization/service-api"
            />
          </Field>
          <Field label="Deployment branch">
            <input
              value={value.branch || 'main'}
              onChange={(e) => setValue({ ...value, branch: e.target.value })}
              placeholder="main"
            />
          </Field>
          <Alert kind="info">
            <ShieldCheck size={13} /> Klyra will inspect runtime files, build settings, and available API specifications once the repository is connected.
          </Alert>
        </>
      )}

      {kind === 'docker' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <button
              type="button"
              className={`ab2-tab-btn ${dockerMode === 'image' ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: dockerMode === 'image' ? '1px solid #8b5cf6' : '1px solid var(--border)',
                background: dockerMode === 'image' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                color: dockerMode === 'image' ? '#c4b5fd' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 500,
                fontSize: 13,
              }}
              onClick={() => {
                setDockerMode('image');
                setError('');
              }}
            >
              <Container size={16} /> OCI Image
            </button>
            <button
              type="button"
              className={`ab2-tab-btn ${dockerMode === 'folder' ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: dockerMode === 'folder' ? '1px solid #8b5cf6' : '1px solid var(--border)',
                background: dockerMode === 'folder' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                color: dockerMode === 'folder' ? '#c4b5fd' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 500,
                fontSize: 13,
              }}
              onClick={() => {
                setDockerMode('folder');
                setError('');
              }}
            >
              <FolderArchive size={16} /> Project Folder (ZIP)
            </button>
          </div>

          {dockerMode === 'image' && (
            <Field label="Container image" hint="Reference from Docker Hub, GHCR, ECR, GCR, or a registry.">
              <input
                value={value.dockerImage || ''}
                onChange={(e) => setValue({ ...value, dockerImage: e.target.value })}
                placeholder="ghcr.io/organization/service-api:latest"
              />
            </Field>
          )}

          {dockerMode === 'folder' && (
            <div style={{ marginBottom: 16 }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".zip,application/zip"
                onChange={handleFileUpload}
              />
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 10,
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Loader2 size={24} className="ab2-spin" color="#8b5cf6" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {uploadPct < 100 ? `Uploading archive… ${uploadPct}%` : 'Extracting & inspecting Dockerfile…'}
                    </span>
                    <div style={{ width: '80%', maxWidth: 320, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(3, uploadPct)}%`, height: '100%', background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)', borderRadius: 6, transition: 'width .25s ease' }} />
                    </div>
                  </div>
                ) : uploadSuccess ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={28} color="#10b981" />
                    <b style={{ fontSize: 14 }}>Project archive uploaded successfully</b>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {value.projectName || 'Project'} · Click to upload a different archive
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Upload size={24} color="#8b5cf6" />
                    <b style={{ fontSize: 14 }}>Upload Project Folder (ZIP)</b>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Select a .zip archive containing your Dockerfile and source files
                    </span>
                  </div>
                )}
              </div>

              {uploadSuccess && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <CheckCircle2 size={13} color="#10b981" /> <b>Detected Docker project</b>
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Dockerfile: <code>{value.dockerfilePath}</code> · Build context: <code>{value.buildContext}</code>
                  </div>
                </div>
              )}

              <div className="ab2-grid2" style={{ marginTop: 14 }}>
                <Field label="Dockerfile path" hint="Path relative to uploaded context.">
                  <input
                    value={value.dockerfilePath || './Dockerfile'}
                    onChange={(e) => setValue({ ...value, dockerfilePath: e.target.value })}
                  />
                </Field>
                <Field label="Build context" hint="Directory containing build context.">
                  <input
                    value={value.buildContext || './'}
                    onChange={(e) => setValue({ ...value, buildContext: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="ab2-grid2">
            <Field label="Container internal port" hint="Target port inside container.">
              <input
                type="number"
                value={value.dockerPort || 8080}
                onChange={(e) => setValue({ ...value, dockerPort: Number(e.target.value) })}
              />
            </Field>
            <Field label="OpenAPI URL (optional)" hint="Path or URL to OpenAPI specification.">
              <input
                value={value.openApiUrl || ''}
                onChange={(e) => setValue({ ...value, openApiUrl: e.target.value })}
                placeholder="/openapi.json or https://..."
              />
            </Field>
          </div>

          <div className="ab2-grid2" style={{ marginTop: 8 }}>
            <Field label="Readiness check mode" hint="How to verify container is healthy.">
              <select
                value={value.readinessMode || 'auto'}
                onChange={(e) =>
                  setValue({ ...value, readinessMode: e.target.value as 'auto' | 'http' | 'tcp' })
                }
              >
                <option value="auto">Automatic (Path Discovery)</option>
                <option value="http">HTTP Endpoint</option>
                <option value="tcp">TCP Socket Reachability</option>
              </select>
            </Field>
            {value.readinessMode === 'http' && (
              <Field label="Health check HTTP path" hint="e.g. /health or /api/ping">
                <input
                  value={value.readinessPath || '/health'}
                  onChange={(e) => setValue({ ...value, readinessPath: e.target.value })}
                  placeholder="/health"
                />
              </Field>
            )}
          </div>
        </>
      )}

      {error && <Alert kind="err">{error}</Alert>}

      <footer className="ab2-foot">
        <button className="ab2-ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="ab2-primary" onClick={continueSetup} disabled={busy || uploading}>
          {busy || uploading ? (
            <>
              <Loader2 size={14} className="ab2-spin" /> Processing…
            </>
          ) : (
            <>
              Continue to discovery <ArrowRight size={14} />
            </>
          )}
        </button>
      </footer>
    </WizardChrome>
  );
};
