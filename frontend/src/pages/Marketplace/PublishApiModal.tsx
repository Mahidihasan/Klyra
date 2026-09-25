import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Upload,
  Globe,
  Tag,
  FileText,
  CreditCard,
  Plus,
  Trash2,
  Server,
  Image as ImageIcon,
  Video,
  Shield,
  Info,
  Clock,
  CheckCircle2,
  Eye,
  Send,
  Sparkles,
  ExternalLink,
  Edit3,
  Search,
  Code2,
  BookOpen,
  Layers,
  ArrowRight,
  Sliders,
  DollarSign,
  Activity,
  Zap,
} from 'lucide-react';
import { CatalogCategory, catalogApi, PublishApiPayload } from '../../services/api/catalog';
import { apiBuildService } from '../../services/apiBuild';
import { ProviderProject, PricingPlan, ProjectVersion } from '../../types/apibuild';
import { useAuth } from '../../context/AuthContext';

interface PublishApiModalProps {
  onClose: () => void;
  onPublished: () => void;
  categories: CatalogCategory[];
}

type WizardStep = 'select' | 'details' | 'media' | 'pricing' | 'preview';

interface StepMeta {
  key: WizardStep;
  label: string;
  sublabel: string;
  icon: React.FC<any>;
}

const WIZARD_STEPS: StepMeta[] = [
  { key: 'select', label: 'Select API', sublabel: 'Choose hosted Studio API', icon: Server },
  { key: 'details', label: 'Details', sublabel: 'Metadata & category', icon: FileText },
  { key: 'media', label: 'Media & Docs', sublabel: 'Images, video & guides', icon: ImageIcon },
  { key: 'pricing', label: 'Pricing & Versions', sublabel: 'Plans, sync & availability', icon: CreditCard },
  { key: 'preview', label: 'Preview & Submit', sublabel: 'Review approval listing', icon: Eye },
];

interface ScreenshotItem {
  id: string;
  url: string;
  caption: string;
}

interface EditableVersionItem {
  id: string;
  semver: string;
  status: string;
  offeredOnMarketplace: boolean;
  isFree: boolean;
  notes?: string;
}

interface EditablePlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  originalPriceMonthly: number;
  priceMonthly: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  requestsPerMonth: number;
  rateLimitPerMin: number;
  features: string[];
  offeredOnMarketplace: boolean;
  isFree: boolean;
}

const SAMPLE_PRESET_LOGOS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=160&q=80',
];

const SAMPLE_PRESET_BANNERS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
];

export const PublishApiModal: React.FC<PublishApiModalProps> = ({
  onClose,
  onPublished,
  categories,
}) => {
  const { user } = useAuth();

  // Navigation state
  const [currentStep, setCurrentStep] = useState<WizardStep>('select');
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  // Studio projects state
  const [studioProjects, setStudioProjects] = useState<ProviderProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedStudioApi, setSelectedStudioApi] = useState<ProviderProject | null>(null);

  // Step 2: Details state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Step 3: Media & Docs state
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');
  const [newScreenshotCaption, setNewScreenshotCaption] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [documentationMarkdown, setDocumentationMarkdown] = useState('');
  const [apiSpecRaw, setApiSpecRaw] = useState('');
  const [docTab, setDocTab] = useState<'edit' | 'preview'>('edit');

  // Step 4: Pricing & Versions state
  const [versionList, setVersionList] = useState<EditableVersionItem[]>([]);
  const [planList, setPlanList] = useState<EditablePlanItem[]>([]);
  const [pricingModel, setPricingModel] = useState<'FREE' | 'FREEMIUM' | 'PAID' | 'ENTERPRISE'>('FREEMIUM');
  const [newFeatureInputs, setNewFeatureInputs] = useState<Record<string, string>>({});

  // Step 5: Submission & Success state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Fetch hosted Studio APIs on mount
  useEffect(() => {
    let active = true;
    setLoadingProjects(true);
    setProjectError(null);

    apiBuildService
      .list()
      .then((projects) => {
        if (!active) return;
        setStudioProjects(projects || []);
      })
      .catch((err) => {
        if (!active) return;
        setProjectError(err.message || 'Failed to load Studio APIs.');
      })
      .finally(() => {
        if (active) setLoadingProjects(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Filter studio projects by search
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return studioProjects;
    const q = projectSearch.toLowerCase();
    return studioProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [studioProjects, projectSearch]);

  // When a Studio API is selected, prefill details, media, and pricing
  const handleSelectStudioApi = (project: ProviderProject) => {
    setSelectedStudioApi(project);

    // Auto-fill details
    setName(project.name || '');
    const generatedSlug = project.slug || project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    setSlug(generatedSlug);
    setDescription(project.description || '');
    setBaseUrl(project.gatewayUrl || project.baseUrl || '');

    // Match category if possible
    if (project.category) {
      const matched = categories.find(
        (c) =>
          c.name.toLowerCase() === project.category.toLowerCase() ||
          c.slug.toLowerCase() === project.category.toLowerCase()
      );
      if (matched) {
        setCategoryId(matched.id);
      } else if (categories.length > 0) {
        setCategoryId(categories[0].id);
      }
    } else if (categories.length > 0) {
      setCategoryId(categories[0].id);
    }

    // Default tags based on category & environment
    const initialTags = ['API Studio', project.category || 'Developer Tools'].filter(Boolean);
    setTags(initialTags);

    // Initial media & docs
    setLogoUrl(SAMPLE_PRESET_LOGOS[Math.floor(Math.random() * SAMPLE_PRESET_LOGOS.length)]);
    setBannerUrl(SAMPLE_PRESET_BANNERS[0]);
    setDocsUrl(project.openApiUrl || `${project.baseUrl || 'https://api.klyra.io'}/docs`);
    setDocumentationMarkdown(
      `# Getting Started with ${project.name}\n\n${project.description || 'Integrate this high-performance API into your modern tech stack with minimal setup.'}\n\n### Authentication\nUse your API Key in the \`Authorization\` header:\n\`\`\`bash\ncurl -X GET "${project.gatewayUrl || project.baseUrl || 'https://api.klyra.io'}/v1/resource" \\\n  -H "Authorization: Bearer YOUR_API_KEY"\n\`\`\`\n\n### SDK Installation\n\`\`\`bash\nnpm install @klyra-api/${generatedSlug}\n\`\`\``
    );

    // Build default OpenAPI spec snippet
    const spec = {
      openapi: '3.0.3',
      info: {
        title: project.name,
        version: project.version || '1.0.0',
        description: project.description,
      },
      servers: [{ url: project.gatewayUrl || project.baseUrl || 'https://api.klyra.io' }],
      paths: {
        '/v1/health': {
          get: {
            summary: 'Service Health Check',
            responses: { '200': { description: 'Healthy service status' } },
          },
        },
      },
    };
    setApiSpecRaw(JSON.stringify(spec, null, 2));

    // Sync Studio Versions
    const studioVersions: ProjectVersion[] = project.versions || [];
    if (studioVersions.length > 0) {
      setVersionList(
        studioVersions.map((v) => ({
          id: v.id || v.semver,
          semver: v.semver,
          status: v.status,
          offeredOnMarketplace: true,
          isFree: false,
          notes: v.notes,
        }))
      );
    } else {
      setVersionList([
        {
          id: 'v1.0.0',
          semver: project.version || '1.0.0',
          status: 'published',
          offeredOnMarketplace: true,
          isFree: false,
          notes: 'Production release',
        },
      ]);
    }

    // Sync Studio Plans
    const studioPlans: PricingPlan[] = project.plans || [];
    if (studioPlans.length > 0) {
      setPlanList(
        studioPlans.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: `${p.requestsPerMonth.toLocaleString()} requests/mo with ${p.rateLimitPerMin} req/min rate limit`,
          originalPriceMonthly: p.priceMonthly,
          priceMonthly: p.priceMonthly,
          billingInterval: 'MONTHLY',
          requestsPerMonth: p.requestsPerMonth,
          rateLimitPerMin: p.rateLimitPerMin,
          features: [
            `${p.requestsPerMonth.toLocaleString()} requests / month`,
            `${p.rateLimitPerMin} req/min rate limit`,
            p.priceMonthly === 0 ? 'Community Support' : 'Priority SLA & Email Support',
            'Full Endpoint Telemetry',
          ],
          offeredOnMarketplace: true,
          isFree: p.priceMonthly === 0,
        }))
      );
    } else {
      // Default initial plans ladder
      setPlanList([
        {
          id: 'plan-free',
          name: 'Free Developer',
          slug: 'free',
          description: 'Sandbox tier for testing and prototype development',
          originalPriceMonthly: 0,
          priceMonthly: 0,
          billingInterval: 'MONTHLY',
          requestsPerMonth: 1000,
          rateLimitPerMin: 60,
          features: ['1,000 requests / month', '60 req/min rate limit', 'Community Support'],
          offeredOnMarketplace: true,
          isFree: true,
        },
        {
          id: 'plan-pro',
          name: 'Professional',
          slug: 'pro',
          description: 'Production access for high-volume applications',
          originalPriceMonthly: 29,
          priceMonthly: 29,
          billingInterval: 'MONTHLY',
          requestsPerMonth: 50000,
          rateLimitPerMin: 300,
          features: ['50,000 requests / month', '300 req/min rate limit', 'Priority Email Support', 'Custom Webhooks'],
          offeredOnMarketplace: true,
          isFree: false,
        },
      ]);
    }
  };

  // Navigations & Validations
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 3) errs.name = 'Name must be at least 3 characters.';
    if (!description.trim() || description.trim().length < 10)
      errs.description = 'Description must be at least 10 characters long.';
    if (!categoryId) errs.categoryId = 'Please select a catalog category.';
    if (!baseUrl.trim() || !baseUrl.startsWith('http'))
      errs.baseUrl = 'Must be a valid URL starting with http:// or https://';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (apiSpecRaw.trim()) {
      try {
        JSON.parse(apiSpecRaw);
      } catch {
        errs.apiSpec = 'API Specification must be valid JSON.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep4 = (): boolean => {
    const errs: Record<string, string> = {};
    const offeredPlans = planList.filter((p) => p.offeredOnMarketplace);
    if (offeredPlans.length === 0) {
      errs.plans = 'Please select at least one pricing plan to offer on the Marketplace.';
    }
    const offeredVersions = versionList.filter((v) => v.offeredOnMarketplace);
    if (offeredVersions.length === 0) {
      errs.versions = 'Please select at least one version to offer on the Marketplace.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep = (step: WizardStep) => {
    const order: WizardStep[] = ['select', 'details', 'media', 'pricing', 'preview'];
    const currentIdx = order.indexOf(currentStep);
    const targetIdx = order.indexOf(step);
    setDirection(targetIdx > currentIdx ? 'next' : 'prev');
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep === 'select') {
      if (!selectedStudioApi) {
        setErrors({ select: 'Please choose a hosted API project to continue.' });
        return;
      }
      setErrors({});
      goToStep('details');
    } else if (currentStep === 'details') {
      if (validateStep2()) goToStep('media');
    } else if (currentStep === 'media') {
      if (validateStep3()) goToStep('pricing');
    } else if (currentStep === 'pricing') {
      if (validateStep4()) goToStep('preview');
    }
  };

  const handleBack = () => {
    if (currentStep === 'details') goToStep('select');
    else if (currentStep === 'media') goToStep('details');
    else if (currentStep === 'pricing') goToStep('media');
    else if (currentStep === 'preview') goToStep('pricing');
  };

  // Tag helpers
  const handleAddTag = () => {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  // Screenshot helpers
  const handleAddScreenshot = () => {
    if (!newScreenshotUrl.trim()) return;
    const item: ScreenshotItem = {
      id: `ss-${Date.now()}`,
      url: newScreenshotUrl.trim(),
      caption: newScreenshotCaption.trim() || 'Product Screenshot',
    };
    setScreenshots([...screenshots, item]);
    setNewScreenshotUrl('');
    setNewScreenshotCaption('');
  };

  const handleRemoveScreenshot = (id: string) => {
    setScreenshots(screenshots.filter((s) => s.id !== id));
  };

  const handleLoadSampleScreenshots = () => {
    setScreenshots([
      {
        id: 's1',
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        caption: 'Interactive Analytics & Real-Time Telemetry',
      },
      {
        id: 's2',
        url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
        caption: 'Developer Portal & API Key Management',
      },
    ]);
  };

  // Version toggle helpers
  const toggleVersionMarketplace = (id: string) => {
    setVersionList(
      versionList.map((v) => (v.id === id ? { ...v, offeredOnMarketplace: !v.offeredOnMarketplace } : v))
    );
  };

  const toggleVersionFree = (id: string) => {
    setVersionList(
      versionList.map((v) => (v.id === id ? { ...v, isFree: !v.isFree } : v))
    );
  };

  // Plan helpers
  const togglePlanMarketplace = (id: string) => {
    setPlanList(
      planList.map((p) => (p.id === id ? { ...p, offeredOnMarketplace: !p.offeredOnMarketplace } : p))
    );
  };

  const togglePlanFree = (id: string) => {
    setPlanList(
      planList.map((p) => {
        if (p.id === id) {
          const willBeFree = !p.isFree;
          return {
            ...p,
            isFree: willBeFree,
            priceMonthly: willBeFree ? 0 : p.originalPriceMonthly > 0 ? p.originalPriceMonthly : 19,
          };
        }
        return p;
      })
    );
  };

  const updatePlanPrice = (id: string, newPrice: number) => {
    setPlanList(
      planList.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            priceMonthly: Math.max(0, newPrice),
            isFree: newPrice === 0,
          };
        }
        return p;
      })
    );
  };

  const addPlanFeature = (planId: string) => {
    const text = (newFeatureInputs[planId] || '').trim();
    if (!text) return;
    setPlanList(
      planList.map((p) => (p.id === planId ? { ...p, features: [...p.features, text] } : p))
    );
    setNewFeatureInputs({ ...newFeatureInputs, [planId]: '' });
  };

  const removePlanFeature = (planId: string, idx: number) => {
    setPlanList(
      planList.map((p) =>
        p.id === planId ? { ...p, features: p.features.filter((_, i) => i !== idx) } : p
      )
    );
  };

  // Check if any plans have pricing modifications compared to Studio original
  const hasPendingStudioPricingChanges = useMemo(() => {
    return planList.some((p) => p.priceMonthly !== p.originalPriceMonthly);
  }, [planList]);

  // Submit listing creation
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      let parsedApiSpec: Record<string, any> | undefined;
      if (apiSpecRaw.trim()) {
        try {
          parsedApiSpec = JSON.parse(apiSpecRaw);
        } catch {
          parsedApiSpec = undefined;
        }
      }

      // Filter only plans offered on Marketplace
      const offeredPlans = planList.filter((p) => p.offeredOnMarketplace);
      const offeredVersions = versionList.filter((v) => v.offeredOnMarketplace);

      // Determine pricing model
      const anyPaid = offeredPlans.some((p) => p.priceMonthly > 0 && !p.isFree);
      const anyFree = offeredPlans.some((p) => p.priceMonthly === 0 || p.isFree);
      const derivedModel = anyPaid && anyFree ? 'FREEMIUM' : anyPaid ? 'PAID' : 'FREE';

      const payload: PublishApiPayload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        categoryId,
        baseUrl: baseUrl.trim(),
        docsUrl: docsUrl.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        pricingModel: derivedModel,
        apiSpec: parsedApiSpec,
        tags,
        plans: offeredPlans.map((p) => ({
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.isFree ? 0 : p.priceMonthly,
          billingInterval: p.billingInterval,
          features: p.features,
          rateLimit: p.rateLimitPerMin,
        })),
        requireApproval: true, // Always require approval for marketplace listing workflow
        studioProjectId: selectedStudioApi?.id,
        proposedStudioChanges: {
          plans: planList.map((p) => ({
            id: p.id,
            name: p.name,
            priceMonthly: p.isFree ? 0 : p.priceMonthly,
            requestsPerMonth: p.requestsPerMonth,
            rateLimitPerMin: p.rateLimitPerMin,
            isFree: p.isFree,
          })),
          isVersionFree: offeredVersions.some((v) => v.isFree),
          semver: offeredVersions[0]?.semver || '1.0.0',
        },
        marketplaceAvailability: {
          versions: offeredVersions.map((v) => v.semver),
          plans: offeredPlans.map((p) => p.id),
        },
        media: {
          bannerUrl: bannerUrl.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          screenshots: screenshots.map((s) => s.url),
        },
        documentationMarkdown: documentationMarkdown.trim() || undefined,
      };

      const result = await catalogApi.publishApi(payload);

      // Create provider notification in localStorage and dispatch event
      const notification = {
        id: `notif-${Date.now()}`,
        userId: user?.id || 'provider',
        type: 'api' as const,
        title: `Submission Queued: ${payload.name}`,
        message: `Your API "${payload.name}" was submitted for review. It will be live on the Marketplace once approved by administrators.`,
        time: 'Just now',
        read: false,
      };
      window.dispatchEvent(new CustomEvent('klyra:add-notification', { detail: notification }));
      try {
        const stored = JSON.parse(localStorage.getItem('klyra_user_notifications') || '[]');
        localStorage.setItem('klyra_user_notifications', JSON.stringify([notification, ...stored]));
      } catch {}

      setSubmitSuccess({
        api: result,
        name: payload.name,
        slug: payload.slug,
      });

      onPublished();
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to submit API for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHostNewInStudio = () => {
    window.dispatchEvent(
      new CustomEvent('klyra:navigate', {
        detail: { tab: 'api-build', apiBuildView: 'new' },
      })
    );
    onClose();
  };

  const currentStepMeta = WIZARD_STEPS.find((s) => s.key === currentStep)!;
  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="pam2-overlay" onClick={onClose}>
      <div className="pam2-shell" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="pam2-header">
          <div className="pam2-header-title-block">
            <div className="pam2-badge">
              <Sparkles size={13} />
              <span>MARKETPLACE ONBOARDING</span>
            </div>
            <h2 className="pam2-header-title">Publish API to Marketplace</h2>
            <p className="pam2-header-subtitle">
              Convert any Studio API project into a commercial listing with custom pricing, media, and documentation.
            </p>
          </div>
          <button className="pam2-close-btn" onClick={onClose} title="Close overlay">
            <X size={18} />
          </button>
        </div>

        {/* Multi-Step Stepper Bar */}
        <div className="pam2-stepper-bar">
          {WIZARD_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div
                key={step.key}
                className={`pam2-stepper-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                onClick={() => {
                  // Only allow jumping backward or to current
                  if (idx <= currentStepIndex) goToStep(step.key);
                }}
              >
                <div className="pam2-stepper-circle">
                  {isDone ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <div className="pam2-stepper-labels">
                  <span className="pam2-stepper-num">STEP 0{idx + 1}</span>
                  <span className="pam2-stepper-name">{step.label}</span>
                </div>
                {idx < WIZARD_STEPS.length - 1 && <div className="pam2-stepper-line" />}
              </div>
            );
          })}
        </div>

        {/* Main Body with animated view transitions */}
        <div className="pam2-body">
          {submitSuccess ? (
            /* Success State */
            <div className="pam2-success-card animate-fade-in">
              <div className="pam2-success-aura" />
              <div className="pam2-success-icon-wrap">
                <CheckCircle2 size={48} className="pam2-success-check" />
              </div>
              <h3 className="pam2-success-title">Approval Request Submitted!</h3>
              <p className="pam2-success-desc">
                Your API <b>{submitSuccess.name}</b> has been queued for review by the Klyra Platform team. It will <b>not</b> appear publicly until reviewed.
              </p>

              <div className="pam2-timeline-card">
                <h4 className="pam2-timeline-title">What happens next:</h4>
                <div className="pam2-timeline-list">
                  <div className="pam2-timeline-step done">
                    <div className="pam2-tl-dot" />
                    <div>
                      <strong>1. Request Registered</strong>
                      <p>Listing details and proposed Studio pricing changes are archived.</p>
                    </div>
                  </div>
                  <div className="pam2-timeline-step pending">
                    <div className="pam2-tl-dot" />
                    <div>
                      <strong>2. Admin Moderation & Guardrail Check</strong>
                      <p>Admins verify OpenAPI endpoints, SLA compliance, and security policies.</p>
                    </div>
                  </div>
                  <div className="pam2-timeline-step pending">
                    <div className="pam2-tl-dot" />
                    <div>
                      <strong>3. Auto-Publish & Studio Sync</strong>
                      <p>Approval instantly publishes your listing and synchronizes approved pricing back to API Studio.</p>
                    </div>
                  </div>
                  <div className="pam2-timeline-step pending">
                    <div className="pam2-tl-dot" />
                    <div>
                      <strong>4. Provider In-App Notification</strong>
                      <p>You will receive a notification with direct links upon decision.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pam2-success-actions">
                <button
                  className="pam2-btn pam2-btn-secondary"
                  onClick={onClose}
                >
                  Return to Marketplace
                </button>
                <button
                  className="pam2-btn pam2-btn-primary"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(
                      new CustomEvent('klyra:navigate', {
                        detail: { tab: 'api-build', apiBuildView: 'dash' },
                      })
                    );
                  }}
                >
                  View in API Studio <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: Select API */}
              {currentStep === 'select' && (
                <div className="pam2-step-content animate-slide-in">
                  <div className="pam2-step-header">
                    <div>
                      <h3 className="pam2-section-heading">Select an API Hosted in API Studio</h3>
                      <p className="pam2-section-sub">
                        Choose a deployed or draft API project. We'll automatically pull its routes, versions, and baseline pricing.
                      </p>
                    </div>
                    {/* Always visible CTA to host another API in Studio */}
                    <button
                      className="pam2-cta-studio-btn"
                      onClick={handleHostNewInStudio}
                      title="Create a new API project in API Studio"
                    >
                      <Plus size={14} />
                      <span>Host an API in Studio</span>
                    </button>
                  </div>

                  {errors.select && (
                    <div className="pam2-alert pam2-alert-error">
                      <AlertCircle size={15} />
                      <span>{errors.select}</span>
                    </div>
                  )}

                  {loadingProjects ? (
                    <div className="pam2-loading-grid">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="pam2-skeleton-card">
                          <div className="pam2-sk-line title" />
                          <div className="pam2-sk-line subtitle" />
                          <div className="pam2-sk-row">
                            <div className="pam2-sk-chip" />
                            <div className="pam2-sk-chip" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : projectError ? (
                    <div className="pam2-error-box">
                      <AlertCircle size={24} />
                      <p>{projectError}</p>
                      <button
                        className="pam2-btn pam2-btn-secondary"
                        onClick={() => {
                          setLoadingProjects(true);
                          apiBuildService.list().then(setStudioProjects).finally(() => setLoadingProjects(false));
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  ) : studioProjects.length === 0 ? (
                    /* Eye-catching empty state */
                    <div className="pam2-empty-state">
                      <div className="pam2-empty-aura" />
                      <div className="pam2-empty-icon-wrap">
                        <Server size={38} className="pam2-empty-icon" />
                      </div>
                      <h4 className="pam2-empty-title">No Hosted APIs Found in API Studio</h4>
                      <p className="pam2-empty-desc">
                        You don't have any APIs hosted in API Studio yet. Build or import an API in Studio to publish it to the Marketplace catalog.
                      </p>
                      <button
                        className="pam2-btn pam2-btn-primary pam2-pulse-btn"
                        onClick={handleHostNewInStudio}
                      >
                        <Sparkles size={16} />
                        <span>Host an API in Studio</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Search & Filter bar for projects */}
                      <div className="pam2-project-filter-row">
                        <div className="pam2-search-box">
                          <Search size={14} className="pam2-search-icon" />
                          <input
                            type="text"
                            placeholder="Filter by name, tag, or category..."
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                          />
                          {projectSearch && (
                            <button className="pam2-search-clear" onClick={() => setProjectSearch('')}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <span className="pam2-project-count-badge">
                          {filteredProjects.length} {filteredProjects.length === 1 ? 'API' : 'APIs'} available
                        </span>
                      </div>

                      {/* Studio APIs Card Grid */}
                      <div className="pam2-projects-grid">
                        {filteredProjects.map((p) => {
                          const isSelected = selectedStudioApi?.id === p.id;
                          const status = p.status || 'draft';
                          return (
                            <div
                              key={p.id}
                              className={`pam2-project-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleSelectStudioApi(p)}
                            >
                              <div className="pam2-pc-top">
                                <div className="pam2-pc-meta">
                                  <span className="pam2-pc-version">{p.version || 'v1.0.0'}</span>
                                  <span className={`pam2-pc-status status-${status}`}>
                                    <span className="pam2-status-dot" />
                                    {status.toUpperCase()}
                                  </span>
                                </div>
                                <div className={`pam2-pc-radio ${isSelected ? 'checked' : ''}`}>
                                  {isSelected && <Check size={13} />}
                                </div>
                              </div>

                              <h4 className="pam2-pc-title">{p.name}</h4>
                              <p className="pam2-pc-desc">
                                {p.description || 'No description provided in Studio.'}
                              </p>

                              <div className="pam2-pc-stats">
                                <div className="pam2-stat-chip" title="Discovered endpoints">
                                  <Zap size={12} />
                                  <span>{p.endpointCount ?? (p.detection?.endpoints?.length || 0)} endpoints</span>
                                </div>
                                <div className="pam2-stat-chip" title="Latency">
                                  <Activity size={12} />
                                  <span>{p.latencyMs ? `${p.latencyMs}ms` : '< 120ms'}</span>
                                </div>
                                <div className="pam2-stat-chip" title="Category">
                                  <Tag size={12} />
                                  <span>{p.category || 'General'}</span>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="pam2-pc-selected-banner">
                                  <Check size={12} /> Selected for Marketplace Listing
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 2: Details */}
              {currentStep === 'details' && (
                <div className="pam2-step-content animate-slide-in">
                  <div className="pam2-step-header">
                    <div>
                      <h3 className="pam2-section-heading">Listing Details & Categorization</h3>
                      <p className="pam2-section-sub">
                        Information pre-filled from your Studio project <b>{selectedStudioApi?.name}</b>. You can customize it for marketplace discovery.
                      </p>
                    </div>
                    {selectedStudioApi && (
                      <span className="pam2-source-pill">
                        <Server size={12} /> Source: {selectedStudioApi.name}
                      </span>
                    )}
                  </div>

                  <div className="pam2-form-grid">
                    <div className="pam2-form-field">
                      <label className="pam2-label">
                        API Name <span className="pam2-req">*</span>
                      </label>
                      <input
                        type="text"
                        className={`pam2-input ${errors.name ? 'has-error' : ''}`}
                        placeholder="e.g. Acme Geocoding API"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                          }
                        }}
                      />
                      {errors.name && <span className="pam2-error-text">{errors.name}</span>}
                    </div>

                    <div className="pam2-form-field">
                      <label className="pam2-label">
                        Catalog Slug (URL path) <span className="pam2-req">*</span>
                      </label>
                      <input
                        type="text"
                        className="pam2-input pam2-mono"
                        placeholder="acme-geocoding-api"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                      />
                      <span className="pam2-hint">https://marketplace.klyra.io/api/{slug || 'your-slug'}</span>
                    </div>

                    <div className="pam2-form-field full-width">
                      <label className="pam2-label">
                        Marketplace Description <span className="pam2-req">*</span>
                      </label>
                      <textarea
                        className={`pam2-textarea ${errors.description ? 'has-error' : ''}`}
                        rows={3}
                        placeholder="Summarize what this API does, its core capabilities, and why developers should use it..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      {errors.description && <span className="pam2-error-text">{errors.description}</span>}
                    </div>

                    <div className="pam2-form-field">
                      <label className="pam2-label">
                        Marketplace Category <span className="pam2-req">*</span>
                      </label>
                      <select
                        className={`pam2-select ${errors.categoryId ? 'has-error' : ''}`}
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                      >
                        <option value="">Select a category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {errors.categoryId && <span className="pam2-error-text">{errors.categoryId}</span>}
                    </div>

                    <div className="pam2-form-field">
                      <label className="pam2-label">
                        Live Gateway / Base URL <span className="pam2-req">*</span>
                      </label>
                      <input
                        type="text"
                        className={`pam2-input pam2-mono ${errors.baseUrl ? 'has-error' : ''}`}
                        placeholder="https://api.yourdomain.com/v1"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                      />
                      {errors.baseUrl && <span className="pam2-error-text">{errors.baseUrl}</span>}
                    </div>

                    <div className="pam2-form-field full-width">
                      <label className="pam2-label">Search Tags & Keywords</label>
                      <div className="pam2-tags-wrap">
                        {tags.map((tag) => (
                          <span key={tag} className="pam2-tag-chip">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        <div className="pam2-tag-input-row">
                          <input
                            type="text"
                            placeholder="Add tag and press Enter..."
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                          />
                          <button type="button" className="pam2-tag-add-btn" onClick={handleAddTag}>
                            Add
                          </button>
                        </div>
                      </div>
                      <span className="pam2-hint">Suggested: AI, Machine Learning, Fast Latency, GraphQL, REST, Cloud</span>
                    </div>

                    <div className="pam2-form-field full-width">
                      <label className="pam2-label">Primary Target Audience / Use Cases (Optional)</label>
                      <input
                        type="text"
                        className="pam2-input"
                        placeholder="e.g. FinTech developers, Autonomous agents, Mobile apps"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Media & Docs */}
              {currentStep === 'media' && (
                <div className="pam2-step-content animate-slide-in">
                  <div className="pam2-step-header">
                    <div>
                      <h3 className="pam2-section-heading">Media Assets & Developer Documentation</h3>
                      <p className="pam2-section-sub">
                        Rich media increases integration conversion. Add logos, banners, video walkthroughs, and OpenAPI specs.
                      </p>
                    </div>
                  </div>

                  {errors.apiSpec && (
                    <div className="pam2-alert pam2-alert-error">
                      <AlertCircle size={15} />
                      <span>{errors.apiSpec}</span>
                    </div>
                  )}

                  <div className="pam2-media-columns">
                    {/* Left Column: Visual Assets */}
                    <div className="pam2-media-block">
                      <h4 className="pam2-block-title">
                        <ImageIcon size={15} /> Visual Assets & Video
                      </h4>

                      {/* Logo URL */}
                      <div className="pam2-form-field">
                        <label className="pam2-label">Logo / Icon URL</label>
                        <div className="pam2-image-preview-row">
                          <div className="pam2-logo-preview">
                            {logoUrl ? <img src={logoUrl} alt="Logo" /> : <Server size={24} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <input
                              type="text"
                              className="pam2-input pam2-mono"
                              placeholder="https://.../logo.png"
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
                            />
                            <div className="pam2-presets-row">
                              <span className="pam2-presets-label">Presets:</span>
                              {SAMPLE_PRESET_LOGOS.map((url, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="pam2-preset-thumb"
                                  onClick={() => setLogoUrl(url)}
                                >
                                  <img src={url} alt={`Preset ${idx}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Banner URL */}
                      <div className="pam2-form-field">
                        <label className="pam2-label">Marketplace Banner / Cover Image URL</label>
                        <input
                          type="text"
                          className="pam2-input pam2-mono"
                          placeholder="https://.../banner.png"
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                        />
                        {bannerUrl && (
                          <div className="pam2-banner-preview">
                            <img src={bannerUrl} alt="Banner Preview" />
                          </div>
                        )}
                      </div>

                      {/* Demo Video URL */}
                      <div className="pam2-form-field">
                        <label className="pam2-label">Demo Video URL (YouTube, Loom, Vimeo, MP4)</label>
                        <input
                          type="text"
                          className="pam2-input pam2-mono"
                          placeholder="https://www.youtube.com/watch?v=... or https://loom.com/share/..."
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                        />
                        <span className="pam2-hint">Embeds directly on your listing preview & detail page.</span>
                      </div>

                      {/* Screenshots Gallery */}
                      <div className="pam2-form-field">
                        <div className="pam2-label-row">
                          <label className="pam2-label">Screenshots Gallery ({screenshots.length})</label>
                          <button
                            type="button"
                            className="pam2-link-btn"
                            onClick={handleLoadSampleScreenshots}
                          >
                            + Load Sample Screenshots
                          </button>
                        </div>

                        <div className="pam2-ss-add-box">
                          <input
                            type="text"
                            placeholder="Image URL..."
                            className="pam2-input pam2-mono"
                            value={newScreenshotUrl}
                            onChange={(e) => setNewScreenshotUrl(e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Caption (e.g. Dashboard view)"
                            className="pam2-input"
                            value={newScreenshotCaption}
                            onChange={(e) => setNewScreenshotCaption(e.target.value)}
                          />
                          <button
                            type="button"
                            className="pam2-btn pam2-btn-secondary"
                            onClick={handleAddScreenshot}
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>

                        {screenshots.length > 0 && (
                          <div className="pam2-screenshots-grid">
                            {screenshots.map((s) => (
                              <div key={s.id} className="pam2-ss-card">
                                <img src={s.url} alt={s.caption} />
                                <div className="pam2-ss-caption">{s.caption}</div>
                                <button
                                  type="button"
                                  className="pam2-ss-remove"
                                  onClick={() => handleRemoveScreenshot(s.id)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Documentation & OpenAPI */}
                    <div className="pam2-media-block">
                      <h4 className="pam2-block-title">
                        <BookOpen size={15} /> Documentation & Spec
                      </h4>

                      <div className="pam2-form-field">
                        <label className="pam2-label">Official Documentation URL</label>
                        <input
                          type="text"
                          className="pam2-input pam2-mono"
                          placeholder="https://docs.yourcompany.com"
                          value={docsUrl}
                          onChange={(e) => setDocsUrl(e.target.value)}
                        />
                      </div>

                      <div className="pam2-form-field">
                        <div className="pam2-label-row">
                          <label className="pam2-label">OpenAPI 3.0 / Swagger JSON Definition</label>
                          <span className="pam2-badge pam2-badge-sm">Auto-synced</span>
                        </div>
                        <textarea
                          className="pam2-textarea pam2-mono"
                          rows={6}
                          value={apiSpecRaw}
                          onChange={(e) => setApiSpecRaw(e.target.value)}
                          placeholder="Paste or edit OpenAPI JSON..."
                        />
                      </div>

                      <div className="pam2-form-field">
                        <div className="pam2-label-row">
                          <label className="pam2-label">Getting Started Guide (Markdown)</label>
                          <div className="pam2-subtabs">
                            <button
                              type="button"
                              className={`pam2-subtab ${docTab === 'edit' ? 'active' : ''}`}
                              onClick={() => setDocTab('edit')}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`pam2-subtab ${docTab === 'preview' ? 'active' : ''}`}
                              onClick={() => setDocTab('preview')}
                            >
                              Preview
                            </button>
                          </div>
                        </div>

                        {docTab === 'edit' ? (
                          <textarea
                            className="pam2-textarea pam2-mono"
                            rows={7}
                            value={documentationMarkdown}
                            onChange={(e) => setDocumentationMarkdown(e.target.value)}
                            placeholder="# Quick Start..."
                          />
                        ) : (
                          <div className="pam2-md-preview">
                            <pre>{documentationMarkdown || 'No markdown written yet.'}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Pricing & Versions */}
              {currentStep === 'pricing' && (
                <div className="pam2-step-content animate-slide-in">
                  <div className="pam2-step-header">
                    <div>
                      <h3 className="pam2-section-heading">Pricing Plans & Version Availability</h3>
                      <p className="pam2-section-sub">
                        Sync Studio plans and configure how they are sold on Marketplace.
                      </p>
                    </div>
                    {hasPendingStudioPricingChanges && (
                      <span className="pam2-sync-alert-pill">
                        <Shield size={12} /> Staged Studio Sync Pending
                      </span>
                    )}
                  </div>

                  {/* Crucial Guardrail Callout Banner */}
                  <div className="pam2-guardrail-banner">
                    <div className="pam2-gr-icon">
                      <Info size={18} />
                    </div>
                    <div className="pam2-gr-content">
                      <strong>Studio Synchronization Guardrail:</strong>
                      <p>
                        Editing pricing tiers or marking versions as Free creates a proposal that <b>syncs back to your Studio project only after admin approval</b>. Marketplace version and plan availability toggles remain <b>Marketplace-only</b>.
                      </p>
                    </div>
                  </div>

                  {errors.plans && (
                    <div className="pam2-alert pam2-alert-error">
                      <AlertCircle size={15} />
                      <span>{errors.plans}</span>
                    </div>
                  )}
                  {errors.versions && (
                    <div className="pam2-alert pam2-alert-error">
                      <AlertCircle size={15} />
                      <span>{errors.versions}</span>
                    </div>
                  )}

                  {/* Section A: Versions Availability */}
                  <div className="pam2-pricing-section">
                    <h4 className="pam2-section-subheading">
                      <Layers size={14} /> 1. Versions Offered on Marketplace
                    </h4>
                    <div className="pam2-versions-table">
                      {versionList.map((v) => (
                        <div key={v.id} className="pam2-version-row">
                          <div className="pam2-vr-meta">
                            <span className="pam2-vr-semver">{v.semver}</span>
                            <span className="pam2-vr-status">{v.status}</span>
                            {v.notes && <span className="pam2-vr-notes">{v.notes}</span>}
                          </div>

                          <div className="pam2-vr-toggles">
                            <label className="pam2-toggle-label">
                              <input
                                type="checkbox"
                                checked={v.offeredOnMarketplace}
                                onChange={() => toggleVersionMarketplace(v.id)}
                              />
                              <span>Offer on Marketplace</span>
                            </label>

                            <label className="pam2-toggle-label">
                              <input
                                type="checkbox"
                                checked={v.isFree}
                                onChange={() => toggleVersionFree(v.id)}
                              />
                              <span className={v.isFree ? 'pam2-free-highlight' : ''}>
                                Mark Version as Free
                              </span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section B: Pricing Plans Ladder */}
                  <div className="pam2-pricing-section">
                    <h4 className="pam2-section-subheading">
                      <DollarSign size={14} /> 2. Pricing Tiers & Quotas
                    </h4>

                    <div className="pam2-plans-grid">
                      {planList.map((plan) => {
                        const isModified = plan.priceMonthly !== plan.originalPriceMonthly;
                        return (
                          <div
                            key={plan.id}
                            className={`pam2-plan-editor-card ${
                              !plan.offeredOnMarketplace ? 'plan-disabled' : ''
                            }`}
                          >
                            <div className="pam2-pec-header">
                              <div>
                                <h5 className="pam2-pec-title">{plan.name}</h5>
                                <span className="pam2-pec-slug">id: {plan.id}</span>
                              </div>
                              <label className="pam2-toggle-label" title="Enable or disable on Marketplace">
                                <input
                                  type="checkbox"
                                  checked={plan.offeredOnMarketplace}
                                  onChange={() => togglePlanMarketplace(plan.id)}
                                />
                                <span>Marketplace Visible</span>
                              </label>
                            </div>

                            {/* Price & Free Toggle */}
                            <div className="pam2-pec-pricing-row">
                              <div className="pam2-price-input-wrap">
                                <span className="pam2-cur">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  disabled={plan.isFree || !plan.offeredOnMarketplace}
                                  value={plan.isFree ? 0 : plan.priceMonthly}
                                  onChange={(e) =>
                                    updatePlanPrice(plan.id, parseFloat(e.target.value) || 0)
                                  }
                                />
                                <span className="pam2-interval">/mo</span>
                              </div>

                              <label className="pam2-toggle-label">
                                <input
                                  type="checkbox"
                                  checked={plan.isFree}
                                  disabled={!plan.offeredOnMarketplace}
                                  onChange={() => togglePlanFree(plan.id)}
                                />
                                <span className={plan.isFree ? 'pam2-free-text' : ''}>100% Free</span>
                              </label>
                            </div>

                            {/* Studio Price Sync Diff Indicator */}
                            {isModified && (
                              <div className="pam2-diff-badge" title="Will sync to Studio upon admin approval">
                                <Clock size={12} /> Studio: ${plan.originalPriceMonthly} → Proposed: ${plan.priceMonthly} (Pending Approval)
                              </div>
                            )}

                            {/* Quotas */}
                            <div className="pam2-pec-quotas">
                              <div>
                                <label className="pam2-mini-label">Requests / Month</label>
                                <input
                                  type="number"
                                  className="pam2-input pam2-input-sm"
                                  disabled={!plan.offeredOnMarketplace}
                                  value={plan.requestsPerMonth}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setPlanList(
                                      planList.map((p) =>
                                        p.id === plan.id ? { ...p, requestsPerMonth: val } : p
                                      )
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <label className="pam2-mini-label">Rate Limit (req/min)</label>
                                <input
                                  type="number"
                                  className="pam2-input pam2-input-sm"
                                  disabled={!plan.offeredOnMarketplace}
                                  value={plan.rateLimitPerMin}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setPlanList(
                                      planList.map((p) =>
                                        p.id === plan.id ? { ...p, rateLimitPerMin: val } : p
                                      )
                                    );
                                  }}
                                />
                              </div>
                            </div>

                            {/* Features list */}
                            <div className="pam2-pec-features">
                              <label className="pam2-mini-label">Included Features</label>
                              <div className="pam2-features-list">
                                {plan.features.map((feat, idx) => (
                                  <div key={idx} className="pam2-feat-item">
                                    <Check size={12} className="pam2-feat-check" />
                                    <span>{feat}</span>
                                    {plan.offeredOnMarketplace && (
                                      <button
                                        type="button"
                                        onClick={() => removePlanFeature(plan.id, idx)}
                                      >
                                        <X size={10} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {plan.offeredOnMarketplace && (
                                <div className="pam2-add-feat-row">
                                  <input
                                    type="text"
                                    placeholder="Add feature bullet..."
                                    value={newFeatureInputs[plan.id] || ''}
                                    onChange={(e) =>
                                      setNewFeatureInputs({
                                        ...newFeatureInputs,
                                        [plan.id]: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addPlanFeature(plan.id);
                                      }
                                    }}
                                  />
                                  <button type="button" onClick={() => addPlanFeature(plan.id)}>
                                    <Plus size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Preview & Submit */}
              {currentStep === 'preview' && (
                <div className="pam2-step-content animate-slide-in">
                  <div className="pam2-step-header">
                    <div>
                      <h3 className="pam2-section-heading">Listing Preview & Submission</h3>
                      <p className="pam2-section-sub">
                        Review exactly how your API will appear to prospective consumers. Use Edit controls to make final adjustments.
                      </p>
                    </div>
                  </div>

                  {submitError && (
                    <div className="pam2-alert pam2-alert-error">
                      <AlertCircle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* High Fidelity Listing Preview Card */}
                  <div className="pam2-preview-frame">
                    {/* Header Banner */}
                    <div
                      className="pam2-prev-hero"
                      style={{
                        backgroundImage: bannerUrl ? `linear-gradient(180deg, rgba(10,12,18,0.4) 0%, rgba(10,12,18,0.95) 100%), url(${bannerUrl})` : undefined,
                      }}
                    >
                      <button
                        type="button"
                        className="pam2-prev-edit-btn"
                        onClick={() => goToStep('media')}
                      >
                        <Edit3 size={12} /> Edit Banner & Media
                      </button>

                      <div className="pam2-prev-hero-body">
                        <div className="pam2-prev-logo">
                          {logoUrl ? <img src={logoUrl} alt="" /> : <Server size={32} />}
                        </div>
                        <div className="pam2-prev-hero-text">
                          <div className="pam2-prev-badges-row">
                            <span className="pam2-prev-cat-badge">
                              {categories.find((c) => c.id === categoryId)?.name || 'API'}
                            </span>
                            <span className="pam2-prev-ver-badge">
                              {versionList.find((v) => v.offeredOnMarketplace)?.semver || 'v1.0.0'}
                            </span>
                            <span className="pam2-prev-rating">★ 5.0 (New)</span>
                          </div>
                          <h2 className="pam2-prev-title">{name || 'API Title'}</h2>
                          <p className="pam2-prev-sub">{description || 'API description preview...'}</p>
                          <div className="pam2-prev-provider">
                            Hosted by <b>{user?.name || 'Authorized Provider'}</b>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Jump Bar */}
                    <div className="pam2-prev-quick-jump">
                      <button type="button" onClick={() => goToStep('details')}>
                        <Edit3 size={12} /> Edit Details
                      </button>
                      <button type="button" onClick={() => goToStep('media')}>
                        <Edit3 size={12} /> Edit Media & Docs
                      </button>
                      <button type="button" onClick={() => goToStep('pricing')}>
                        <Edit3 size={12} /> Edit Pricing & Versions
                      </button>
                    </div>

                    {/* Preview Sections */}
                    <div className="pam2-prev-sections">
                      {/* Media Row (if video / screenshots present) */}
                      {(videoUrl || screenshots.length > 0) && (
                        <div className="pam2-prev-card">
                          <h4 className="pam2-prev-card-title">Media & Demos</h4>
                          {videoUrl && (
                            <div className="pam2-prev-video-box">
                              <Video size={16} /> Demo Video Available: <a href={videoUrl} target="_blank" rel="noreferrer">{videoUrl}</a>
                            </div>
                          )}
                          {screenshots.length > 0 && (
                            <div className="pam2-prev-screenshots-strip">
                              {screenshots.map((s) => (
                                <div key={s.id} className="pam2-prev-ss-item">
                                  <img src={s.url} alt={s.caption} />
                                  <span>{s.caption}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pricing Tiers Preview */}
                      <div className="pam2-prev-card">
                        <div className="pam2-prev-card-head-row">
                          <h4 className="pam2-prev-card-title">Commercial Tiers (Offered on Marketplace)</h4>
                          <span className="pam2-badge pam2-badge-sm">
                            {planList.filter((p) => p.offeredOnMarketplace).length} Active Tiers
                          </span>
                        </div>
                        <div className="pam2-prev-plans-grid">
                          {planList
                            .filter((p) => p.offeredOnMarketplace)
                            .map((plan) => (
                              <div key={plan.id} className="pam2-prev-plan-card">
                                <h5>{plan.name}</h5>
                                <div className="pam2-prev-plan-price">
                                  {plan.isFree || plan.priceMonthly === 0 ? (
                                    <span className="pam2-free-tag">FREE</span>
                                  ) : (
                                    <>
                                      <strong>${plan.priceMonthly}</strong>
                                      <small>/mo</small>
                                    </>
                                  )}
                                </div>
                                <div className="pam2-prev-plan-quotas">
                                  <span>{plan.requestsPerMonth.toLocaleString()} req/mo</span>
                                  <span>{plan.rateLimitPerMin} req/min</span>
                                </div>
                                <ul className="pam2-prev-plan-features">
                                  {plan.features.map((f, idx) => (
                                    <li key={idx}>
                                      <Check size={11} /> {f}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Documentation & Getting Started Preview */}
                      {documentationMarkdown && (
                        <div className="pam2-prev-card">
                          <h4 className="pam2-prev-card-title">Developer Integration Overview</h4>
                          <div className="pam2-prev-doc-content">
                            <pre>{documentationMarkdown}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Summary & Admin Approval Notice */}
                  <div className="pam2-submission-notice-card">
                    <div className="pam2-sn-icon">
                      <Shield size={24} className="pam2-shield-pulse" />
                    </div>
                    <div className="pam2-sn-body">
                      <h4>Submission Verification & Admin Approval</h4>
                      <p>
                        Submitting creates a formal <b>Admin Approval Request</b>. Your API will <b>not be published immediately</b>.
                      </p>
                      <ul className="pam2-sn-bullets">
                        <li>
                          <b>Auto-Publishing:</b> Platform admins will inspect and approve the listing. Upon approval, it immediately becomes public in the catalog.
                        </li>
                        <li>
                          <b>Studio Pricing Sync:</b> Approved pricing changes will automatically synchronize back to your Studio project <code>{selectedStudioApi?.name}</code>.
                        </li>
                        <li>
                          <b>Notifications:</b> You will receive an immediate in-app notification when the review decision is finalized.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation Bar */}
        {!submitSuccess && (
          <div className="pam2-footer">
            <div className="pam2-footer-left">
              {currentStep !== 'select' && (
                <button
                  type="button"
                  className="pam2-btn pam2-btn-secondary"
                  onClick={handleBack}
                  disabled={submitting}
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              {currentStep === 'select' && (
                <button
                  type="button"
                  className="pam2-btn pam2-btn-ghost"
                  onClick={onClose}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="pam2-footer-right">
              {currentStep !== 'preview' ? (
                <button
                  type="button"
                  className="pam2-btn pam2-btn-primary"
                  onClick={handleNext}
                >
                  <span>Continue</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="pam2-btn pam2-btn-primary pam2-btn-submit"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="pam2-spinner" />
                      <span>Creating Approval Request...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Submit for Admin Approval</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pam2-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(4, 6, 12, 0.82);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          overflow-y: auto;
          animation: pamFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pam2-shell {
          background: #0d101a;
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 20px;
          box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(139, 92, 246, 0.12);
          width: 100%;
          max-width: 1020px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          color: #f8fafc;
        }

        /* Header */
        .pam2-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 24px 28px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          background: linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, transparent 100%);
        }
        .pam2-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #c4b5fd;
          margin-bottom: 6px;
        }
        .pam2-header-title {
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }
        .pam2-header-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
          max-width: 680px;
          line-height: 1.45;
        }
        .pam2-close-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .pam2-close-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        /* Stepper Bar */
        .pam2-stepper-bar {
          display: flex;
          align-items: center;
          background: #090c14;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 12px 28px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .pam2-stepper-bar::-webkit-scrollbar { display: none; }
        .pam2-stepper-item {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          cursor: pointer;
          opacity: 0.45;
          transition: all 0.25s ease;
          flex-shrink: 0;
        }
        .pam2-stepper-item.active { opacity: 1; }
        .pam2-stepper-item.completed { opacity: 0.85; }
        .pam2-stepper-item:hover { opacity: 1; }
        .pam2-stepper-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          transition: all 0.25s ease;
        }
        .pam2-stepper-item.active .pam2-stepper-circle {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          border-color: #a78bfa;
          color: #ffffff;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.5);
        }
        .pam2-stepper-item.completed .pam2-stepper-circle {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
          color: #4ade80;
        }
        .pam2-stepper-labels {
          display: flex;
          flex-direction: column;
        }
        .pam2-stepper-num {
          font-size: 9px;
          font-weight: 800;
          color: #8b5cf6;
          letter-spacing: 0.06em;
        }
        .pam2-stepper-name {
          font-size: 12px;
          font-weight: 600;
          color: #e2e8f0;
          white-space: nowrap;
        }
        .pam2-stepper-line {
          width: 32px;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 0 12px;
          flex-shrink: 0;
        }

        /* Body Area */
        .pam2-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
          min-height: 420px;
        }

        .pam2-step-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .pam2-section-heading {
          font-size: 17px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 4px;
        }
        .pam2-section-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.4;
        }
        .pam2-cta-studio-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.35);
          color: #c4b5fd;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 14px;
          border-radius: 999px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .pam2-cta-studio-btn:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: #a78bfa;
          color: #ffffff;
          transform: translateY(-1px);
        }
        .pam2-source-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 11.5px;
          padding: 4px 10px;
          border-radius: 999px;
        }

        /* Step 1 Project Grid */
        .pam2-project-filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .pam2-search-box {
          position: relative;
          flex: 1;
          max-width: 380px;
        }
        .pam2-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
        }
        .pam2-search-box input {
          width: 100%;
          background: #131724;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 7px 28px 7px 32px;
          color: #f8fafc;
          font-size: 12.5px;
        }
        .pam2-search-box input:focus {
          outline: none;
          border-color: #8b5cf6;
        }
        .pam2-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
        }
        .pam2-project-count-badge {
          font-size: 12px;
          color: #94a3b8;
        }
        .pam2-projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 14px;
        }
        .pam2-project-card {
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .pam2-project-card:hover {
          background: #171b2b;
          border-color: rgba(139, 92, 246, 0.35);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
        }
        .pam2-project-card.selected {
          background: linear-gradient(145deg, rgba(139, 92, 246, 0.18) 0%, #141727 100%);
          border-color: #8b5cf6;
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.25);
        }
        .pam2-pc-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .pam2-pc-meta {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .pam2-pc-version {
          font-size: 11px;
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          color: #c4b5fd;
          background: rgba(139, 92, 246, 0.15);
          padding: 2px 7px;
          border-radius: 6px;
        }
        .pam2-pc-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: #94a3b8;
        }
        .pam2-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #94a3b8;
        }
        .pam2-pc-status.status-healthy .pam2-status-dot,
        .pam2-pc-status.status-published .pam2-status-dot { background: #22c55e; }
        .pam2-pc-status.status-deploying .pam2-status-dot { background: #f59e0b; }
        .pam2-pc-status.status-draft .pam2-status-dot { background: #a78bfa; }
        .pam2-pc-radio {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          transition: all 0.2s ease;
        }
        .pam2-pc-radio.checked {
          background: #8b5cf6;
          border-color: #8b5cf6;
        }
        .pam2-pc-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .pam2-pc-desc {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.4;
          margin: 0 0 14px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex: 1;
        }
        .pam2-pc-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pam2-stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.04);
          padding: 3px 8px;
          border-radius: 6px;
        }
        .pam2-pc-selected-banner {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          font-size: 11.5px;
          font-weight: 700;
          color: #c4b5fd;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* Empty State */
        .pam2-empty-state {
          position: relative;
          padding: 60px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          overflow: hidden;
        }
        .pam2-empty-aura {
          position: absolute;
          width: 260px;
          height: 140px;
          background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.25) 0%, transparent 70%);
          filter: blur(28px);
          pointer-events: none;
        }
        .pam2-empty-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c4b5fd;
          margin-bottom: 16px;
          box-shadow: 0 0 24px rgba(139, 92, 246, 0.25);
        }
        .pam2-empty-title {
          font-size: 19px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 8px;
        }
        .pam2-empty-desc {
          font-size: 13.5px;
          color: #94a3b8;
          max-width: 480px;
          margin: 0 0 24px;
          line-height: 1.5;
        }
        .pam2-pulse-btn {
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
          animation: pamGlowPulse 2.5s infinite alternate;
        }

        /* Forms Grid */
        .pam2-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .pam2-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pam2-form-field.full-width { grid-column: span 2; }
        .pam2-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .pam2-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .pam2-req { color: #f43f5e; }
        .pam2-hint {
          font-size: 11px;
          color: #64748b;
        }
        .pam2-error-text {
          font-size: 11.5px;
          color: #f87171;
        }
        .pam2-input,
        .pam2-select,
        .pam2-textarea {
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9px;
          padding: 9px 12px;
          color: #f8fafc;
          font-size: 13px;
          transition: all 0.2s ease;
        }
        .pam2-input:focus,
        .pam2-select:focus,
        .pam2-textarea:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18);
          background: #151928;
        }
        .pam2-input.has-error,
        .pam2-select.has-error,
        .pam2-textarea.has-error {
          border-color: #f43f5e;
        }
        .pam2-mono {
          font-family: var(--font-mono, monospace);
          font-size: 12.5px;
        }

        /* Tags */
        .pam2-tags-wrap {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 9px;
          padding: 8px 10px;
        }
        .pam2-tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11.5px;
          font-weight: 600;
          color: #c4b5fd;
          background: rgba(139, 92, 246, 0.18);
          border: 1px solid rgba(139, 92, 246, 0.3);
          padding: 2px 7px;
          border-radius: 6px;
        }
        .pam2-tag-chip button {
          background: none;
          border: none;
          color: #a78bfa;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
        }
        .pam2-tag-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 140px;
        }
        .pam2-tag-input-row input {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 12.5px;
          outline: none;
          width: 100%;
        }
        .pam2-tag-add-btn {
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #cbd5e1;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        /* Step 3 Media Columns */
        .pam2-media-columns {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 20px;
        }
        .pam2-media-block {
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .pam2-block-title {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .pam2-image-preview-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pam2-logo-preview {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: #94a3b8;
          flex-shrink: 0;
        }
        .pam2-logo-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .pam2-presets-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }
        .pam2-presets-label {
          font-size: 10.5px;
          color: #64748b;
        }
        .pam2-preset-thumb {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          padding: 0;
          cursor: pointer;
        }
        .pam2-preset-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .pam2-banner-preview {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .pam2-banner-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .pam2-link-btn {
          background: none;
          border: none;
          color: #c4b5fd;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .pam2-ss-add-box {
          display: grid;
          grid-template-columns: 1.5fr 1.2fr auto;
          gap: 8px;
        }
        .pam2-screenshots-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .pam2-ss-card {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #090c14;
        }
        .pam2-ss-card img {
          width: 100%;
          height: 70px;
          object-fit: cover;
        }
        .pam2-ss-caption {
          font-size: 10.5px;
          color: #94a3b8;
          padding: 4px 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pam2-ss-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.7);
          border: none;
          color: #f87171;
          border-radius: 4px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .pam2-subtabs {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px;
          border-radius: 6px;
        }
        .pam2-subtab {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .pam2-subtab.active {
          background: rgba(139, 92, 246, 0.25);
          color: #c4b5fd;
        }
        .pam2-md-preview {
          background: #090c14;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9px;
          padding: 12px;
          font-size: 12px;
          color: #cbd5e1;
          max-height: 180px;
          overflow-y: auto;
        }
        .pam2-md-preview pre { margin: 0; white-space: pre-wrap; font-family: var(--font-mono, monospace); }

        /* Step 4 Pricing & Versions */
        .pam2-guardrail-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 20px;
        }
        .pam2-gr-icon { color: #a78bfa; flex-shrink: 0; margin-top: 2px; }
        .pam2-gr-content strong { color: #ffffff; font-size: 13px; display: block; margin-bottom: 3px; }
        .pam2-gr-content p { font-size: 12.5px; color: #cbd5e1; margin: 0; line-height: 1.45; }
        .pam2-sync-alert-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          padding: 4px 10px;
          border-radius: 999px;
        }
        .pam2-pricing-section {
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 18px;
        }
        .pam2-section-subheading {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 14px;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .pam2-version-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #0d101a;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .pam2-vr-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pam2-vr-semver {
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }
        .pam2-vr-status {
          font-size: 10px;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
          color: #94a3b8;
        }
        .pam2-vr-notes { font-size: 12px; color: #64748b; }
        .pam2-vr-toggles {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .pam2-toggle-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #cbd5e1;
          cursor: pointer;
        }
        .pam2-toggle-label input[type='checkbox'] {
          accent-color: #8b5cf6;
          width: 15px;
          height: 15px;
          cursor: pointer;
        }
        .pam2-free-highlight { color: #4ade80; font-weight: 700; }
        .pam2-plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .pam2-plan-editor-card {
          background: #0d101a;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.2s ease;
        }
        .pam2-plan-editor-card.plan-disabled {
          opacity: 0.45;
          border-style: dashed;
        }
        .pam2-pec-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .pam2-pec-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }
        .pam2-pec-slug {
          font-size: 10.5px;
          color: #64748b;
          font-family: var(--font-mono, monospace);
        }
        .pam2-pec-pricing-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
        }
        .pam2-price-input-wrap {
          display: flex;
          align-items: baseline;
          gap: 3px;
        }
        .pam2-cur { font-size: 15px; color: #94a3b8; }
        .pam2-price-input-wrap input {
          width: 70px;
          background: #141724;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 700;
          padding: 3px 6px;
        }
        .pam2-interval { font-size: 12px; color: #64748b; }
        .pam2-free-text { color: #4ade80; font-weight: 700; }
        .pam2-diff-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          font-weight: 600;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 6px;
          padding: 4px 8px;
        }
        .pam2-pec-quotas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .pam2-mini-label {
          font-size: 10.5px;
          color: #94a3b8;
          font-weight: 600;
          display: block;
          margin-bottom: 3px;
        }
        .pam2-input-sm {
          padding: 5px 8px;
          font-size: 12px;
          width: 100%;
        }
        .pam2-features-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 6px;
          max-height: 120px;
          overflow-y: auto;
        }
        .pam2-feat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.02);
          padding: 3px 6px;
          border-radius: 4px;
        }
        .pam2-feat-item span { flex: 1; }
        .pam2-feat-item button {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
        }
        .pam2-feat-item button:hover { color: #f87171; }
        .pam2-feat-check { color: #8b5cf6; flex-shrink: 0; }
        .pam2-add-feat-row {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .pam2-add-feat-row input {
          flex: 1;
          background: #141724;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 4px 8px;
          color: #ffffff;
          font-size: 11.5px;
        }
        .pam2-add-feat-row button {
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: #c4b5fd;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
        }

        /* Step 5 Preview */
        .pam2-preview-frame {
          background: #090c14;
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 18px;
        }
        .pam2-prev-hero {
          position: relative;
          min-height: 160px;
          background-color: #121522;
          background-size: cover;
          background-position: center;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .pam2-prev-edit-btn {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s ease;
        }
        .pam2-prev-edit-btn:hover { background: rgba(0, 0, 0, 0.9); color: #ffffff; }
        .pam2-prev-hero-body {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .pam2-prev-logo {
          width: 64px;
          height: 64px;
          border-radius: 14px;
          background: #1e2235;
          border: 2px solid rgba(255, 255, 255, 0.15);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c4b5fd;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
        }
        .pam2-prev-logo img { width: 100%; height: 100%; object-fit: cover; }
        .pam2-prev-hero-text { flex: 1; }
        .pam2-prev-badges-row {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 5px;
        }
        .pam2-prev-cat-badge {
          font-size: 10.5px;
          font-weight: 700;
          color: #c4b5fd;
          background: rgba(139, 92, 246, 0.25);
          padding: 2px 7px;
          border-radius: 4px;
        }
        .pam2-prev-ver-badge {
          font-size: 10.5px;
          font-family: var(--font-mono, monospace);
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 7px;
          border-radius: 4px;
        }
        .pam2-prev-rating { font-size: 11px; font-weight: 700; color: #fbbf24; }
        .pam2-prev-title {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 3px;
        }
        .pam2-prev-sub {
          font-size: 12.5px;
          color: #cbd5e1;
          margin: 0 0 4px;
          line-height: 1.4;
        }
        .pam2-prev-provider {
          font-size: 11px;
          color: #94a3b8;
        }
        .pam2-prev-provider b { color: #f8fafc; }
        .pam2-prev-quick-jump {
          display: flex;
          gap: 8px;
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .pam2-prev-quick-jump button {
          background: none;
          border: none;
          color: #a78bfa;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .pam2-prev-quick-jump button:hover { color: #c4b5fd; text-decoration: underline; }
        .pam2-prev-sections {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .pam2-prev-card {
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 16px;
        }
        .pam2-prev-card-head-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .pam2-prev-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 10px;
        }
        .pam2-prev-video-box {
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .pam2-prev-video-box a { color: #c4b5fd; text-decoration: underline; }
        .pam2-prev-screenshots-strip {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 6px;
        }
        .pam2-prev-ss-item {
          flex-shrink: 0;
          width: 140px;
          border-radius: 6px;
          overflow: hidden;
          background: #090c14;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pam2-prev-ss-item img {
          width: 100%;
          height: 75px;
          object-fit: cover;
        }
        .pam2-prev-ss-item span {
          font-size: 10px;
          color: #94a3b8;
          padding: 4px 6px;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pam2-prev-plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .pam2-prev-plan-card {
          background: #0d101a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 14px;
        }
        .pam2-prev-plan-card h5 {
          font-size: 14px;
          color: #ffffff;
          margin: 0 0 6px;
        }
        .pam2-prev-plan-price { margin-bottom: 8px; }
        .pam2-prev-plan-price strong { font-size: 20px; color: #ffffff; }
        .pam2-prev-plan-price small { font-size: 12px; color: #94a3b8; }
        .pam2-free-tag {
          font-size: 12px;
          font-weight: 800;
          color: #4ade80;
          background: rgba(34, 197, 94, 0.15);
          padding: 2px 7px;
          border-radius: 4px;
        }
        .pam2-prev-plan-quotas {
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .pam2-prev-plan-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pam2-prev-plan-features li {
          font-size: 11px;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .pam2-prev-plan-features svg { color: #8b5cf6; flex-shrink: 0; }
        .pam2-prev-doc-content {
          background: #090c14;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 12px;
          max-height: 140px;
          overflow-y: auto;
          font-size: 11.5px;
          color: #cbd5e1;
        }
        .pam2-prev-doc-content pre { margin: 0; white-space: pre-wrap; font-family: var(--font-mono, monospace); }

        /* Submission notice */
        .pam2-submission-notice-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(99, 102, 241, 0.08) 100%);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 14px;
          padding: 18px 20px;
        }
        .pam2-sn-icon { color: #c4b5fd; flex-shrink: 0; margin-top: 2px; }
        .pam2-shield-pulse { animation: pamGlowPulse 2.5s infinite alternate; }
        .pam2-sn-body h4 {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px;
        }
        .pam2-sn-body p {
          font-size: 12.5px;
          color: #cbd5e1;
          margin: 0 0 10px;
          line-height: 1.45;
        }
        .pam2-sn-bullets {
          margin: 0;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pam2-sn-bullets li {
          font-size: 12px;
          color: #cbd5e1;
          line-height: 1.4;
        }
        .pam2-sn-bullets b { color: #ffffff; }

        /* Success Card */
        .pam2-success-card {
          position: relative;
          padding: 40px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .pam2-success-aura {
          position: absolute;
          width: 320px;
          height: 180px;
          background: radial-gradient(ellipse at center, rgba(34, 197, 94, 0.22) 0%, transparent 70%);
          filter: blur(34px);
          pointer-events: none;
        }
        .pam2-success-icon-wrap {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4ade80;
          margin-bottom: 20px;
          box-shadow: 0 0 32px rgba(34, 197, 94, 0.3);
        }
        .pam2-success-title {
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 8px;
        }
        .pam2-success-desc {
          font-size: 14px;
          color: #cbd5e1;
          max-width: 520px;
          margin: 0 0 24px;
          line-height: 1.5;
        }
        .pam2-timeline-card {
          width: 100%;
          max-width: 540px;
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 20px 24px;
          text-align: left;
          margin-bottom: 28px;
        }
        .pam2-timeline-title {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 14px;
        }
        .pam2-timeline-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .pam2-timeline-step {
          display: flex;
          gap: 12px;
          position: relative;
        }
        .pam2-tl-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-top: 4px;
          flex-shrink: 0;
        }
        .pam2-timeline-step.done .pam2-tl-dot { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
        .pam2-timeline-step.pending .pam2-tl-dot { background: rgba(255, 255, 255, 0.2); }
        .pam2-timeline-step strong { font-size: 12.5px; color: #ffffff; display: block; margin-bottom: 2px; }
        .pam2-timeline-step p { font-size: 11.5px; color: #94a3b8; margin: 0; line-height: 1.4; }
        .pam2-success-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Footer */
        .pam2-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 28px;
          background: #090c14;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .pam2-footer-left,
        .pam2-footer-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Buttons */
        .pam2-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          padding: 9px 18px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid transparent;
        }
        .pam2-btn-primary {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
        }
        .pam2-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
          filter: brightness(1.08);
        }
        .pam2-btn-submit {
          padding: 10px 22px;
          font-weight: 700;
        }
        .pam2-btn-secondary {
          background: #141724;
          border-color: rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
        }
        .pam2-btn-secondary:hover:not(:disabled) {
          background: #1e2235;
          color: #ffffff;
        }
        .pam2-btn-ghost {
          background: transparent;
          color: #94a3b8;
        }
        .pam2-btn-ghost:hover { color: #ffffff; }
        .pam2-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Alerts & Helpers */
        .pam2-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
        }
        .pam2-alert-error {
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #fca5a5;
        }

        .pam2-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: pamSpin 0.7s linear infinite;
        }

        /* Skeletons */
        .pam2-loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .pam2-skeleton-card {
          background: #121522;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pam2-sk-line {
          height: 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          animation: pamPulse 1.5s infinite ease-in-out;
        }
        .pam2-sk-line.title { width: 60%; height: 16px; }
        .pam2-sk-line.subtitle { width: 90%; }
        .pam2-sk-row { display: flex; gap: 8px; margin-top: 8px; }
        .pam2-sk-chip {
          width: 65px;
          height: 20px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          animation: pamPulse 1.5s infinite ease-in-out;
        }

        /* Animations */
        @keyframes pamFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pamSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes pamPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.85; }
        }
        @keyframes pamGlowPulse {
          0% { box-shadow: 0 0 12px rgba(139, 92, 246, 0.25); }
          100% { box-shadow: 0 0 26px rgba(139, 92, 246, 0.55); }
        }
        .animate-slide-in {
          animation: pamSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes pamSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: pamFadeIn 0.3s ease;
        }

        @media (max-width: 768px) {
          .pam2-overlay { padding: 10px; }
          .pam2-shell { max-height: 96vh; }
          .pam2-form-grid,
          .pam2-media-columns { grid-template-columns: 1fr; }
          .pam2-form-field.full-width { grid-column: span 1; }
          .pam2-header { padding: 18px 16px; }
          .pam2-body { padding: 18px 16px; }
          .pam2-footer { padding: 14px 16px; }
          .pam2-stepper-bar { padding: 10px 16px; }
        }
      `}</style>
    </div>
  );
};
