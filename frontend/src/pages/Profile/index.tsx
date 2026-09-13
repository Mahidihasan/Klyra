import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { authApi, UpdateProfileInput, UserProfile } from '../../services/api/auth';
import './styles.css';

type ProfileSection = 'general' | 'security' | 'preferences' | 'accounts';

const SECTIONS: Array<{ id: ProfileSection; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General & Personal Info', icon: <UserRound size={17} /> },
  { id: 'security', label: 'Security & Password', icon: <ShieldCheck size={17} /> },
  {
    id: 'preferences',
    label: 'Preferences & Notifications',
    icon: <SlidersHorizontal size={17} />,
  },
  { id: 'accounts', label: 'Connected Accounts & API Keys', icon: <KeyRound size={17} /> },
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

export const ProfilePage: React.FC = () => {
  const { user, isLoading: isAuthLoading, refreshProfile } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [form, setForm] = useState<ProfileForm | null>(user ? toForm(user) : null);
  const [section, setSection] = useState<ProfileSection>('general');
  const [isLoading, setIsLoading] = useState(Boolean(user));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

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
    setError(null);
    try {
      const { user: currentProfile } = await authApi.getProfile();
      setProfile(currentProfile);
      setForm(toForm(currentProfile));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load your profile.'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
      const result = await authApi.uploadAvatar(avatarFile);
      setProfile(result.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      await refreshProfile();
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
      const result = await authApi.removeAvatar();
      setProfile(result.user);
      setAvatarFile(null);
      setAvatarPreview(null);
      await refreshProfile();
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
      const result = await authApi.updateProfile(payload);
      setProfile(result.user);
      setForm(toForm(result.user));
      await refreshProfile();
      setSuccess(result.message);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save your profile.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="profile-state" role="status">
        <Loader2 className="profile-spinner" size={22} /> Loading your profile…
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
          {section !== 'general' ? (
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
                  />
                  <small>Klyra currently stores a single full-name field.</small>
                </div>

                <div className="profile-field full">
                  <label htmlFor="profile-email">Email</label>
                  <div className="profile-readonly-input">
                    <Mail size={16} />
                    <input id="profile-email" value={profile.email} readOnly aria-readonly="true" />
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
