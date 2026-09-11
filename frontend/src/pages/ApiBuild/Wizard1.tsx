import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Globe2, Plus, Sparkles, Tags, X } from 'lucide-react';
import { CreateProjectInput } from '../../types/apibuild';
import { Alert, Field } from './bits';
import { apiBuildService } from '../../services/apiBuild';
import './styles.css';

const STEPS = ['Project', 'Source', 'Detect', 'Configure', 'Deploy', 'Product', 'Pricing', 'Publish'];

export const WizardChrome: React.FC<{ step: number; total: number; labels: string[]; children: React.ReactNode }> = ({ step, total, labels, children }) => (
  <div className="ab2-page"><div className="ab2-shell" style={{ maxWidth: 900 }}>
    <nav className="ab2-steps" aria-label="Project setup progress">{labels.map((label, index) => (
      <React.Fragment key={label}>
        <span className={`ab2-step ${index < step ? 'done' : index === step ? 'now' : ''}`}><i>{index < step ? <Check size={11} /> : index + 1}</i>{label}</span>
        {index < labels.length - 1 && <span className="ab2-step-line" />}
      </React.Fragment>
    ))}</nav>
    <section className="ab2-card ab2-wiz-card">{children}</section>
    <p className="ab2-wizard-progress">Step {step + 1} of {total} · Your draft is saved to this workspace as you go.</p>
  </div></div>
);

export const StepNewProject: React.FC<{ init: CreateProjectInput; onNext: (v: CreateProjectInput) => void; onBack: () => void }> = ({ init, onNext, onBack }) => {
  const [value, setValue] = useState<CreateProjectInput>(init);
  const [categories, setCategories] = useState(() => apiBuildService.getCategories());
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { void apiBuildService.hydrateCategories().then((items) => items && setCategories(items)); }, []);
  const update = (patch: Partial<CreateProjectInput>) => { setError(''); setValue((previous) => ({ ...previous, ...patch })); };
  const addCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    await apiBuildService.addCategory(name);
    setCategories((items) => items.some((item) => item.toLowerCase() === name.toLowerCase()) ? items : [...items, name]);
    update({ category: name }); setCategoryName(''); setIsAddingCategory(false);
    setNotice(`“${name}” is now available for this project and marketplace listings.`);
  };
  const submit = () => {
    if (!value.name.trim()) return setError('Enter a clear API name before continuing.');
    if (!value.category.trim()) return setError('Select or create a marketplace category.');
    onNext({ ...value, name: value.name.trim(), description: value.description.trim(), category: value.category.trim() });
  };
  const slug = value.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'your-api';

  return <WizardChrome step={0} total={8} labels={STEPS}>
    <div className="ab2-wiz-head"><div><span className="ab2-eyebrow"><Sparkles size={11} /> Project identity</span><h2>Create a new API project</h2><p>Set the public identity for your API. These details appear in your workspace, generated docs, and marketplace listing.</p></div></div>
    <div className="ab2-project-form-grid">
      <div>
        <Field label="API name" hint="Use a concise, recognizable name for consumers."><input autoFocus value={value.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Inventory Intelligence API" /></Field>
        <Field label="Description" hint="Explain the value and the primary use case."><textarea rows={4} value={value.description} onChange={(e) => update({ description: e.target.value })} placeholder="Provide a short, consumer-facing description of this API." /></Field>
        <Field label="Marketplace category" hint="Categories help buyers discover your API."><div className="ab2-category-picker">
          {categories.map((category) => <button type="button" key={category} className={`ab2-category-option ${value.category === category ? 'active' : ''}`} onClick={() => update({ category })}><Tags size={12} />{category}</button>)}
          <button type="button" className="ab2-category-option ab2-add-category" onClick={() => setIsAddingCategory(true)}><Plus size={13} /> Add category</button>
        </div></Field>
        {isAddingCategory && <div className="ab2-inline-create"><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addCategory()} placeholder="e.g. Logistics" /><button type="button" className="ab2-primary" onClick={() => void addCategory()}>Add</button><button type="button" className="ab2-icon-btn" aria-label="Cancel adding category" onClick={() => setIsAddingCategory(false)}><X size={14} /></button></div>}
        {notice && <Alert kind="ok">{notice}</Alert>}{error && <Alert kind="err">{error}</Alert>}
      </div>
      <aside className="ab2-project-preview"><span className="ab2-preview-label">Marketplace preview</span><div className="ab2-preview-mark" aria-hidden="true">{value.name ? value.name.charAt(0).toUpperCase() : <Globe2 size={21} />}</div><h3>{value.name || 'Your API name'}</h3><p>{value.description || 'A clear description will help consumers understand what this API does.'}</p><div><span className="ab2-pill">{value.category || 'Choose a category'}</span><span className="ab2-pill ab2-mono">v1.0.0</span></div><div className="ab2-preview-url"><span>Gateway URL</span><code>api.klyra.com/{slug}</code></div></aside>
    </div>
    <footer className="ab2-foot"><button className="ab2-ghost" onClick={onBack}><ArrowLeft size={14} /> Projects</button><button className="ab2-primary" onClick={submit}>Continue to source <ArrowRight size={14} /></button></footer>
  </WizardChrome>;
};
