import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Bell,
  CalendarDays,
  Chrome,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Globe2,
  Github,
  Info,
  KeyRound,
  Lock,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { applyTheme, useAuth } from '../../context/AuthContext';
import { ManagedApiKey, profileApi, UpdatePreferencesInput, UpdateProfileInput, UserPreferences, UserProfile } from '../../services/api/auth';
import './styles.css';

type ProfileSection = 'general' | 'security' | 'preferences' | 'accounts' | 'connections';

const SECTIONS: Array<{ id: ProfileSection; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General & Personal Info', icon: <UserRound size={17} /> },
  { id: 'security', label: 'Security & Password', icon: <ShieldCheck size={17} /> },
  {
    id: 'preferences',
    label: 'Preferences & Notifications',
    icon: <SlidersHorizontal size={17} />,
  },
  { id: 'accounts', label: 'Account Information', icon: <KeyRound size={17} /> },
  { id: 'connections', label: 'Connected Accounts & API Keys', icon: <KeyRound size={17} /> },
];

interface ProfileForm {
  name: string;
  company: string;
  bio: string;
  website: string;
}

const toForm = (profile: UserProfile): ProfileForm => ({
  name: profile.name,
  company: profile.company || '',
  bio: profile.bio || '',
  website: profile.website || '',
});

function initials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

function validate(form: ProfileForm): string | null {
  const name = form.name.trim();
  if (name.length < 2 || name.length > 100) {
    return 'Full name must be between 2 and 100 characters.';
  }
  if (form.company.trim().length > 255) {
    return 'Organization must be 255 characters or fewer.';
  }
  if (form.bio.trim().length > 2000) {
    return 'Bio must be 2,000 characters or fewer.';
  }
  const website = form.website.trim();
  if (website) {
    try {
      const parsed = new URL(website);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'Website must use http:// or https://.';
      }
    } catch {
      return 'Website must be a valid URL.';
    }
  }
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available';
}

function roleDescription(role: string): string {
  return role.toLowerCase() === 'admin' ? 'Administrator — full platform access' : 'User — standard account access';
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  timezone: 'UTC',
  notifications: { email: true, push: true, in_app: true },
};

function validatePasswordForm(form: PasswordForm): string | null {
  if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
    return 'Enter your current password and confirm your new password.';
  }
  if (form.newPassword.length < 8 || form.newPassword.length > 256) {
    return 'New password must be between 8 and 256 characters.';
  }
  if (form.currentPassword === form.newPassword) {
    return 'New password must be different from your current password.';
  }
  if (form.newPassword !== form.confirmPassword) {
    return 'New password and confirmation do not match.';
  }
  return null;
}

export const ProfilePage: React.FC = () => {
  const { user, isLoading: isAuthLoading, loadProfile: fetchProfile, updatePersonalInfo, uploadProfileAvatar, removeProfileAvatar, changeProfilePassword, updateProfilePreferences } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [form, setForm] = useState<ProfileForm | null>(user ? toForm(user) : null);
  const [section, setSection] = useState<ProfileSection>('general');
  const [isLoading, setIsLoading] = useState(Boolean(user));
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(user?.preferences || null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSuccess, setPreferencesSuccess] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ManagedApiKey[]>([]);
  const [isApiKeysLoading, setIsApiKeysLoading] = useState(false);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [apiKeysSuccess, setApiKeysSuccess] = useState<string | null>(null);
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [isSecretCopied, setIsSecretCopied] = useState(false);
  const [keyPendingRevocation, setKeyPendingRevocation] = useState<ManagedApiKey | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setForm(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setProfileLoadError(null);
    setError(null);
    try {
      const currentProfile = await fetchProfile();
      setProfile(currentProfile);
      setForm(toForm(currentProfile));
      setPreferences(currentProfile.preferences);
    } catch (err: unknown) {
      setProfileLoadError(getErrorMessage(err, 'Unable to load your profile.'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const loadApiKeys = useCallback(async () => {
    setIsApiKeysLoading(true);
    setApiKeysError(null);
    try {
      const result = await profileApi.listApiKeys();
      setApiKeys(result.apiKeys);
    } catch (err: unknown) {
      setApiKeysError(getErrorMessage(err, 'Unable to load API keys.'));
    } finally {
      setIsApiKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'connections') void loadApiKeys();
  }, [loadApiKeys, section]);

  const updateField = (field: keyof ProfileForm, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setError(null);
    setSuccess(null);
  };

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAvatarError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError('Avatar must be 3 MB or smaller.');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarError(null);
    setAvatarSuccess(null);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) {
      return;
    }
    setIsAvatarSaving(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const result = await uploadProfileAvatar(avatarFile);
      setProfile(result.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarSuccess(result.message);
    } catch (error: unknown) {
      setAvatarError(getErrorMessage(error, 'Unable to upload your profile picture.'));
    } finally {
      setIsAvatarSaving(false);
    }
  };

  const removeAvatar = async () => {
    setIsAvatarSaving(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const result = await removeProfileAvatar();
      setProfile(result.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarSuccess(result.message);
    } catch (error: unknown) {
      setAvatarError(getErrorMessage(error, 'Unable to remove your profile picture.'));
    } finally {
      setIsAvatarSaving(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) {
      return;
    }

    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: UpdateProfileInput = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      bio: form.bio.trim() || null,
      website: form.website.trim() || null,
    };

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await updatePersonalInfo(payload);
      setProfile(result.user);
      setForm(toForm(result.user));
      setSuccess(result.message);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save your profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  const updatePasswordField = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePasswordForm(passwordForm);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const result = await changeProfilePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordSuccess(result.message);
    } catch (err: unknown) {
      setPasswordError(getErrorMessage(err, 'Unable to change your password.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const updatePreferences = (changes: Partial<UserPreferences>) => {
    setPreferences((current) => current ? { ...current, ...changes } : current);
    if (changes.theme) {
      applyTheme(changes.theme);
    }
    setPreferencesError(null);
    setPreferencesSuccess(null);
  };

  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preferences) return;
    setIsSavingPreferences(true);
    setPreferencesError(null);
    setPreferencesSuccess(null);
    try {
      const result = await updateProfilePreferences(preferences as UpdatePreferencesInput);
      setProfile(result.user);
      setPreferences(result.user.preferences);
      setPreferencesSuccess(result.message);
    } catch (err: unknown) {
      setPreferencesError(getErrorMessage(err, 'Unable to save preferences.'));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const createApiKey = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newKeyName.trim();
    if (!name || name.length > 100) {
      setApiKeysError('API key name must be between 1 and 100 characters.');
      return;
    }

    setIsCreatingKey(true);
    setApiKeysError(null);
    setApiKeysSuccess(null);
    try {
      const result = await profileApi.createApiKey(name);
      setApiKeys((current) => [result.apiKey, ...current]);
      setNewKeyName('');
      setIsCreateKeyOpen(false);
      setOneTimeSecret(result.secret);
      setIsSecretCopied(false);
      setApiKeysSuccess(result.message);
    } catch (err: unknown) {
      setApiKeysError(getErrorMessage(err, 'Unable to create API key.'));
    } finally {
      setIsCreatingKey(false);
    }
  };

  const revokeApiKey = async () => {
    const key = keyPendingRevocation;
    if (!key) return;
    setRevokingKeyId(key.id);
    setApiKeysError(null);
    setApiKeysSuccess(null);
    try {
      const result = await profileApi.revokeApiKey(key.id);
      setApiKeys((current) => current.map((item) => item.id === key.id ? result.apiKey : item));
      setApiKeysSuccess(result.message);
      setKeyPendingRevocation(null);
    } catch (err: unknown) {
      setApiKeysError(getErrorMessage(err, 'Unable to revoke API key.'));
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyOneTimeSecret = async () => {
    if (!oneTimeSecret) return;
    try {
      await navigator.clipboard.writeText(oneTimeSecret);
      setIsSecretCopied(true);
    } catch {
      setApiKeysError('Unable to copy the API key. Please copy it manually before closing this dialog.');
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="profile-state" role="status">
        <Loader2 className="profile-spinner" size={22} /> Loading your profile…
      </div>
    );
  }

  if (profileLoadError) {
    return (
      <div className="profile-state profile-error-state" role="alert">
        <AlertCircle size={22} />
        <div><strong>Unable to load your profile</strong><p>{profileLoadError}</p></div>
        <button type="button" className="profile-secondary-btn" onClick={() => void loadProfile()} disabled={isLoading}>Retry</button>
      </div>
    );
  }

  if (!profile || !form) {
    return (
      <div className="profile-state">
        <AlertCircle size={22} /> Sign in to view your profile.
      </div>
    );
  }

  const activeSection = SECTIONS.find((item) => item.id === section)!;

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-hero-glow" />
        <div className="profile-avatar" aria-label={`${profile.name}'s avatar`}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(profile.name)}
        </div>
        <div className="profile-hero-content">
          <div className="profile-title-row">
            <h1>{profile.name}</h1>
            {profile.email_verified_at && <BadgeCheck size={18} aria-label="Email verified" />}
          </div>
          <p className="profile-role">{profile.role}</p>
          {profile.company && (
            <p className="profile-company">
              <Building2 size={15} /> {profile.company}
            </p>
          )}
        </div>
      </section>

      <section className="profile-avatar-editor" aria-labelledby="profile-picture-title">
        <div className="profile-avatar-preview" aria-label="Profile picture preview">
          {avatarPreview || profile.avatar_url ? (
            <img src={avatarPreview || profile.avatar_url || ''} alt="Profile preview" />
          ) : (
            initials(profile.name)
          )}
        </div>
        <div className="profile-avatar-copy">
          <h2 id="profile-picture-title">Profile picture</h2>
          <p>PNG, JPG, or WebP. Maximum file size 3 MB.</p>
          {avatarFile && <span className="profile-avatar-file">Ready to upload: {avatarFile.name}</span>}
          {avatarError && (
            <div className="profile-avatar-message error">
              <AlertCircle size={15} /> {avatarError}
            </div>
          )}
          {avatarSuccess && (
            <div className="profile-avatar-message success">
              <CheckCircle2 size={15} /> {avatarSuccess}
            </div>
          )}
        </div>
        <div className="profile-avatar-actions">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={selectAvatar}
            hidden
          />
          <button
            type="button"
            className="profile-secondary-btn"
            onClick={() => avatarInputRef.current?.click()}
            disabled={isAvatarSaving}
          >
            <Upload size={16} /> Choose image
          </button>
          {avatarFile && (
            <button
              type="button"
              className="profile-primary-btn"
              onClick={uploadAvatar}
              disabled={isAvatarSaving}
            >
              {isAvatarSaving ? <Loader2 className="profile-spinner" size={16} /> : <Upload size={16} />}
              Upload
            </button>
          )}
          {profile.avatar_url && !avatarFile && (
            <button
              type="button"
              className="profile-danger-btn"
              onClick={removeAvatar}
              disabled={isAvatarSaving}
            >
              {isAvatarSaving ? <Loader2 className="profile-spinner" size={16} /> : <Trash2 size={16} />}
              Remove
            </button>
          )}
        </div>
      </section>

      <div className="profile-layout">
        <nav className="profile-nav" aria-label="Profile settings">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'active' : ''}
              onClick={() => {
                setSection(item.id);
                setError(null);
                setSuccess(null);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <section className="profile-panel" aria-labelledby="profile-section-title">
          {section === 'connections' ? (
            <>
              <header className="profile-panel-header profile-keys-header">
                <div>
                  <p className="profile-eyebrow">CREDENTIALS</p>
                  <h2 id="profile-section-title">Connected Accounts &amp; API Keys</h2>
                  <p>Manage developer credentials and available account integrations.</p>
                </div>
                <button type="button" className="profile-primary-btn" onClick={() => { setIsCreateKeyOpen(true); setApiKeysError(null); }} disabled={isApiKeysLoading || isCreatingKey}>
                  <KeyRound size={17} /> Create API key
                </button>
              </header>

              {apiKeysError && <div className="profile-message error" role="alert"><AlertCircle size={17} /> {apiKeysError}</div>}
              {apiKeysSuccess && <div className="profile-message success"><CheckCircle2 size={17} /> {apiKeysSuccess}</div>}

              <div className="profile-keys-section">
                <div className="profile-section-heading">
                  <div><h3>API Keys</h3><p>Secrets are shown only once, when a key is created.</p></div>
                </div>
                {isApiKeysLoading ? (
                  <div className="profile-inline-state" role="status"><Loader2 className="profile-spinner" size={18} /> Loading API keys…</div>
                ) : apiKeys.length === 0 ? (
                  <div className="profile-empty-state"><KeyRound size={22} /><strong>No API keys yet</strong><span>Create a key when you need a developer credential.</span></div>
                ) : (
                  <div className="profile-api-key-list">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="profile-api-key-row">
                        <div className="profile-api-key-main">
                          <strong>{key.name}</strong>
                          <code>{key.keyPrefix}••••••••</code>
                          <span>Created {formatDate(key.createdAt)}</span>
                          {key.revokedAt && <span>Revoked {formatDate(key.revokedAt)}</span>}
                        </div>
                        <div className="profile-api-key-actions">
                          <span className={`profile-key-status ${key.status.toLowerCase()}`}>{key.status}</span>
                          {key.status === 'ACTIVE' && (
                            <button type="button" className="profile-danger-btn" onClick={() => setKeyPendingRevocation(key)} disabled={revokingKeyId === key.id}>
                              <Trash2 size={15} /> Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-keys-section">
                <div className="profile-section-heading"><div><h3>Connected Accounts</h3><p>Third-party account linking requires OAuth configuration.</p></div></div>
                <div className="profile-connected-grid">
                  <div className="profile-connected-card"><Github size={22} /><div><h4>GitHub</h4><p>OAuth not configured</p></div><span>Unavailable</span></div>
                  <div className="profile-connected-card"><Chrome size={22} /><div><h4>Google</h4><p>OAuth not configured</p></div><span>Unavailable</span></div>
                </div>
              </div>

              {isCreateKeyOpen && (
                <div className="profile-modal-backdrop" role="presentation">
                  <form className="profile-key-modal" onSubmit={createApiKey} aria-labelledby="create-api-key-title">
                    <button type="button" className="profile-modal-close" onClick={() => { setIsCreateKeyOpen(false); setNewKeyName(''); }} disabled={isCreatingKey} aria-label="Close"><X size={18} /></button>
                    <h3 id="create-api-key-title">Create API key</h3>
                    <p>Name this key so you can identify it later. The secret will be shown only once.</p>
                    <div className="profile-field"><label htmlFor="new-api-key-name">Key name</label><input id="new-api-key-name" value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} maxLength={100} placeholder="e.g. Local development" autoFocus disabled={isCreatingKey} /></div>
                    <div className="profile-modal-actions"><button type="button" className="profile-secondary-btn" onClick={() => { setIsCreateKeyOpen(false); setNewKeyName(''); }} disabled={isCreatingKey}>Cancel</button><button type="submit" className="profile-primary-btn" disabled={isCreatingKey}>{isCreatingKey ? <Loader2 className="profile-spinner" size={16} /> : <KeyRound size={16} />}{isCreatingKey ? 'Creating…' : 'Create key'}</button></div>
                  </form>
                </div>
              )}

              {oneTimeSecret && (
                <div className="profile-modal-backdrop" role="presentation">
                  <div className="profile-key-modal profile-secret-modal" role="dialog" aria-modal="true" aria-labelledby="api-key-secret-title">
                    <button type="button" className="profile-modal-close" onClick={() => setOneTimeSecret(null)} aria-label="Close"><X size={18} /></button>
                    <CheckCircle2 className="profile-secret-icon" size={25} />
                    <h3 id="api-key-secret-title">Copy your API key now</h3>
                    <p>This is the only time Klyra will show the complete secret. Store it securely before closing this dialog.</p>
                    <code className="profile-secret-value">{oneTimeSecret}</code>
                    <button type="button" className="profile-secondary-btn" onClick={() => void copyOneTimeSecret()}><Copy size={16} />{isSecretCopied ? 'Copied' : 'Copy key'}</button>
                    <button type="button" className="profile-primary-btn" onClick={() => setOneTimeSecret(null)}>I stored this key</button>
                  </div>
                </div>
              )}

              {keyPendingRevocation && (
                <div className="profile-modal-backdrop" role="presentation">
                  <div className="profile-key-modal" role="dialog" aria-modal="true" aria-labelledby="revoke-api-key-title">
                    <button type="button" className="profile-modal-close" onClick={() => setKeyPendingRevocation(null)} disabled={Boolean(revokingKeyId)} aria-label="Close"><X size={18} /></button>
                    <h3 id="revoke-api-key-title">Revoke API key?</h3>
                    <p><strong>{keyPendingRevocation.name}</strong> will stop working immediately. This action cannot be undone.</p>
                    <div className="profile-modal-actions"><button type="button" className="profile-secondary-btn" onClick={() => setKeyPendingRevocation(null)} disabled={Boolean(revokingKeyId)}>Cancel</button><button type="button" className="profile-danger-btn" onClick={() => void revokeApiKey()} disabled={Boolean(revokingKeyId)}>{revokingKeyId ? <Loader2 className="profile-spinner" size={16} /> : <Trash2 size={16} />}{revokingKeyId ? 'Revoking…' : 'Revoke key'}</button></div>
                  </div>
                </div>
              )}
            </>
          ) : section === 'preferences' && preferences ? (
            <>
              <header className="profile-panel-header">
                <div><p className="profile-eyebrow">PREFERENCES</p><h2 id="profile-section-title">Preferences & Notifications</h2><p>Choose how Klyra looks and how it can contact you.</p></div>
              </header>
              <form className="profile-preferences-form" onSubmit={savePreferences} noValidate>
                {preferencesError && <div className="profile-message error"><AlertCircle size={17} /> {preferencesError}</div>}
                {preferencesSuccess && <div className="profile-message success"><CheckCircle2 size={17} /> {preferencesSuccess}</div>}
                <div className="profile-preference-group">
                  <div><h3>Theme</h3><p>Applies across Klyra immediately and is saved with your preferences.</p></div>
                  <div className="profile-theme-options" role="radiogroup" aria-label="Theme preference">
                    {(['dark', 'light', 'system'] as const).map((theme) => <button key={theme} type="button" className={preferences.theme === theme ? 'active' : ''} onClick={() => updatePreferences({ theme })} disabled={isSavingPreferences} role="radio" aria-checked={preferences.theme === theme}>{theme === 'system' ? <Monitor size={17} /> : theme === 'dark' ? <Moon size={17} /> : <Globe2 size={17} />}<span>{theme[0].toUpperCase() + theme.slice(1)}</span></button>)}
                  </div>
                </div>
                <div className="profile-preference-grid">
                  <div className="profile-field"><label htmlFor="profile-timezone">Timezone</label><select id="profile-timezone" value={preferences.timezone} onChange={(event) => updatePreferences({ timezone: event.target.value })} disabled={isSavingPreferences}><option value="UTC">UTC</option><option value="Asia/Dhaka">Asia/Dhaka</option><option value="America/New_York">America/New_York</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="Europe/London">Europe/London</option><option value="Europe/Berlin">Europe/Berlin</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="Australia/Sydney">Australia/Sydney</option></select></div>
                </div>
                <div className="profile-preference-group"><div><h3>Notification channels</h3><p>Delivery preferences are saved now; notification delivery may depend on the relevant Klyra service being enabled.</p></div><div className="profile-toggle-list">{([{ key: 'email', label: 'Email', icon: <Mail size={17} /> }, { key: 'push', label: 'Push', icon: <Bell size={17} /> }, { key: 'in_app', label: 'In-app', icon: <Monitor size={17} /> }] as const).map(({ key, label, icon }) => <label key={key} className="profile-toggle"><span>{icon}<span>{label}</span></span><input type="checkbox" checked={preferences.notifications[key]} onChange={(event) => updatePreferences({ notifications: { ...preferences.notifications, [key]: event.target.checked } })} disabled={isSavingPreferences} /><i aria-hidden="true" /></label>)}</div></div>
                <div className="profile-form-actions"><button type="button" className="profile-secondary-btn" onClick={() => { setPreferences(DEFAULT_PREFERENCES); applyTheme(DEFAULT_PREFERENCES.theme); setPreferencesError(null); setPreferencesSuccess(null); }} disabled={isSavingPreferences}>Reset to defaults</button><button type="submit" className="profile-primary-btn" disabled={isSavingPreferences}>{isSavingPreferences ? <Loader2 className="profile-spinner" size={17} /> : <Save size={17} />}{isSavingPreferences ? 'Saving…' : 'Save preferences'}</button></div>
              </form>
            </>
          ) : section === 'accounts' ? (
            <>
              <header className="profile-panel-header"><div><p className="profile-eyebrow">ACCOUNT</p><h2 id="profile-section-title">Account Information</h2><p>Read-only account metadata and lifecycle availability.</p></div></header>
              <div className="profile-account-grid">
                <div className="profile-account-item"><CalendarDays size={18} /><div><span>Account created</span><strong>{formatDate(profile.created_at)}</strong></div></div>
                <div className="profile-account-item"><ShieldCheck size={18} /><div><span>Role & permissions</span><strong>{roleDescription(profile.role)}</strong></div></div>
                <div className="profile-account-item"><KeyRound size={18} /><div><span>Account ID</span><code>{profile.id}</code></div></div>
                <div className="profile-account-item"><Clock3 size={18} /><div><span>Last login</span><strong>{formatDate(profile.last_login_at)}{profile.last_login_ip ? ` · ${profile.last_login_ip}` : ''}</strong></div></div>
              </div>
              <aside className="profile-unavailable"><Info size={18} /><div><h3>Deactivation and deletion unavailable</h3><p>Klyra does not yet expose a supported account deactivation or deletion workflow. No account action can be performed from this page.</p></div></aside>
            </>
          ) : section === 'security' ? (
            <>
              <header className="profile-panel-header">
                <div>
                  <p className="profile-eyebrow">SECURITY</p>
                  <h2 id="profile-section-title">Security & Password</h2>
                  <p>Use a strong password to keep your Klyra account secure.</p>
                </div>
              </header>

              <div className="profile-security-grid">
                <form className="profile-security-card" onSubmit={changePassword} noValidate>
                  <div className="profile-security-card-heading">
                    <div className="profile-section-icon"><Lock size={18} /></div>
                    <div>
                      <h3>Change password</h3>
                      <p>Changing your password signs out other devices.</p>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="profile-message error">
                      <AlertCircle size={17} /> {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="profile-message success">
                      <CheckCircle2 size={17} /> {passwordSuccess}
                    </div>
                  )}

                  <div className="profile-field">
                    <label htmlFor="profile-current-password">Current password</label>
                    <div className="profile-password-input">
                      <input
                        id="profile-current-password"
                        type={showPasswords ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
                        autoComplete="current-password"
                        disabled={isChangingPassword}
                      />
                    </div>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="profile-new-password">New password</label>
                    <div className="profile-password-input">
                      <input
                        id="profile-new-password"
                        type={showPasswords ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(event) => updatePasswordField('newPassword', event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={256}
                        disabled={isChangingPassword}
                      />
                      <button
                        type="button"
                        className="profile-password-toggle"
                        onClick={() => setShowPasswords((current) => !current)}
                        aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                        disabled={isChangingPassword}
                      >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <small>Use 8 to 256 characters.</small>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="profile-confirm-password">Confirm new password</label>
                    <div className="profile-password-input">
                      <input
                        id="profile-confirm-password"
                        type={showPasswords ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(event) => updatePasswordField('confirmPassword', event.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={256}
                        disabled={isChangingPassword}
                      />
                      <button
                        type="button"
                        className="profile-password-toggle"
                        onClick={() => setShowPasswords((current) => !current)}
                        aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                        disabled={isChangingPassword}
                      >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="profile-form-actions">
                    <button type="submit" className="profile-primary-btn" disabled={isChangingPassword}>
                      {isChangingPassword ? <Loader2 className="profile-spinner" size={17} /> : <Lock size={17} />}
                      {isChangingPassword ? 'Updating…' : 'Update password'}
                    </button>
                  </div>
                </form>

                <aside className="profile-security-card profile-security-placeholder" aria-labelledby="profile-two-factor-title">
                  <div className="profile-security-card-heading">
                    <div className="profile-section-icon"><ShieldCheck size={18} /></div>
                    <div>
                      <h3 id="profile-two-factor-title">Two-factor authentication</h3>
                      <p>Additional sign-in protection is planned for a later Profile module.</p>
                    </div>
                  </div>
                  <p className="profile-security-note">Klyra already verifies new devices during sign-in. There is no user-managed 2FA setting available yet.</p>
                </aside>
              </div>
            </>
          ) : section !== 'general' ? (
            <div className="profile-coming-soon">
              <div className="profile-section-icon">{activeSection.icon}</div>
              <h2 id="profile-section-title">{activeSection.label}</h2>
              <p>This section is planned for a later Profile module.</p>
            </div>
          ) : (
            <>
              <header className="profile-panel-header">
                <div>
                  <p className="profile-eyebrow">PROFILE</p>
                  <h2 id="profile-section-title">General & Personal Info</h2>
                  <p>Manage the information shown for your Klyra account.</p>
                </div>
              </header>

              {error && (
                <div className="profile-message error">
                  <AlertCircle size={17} /> {error}
                </div>
              )}
              {success && (
                <div className="profile-message success">
                  <CheckCircle2 size={17} /> {success}
                </div>
              )}

              <form className="profile-form" onSubmit={saveProfile} noValidate>
                <div className="profile-field full">
                  <label htmlFor="profile-name">Full name</label>
                  <input
                    id="profile-name"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    maxLength={100}
                    autoComplete="name"
                    required
                    disabled={isSaving}
                  />
                  <small>Klyra currently stores a single full-name field.</small>
                </div>

                <div className="profile-field full">
                  <label htmlFor="profile-email">Email</label>
                  <div className="profile-readonly-input">
                    <Mail size={16} />
                    <input id="profile-email" value={profile.email} readOnly aria-readonly="true" disabled={isSaving} />
                  </div>
                  <small>Email changes are not part of this module.</small>
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-company">Organization / company</label>
                  <input
                    id="profile-company"
                    value={form.company}
                    onChange={(event) => updateField('company', event.target.value)}
                    maxLength={255}
                    autoComplete="organization"
                    disabled={isSaving}
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-website">Website</label>
                  <div className="profile-input-icon">
                    <Globe2 size={16} />
                    <input
                      id="profile-website"
                      type="url"
                      value={form.website}
                      onChange={(event) => updateField('website', event.target.value)}
                      maxLength={500}
                      placeholder="https://example.com"
                      autoComplete="url"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="profile-field full">
                  <div className="profile-label-row">
                    <label htmlFor="profile-bio">Bio</label>
                    <span>{form.bio.length}/2000</span>
                  </div>
                  <textarea
                    id="profile-bio"
                    value={form.bio}
                    onChange={(event) => updateField('bio', event.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder="Tell the Klyra community a little about yourself."
                    disabled={isSaving}
                  />
                </div>

                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="profile-secondary-btn"
                    onClick={() => setForm(toForm(profile))}
                    disabled={isSaving}
                  >
                    Reset
                  </button>
                  <button type="submit" className="profile-primary-btn" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="profile-spinner" size={17} />
                    ) : (
                      <Save size={17} />
                    )}
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
