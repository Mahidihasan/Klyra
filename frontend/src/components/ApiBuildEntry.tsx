import React, { useRef, useState } from 'react';
import {
  Bot, Braces, CheckCircle2, ChevronLeft, FileCode2, FileUp, Globe2,
  Layers3, Plus, Sparkles, Upload, Wand2
} from 'lucide-react';
import { ApiProject, ApiProjectCreationMethod } from '../types/api';
import './ApiBuildEntry.css';

interface Props {
  onBack: () => void;
  onOpenProject: (project: ApiProject) => void;
}

type Path = 'import' | 'build';
type ImportMode = 'file' | 'url' | 'paste';
type BuildMode = 'blank' | 'template' | 'ai';

const starterDefinition = (name: string) => JSON.stringify({
  openapi: '3.0.3', info: { title: name, version: '1.0.0', description: '' },
  servers: [{ url: 'https://api.example.com/v1' }], paths: {}, components: { schemas: {}, securitySchemes: {} }
}, null, 2);

const nameFromDefinition = (value: string, fallback: string) => {
  try { return JSON.parse(value)?.info?.title || fallback; } catch {
    return value.match(/^\s*title:\s*['\"]?([^'\"\n]+)/mi)?.[1]?.trim() || fallback;
  }
};

export const ApiBuildEntry: React.FC<Props> = ({ onBack, onOpenProject }) => {
  const [path, setPath] = useState<Path>('import');
  const [importMode, setImportMode] = useState<ImportMode>('file');
  const [buildMode, setBuildMode] = useState<BuildMode>('blank');
  const [source, setSource] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('REST API');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const create = (method: ApiProjectCreationMethod, definition: string, fallbackName: string) => {
    const name = projectName.trim() || nameFromDefinition(definition, fallbackName);
    const project: ApiProject = {
      id: `api-project-${Date.now()}`,
      name,
      description: description.trim() || `A ${method === 'import' ? 'imported' : 'new'} API Project.`,
      creationMethod: method,
      lifecycle: 'draft',
      activeVersionId: 'draft-v1',
      versions: [{ id: 'draft-v1', semver: 'v1.0.0', notes: 'Initial draft', status: 'draft', immutable: false, definition }],
      createdAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem('klyra-api-projects') || '[]');
    localStorage.setItem('klyra-api-projects', JSON.stringify([project, ...existing]));
    localStorage.setItem('klyra-active-api-project', project.id);
    onOpenProject(project);
  };

  const handleImport = () => {
    setError('');
    if (!source.trim()) { setError('Choose a specification file, paste a definition, or add an API URL.'); return; }
    if (importMode === 'paste' && !/openapi:|swagger:|"openapi"|"swagger"/i.test(source)) {
      setError('Add a valid OpenAPI or Swagger JSON/YAML definition.'); return;
    }
    create('import', source, 'Imported API');
  };

  const handleBuild = () => {
    const name = projectName.trim() || (buildMode === 'template' ? `${template} API` : buildMode === 'ai' ? 'AI generated API' : 'Untitled API');
    const definition = buildMode === 'ai'
      ? JSON.stringify({ openapi: '3.0.3', info: { title: name, version: '1.0.0', description: source || 'Generated API' }, servers: [{ url: 'https://api.example.com/v1' }], paths: { '/health': { get: { summary: 'Health check', responses: { '200': { description: 'Service is healthy' } } } } }, components: { schemas: {}, securitySchemes: {} } }, null, 2)
      : starterDefinition(name);
    create(buildMode, definition, name);
  };

  return <div className="api-build-page animate-fade-in">
    <div className="api-build-shell">
      <button className="api-build-back" onClick={onBack}><ChevronLeft size={17} /> Back to dashboard</button>
      <div className="api-build-heading">
        <span className="api-build-eyebrow"><Sparkles size={14} /> API PROJECTS</span>
        <h1>Bring an API to life</h1>
        <p>Import what you already have or build from an idea. Either way, you get one editable API Project.</p>
      </div>

      <div className="api-build-choices" role="tablist">
        <button className={path === 'import' ? 'active' : ''} onClick={() => setPath('import')}><Upload size={20} /><span>IMPORT API</span><small>OpenAPI, Swagger & existing definitions</small></button>
        <button className={path === 'build' ? 'active' : ''} onClick={() => setPath('build')}><Wand2 size={20} /><span>BUILD API</span><small>Blank, template, or AI-assisted</small></button>
      </div>

      <section className="api-build-card">
        {path === 'import' ? <>
          <div className="api-build-card-head"><div><h2>Import an existing API</h2><p>Your original specification is retained in a new editable API Project.</p></div><FileCode2 size={26} /></div>
          <div className="api-build-tabs">
            <button className={importMode === 'file' ? 'active' : ''} onClick={() => setImportMode('file')}><FileUp size={15}/> Definition file</button>
            <button className={importMode === 'url' ? 'active' : ''} onClick={() => setImportMode('url')}><Globe2 size={15}/> API URL</button>
            <button className={importMode === 'paste' ? 'active' : ''} onClick={() => setImportMode('paste')}><Braces size={15}/> Paste spec</button>
          </div>
          {importMode === 'file' && <div className="api-upload-zone" onClick={() => inputRef.current?.click()}><Upload size={25}/><strong>Upload OpenAPI or Swagger</strong><span>JSON, YAML, or a saved API definition</span><button type="button">Choose file</button><input ref={inputRef} type="file" accept=".json,.yaml,.yml" hidden onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setSource(String(reader.result || '')); setProjectName(current => current || file.name.replace(/\.(json|ya?ml)$/i, '')); }; reader.readAsText(file); }} /></div>}
          {importMode === 'url' && <label className="api-build-field"><span>OpenAPI definition or API URL</span><input value={source} onChange={event => setSource(event.target.value)} placeholder="https://api.example.com/openapi.json" /></label>}
          {importMode === 'paste' && <label className="api-build-field"><span>OpenAPI / Swagger JSON or YAML</span><textarea value={source} onChange={event => setSource(event.target.value)} placeholder={'openapi: 3.0.3\ninfo:\n  title: My API'} /></label>}
        </> : <>
          <div className="api-build-card-head"><div><h2>Build a new API</h2><p>Start small, then define every route, schema, test, and deployment in the builder.</p></div><Layers3 size={26} /></div>
          <div className="api-build-tabs">
            <button className={buildMode === 'blank' ? 'active' : ''} onClick={() => setBuildMode('blank')}><Plus size={15}/> Blank API</button>
            <button className={buildMode === 'template' ? 'active' : ''} onClick={() => setBuildMode('template')}><Layers3 size={15}/> Template</button>
            <button className={buildMode === 'ai' ? 'active' : ''} onClick={() => setBuildMode('ai')}><Bot size={15}/> Describe with AI</button>
          </div>
          {buildMode === 'template' && <label className="api-build-field"><span>Starting template</span><select value={template} onChange={event => setTemplate(event.target.value)}><option>REST API</option><option>Webhook API</option><option>CRUD API</option><option>Authentication API</option></select></label>}
          {buildMode === 'ai' && <label className="api-build-field"><span>Describe the API you want to build</span><textarea value={source} onChange={event => setSource(event.target.value)} placeholder="A weather API with current conditions and a five-day forecast..." /></label>}
          {buildMode === 'blank' && <div className="api-build-blank"><Braces size={25}/><div><strong>Start with a clean OpenAPI definition</strong><span>Routes, schemas, servers, authentication and tests can all be added in the builder.</span></div></div>}
        </>}
        <div className="api-build-details"><label className="api-build-field"><span>Project name <em>optional</em></span><input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="My Weather API" /></label><label className="api-build-field"><span>Description <em>optional</em></span><input value={description} onChange={event => setDescription(event.target.value)} placeholder="What does this API do?" /></label></div>
        {error && <p className="api-build-error">{error}</p>}
        <div className="api-build-footer"><span><CheckCircle2 size={15}/> Creates a Draft API Project — nothing is published yet</span><button onClick={path === 'import' ? handleImport : handleBuild}>{path === 'import' ? 'Import into Builder' : buildMode === 'ai' ? 'Generate API Project' : 'Create API Project'}</button></div>
      </section>
      <div className="api-build-lifecycle"><span>Draft</span><i/> <span>Build</span><i/> <span>Test</span><i/> <span>Version</span><i/> <span>Publish</span><p>Published versions are immutable. Continue work in a new draft whenever you are ready.</p></div>
    </div>
  </div>;
};
