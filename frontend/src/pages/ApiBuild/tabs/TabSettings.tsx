import React, { useState } from 'react';
import { Settings, ShieldAlert, Trash2, Save, Users, UserPlus, Plus, X, ServerCog, ClipboardList, ShieldCheck, BellRing, GitCompare, LockKeyhole, Network } from 'lucide-react';
import { ProviderProject } from '../../../types/apibuild';

type SettingsView = 'general' | 'team' | 'environments' | 'security' | 'lifecycle' | 'notifications' | 'audit';
type TeamRole = 'Owner' | 'Editor' | 'Viewer';
interface TeamMember { id: string; name: string; email: string; role: TeamRole; status: 'Active' | 'Invited'; }
interface EnvironmentVariable { key: string; value: string; secret: boolean; }
interface AuditEntry { id: string; action: string; actor: string; at: string; detail: string; }

interface TabSettingsProps {
  project: ProviderProject;
  onUpdateProject: (patch: Partial<ProviderProject>) => void;
  onDeleteProject: () => void;
  onShowToast: (msg: string) => void;
}

export const TabSettings: React.FC<TabSettingsProps> = ({
  project,
  onUpdateProject,
  onDeleteProject,
  onShowToast
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [category, setCategory] = useState(project.category);
  const [baseUrl, setBaseUrl] = useState(project.baseUrl || 'https://api.kickonass.com');
  const [rateLimit, setRateLimit] = useState(project.rateLimitPerMin || 100);
  const [visibility, setVisibility] = useState(project.visibility || 'public');
  const [customDomain, setCustomDomain] = useState('api.kickonass.com');
  const [settingsView, setSettingsView] = useState<SettingsView>('general');
  const [wafEnabled, setWafEnabled] = useState(true);
  const [requireMfa, setRequireMfa] = useState(true);
  const [strictTransport, setStrictTransport] = useState(true);
  const [allowedMethods, setAllowedMethods] = useState('GET, POST, PUT, PATCH, DELETE');
  const [ipAllowlist, setIpAllowlist] = useState(project.ipAllowlist || '10.0.0.0/8');
  const [canaryPercent, setCanaryPercent] = useState(10);
  const [autoRollback, setAutoRollback] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [sunsetWindow, setSunsetWindow] = useState(30);
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.example.com/klyra');
  const [team, setTeam] = useState<TeamMember[]>([
    { id: 'tm-1', name: 'Mahidi Hasan', email: 'mahidi@klyra.dev', role: 'Owner', status: 'Active' },
    { id: 'tm-2', name: 'Priya Nair', email: 'priya@klyra.dev', role: 'Editor', status: 'Active' },
    { id: 'tm-3', name: 'Noah Williams', email: 'noah@klyra.dev', role: 'Viewer', status: 'Invited' },
  ]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('Viewer');
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('staging');
  const [variables, setVariables] = useState<Record<string, EnvironmentVariable[]>>({
    development: [{ key: 'base_url', value: 'http://localhost:8080', secret: false }, { key: 'api_key', value: 'dev_••••••••', secret: true }],
    staging: [{ key: 'base_url', value: 'https://staging-api.example.com', secret: false }, { key: 'api_key', value: 'stg_••••••••', secret: true }],
    production: [{ key: 'base_url', value: 'https://api.example.com', secret: false }, { key: 'api_key', value: 'live_••••••••', secret: true }],
  });
  const [audit, setAudit] = useState<AuditEntry[]>(project.activity.slice(0, 8).map((entry) => ({
    id: entry.id, action: entry.label, actor: 'Mahidi Hasan', at: entry.at, detail: entry.kind,
  })));

  const handleSave = () => {
    onUpdateProject({
      name,
      description,
      category,
      baseUrl,
      rateLimitPerMin: Number(rateLimit),
      visibility: visibility as any
    });
    setAudit((entries) => [{ id: `audit-${Date.now()}`, action: 'Updated project configuration', actor: 'Mahidi Hasan', at: new Date().toISOString(), detail: 'General settings and gateway policy', }, ...entries]);
    onShowToast('Project configuration saved successfully');
  };

  const inviteMember = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setTeam((members) => [...members, { id: `tm-${Date.now()}`, name: email.split('@')[0], email, role: inviteRole, status: 'Invited' }]);
    setInviteEmail('');
    setAudit((entries) => [{ id: `audit-${Date.now()}`, action: 'Invited workspace member', actor: 'Mahidi Hasan', at: new Date().toISOString(), detail: `${email} as ${inviteRole}`, }, ...entries]);
    onShowToast(`Invitation sent to ${email}`);
  };

  const addVariable = () => setVariables((current) => ({ ...current, [environment]: [...current[environment], { key: 'new_variable', value: '', secret: false }] }));
  const updateVariable = (index: number, patch: Partial<EnvironmentVariable>) => setVariables((current) => ({ ...current, [environment]: current[environment].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const removeVariable = (index: number) => setVariables((current) => ({ ...current, [environment]: current[environment].filter((_, itemIndex) => itemIndex !== index) }));

  return (
    <div className="kly-page-stack kly-settings-page">
      <div className="kly-settings-nav" role="tablist" aria-label="Project settings">
        {([['general', 'General', Settings], ['team', 'Team & RBAC', Users], ['environments', 'Environments', ServerCog], ['security', 'Security', ShieldCheck], ['lifecycle', 'Lifecycle', GitCompare], ['notifications', 'Notifications', BellRing], ['audit', 'Audit Log', ClipboardList]] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={settingsView === id} className={settingsView === id ? 'is-active' : ''} onClick={() => setSettingsView(id)}><Icon size={14} />{label}</button>
        ))}
      </div>

      {settingsView === 'general' && <>
      <div className="kly-card">
        <h4 className="kly-card-title" style={{ marginBottom: 14 }}>General Configuration</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="kly-input-group">
            <label className="kly-label">Project Name</label>
            <input className="kly-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="kly-input-group">
            <label className="kly-label">Category</label>
            <input className="kly-input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>

        <div className="kly-input-group" style={{ marginTop: 12 }}>
          <label className="kly-label">Project Description</label>
          <textarea
            className="kly-textarea"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="kly-input-group" style={{ marginTop: 12 }}>
          <label className="kly-label">Marketplace Listing Visibility</label>
          <select className="kly-select" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
            <option value="public">Public (Indexed on Klyra marketplace & search engines)</option>
            <option value="unlisted">Unlisted (Accessible only via direct gateway link)</option>
            <option value="private">Private (Restricted to workspace team members)</option>
          </select>
        </div>
      </div>

      {/* 2. Gateway & Routing */}
      <div className="kly-card">
        <h4 className="kly-card-title" style={{ marginBottom: 14 }}>Gateway & Custom Domain</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="kly-input-group">
            <label className="kly-label">Custom Edge Domain</label>
            <input
              className="kly-input kly-mono"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="api.yourbrand.com"
            />
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
              CNAME points to <code>edge.klyra.net</code> (SSL auto-provisioned)
            </span>
          </div>

          <div className="kly-input-group">
            <label className="kly-label">Upstream Origin Base URL</label>
            <input
              className="kly-input kly-mono"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="kly-input-group" style={{ marginTop: 14 }}>
          <label className="kly-label">Global Default Rate Limit Policy (requests/min per IP/Key)</label>
          <input
            type="number"
            className="kly-input"
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="kly-btn kly-btn-primary" onClick={handleSave}>
          <Save size={13} />
          <span>Save Changes</span>
        </button>
      </div>
      </>}

      {settingsView === 'team' && <div className="kly-card">
        <div className="kly-card-header"><div><h4 className="kly-card-title"><Users size={15} /> Team access and roles</h4><p className="kly-card-subtitle">Separate who can change infrastructure from who can inspect it.</p></div><span className="kly-badge kly-badge-healthy">RBAC enforced</span></div>
        <div className="kly-table-wrapper"><table className="kly-table"><thead><tr><th>Member</th><th>Status</th><th>Role</th><th style={{ textAlign: 'right' }}>Access</th></tr></thead><tbody>{team.map((member) => <tr key={member.id}><td><strong>{member.name}</strong><div className="kly-table-secondary">{member.email}</div></td><td><span className={`kly-badge ${member.status === 'Active' ? 'kly-badge-healthy' : 'kly-badge-deploying'}`}>{member.status}</span></td><td><select className="kly-select kly-select-compact" value={member.role} disabled={member.role === 'Owner'} onChange={(event) => setTeam((members) => members.map((item) => item.id === member.id ? { ...item, role: event.target.value as TeamRole } : item))}><option>Owner</option><option>Editor</option><option>Viewer</option></select></td><td style={{ textAlign: 'right', color: 'var(--kly-text-dim)', fontSize: 11 }}>{member.role === 'Owner' ? 'Full control + billing' : member.role === 'Editor' ? 'Specs + deploy' : 'Read-only observability'}</td></tr>)}</tbody></table></div>
        <div className="kly-settings-invite"><input className="kly-input" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" type="email" /><select className="kly-select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as TeamRole)}><option>Viewer</option><option>Editor</option><option>Owner</option></select><button className="kly-btn kly-btn-primary" onClick={inviteMember} disabled={!inviteEmail.trim()}><UserPlus size={13} /> Invite member</button></div>
      </div>}

      {settingsView === 'environments' && <div className="kly-card">
        <div className="kly-card-header"><div><h4 className="kly-card-title"><ServerCog size={15} /> Environment variables</h4><p className="kly-card-subtitle">Use <code>{'{{base_url}}'}</code> and <code>{'{{api_key}}'}</code> in routes without editing the spec.</p></div><select className="kly-select" value={environment} onChange={(event) => setEnvironment(event.target.value as typeof environment)}><option value="development">Development</option><option value="staging">Staging</option><option value="production">Production</option></select></div>
        <div className="kly-variable-list">{variables[environment].map((item, index) => <div className="kly-variable-row" key={`${environment}-${index}`}><input className="kly-input kly-mono" value={item.key} onChange={(event) => updateVariable(index, { key: event.target.value })} /><input className="kly-input kly-mono" value={item.value} type={item.secret ? 'password' : 'text'} onChange={(event) => updateVariable(index, { value: event.target.value })} /><label className="kly-secret-toggle"><input type="checkbox" checked={item.secret} onChange={(event) => updateVariable(index, { secret: event.target.checked })} /> Secret</label><button className="kly-btn-icon" aria-label={`Remove ${item.key}`} onClick={() => removeVariable(index)}><X size={14} /></button></div>)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}><button className="kly-btn kly-btn-secondary" onClick={addVariable}><Plus size={13} /> Add variable</button><button className="kly-btn kly-btn-primary" onClick={() => { setAudit((entries) => [{ id: `audit-${Date.now()}`, action: 'Updated environment variables', actor: 'Mahidi Hasan', at: new Date().toISOString(), detail: `${environment} environment`, }, ...entries]); onShowToast(`${environment} variables saved`); }}><Save size={13} /> Save environment</button></div>
      </div>}

      {settingsView === 'security' && <div className="kly-page-stack">
        <div className="kly-card"><div className="kly-card-header"><div><h4 className="kly-card-title"><ShieldCheck size={15} /> Gateway security policy</h4><p className="kly-card-subtitle">Set guardrails that apply before requests reach the upstream.</p></div><span className="kly-badge kly-badge-healthy">Protected</span></div>
          <div className="kly-control-list"><label className="kly-policy-toggle"><span><b>Web application firewall</b><small>Block common injection, bot, and protocol abuse patterns.</small></span><input type="checkbox" checked={wafEnabled} onChange={(event) => setWafEnabled(event.target.checked)} /></label><label className="kly-policy-toggle"><span><b>Require MFA for privileged actions</b><small>Require step-up authentication for billing, keys, and deletion.</small></span><input type="checkbox" checked={requireMfa} onChange={(event) => setRequireMfa(event.target.checked)} /></label><label className="kly-policy-toggle"><span><b>Strict transport security</b><small>Enforce TLS 1.2+, HSTS, and secure redirect behavior.</small></span><input type="checkbox" checked={strictTransport} onChange={(event) => setStrictTransport(event.target.checked)} /></label></div>
        </div>
        <div className="kly-card"><h4 className="kly-card-title"><Network size={15} /> Network and request controls</h4><div className="kly-settings-grid"><div className="kly-input-group"><label className="kly-label">IP allowlist</label><textarea className="kly-textarea kly-mono" rows={3} value={ipAllowlist} onChange={(event) => setIpAllowlist(event.target.value)} placeholder="One CIDR block per line" /></div><div className="kly-input-group"><label className="kly-label">Allowed HTTP methods</label><input className="kly-input kly-mono" value={allowedMethods} onChange={(event) => setAllowedMethods(event.target.value)} /><span className="kly-field-hint">Comma-separated. Requests using other methods are rejected at the edge.</span></div></div><div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="kly-btn kly-btn-primary" onClick={() => { onUpdateProject({ ipAllowlist }); setAudit((entries) => [{ id: `audit-${Date.now()}`, action: 'Updated gateway security policy', actor: 'Mahidi Hasan', at: new Date().toISOString(), detail: `${wafEnabled ? 'WAF on' : 'WAF off'} · ${ipAllowlist}`, }, ...entries]); onShowToast('Gateway security policy saved'); }}><Save size={13} /> Save security policy</button></div></div>
      </div>}

      {settingsView === 'lifecycle' && <div className="kly-card"><div className="kly-card-header"><div><h4 className="kly-card-title"><GitCompare size={15} /> Release governance</h4><p className="kly-card-subtitle">Control promotion, canary exposure, rollback, and version retirement.</p></div><span className="kly-badge kly-badge-deploying">Production guardrails</span></div><div className="kly-settings-grid"><div className="kly-input-group"><label className="kly-label">Canary traffic</label><input className="kly-input" type="number" min={0} max={100} value={canaryPercent} onChange={(event) => setCanaryPercent(Number(event.target.value))} /><span className="kly-field-hint">Percentage of production traffic sent to a new deployment.</span></div><div className="kly-input-group"><label className="kly-label">Deprecation sunset window (days)</label><input className="kly-input" type="number" min={0} value={sunsetWindow} onChange={(event) => setSunsetWindow(Number(event.target.value))} /><span className="kly-field-hint">Default window applied when a version is deprecated.</span></div></div><div className="kly-control-list" style={{ marginTop: 14 }}><label className="kly-policy-toggle"><span><b>Automatic rollback on SLO breach</b><small>Revert the canary when error rate or latency exceeds the alert threshold.</small></span><input type="checkbox" checked={autoRollback} onChange={(event) => setAutoRollback(event.target.checked)} /></label><label className="kly-policy-toggle"><span><b>Require two-person production approval</b><small>Owners and Editors cannot promote alone.</small></span><input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} /></label></div><div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="kly-btn kly-btn-primary" onClick={() => { setAudit((entries) => [{ id: `audit-${Date.now()}`, action: 'Updated release governance', actor: 'Mahidi Hasan', at: new Date().toISOString(), detail: `${canaryPercent}% canary · ${autoRollback ? 'auto rollback' : 'manual rollback'}`, }, ...entries]); onShowToast('Release governance saved'); }}><Save size={13} /> Save lifecycle policy</button></div></div>}

      {settingsView === 'notifications' && <div className="kly-card"><div className="kly-card-header"><div><h4 className="kly-card-title"><BellRing size={15} /> Operational notifications</h4><p className="kly-card-subtitle">Choose where deployment, security, and reliability events are delivered.</p></div></div><div className="kly-control-list"><label className="kly-policy-toggle"><span><b>Slack notifications</b><small>Deployment status, incidents, and threshold alerts.</small></span><input type="checkbox" checked={slackEnabled} onChange={(event) => setSlackEnabled(event.target.checked)} /></label><label className="kly-policy-toggle"><span><b>Email notifications</b><small>Send critical events to workspace Owners.</small></span><input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} /></label></div><div className="kly-input-group" style={{ marginTop: 14 }}><label className="kly-label">Signed webhook endpoint</label><input className="kly-input kly-mono" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} /><span className="kly-field-hint">Payloads are signed and include the project, version, actor, and event timestamp.</span></div><div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="kly-btn kly-btn-primary" onClick={() => { setAudit((entries) => [{ id: `audit-${Date.now()}`, action: 'Updated notification routing', actor: 'Mahidi Hasan', at: new Date().toISOString(), detail: `${slackEnabled ? 'Slack' : ''}${emailEnabled ? ' Email' : ''}`, }, ...entries]); onShowToast('Notification routing saved'); }}><Save size={13} /> Save notifications</button></div></div>}

      {settingsView === 'audit' && <div className="kly-card">
        <div className="kly-card-header"><div><h4 className="kly-card-title"><ClipboardList size={15} /> Audit trail</h4><p className="kly-card-subtitle">Immutable-looking activity context for deployments, access, and configuration changes.</p></div><span className="kly-mono" style={{ color: 'var(--kly-text-dim)', fontSize: 11 }}>{audit.length} events</span></div>
        <div className="kly-table-wrapper"><table className="kly-table"><thead><tr><th>Event</th><th>Actor</th><th>Detail</th><th style={{ textAlign: 'right' }}>Timestamp</th></tr></thead><tbody>{audit.length ? audit.map((entry) => <tr key={entry.id}><td><strong>{entry.action}</strong></td><td>{entry.actor}</td><td className="kly-mono" style={{ color: 'var(--kly-text-muted)', fontSize: 11 }}>{entry.detail}</td><td className="kly-mono" style={{ textAlign: 'right', color: 'var(--kly-text-dim)', fontSize: 11 }}>{new Date(entry.at).toLocaleString()}</td></tr>) : <tr><td colSpan={4}>No audit events recorded for this project yet.</td></tr>}</tbody></table></div>
      </div>}

      {/* 3. Danger Zone */}
      <div className="kly-card" style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.03)' }}>
        <h4 className="kly-card-title" style={{ color: '#fb7185', marginBottom: 10 }}>
          <ShieldAlert size={15} color="#fb7185" />
          <span>Danger Zone</span>
        </h4>
        <p style={{ fontSize: 12, color: 'var(--kly-text-muted)', marginBottom: 14 }}>
          Destructive operations that immediately halt traffic or irreversibly purge project data.
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <b style={{ fontSize: 13, display: 'block' }}>Delete this Project</b>
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
              Permanently revokes all 42 endpoints, 3 API keys, and drops gateway routing.
            </span>
          </div>

          <button className="kly-btn kly-btn-danger" onClick={onDeleteProject}>
            <Trash2 size={13} />
            <span>Delete Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
