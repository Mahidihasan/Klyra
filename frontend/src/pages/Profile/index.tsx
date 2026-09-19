import {
  AlertCircle,
  AlignLeft,
  AtSign,
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Chrome,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Github,
  Globe2,
  Info,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Plus,
  Pencil,
  Save,
  Settings,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { OtpInput } from '../../components/OtpInput';
import { applyTheme, useAuth } from '../../context/AuthContext';
import {
  ApiResponseFormat,
  CodeSnippetPreference,
  ManagedApiKey,
  ProfileApiError,
  ProfileEducation,
  ProfileExperience,
  profileApi,
  SecuritySession,
  ThemePreference,
  UpdatePreferencesInput,
  UpdateProfileInput,
  UserPreferences,
  UserProfile,
} from '../../services/api/auth';
import { apiBuildService } from '../../services/apiBuild';
import type { ProviderProject } from '../../types/apibuild';

import { EditableRow } from './EditableRow';
import {
  ActivityEntry,
  buildAchievements,
  Contribution,
  ContributionGraph,
  ContributionsFeed,
  ProjectsList,
  StickerGrid,
} from './overview';
import './styles.css';

type ProfileSection = 'general' | 'security' | 'preferences' | 'accounts' | 'connections';
type FieldKey = 'name' | 'handle' | 'jobTitle' | 'company' | 'website' | 'githubUrl' | 'bio';

const SECTIONS: Array<{ id: ProfileSection; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General & Personal Info', icon: <UserRound size={16} /> },
  { id: 'security', label: 'Security & Access', icon: <ShieldCheck size={16} /> },
  {
    id: 'preferences',
    label: 'Preferences & Notifications',
    icon: <SlidersHorizontal size={16} />,
  },
  { id: 'connections', label: 'API Keys & Connections', icon: <KeyRound size={16} /> },
  { id: 'accounts', label: 'Account Information', icon: <Info size={16} /> },
];

interface ProfileForm {
  firstName: string;
  lastName: string;
  handle: string;
  company: string;
  jobTitle: string;
  bio: string;
  website: string;
  githubUrl: string;
}

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

type ProfileDetailKind = 'experience' | 'education';

interface ProfileDetailDraft {
  kind: ProfileDetailKind;
  index: number | null;
  primary: string;
  secondary: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
}

const EMPTY_FORM: ProfileForm = {
  firstName: '',
  lastName: '',
  handle: '',
  company: '',
  jobTitle: '',
  bio: '',
  website: '',
  githubUrl: '',
};

const emptyDetailDraft = (kind: ProfileDetailKind): ProfileDetailDraft => ({
  kind,
  index: null,
  primary: '',
  secondary: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
});

const DEFAULT_NOTIFICATIONS = { email: true, push: true, in_app: true };
const DEFAULT_EMAIL_NOTIFICATIONS = {
  api_downtime_alerts: true,
  monthly_usage_quota_warnings: true,
  product_announcements: false,
};
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  timezone:
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC',
  notifications: { ...DEFAULT_NOTIFICATIONS },
  api_response_format: 'json',
  code_snippet_preference: 'curl',
  email_notifications: { ...DEFAULT_EMAIL_NOTIFICATIONS },
};

const TIMEZONE_FALLBACK = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function supportedTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    const zones = intl.supportedValuesOf?.('timeZone');
    if (Array.isArray(zones) && zones.length > 0) {
      return zones;
    }
  } catch {
    /* fall through to the static list */
  }
  return TIMEZONE_FALLBACK;
}

function normalizePreferences(value: unknown): UserPreferences {
  const source = (value ?? {}) as Partial<UserPreferences>;
  const isTheme = (v: unknown): v is ThemePreference =>
    v === 'dark' || v === 'light' || v === 'system';
  const isFormat = (v: unknown): v is ApiResponseFormat => v === 'json' || v === 'xml';
  const isSnippet = (v: unknown): v is CodeSnippetPreference =>
    v === 'curl' ||
    v === 'javascript-fetch' ||
    v === 'javascript-axios' ||
    v === 'python' ||
    v === 'go';
  return {
    theme: isTheme(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme,
    timezone:
      typeof source.timezone === 'string' && source.timezone
        ? source.timezone
        : DEFAULT_PREFERENCES.timezone,
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(source.notifications ?? {}) },
    api_response_format: isFormat(source.api_response_format) ? source.api_response_format : 'json',
    code_snippet_preference: isSnippet(source.code_snippet_preference)
      ? source.code_snippet_preference
      : 'curl',
    email_notifications: { ...DEFAULT_EMAIL_NOTIFICATIONS, ...(source.email_notifications ?? {}) },
  };
}

const toForm = (profile: UserProfile): ProfileForm => ({
  firstName: profile.first_name,
  lastName: profile.last_name,
  handle: profile.handle || '',
  company: profile.company || '',
  jobTitle: profile.job_title || '',
  bio: profile.bio || '',
  website: profile.website || '',
  githubUrl: profile.github_url || '',
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

function validateField(field: FieldKey, form: ProfileForm): string | null {
  if (field === 'name') {
    if (
      !form.firstName.trim() ||
      form.firstName.trim().length > 50 ||
      !form.lastName.trim() ||
      form.lastName.trim().length > 50
    ) {
      return 'First and last names are required and must be 50 characters or fewer.';
    }
    if (`${form.firstName.trim()} ${form.lastName.trim()}`.length > 100) {
      return 'First and last name together must be 100 characters or fewer.';
    }
    return null;
  }
  if (field === 'handle') {
    return /^[a-z0-9][a-z0-9_-]{2,29}$/i.test(form.handle.trim())
      ? null
      : 'Username must be 3–30 characters and use only letters, numbers, underscores, or hyphens.';
  }
  if (field === 'jobTitle') {
    return form.jobTitle.trim() && form.jobTitle.trim().length <= 100
      ? null
      : 'Job title is required and must be 100 characters or fewer.';
  }
  if (field === 'company') {
    return form.company.trim().length <= 255
      ? null
      : 'Organization must be 255 characters or fewer.';
  }
  if (field === 'bio') {
    return form.bio.trim().length <= 250 ? null : 'Bio must be 250 characters or fewer.';
  }
  if (field === 'website') {
    const value = form.website.trim();
    if (!value) {
      return null;
    }
    try {
      if (new URL(value).protocol !== 'https:') {
        throw new Error();
      }
      return null;
    } catch {
      return 'Website must be a valid HTTPS URL.';
    }
  }
  const github = form.githubUrl.trim();
  try {
    const parsed = new URL(github);
    if (
      parsed.protocol !== 'https:' ||
      !['github.com', 'www.github.com'].includes(parsed.hostname.toLowerCase()) ||
      parsed.pathname.split('/').filter(Boolean).length !== 1
    ) {
      throw new Error();
    }
    return null;
  } catch {
    return 'GitHub profile must be a https://github.com/<username> URL.';
  }
}

function validatePassword(form: PasswordForm): string | null {
  if (!form.current) {
    return 'Enter your current password.';
  }
  if (form.next.length < 10) {
    return 'New password must be at least 10 characters long.';
  }
  if (!/[A-Z]/.test(form.next) || !/[a-z]/.test(form.next) || !/[0-9]/.test(form.next)) {
    return 'New password must mix uppercase, lowercase, and numeric characters.';
  }
  if (form.next !== form.confirm) {
    return 'New password and confirmation do not match.';
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ProfileApiError) {
    return error.backendMessage || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  );
}

function roleDescription(role: string): string {
  if (role === 'ADMIN') {
    return 'Admin — full platform control';
  }
  if (role === 'MODERATOR') {
    return 'Moderator — content and API review';
  }
  return 'Member — build and publish APIs';
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function githubHandle(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts.length > 0 ? `@${parts[0]}` : safeHost(url);
  } catch {
    return url;
  }
}

export const ProfilePage: React.FC = () => {
  const {
    user: profile,
    isLoading: isAuthLoading,
    updatePersonalInfo,
    uploadProfileAvatar,
    removeProfileAvatar: removeAvatarRemote,
    changeProfilePassword,
    updateProfilePreferences,
    refreshProfile,
    deactivateAccount,
  } = useAuth();

  const [showSettings, setShowSettings] = useState(false);
  const [section, setSection] = useState<ProfileSection>('general');

  /* Identity — per-field inline editing via the pencil affordances. */
  const [form, setForm] = useState<ProfileForm>(() => (profile ? toForm(profile) : EMPTY_FORM));
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [editDraft, setEditDraft] = useState<ProfileForm>(() =>
    profile ? toForm(profile) : EMPTY_FORM,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  /* About details */
  const [skillDraft, setSkillDraft] = useState('');
  const [showSkillEditor, setShowSkillEditor] = useState(false);
  const [detailEditor, setDetailEditor] = useState<ProfileDetailDraft | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  /* Avatar */
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Password */
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current: '',
    next: '',
    confirm: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  /* Preferences */
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    normalizePreferences(profile?.preferences),
  );
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  /* Account deactivation */
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

  /* API keys */
  const [apiKeys, setApiKeys] = useState<ManagedApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [createKeyError, setCreateKeyError] = useState<string | null>(null);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ManagedApiKey | null>(null);
  const [isRevokingKey, setIsRevokingKey] = useState(false);

  /* Security sessions */
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  /* Two-factor (TOTP) */
  const [totpOpen, setTotpOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isTotpBusy, setIsTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpDisableOpen, setTotpDisableOpen] = useState(false);
  const [totpDisablePassword, setTotpDisablePassword] = useState('');
  const [isDisablingTotp, setIsDisablingTotp] = useState(false);

  /* Projects & contributions */
  const [projects, setProjects] = useState<ProviderProject[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && editingField === null) {
      setForm(toForm(profile));
    }
  }, [profile, editingField]);

  useEffect(() => {
    if (profile?.preferences) {
      setPreferences(normalizePreferences(profile.preferences));
    }
  }, [profile?.preferences]);

  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = setTimeout(() => setSuccess(null), 4200);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!avatarSuccess) {
      return;
    }
    const timer = setTimeout(() => setAvatarSuccess(null), 4200);
    return () => clearTimeout(timer);
  }, [avatarSuccess]);

  useEffect(() => {
    if (section !== 'connections') {
      return;
    }
    let cancelled = false;
    setIsLoadingKeys(true);
    setKeysError(null);
    profileApi
      .listApiKeys()
      .then(({ apiKeys: keys }) => {
        if (!cancelled) {
          setApiKeys(keys);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setKeysError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingKeys(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  useEffect(() => {
    if (section !== 'security') {
      return;
    }
    let cancelled = false;
    setIsLoadingSecurity(true);
    setSecurityError(null);
    profileApi
      .listSecuritySessions()
      .then(({ sessions: list }) => {
        if (!cancelled) {
          setSessions(list);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSecurityError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSecurity(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const list = await apiBuildService.list();
      setProjects(list);
      const results = await Promise.allSettled(
        list.slice(0, 12).map(async (project) => ({
          project,
          activity: await apiBuildService.listActivity<ActivityEntry>(project.id),
        })),
      );
      const feed: Contribution[] = [];
      for (const result of results) {
        if (result.status !== 'fulfilled') {
          continue;
        }
        const { project, activity } = result.value;
        for (const entry of activity) {
          feed.push({ ...entry, projectId: project.id, projectName: project.name });
        }
      }
      feed.sort((a, b) => (new Date(b.at).getTime() || 0) - (new Date(a.at).getTime() || 0));
      setContributions(feed);
    } catch (error) {
      setProjectsError(getErrorMessage(error));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const achievements = useMemo(() => {
    if (!profile) {
      return [];
    }
    return buildAchievements({
      emailVerified: !!profile.email_verified_at,
      twoFactorEnabled: !!profile.two_factor_enabled,
      projects: projects.length,
      published: projects.filter(
        (project) =>
          project.published || project.status === 'published' || project.status === 'healthy',
      ).length,
      consumers: projects.reduce((total, project) => total + project.consumers, 0),
      contributions: contributions.length,
      avgSuccessRate: projects.length
        ? projects.reduce((total, project) => total + (project.successRate || 0), 0) /
          projects.length
        : 0,
      memberSince: profile.created_at ? new Date(profile.created_at) : new Date(),
      completeness: [
        !!profile.avatar_url,
        !!profile.bio,
        !!profile.company,
        !!profile.website,
        !!profile.github_url,
      ].filter(Boolean).length,
    });
  }, [profile, projects, contributions]);

  const beginEdit = (field: FieldKey) => {
    setEditDraft({ ...form });
    setEditingField(field);
    setFieldError(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditDraft({ ...form });
    setFieldError(null);
  };

  const patchDraft = (patch: Partial<ProfileForm>) => {
    setEditDraft((current) => ({ ...current, ...patch }));
    setFieldError(null);
  };

  const saveField = async (field: FieldKey) => {
    const error = validateField(field, editDraft);
    if (error) {
      setFieldError(error);
      return;
    }
    setIsSaving(true);
    setFieldError(null);
    setSuccess(null);
    try {
      const payload: UpdateProfileInput = {
        name: `${editDraft.firstName.trim()} ${editDraft.lastName.trim()}`,
        company: editDraft.company.trim() || null,
        bio: editDraft.bio.trim() || null,
        website: editDraft.website.trim() || null,
        first_name: editDraft.firstName.trim(),
        last_name: editDraft.lastName.trim(),
        handle: editDraft.handle.trim(),
        job_title: editDraft.jobTitle.trim(),
        github_url: editDraft.githubUrl.trim(),
      };
      const result = await updatePersonalInfo(payload);
      setForm(toForm(result.user));
      setEditingField(null);
      setSuccess(result.message || 'Profile updated.');
    } catch (saveError) {
      setFieldError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfileDetails = async (
    patch: Pick<UpdateProfileInput, 'skills' | 'experience' | 'education'>,
  ) => {
    if (!profile) {
      return false;
    }
    setIsSavingDetails(true);
    setDetailsError(null);
    setSuccess(null);
    try {
      const result = await updatePersonalInfo(patch);
      setForm(toForm(result.user));
      setSuccess(result.message || 'Profile updated.');
      return true;
    } catch (error) {
      setDetailsError(getErrorMessage(error));
      return false;
    } finally {
      setIsSavingDetails(false);
    }
  };

  const addSkill = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) {
      return;
    }
    const skill = skillDraft.trim();
    if (!skill) {
      setDetailsError('Enter a skill to add.');
      return;
    }
    if (profile.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setDetailsError('That skill is already on your profile.');
      return;
    }
    if (await saveProfileDetails({ skills: [...profile.skills, skill] })) {
      setSkillDraft('');
      setShowSkillEditor(false);
    }
  };

  const removeSkill = (skill: string) => {
    if (profile) {
      void saveProfileDetails({ skills: profile.skills.filter((item) => item !== skill) });
    }
  };

  const openDetailEditor = (kind: ProfileDetailKind, index: number | null = null) => {
    if (index === null) {
      setDetailEditor(emptyDetailDraft(kind));
    } else {
      if (kind === 'experience') {
        const entry = profile?.experience[index];
        if (!entry) return;
        setDetailEditor({ kind, index, primary: entry.title, secondary: entry.company, startDate: entry.start_date, endDate: entry.end_date || '', isCurrent: entry.is_current, description: entry.description || '' });
      } else {
        const entry = profile?.education[index];
        if (!entry) return;
        setDetailEditor({ kind, index, primary: entry.institution, secondary: entry.program, startDate: entry.start_date, endDate: entry.end_date || '', isCurrent: entry.is_current, description: entry.description || '' });
      }
    }
    setDetailsError(null);
  };

  const saveDetail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !detailEditor) {
      return;
    }
    const primary = detailEditor.primary.trim();
    const secondary = detailEditor.secondary.trim();
    const startDate = detailEditor.startDate;
    const endDate = detailEditor.isCurrent ? null : detailEditor.endDate || null;
    if (!primary || !secondary || !startDate || (!detailEditor.isCurrent && !endDate)) {
      setDetailsError('Complete the required fields, including an end date for non-current entries.');
      return;
    }
    if (endDate && endDate < startDate) {
      setDetailsError('End date cannot be before the start date.');
      return;
    }

    if (detailEditor.kind === 'experience') {
      const entry: ProfileExperience = {
        title: primary,
        company: secondary,
        start_date: startDate,
        end_date: endDate,
        is_current: detailEditor.isCurrent,
        description: detailEditor.description.trim() || null,
      };
      const experience = [...profile.experience];
      if (detailEditor.index === null) experience.push(entry);
      else experience[detailEditor.index] = entry;
      if (await saveProfileDetails({ experience })) setDetailEditor(null);
      return;
    }

    const entry: ProfileEducation = {
      institution: primary,
      program: secondary,
      start_date: startDate,
      end_date: endDate,
      is_current: detailEditor.isCurrent,
      description: detailEditor.description.trim() || null,
    };
    const education = [...profile.education];
    if (detailEditor.index === null) education.push(entry);
    else education[detailEditor.index] = entry;
    if (await saveProfileDetails({ education })) setDetailEditor(null);
  };

  const deleteDetail = (kind: ProfileDetailKind, index: number) => {
    if (!profile || !window.confirm(`Delete this ${kind} entry?`)) {
      return;
    }
    if (kind === 'experience') {
      void saveProfileDetails({ experience: profile.experience.filter((_, itemIndex) => itemIndex !== index) });
    } else {
      void saveProfileDetails({ education: profile.education.filter((_, itemIndex) => itemIndex !== index) });
    }
  };

  const selectAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setAvatarError(null);
    setAvatarSuccess(null);
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Avatar must be a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError('Avatar must be 3 MB or smaller.');
      return;
    }
    void (async () => {
      setIsAvatarSaving(true);
      try {
        const result = await uploadProfileAvatar(file);
        setAvatarSuccess(result.message || 'Profile photo updated.');
      } catch (uploadError) {
        setAvatarError(getErrorMessage(uploadError));
      } finally {
        setIsAvatarSaving(false);
      }
    })();
  };

  const removeAvatar = async () => {
    if (!window.confirm('Remove your profile photo?')) {
      return;
    }
    setIsAvatarSaving(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const result = await removeAvatarRemote();
      setAvatarSuccess(result.message || 'Profile photo removed.');
    } catch (error) {
      setAvatarError(getErrorMessage(error));
    } finally {
      setIsAvatarSaving(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validatePassword(passwordForm);
    if (error) {
      setPasswordError(error);
      return;
    }
    setIsPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const result = await changeProfilePassword(passwordForm.current, passwordForm.next);
      setPasswordSuccess(result.message || 'Password changed successfully.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (changeError) {
      setPasswordError(getErrorMessage(changeError));
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const updatePreferences = (patch: Partial<UserPreferences>) =>
    setPreferences((current) => ({ ...current, ...patch }));

  const hasUnsavedPreferenceChanges = useMemo(
    () =>
      profile
        ? JSON.stringify(preferences) !== JSON.stringify(normalizePreferences(profile.preferences))
        : false,
    [preferences, profile],
  );

  const resetPreferences = () => {
    setPreferences(normalizePreferences(profile?.preferences));
    setPreferencesError(null);
  };

  const savePreferences = async () => {
    setIsSavingPreferences(true);
    setPreferencesError(null);
    try {
      const payload: UpdatePreferencesInput = JSON.parse(
        JSON.stringify(preferences),
      ) as UpdatePreferencesInput;
      await updateProfilePreferences(payload);
    } catch (error) {
      setPreferencesError(getErrorMessage(error));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const confirmDeactivation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deactivatePassword) {
      setDeactivationError('Enter your password to confirm.');
      return;
    }
    setIsDeactivating(true);
    setDeactivationError(null);
    try {
      await deactivateAccount(deactivatePassword);
    } catch (error) {
      setDeactivationError(getErrorMessage(error));
      setIsDeactivating(false);
    }
  };

  const submitCreateKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newKeyName.trim()) {
      setCreateKeyError('Give this key a memorable name.');
      return;
    }
    setIsCreatingKey(true);
    setCreateKeyError(null);
    try {
      const result = await profileApi.createApiKey(newKeyName.trim());
      setApiKeys((current) => [result.apiKey, ...current]);
      setOneTimeSecret(result.secret);
      setCopiedSecret(false);
      setNewKeyName('');
    } catch (error) {
      setCreateKeyError(getErrorMessage(error));
    } finally {
      setIsCreatingKey(false);
    }
  };

  const confirmRevokeKey = async () => {
    if (!revokeTarget) {
      return;
    }
    setIsRevokingKey(true);
    try {
      const result = await profileApi.revokeApiKey(revokeTarget.id);
      setApiKeys((current) =>
        current.map((key) => (key.id === revokeTarget.id ? result.apiKey : key)),
      );
      setRevokeTarget(null);
    } catch (error) {
      setKeysError(getErrorMessage(error));
      setRevokeTarget(null);
    } finally {
      setIsRevokingKey(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    setSecurityError(null);
    try {
      const result = await profileApi.revokeSecuritySession(sessionId);
      if (result.revokedCurrent) {
        return; // Session revoked; the app will sign out on the next request.
      }
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (error) {
      setSecurityError(getErrorMessage(error));
    } finally {
      setRevokingSessionId(null);
    }
  };

  const revokeOtherSessions = async () => {
    setIsLoadingSecurity(true);
    setSecurityError(null);
    try {
      await profileApi.revokeOtherSecuritySessions();
      const { sessions: list } = await profileApi.listSecuritySessions();
      setSessions(list);
    } catch (error) {
      setSecurityError(getErrorMessage(error));
    } finally {
      setIsLoadingSecurity(false);
    }
  };

  const startTotpSetup = async () => {
    setIsTotpBusy(true);
    setTotpError(null);
    try {
      const result = await profileApi.startTotpSetup();
      setTotpSecret(result.secret);
      setTotpUri(result.qrCodeDataUrl);
      setTotpCode('');
      setTotpOpen(true);
    } catch (error) {
      setTotpError(getErrorMessage(error));
    } finally {
      setIsTotpBusy(false);
    }
  };

  const confirmTotpSetup = async (code?: string) => {
    const value = (code ?? totpCode).trim();
    if (value.length !== 6) {
      setTotpError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setIsTotpBusy(true);
    setTotpError(null);
    try {
      await profileApi.confirmTotpSetup(value);
      setTotpOpen(false);
      setTotpSecret('');
      setTotpUri('');
      setTotpCode('');
      await refreshProfile();
    } catch (error) {
      setTotpError(getErrorMessage(error));
    } finally {
      setIsTotpBusy(false);
    }
  };

  const disableTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!totpDisablePassword || totpCode.trim().length !== 6) {
      setTotpError('Enter your password and the current 6-digit code to disable 2FA.');
      return;
    }
    setIsDisablingTotp(true);
    setTotpError(null);
    try {
      await profileApi.disableTotp(totpDisablePassword, totpCode.trim());
      setTotpDisableOpen(false);
      setTotpDisablePassword('');
      setTotpCode('');
      await refreshProfile();
    } catch (error) {
      setTotpError(getErrorMessage(error));
    } finally {
      setIsDisablingTotp(false);
    }
  };

  const copyOneTimeSecret = async () => {
    if (!oneTimeSecret) {
      return;
    }
    try {
      await navigator.clipboard.writeText(oneTimeSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2400);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (isAuthLoading && !profile) {
    return (
      <div className="profile-state">
        <Loader2 className="profile-spinner" size={20} /> Loading your profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-state">
        <Lock size={18} /> Sign in to view and manage your profile.
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-header-top">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-xl">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={`${profile.name} avatar`} />
              ) : (
                <span>{initials(profile.name)}</span>
              )}
              {isAvatarSaving && (
                <span className="profile-avatar-busy">
                  <Loader2 className="profile-spinner" size={18} />
                </span>
              )}
            </div>
            <button
              type="button"
              className="profile-avatar-fab"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAvatarSaving}
              aria-label="Change profile photo"
              title="Change profile photo"
            >
              <Camera size={14} />
            </button>
            {profile.avatar_url && (
              <button
                type="button"
                className="profile-avatar-fab remove"
                onClick={() => void removeAvatar()}
                disabled={isAvatarSaving}
                aria-label="Remove profile photo"
                title="Remove profile photo"
              >
                <Trash2 size={14} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={selectAvatar}
            />
          </div>

          <div className="profile-identity">
            <div className="profile-name-line">
              <h1>{profile.name}</h1>
              {profile.email_verified_at ? (
                <span className="profile-verified" title="Email verified">
                  <BadgeCheck size={17} />
                </span>
              ) : null}
              <span className="profile-role-chip">
                {profile.role === 'ADMIN'
                  ? 'Admin'
                  : profile.role === 'MODERATOR'
                  ? 'Moderator'
                  : 'Member'}
              </span>
            </div>
            <p className="profile-handle-line">
              {profile.handle ? <span>@{profile.handle}</span> : null}
              {profile.handle && profile.job_title ? <span className="feed-dot">·</span> : null}
              {profile.job_title ? (
                <span>
                  <span className="profile-meta-label">Job title</span> {profile.job_title}
                </span>
              ) : null}
            </p>
            <p className="profile-bio-line">
              {profile.bio || 'No bio yet — add one from Settings.'}
            </p>
            <div className="profile-meta-row">
              {profile.company ? (
                <span className="profile-meta-chip">
                  <Building2 size={13} /> {profile.company}
                </span>
              ) : null}
              {profile.website ? (
                <a
                  className="profile-meta-chip link"
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe2 size={13} /> {safeHost(profile.website)}
                </a>
              ) : null}
              {profile.github_url ? (
                <a
                  className="profile-meta-chip link"
                  href={profile.github_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github size={13} /> {githubHandle(profile.github_url)}
                </a>
              ) : null}
              <span className="profile-meta-chip">
                <CalendarDays size={13} /> Joined {formatDate(profile.created_at)}
              </span>
            </div>
          </div>

          <div className="profile-header-actions">
            <button
              type="button"
              className="profile-icon-btn"
              onClick={() => setShowSettings(true)}
              aria-label="Profile settings"
              title="Profile settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {(avatarError || avatarSuccess) && (
          <p className={`profile-avatar-status ${avatarError ? 'error' : 'success'}`}>
            {avatarError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{' '}
            {avatarError || avatarSuccess}
          </p>
        )}

      </header>

      {detailEditor && (
        <div className="profile-modal" role="presentation" onMouseDown={() => !isSavingDetails && setDetailEditor(null)}>
          <section className="profile-modal-card profile-detail-modal" role="dialog" aria-modal="true" aria-labelledby="profile-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="profile-modal-header">
              <div>
                <h2 id="profile-detail-title">{detailEditor.index === null ? 'Add' : 'Edit'} {detailEditor.kind}</h2>
                <p className="profile-modal-copy">Add the details displayed on your profile.</p>
              </div>
              <button type="button" className="profile-modal-close" onClick={() => setDetailEditor(null)} disabled={isSavingDetails} aria-label="Close"><X size={17} /></button>
            </header>
            <form onSubmit={saveDetail}>
              {detailsError ? <div className="profile-message error"><AlertCircle size={16} /> {detailsError}</div> : null}
              <div className="profile-detail-form">
                <label><span>{detailEditor.kind === 'experience' ? 'Title' : 'Institution'}</span><input className="profile-input" value={detailEditor.primary} onChange={(event) => setDetailEditor({ ...detailEditor, primary: event.target.value })} maxLength={detailEditor.kind === 'experience' ? 100 : 255} autoFocus /></label>
                <label><span>{detailEditor.kind === 'experience' ? 'Company' : 'Program / degree'}</span><input className="profile-input" value={detailEditor.secondary} onChange={(event) => setDetailEditor({ ...detailEditor, secondary: event.target.value })} maxLength={detailEditor.kind === 'experience' ? 255 : 150} /></label>
                <label><span>Start date</span><input className="profile-input" type="date" value={detailEditor.startDate} onChange={(event) => setDetailEditor({ ...detailEditor, startDate: event.target.value })} /></label>
                <label><span>End date</span><input className="profile-input" type="date" value={detailEditor.endDate} onChange={(event) => setDetailEditor({ ...detailEditor, endDate: event.target.value })} disabled={detailEditor.isCurrent} /></label>
                <label className="profile-detail-current"><input type="checkbox" checked={detailEditor.isCurrent} onChange={(event) => setDetailEditor({ ...detailEditor, isCurrent: event.target.checked, endDate: event.target.checked ? '' : detailEditor.endDate })} /> Currently {detailEditor.kind === 'experience' ? 'working here' : 'studying here'}</label>
                <label className="profile-detail-description"><span>Description <em>{detailEditor.description.length}/2000</em></span><textarea className="profile-input profile-textarea" value={detailEditor.description} onChange={(event) => setDetailEditor({ ...detailEditor, description: event.target.value })} maxLength={2000} rows={4} /></label>
              </div>
              <footer className="profile-modal-actions profile-detail-modal-actions">
                <button type="button" className="profile-secondary-btn" onClick={() => setDetailEditor(null)} disabled={isSavingDetails}>Cancel</button>
                <button type="submit" className="profile-primary-btn" disabled={isSavingDetails}>{isSavingDetails ? <Loader2 className="profile-spinner" size={15} /> : <Save size={15} />} {isSavingDetails ? 'Saving…' : 'Save'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {!showSettings ? (
        <div className="profile-overview">
          <section className="profile-card">
            <header className="profile-card-head">
              <div>
                <p className="profile-eyebrow">ABOUT</p>
                <h2>About</h2>
                <p className="profile-card-sub">
                  Profile details will appear here as they are added.
                </p>
              </div>
            </header>
            <div className="profile-about-grid">
              <section className="profile-about-item">
                <div className="profile-about-title">
                  <h3>Skills</h3>
                  <button type="button" className="profile-secondary-btn compact" onClick={() => setShowSkillEditor(true)} disabled={isSavingDetails}><Plus size={13} /> Add</button>
                </div>
                {profile.skills.length ? (
                  <div className="profile-skill-list">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="profile-skill-chip">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} disabled={isSavingDetails} aria-label={`Remove ${skill}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : <p>No skills added yet.</p>}
                {showSkillEditor ? (
                  <form className="profile-skill-add" onSubmit={addSkill}>
                    <input className="profile-input" value={skillDraft} onChange={(event) => setSkillDraft(event.target.value)} placeholder="Add a skill" maxLength={80} disabled={isSavingDetails} />
                    <button type="submit" className="profile-secondary-btn compact" disabled={isSavingDetails}><Plus size={13} /> Add</button>
                  </form>
                ) : null}
              </section>
              <section className="profile-about-item">
                <div className="profile-about-title">
                  <h3>Experience</h3>
                  <button type="button" className="profile-secondary-btn compact" onClick={() => openDetailEditor('experience')} disabled={isSavingDetails}><Plus size={13} /> Add</button>
                </div>
                {profile.experience.length ? (
                  <div className="profile-detail-list">
                    {profile.experience.map((entry, index) => (
                      <article key={`${entry.title}-${entry.company}-${entry.start_date}`} className="profile-detail-item">
                        <div><strong>{entry.title}</strong><span>{entry.company}</span></div>
                        <p>{entry.start_date} — {entry.is_current ? 'Present' : entry.end_date}</p>
                        <div className="profile-detail-actions">
                          <button type="button" onClick={() => openDetailEditor('experience', index)} disabled={isSavingDetails} aria-label={`Edit ${entry.title}`}><Pencil size={13} /></button>
                          <button type="button" onClick={() => deleteDetail('experience', index)} disabled={isSavingDetails} aria-label={`Delete ${entry.title}`}><Trash2 size={13} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <p>No experience added yet.</p>}
              </section>
              <section className="profile-about-item">
                <div className="profile-about-title">
                  <h3>Education</h3>
                  <button type="button" className="profile-secondary-btn compact" onClick={() => openDetailEditor('education')} disabled={isSavingDetails}><Plus size={13} /> Add</button>
                </div>
                {profile.education.length ? (
                  <div className="profile-detail-list">
                    {profile.education.map((entry, index) => (
                      <article key={`${entry.institution}-${entry.program}-${entry.start_date}`} className="profile-detail-item">
                        <div><strong>{entry.institution}</strong><span>{entry.program}</span></div>
                        <p>{entry.start_date} — {entry.is_current ? 'Present' : entry.end_date}</p>
                        <div className="profile-detail-actions">
                          <button type="button" onClick={() => openDetailEditor('education', index)} disabled={isSavingDetails} aria-label={`Edit ${entry.institution}`}><Pencil size={13} /></button>
                          <button type="button" onClick={() => deleteDetail('education', index)} disabled={isSavingDetails} aria-label={`Delete ${entry.institution}`}><Trash2 size={13} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <p>No education added yet.</p>}
              </section>
            </div>
            {detailsError ? <div className="profile-message error profile-about-message"><AlertCircle size={16} /> {detailsError}</div> : null}
          </section>

          <section className="profile-card">
            <header className="profile-card-head">
              <div>
                <p className="profile-eyebrow">ACHIEVEMENTS</p>
                <h2>Achievements</h2>
                <p className="profile-card-sub">Milestones currently recognized in Klyra.</p>
              </div>
            </header>
            <StickerGrid achievements={achievements} />
          </section>

          <section className="profile-card">
            <header className="profile-card-head">
              <div>
                <p className="profile-eyebrow">PROJECTS</p>
                <h2>Projects</h2>
                <p className="profile-card-sub">
                  API projects available in the current workspace.
                </p>
              </div>
            </header>
            <ProjectsList
              projects={projects}
              loading={projectsLoading}
              error={projectsError}
              onRetry={() => void loadProjects()}
            />
          </section>
          <section className="profile-card">
            <header className="profile-card-head">
              <div>
                <p className="profile-eyebrow">ACTIVITY</p>
                <h2>Activity</h2>
                <p className="profile-card-sub">
                  Recent events from available API Build projects.
                </p>
              </div>
            </header>
            <ContributionGraph contributions={contributions} loading={projectsLoading} />
            <div className="profile-activity-feed">
              <ContributionsFeed contributions={contributions} loading={projectsLoading} />
            </div>
          </section>
        </div>
      ) : (
        <div className="profile-settings-view">
          <div className="profile-settings-toolbar">
            <button
              type="button"
              className="profile-secondary-btn compact"
              onClick={() => setShowSettings(false)}
            >
              Back to profile
            </button>
          </div>
          <div className="settings-layout">
            <nav className="profile-nav" aria-label="Settings sections">
            {SECTIONS.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                className={section === id ? 'active' : ''}
                onClick={() => setSection(id)}
                aria-current={section === id ? 'true' : undefined}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
            </nav>
            <div className="profile-panel">
            {section === 'general' ? (
              <>
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-eyebrow">PROFILE</p>
                    <h2 id="profile-section-title">General & Personal Info</h2>
                    <p>
                      Click the edit icon on any row to update it — each change saves individually.
                    </p>
                  </div>
                </header>
                {success ? (
                  <div className="profile-message success">
                    <CheckCircle2 size={16} /> {success}
                  </div>
                ) : null}
                <div className="profile-rows">
                  <EditableRow
                    icon={<UserRound size={16} />}
                    label="Full name"
                    editing={editingField === 'name'}
                    busy={isSaving}
                    error={editingField === 'name' ? fieldError : null}
                    onEdit={() => beginEdit('name')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('name')}
                    value={
                      <span>
                        {profile.first_name} {profile.last_name}
                      </span>
                    }
                  >
                    <div className="profile-field-pair">
                      <input
                        className="profile-input"
                        value={editDraft.firstName}
                        onChange={(event) => patchDraft({ firstName: event.target.value })}
                        placeholder="First name"
                        maxLength={50}
                        autoFocus
                      />
                      <input
                        className="profile-input"
                        value={editDraft.lastName}
                        onChange={(event) => patchDraft({ lastName: event.target.value })}
                        placeholder="Last name"
                        maxLength={50}
                      />
                    </div>
                  </EditableRow>

                  <EditableRow
                    icon={<AtSign size={16} />}
                    label="Username"
                    hint="how teammates find you"
                    editing={editingField === 'handle'}
                    busy={isSaving}
                    error={editingField === 'handle' ? fieldError : null}
                    onEdit={() => beginEdit('handle')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('handle')}
                    value={
                      profile.handle ? (
                        <span>@{profile.handle}</span>
                      ) : (
                        <span className="profile-value-empty">Not set</span>
                      )
                    }
                  >
                    <input
                      className="profile-input"
                      value={editDraft.handle}
                      onChange={(event) => patchDraft({ handle: event.target.value })}
                      placeholder="e.g. ada_lovelace"
                      maxLength={30}
                      autoFocus
                    />
                  </EditableRow>

                  <EditableRow
                    icon={<Briefcase size={16} />}
                    label="Job title"
                    editing={editingField === 'jobTitle'}
                    busy={isSaving}
                    error={editingField === 'jobTitle' ? fieldError : null}
                    onEdit={() => beginEdit('jobTitle')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('jobTitle')}
                    value={
                      profile.job_title ? (
                        <span>{profile.job_title}</span>
                      ) : (
                        <span className="profile-value-empty">Not set</span>
                      )
                    }
                  >
                    <input
                      className="profile-input"
                      value={editDraft.jobTitle}
                      onChange={(event) => patchDraft({ jobTitle: event.target.value })}
                      placeholder="e.g. Platform Engineer"
                      maxLength={100}
                      autoFocus
                    />
                  </EditableRow>

                  <EditableRow
                    icon={<Building2 size={16} />}
                    label="Organization"
                    editing={editingField === 'company'}
                    busy={isSaving}
                    error={editingField === 'company' ? fieldError : null}
                    onEdit={() => beginEdit('company')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('company')}
                    value={
                      profile.company ? (
                        <span>{profile.company}</span>
                      ) : (
                        <span className="profile-value-empty">Not set</span>
                      )
                    }
                  >
                    <input
                      className="profile-input"
                      value={editDraft.company}
                      onChange={(event) => patchDraft({ company: event.target.value })}
                      placeholder="Where do you work?"
                      maxLength={255}
                      autoFocus
                    />
                  </EditableRow>

                  <EditableRow
                    icon={<Globe2 size={16} />}
                    label="Website"
                    hint="https only"
                    editing={editingField === 'website'}
                    busy={isSaving}
                    error={editingField === 'website' ? fieldError : null}
                    onEdit={() => beginEdit('website')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('website')}
                    value={
                      profile.website ? (
                        <a href={profile.website} target="_blank" rel="noreferrer">
                          {safeHost(profile.website)}
                        </a>
                      ) : (
                        <span className="profile-value-empty">Not set</span>
                      )
                    }
                  >
                    <input
                      className="profile-input"
                      value={editDraft.website}
                      onChange={(event) => patchDraft({ website: event.target.value })}
                      placeholder="https://yoursite.dev"
                      autoFocus
                    />
                  </EditableRow>

                  <EditableRow
                    icon={<Github size={16} />}
                    label="GitHub"
                    editing={editingField === 'githubUrl'}
                    busy={isSaving}
                    error={editingField === 'githubUrl' ? fieldError : null}
                    onEdit={() => beginEdit('githubUrl')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('githubUrl')}
                    value={
                      profile.github_url ? (
                        <a href={profile.github_url} target="_blank" rel="noreferrer">
                          {profile.github_url.replace(/^https?:\/\/(www\.)?github\.com\//i, '@')}
                        </a>
                      ) : (
                        <span className="profile-value-empty">Not set</span>
                      )
                    }
                  >
                    <input
                      className="profile-input"
                      value={editDraft.githubUrl}
                      onChange={(event) => patchDraft({ githubUrl: event.target.value })}
                      placeholder="https://github.com/username"
                      autoFocus
                    />
                  </EditableRow>

                  <EditableRow
                    icon={<AlignLeft size={16} />}
                    label="Bio"
                    hint={`${editDraft.bio.length}/250`}
                    editing={editingField === 'bio'}
                    busy={isSaving}
                    error={editingField === 'bio' ? fieldError : null}
                    onEdit={() => beginEdit('bio')}
                    onCancel={cancelEdit}
                    onSave={() => void saveField('bio')}
                    value={
                      profile.bio ? (
                        <span>{profile.bio}</span>
                      ) : (
                        <span className="profile-value-empty">Not set</span>
                      )
                    }
                  >
                    <textarea
                      className="profile-input profile-textarea"
                      value={editDraft.bio}
                      onChange={(event) => patchDraft({ bio: event.target.value })}
                      placeholder="Tell the marketplace what you build."
                      maxLength={250}
                      rows={3}
                      autoFocus
                    />
                  </EditableRow>

                  <EditableRow
                    icon={<Mail size={16} />}
                    label="Email"
                    readOnly
                    readOnlyNote="Contact support to change the email on your account."
                    editing={false}
                    onEdit={() => undefined}
                    onCancel={() => undefined}
                    onSave={() => undefined}
                    value={
                      <span>
                        {profile.email}
                        {profile.email_verified_at ? (
                          <em className="profile-value-note">verified</em>
                        ) : (
                          <em className="profile-value-note pending">unverified</em>
                        )}
                      </span>
                    }
                  />
                </div>
              </>
            ) : section === 'security' ? (
              <>
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-eyebrow">SECURITY</p>
                    <h2 id="profile-section-title">Security & Access</h2>
                    <p>Password, two-factor authentication and active sessions.</p>
                  </div>
                </header>
                {securityError ? (
                  <div className="profile-message error">
                    <AlertCircle size={16} /> {securityError}
                  </div>
                ) : null}
                {passwordSuccess ? (
                  <div className="profile-message success">
                    <CheckCircle2 size={16} /> {passwordSuccess}
                  </div>
                ) : null}

                <div className="profile-security-grid">
                  <section
                    className="profile-security-card"
                    aria-labelledby="security-password-title"
                  >
                    <header className="profile-security-head">
                      <div className="profile-security-icon">
                        <Lock size={18} />
                      </div>
                      <h3 id="security-password-title">Password</h3>
                    </header>
                    <form className="profile-form" onSubmit={(event) => void submitPassword(event)}>
                      <label className="profile-field">
                        <span>Current password</span>
                        <span className="profile-input-wrap">
                          <input
                            className="profile-input"
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={passwordForm.current}
                            onChange={(event) =>
                              setPasswordForm((current) => ({
                                ...current,
                                current: event.target.value,
                              }))
                            }
                            placeholder="Current password"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="profile-input-toggle"
                            onClick={() => setShowCurrentPassword((current) => !current)}
                            aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                          >
                            {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </span>
                      </label>
                      <label className="profile-field">
                        <span>New password</span>
                        <span className="profile-input-wrap">
                          <input
                            className="profile-input"
                            type={showNewPassword ? 'text' : 'password'}
                            value={passwordForm.next}
                            onChange={(event) =>
                              setPasswordForm((current) => ({
                                ...current,
                                next: event.target.value,
                              }))
                            }
                            placeholder="At least 10 characters"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="profile-input-toggle"
                            onClick={() => setShowNewPassword((current) => !current)}
                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </span>
                      </label>
                      <label className="profile-field">
                        <span>Confirm new password</span>
                        <input
                          className="profile-input"
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordForm.confirm}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              confirm: event.target.value,
                            }))
                          }
                          placeholder="Re-enter the new password"
                          autoComplete="new-password"
                        />
                      </label>
                      {passwordError ? (
                        <p className="profile-form-error">
                          <AlertCircle size={14} /> {passwordError}
                        </p>
                      ) : null}
                      <div className="profile-form-actions">
                        <button
                          type="submit"
                          className="profile-primary-btn"
                          disabled={isPasswordSaving}
                        >
                          {isPasswordSaving ? (
                            <Loader2 className="profile-spinner" size={16} />
                          ) : (
                            <Save size={16} />
                          )}
                          {isPasswordSaving ? 'Saving…' : 'Update password'}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="profile-security-card" aria-labelledby="security-2fa-title">
                    <header className="profile-security-head">
                      <div className="profile-security-icon">
                        <Smartphone size={18} />
                      </div>
                      <h3 id="security-2fa-title">Two-factor authentication</h3>
                    </header>
                    <p className="profile-security-desc">
                      Protects your account with a one-time code from an authenticator app on top of
                      your password.
                    </p>
                    <div className="profile-2fa-status">
                      <span className={profile.two_factor_enabled ? 'on' : 'off'}>
                        {profile.two_factor_enabled ? (
                          <ShieldCheck size={16} />
                        ) : (
                          <ShieldOff size={16} />
                        )}
                        {profile.two_factor_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {profile.two_factor_enabled ? (
                      <div className="profile-2fa-actions">
                        <button
                          type="button"
                          className="profile-secondary-btn"
                          onClick={() => setTotpDisableOpen((current) => !current)}
                          disabled={isDisablingTotp}
                        >
                          {isDisablingTotp ? (
                            <Loader2 className="profile-spinner" size={15} />
                          ) : (
                            <ShieldOff size={15} />
                          )}
                          Disable 2FA
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="profile-primary-btn"
                        onClick={() => void startTotpSetup()}
                        disabled={isTotpBusy}
                      >
                        {isTotpBusy ? (
                          <Loader2 className="profile-spinner" size={15} />
                        ) : (
                          <Smartphone size={15} />
                        )}
                        Enable 2FA
                      </button>
                    )}
                    {totpDisableOpen && (
                      <form
                        className="profile-inline-form"
                        onSubmit={(event) => void disableTwoFactor(event)}
                      >
                        <input
                          className="profile-input"
                          type="password"
                          value={totpDisablePassword}
                          onChange={(event) => setTotpDisablePassword(event.target.value)}
                          placeholder="Current password"
                          autoComplete="current-password"
                        />
                        <input
                          className="profile-input"
                          value={totpCode}
                          onChange={(event) =>
                            setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="6-digit code"
                          inputMode="numeric"
                        />
                        {totpError ? (
                          <p className="profile-form-error">
                            <AlertCircle size={14} /> {totpError}
                          </p>
                        ) : null}
                        <div className="profile-form-actions">
                          <button
                            type="button"
                            className="profile-secondary-btn"
                            onClick={() => {
                              setTotpDisableOpen(false);
                              setTotpDisablePassword('');
                              setTotpCode('');
                              setTotpError(null);
                            }}
                            disabled={isDisablingTotp}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="profile-danger-btn"
                            disabled={isDisablingTotp}
                          >
                            {isDisablingTotp ? (
                              <Loader2 className="profile-spinner" size={15} />
                            ) : (
                              <ShieldOff size={15} />
                            )}
                            Confirm disable
                          </button>
                        </div>
                      </form>
                    )}
                  </section>

                  <section
                    className="profile-security-card sessions"
                    aria-labelledby="security-sessions-title"
                  >
                    <header className="profile-security-head">
                      <div className="profile-security-icon">
                        <Monitor size={18} />
                      </div>
                      <h3 id="security-sessions-title">Active sessions</h3>
                      <button
                        type="button"
                        className="profile-secondary-btn"
                        onClick={() => void revokeOtherSessions()}
                        disabled={isLoadingSecurity}
                      >
                        {isLoadingSecurity ? (
                          <Loader2 className="profile-spinner" size={14} />
                        ) : (
                          <LogOut size={14} />
                        )}
                        Sign out others
                      </button>
                    </header>
                    {isLoadingSecurity && sessions.length === 0 ? (
                      <div className="profile-security-loading">
                        <Loader2 className="profile-spinner" size={16} /> Loading sessions…
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="profile-security-empty">No active sessions found.</p>
                    ) : (
                      <div className="session-list">
                        {sessions.map((session) => (
                          <div key={session.id} className="session-row">
                            <span
                              className={`session-badge${session.is_current ? ' is-current' : ''}`}
                            >
                              {session.is_current ? <Chrome size={16} /> : <Monitor size={16} />}
                            </span>
                            <div className="session-copy">
                              <p className="session-name">
                                {session.device || session.browser || 'Device'}
                                {session.is_current ? (
                                  <em className="profile-value-note">this device</em>
                                ) : null}
                              </p>
                              <p className="session-meta">
                                {[session.browser, session.os, session.ip]
                                  .filter(Boolean)
                                  .join(' · ') || 'Unknown client'}
                                <span className="feed-dot">·</span>
                                Last active {formatDateTime(session.last_active_at)}
                              </p>
                            </div>
                            {!session.is_current && (
                              <button
                                type="button"
                                className="profile-secondary-btn compact"
                                onClick={() => void revokeSession(session.id)}
                                disabled={revokingSessionId === session.id}
                              >
                                {revokingSessionId === session.id ? (
                                  <Loader2 className="profile-spinner" size={14} />
                                ) : (
                                  <X size={14} />
                                )}
                                Revoke
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : section === 'preferences' ? (
              <form className="profile-preferences" onSubmit={(event) => event.preventDefault()}>
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-eyebrow">PREFERENCES</p>
                    <h2 id="profile-section-title">Preferences & Notifications</h2>
                    <p>Personalize how Klyra looks and communicates with you.</p>
                  </div>
                </header>
                {preferencesError ? (
                  <div className="profile-message error">
                    <AlertCircle size={16} /> {preferencesError}
                  </div>
                ) : null}

                <div className="profile-preference-group">
                  <div>
                    <h3>Appearance</h3>
                    <p>Choose the interface theme.</p>
                  </div>
                  <div className="profile-segmented" role="group" aria-label="Theme">
                    <button
                      type="button"
                      className={preferences.theme === 'dark' ? 'active' : ''}
                      onClick={() => updatePreferences({ theme: 'dark' })}
                    >
                      <Moon size={15} /> Dark
                    </button>
                    <button
                      type="button"
                      className={preferences.theme === 'light' ? 'active' : ''}
                      onClick={() => updatePreferences({ theme: 'light' })}
                    >
                      <Sun size={15} /> Light
                    </button>
                    <button
                      type="button"
                      className={preferences.theme === 'system' ? 'active' : ''}
                      onClick={() => updatePreferences({ theme: 'system' })}
                    >
                      <Monitor size={15} /> System
                    </button>
                  </div>
                </div>

                <div className="profile-preference-group">
                  <div>
                    <h3>Timezone</h3>
                    <p>Used for scheduled reports and analytics windows.</p>
                  </div>
                  <select
                    className="profile-input profile-select"
                    value={preferences.timezone}
                    onChange={(event) => updatePreferences({ timezone: event.target.value })}
                    disabled={isSavingPreferences}
                  >
                    {supportedTimezones().map((zone) => (
                      <option key={zone} value={zone}>
                        {zone.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="profile-preference-group">
                  <div>
                    <h3>API defaults</h3>
                    <p>Preferred response format and code snippet language in the playground.</p>
                  </div>
                  <div className="profile-select-pair">
                    <select
                      className="profile-input profile-select"
                      value={preferences.api_response_format}
                      onChange={(event) =>
                        updatePreferences({
                          api_response_format: event.target.value as ApiResponseFormat,
                        })
                      }
                      disabled={isSavingPreferences}
                      aria-label="Default response format"
                    >
                      <option value="json">JSON</option>
                      <option value="xml">XML</option>
                    </select>
                    <select
                      className="profile-input profile-select"
                      value={preferences.code_snippet_preference}
                      onChange={(event) =>
                        updatePreferences({
                          code_snippet_preference: event.target.value as CodeSnippetPreference,
                        })
                      }
                      disabled={isSavingPreferences}
                      aria-label="Default code snippet language"
                    >
                      <option value="curl">cURL</option>
                      <option value="javascript-fetch">JavaScript · fetch</option>
                      <option value="javascript-axios">JavaScript · axios</option>
                      <option value="python">Python</option>
                      <option value="go">Go</option>
                    </select>
                  </div>
                </div>

                <div className="profile-preference-group">
                  <div>
                    <h3>Notification delivery</h3>
                    <p>
                      Changes save when you save preferences; delivery may depend on the relevant
                      Klyra service being enabled.
                    </p>
                  </div>
                  <div className="profile-toggle-list">
                    {(
                      [
                        { key: 'email', label: 'Email', Icon: Mail },
                        { key: 'push', label: 'Push', Icon: Bell },
                        { key: 'in_app', label: 'In-app', Icon: Monitor },
                      ] as const
                    ).map(({ key, label, Icon }) => (
                      <label key={key} className="profile-toggle">
                        <span>
                          <Icon size={16} />
                          <span>{label}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={preferences.notifications[key]}
                          onChange={(event) =>
                            updatePreferences({
                              notifications: {
                                ...preferences.notifications,
                                [key]: event.target.checked,
                              },
                            })
                          }
                          disabled={isSavingPreferences}
                        />
                        <i aria-hidden="true" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="profile-preference-group">
                  <div>
                    <h3>Email notification categories</h3>
                    <p>Which email alerts you want to receive.</p>
                  </div>
                  <div className="profile-toggle-list">
                    {(
                      [
                        { key: 'api_downtime_alerts', label: 'API downtime alerts' },
                        {
                          key: 'monthly_usage_quota_warnings',
                          label: 'Monthly usage quota warnings',
                        },
                        { key: 'product_announcements', label: 'Product announcements' },
                      ] as const
                    ).map(({ key, label }) => (
                      <label key={key} className="profile-toggle">
                        <span>
                          <Mail size={16} />
                          <span>{label}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={preferences.email_notifications[key]}
                          onChange={(event) =>
                            updatePreferences({
                              email_notifications: {
                                ...preferences.email_notifications,
                                [key]: event.target.checked,
                              },
                            })
                          }
                          disabled={isSavingPreferences}
                        />
                        <i aria-hidden="true" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="profile-secondary-btn"
                    onClick={resetPreferences}
                    disabled={isSavingPreferences}
                  >
                    Reset to defaults
                  </button>
                  <button
                    type="submit"
                    className="profile-primary-btn"
                    onClick={() => void savePreferences()}
                    disabled={isSavingPreferences || !hasUnsavedPreferenceChanges}
                  >
                    {isSavingPreferences ? (
                      <Loader2 className="profile-spinner" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    {isSavingPreferences
                      ? 'Saving…'
                      : hasUnsavedPreferenceChanges
                      ? 'Save Preferences'
                      : 'Preferences saved'}
                  </button>
                </div>
              </form>
            ) : section === 'connections' ? (
              <>
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-eyebrow">CONNECTIONS</p>
                    <h2 id="profile-section-title">API Keys & Connections</h2>
                    <p>
                      Personal access tokens for the Klyra API and connected third-party accounts.
                    </p>
                  </div>
                </header>
                {keysError ? (
                  <div className="profile-message error">
                    <AlertCircle size={16} /> {keysError}
                  </div>
                ) : null}

                <section className="profile-keys" aria-labelledby="api-keys-title">
                  <div className="profile-keys-head">
                    <div>
                      <h3 id="api-keys-title">
                        <KeyRound size={16} /> API keys
                      </h3>
                      <p>Keys grant access to your Klyra account via the platform API.</p>
                    </div>
                  </div>
                  <form
                    className="profile-key-create"
                    onSubmit={(event) => void submitCreateKey(event)}
                  >
                    <input
                      className="profile-input"
                      value={newKeyName}
                      onChange={(event) => {
                        setNewKeyName(event.target.value);
                        setCreateKeyError(null);
                      }}
                      placeholder="Key name, e.g. production-cli"
                      maxLength={80}
                    />
                    <button type="submit" className="profile-primary-btn" disabled={isCreatingKey}>
                      {isCreatingKey ? (
                        <Loader2 className="profile-spinner" size={15} />
                      ) : (
                        <Plus size={15} />
                      )}
                      New key
                    </button>
                    {createKeyError ? (
                      <p className="profile-form-error">
                        <AlertCircle size={14} /> {createKeyError}
                      </p>
                    ) : null}
                  </form>

                  {isLoadingKeys && apiKeys.length === 0 ? (
                    <div className="profile-security-loading">
                      <Loader2 className="profile-spinner" size={15} /> Loading keys…
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <p className="profile-security-empty">No API keys yet — create one above.</p>
                  ) : (
                    <div className="profile-api-key-list">
                      {apiKeys.map((key) => (
                        <div key={key.id} className="profile-api-key-row">
                          <span
                            className={`profile-api-key-status ${
                              key.isActive ? 'active' : 'revoked'
                            }`}
                          />
                          <div className="profile-api-key-copy">
                            <p className="profile-api-key-name">{key.name || 'Untitled key'}</p>
                            <p className="profile-api-key-meta">
                              <code>{key.keyPrefix}••••••••</code>
                              <span className="feed-dot">·</span>
                              <span>{key.isActive ? 'Active' : key.status}</span>
                              <span className="feed-dot">·</span>
                              <span>Created {formatDate(key.createdAt)}</span>
                            </p>
                          </div>
                          <div className="profile-api-key-actions">
                            {key.lastUsedAt ? (
                              <span className="profile-api-key-last">
                                Last used {formatDate(key.lastUsedAt)}
                              </span>
                            ) : null}
                            {key.isActive ? (
                              <button
                                type="button"
                                className="profile-secondary-btn compact"
                                onClick={() => setRevokeTarget(key)}
                              >
                                <Trash2 size={13} /> Revoke
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="profile-connected" aria-labelledby="connected-title">
                  <div className="profile-keys-head">
                    <div>
                      <h3 id="connected-title">
                        <Globe2 size={16} /> Connected accounts
                      </h3>
                      <p>Link external identities to enrich your public profile.</p>
                    </div>
                  </div>
                  <div className="profile-connected-grid">
                    <div className="profile-connected-card">
                      <span className="profile-connected-icon">
                        <Github size={18} />
                      </span>
                      <div>
                        <p className="profile-connected-name">GitHub</p>
                        <p className="profile-connected-meta">
                          {profile.github_url ? (
                            <a href={profile.github_url} target="_blank" rel="noreferrer">
                              {githubHandle(profile.github_url)}
                            </a>
                          ) : (
                            'Not connected'
                          )}
                        </p>
                      </div>
                      <span
                        className={`profile-connected-state ${profile.github_url ? 'linked' : ''}`}
                      >
                        {profile.github_url ? 'Linked' : '—'}
                      </span>
                    </div>
                    <div className="profile-connected-card">
                      <span className="profile-connected-icon">
                        <Chrome size={18} />
                      </span>
                      <div>
                        <p className="profile-connected-name">Browser sessions</p>
                        <p className="profile-connected-meta">Managed under Security & Access.</p>
                      </div>
                      <span className="profile-connected-state">—</span>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              /* accounts */
              <>
                <header className="profile-panel-header">
                  <div>
                    <p className="profile-eyebrow">ACCOUNT</p>
                    <h2 id="profile-section-title">Account Information</h2>
                    <p>Read-only account metadata and lifecycle availability.</p>
                  </div>
                </header>
                <div className="profile-account-grid">
                  <div className="profile-account-item">
                    <CalendarDays size={17} />
                    <div>
                      <span>Account created</span>
                      <strong>{formatDate(profile.created_at)}</strong>
                    </div>
                  </div>
                  <div className="profile-account-item">
                    <ShieldCheck size={17} />
                    <div>
                      <span>Role & permissions</span>
                      <strong>{roleDescription(profile.role)}</strong>
                    </div>
                  </div>
                  <div className="profile-account-item">
                    <KeyRound size={17} />
                    <div>
                      <span>Account ID</span>
                      <code>{profile.id}</code>
                    </div>
                  </div>
                  <div className="profile-account-item">
                    <Clock3 size={17} />
                    <div>
                      <span>Last login</span>
                      <strong>
                        {formatDateTime(profile.last_login_at)}
                        {profile.last_login_ip ? ` · ${profile.last_login_ip}` : ''}
                      </strong>
                    </div>
                  </div>
                </div>
                <section className="profile-danger-zone" aria-labelledby="deactivate-account-title">
                  <div>
                    <h3 id="deactivate-account-title">Deactivate account</h3>
                    <p>
                      Your account will be disabled and you will be signed out. Active sessions and
                      API keys will be revoked. Your existing account and data records will be
                      retained.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="profile-danger-btn"
                    onClick={() => setDeactivateOpen(true)}
                  >
                    <Trash2 size={15} /> Deactivate account
                  </button>
                </section>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {revokeTarget && (
        <div
          className="profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-key-title"
        >
          <div className="profile-modal-card">
            <div className="profile-modal-header">
              <h2 id="revoke-key-title">Revoke API key?</h2>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setRevokeTarget(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="profile-modal-copy">
              “{revokeTarget.name || 'Untitled key'}” will immediately stop working. Integrations
              using it will fail until you create and configure a replacement key.
            </p>
            <div className="profile-modal-actions">
              <button
                type="button"
                className="profile-secondary-btn"
                onClick={() => setRevokeTarget(null)}
                disabled={isRevokingKey}
              >
                Cancel
              </button>
              <button
                type="button"
                className="profile-danger-btn"
                onClick={() => void confirmRevokeKey()}
                disabled={isRevokingKey}
              >
                {isRevokingKey ? (
                  <Loader2 className="profile-spinner" size={15} />
                ) : (
                  <Trash2 size={15} />
                )}
                Revoke key
              </button>
            </div>
          </div>
        </div>
      )}

      {oneTimeSecret && (
        <div
          className="profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="secret-title"
        >
          <div className="profile-modal-card profile-secret-modal">
            <div className="profile-modal-header">
              <h2 id="secret-title">Key created</h2>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => {
                  setOneTimeSecret(null);
                  setCopiedSecret(false);
                }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <CheckCircle2 className="profile-secret-icon" size={22} />
            <p className="profile-modal-copy">
              Copy the secret now — for security it won&apos;t be shown again.
            </p>
            <code className="profile-secret-value">{oneTimeSecret}</code>
            <div className="profile-modal-actions">
              <button
                type="button"
                className="profile-primary-btn"
                onClick={() => void copyOneTimeSecret()}
              >
                {copiedSecret ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                {copiedSecret ? 'Copied' : 'Copy secret'}
              </button>
            </div>
          </div>
        </div>
      )}

      {totpOpen && (
        <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="totp-title">
          <div className="profile-modal-card profile-totp-modal">
            <div className="profile-modal-header">
              <h2 id="totp-title">Set up authenticator app</h2>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => {
                  setTotpOpen(false);
                  setTotpSecret('');
                  setTotpUri('');
                  setTotpError(null);
                }}
                disabled={isTotpBusy}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="profile-modal-copy">
              Scan the QR code with your authenticator app, then enter the 6-digit code it
              generates.
            </p>
            {totpUri ? (
              <div className="profile-totp-qr">
                <img src={totpUri} alt="QR code for your authenticator app" />
              </div>
            ) : (
              <div className="profile-state">
                <Loader2 className="profile-spinner" size={16} /> Generating…
              </div>
            )}
            {totpSecret ? <code className="profile-totp-secret">{totpSecret}</code> : null}
            <div className="profile-otp-wrap">
              <OtpInput
                value={totpCode}
                onChange={setTotpCode}
                label="Verification code"
                disabled={isTotpBusy}
                invalid={!!totpError}
              />
            </div>
            {totpError ? (
              <p className="profile-form-error">
                <AlertCircle size={14} /> {totpError}
              </p>
            ) : null}
            <div className="profile-modal-actions">
              <button
                type="button"
                className="profile-primary-btn"
                onClick={() => void confirmTotpSetup()}
                disabled={isTotpBusy || totpCode.length !== 6}
              >
                {isTotpBusy ? (
                  <Loader2 className="profile-spinner" size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateOpen && (
        <div
          className="profile-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-confirm-title"
        >
          <div className="profile-modal-card">
            <div className="profile-modal-header">
              <h2 id="deactivate-confirm-title">Deactivate your account</h2>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => {
                  setDeactivateOpen(false);
                  setDeactivationError(null);
                }}
                disabled={isDeactivating}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="profile-modal-copy">
              This permanently disables your account, signs you out everywhere and revokes all API
              keys. Enter your password to confirm.
            </p>
            <form className="profile-form" onSubmit={(event) => void confirmDeactivation(event)}>
              <label className="profile-field">
                <span>Password</span>
                <input
                  className="profile-input"
                  type="password"
                  value={deactivatePassword}
                  onChange={(event) => {
                    setDeactivatePassword(event.target.value);
                    setDeactivationError(null);
                  }}
                  placeholder="Your password"
                  autoComplete="current-password"
                />
              </label>
              {deactivationError ? (
                <p className="profile-form-error">
                  <AlertCircle size={14} /> {deactivationError}
                </p>
              ) : null}
              <div className="profile-modal-actions">
                <button
                  type="button"
                  className="profile-secondary-btn"
                  onClick={() => setDeactivateOpen(false)}
                  disabled={isDeactivating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="profile-danger-btn"
                  disabled={isDeactivating || !deactivatePassword}
                >
                  {isDeactivating ? (
                    <Loader2 className="profile-spinner" size={15} />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  {isDeactivating ? 'Deactivating…' : 'Deactivate account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
