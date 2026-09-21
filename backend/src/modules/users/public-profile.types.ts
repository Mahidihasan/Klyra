import type { ProfileAchievement, ProfileEducation, ProfileExperience } from '../auth/auth.types';
import type { PublicProfileCertificate } from '../certificates/certificates.service';

export interface PublicProfileApiPricingPlan {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: string;
  features: string[];
  rate_limit: number | null;
}

export interface PublicProfileApi {
  slug: string;
  name: string;
  description: string | null;
  current_version: string;
  documentation_url: string | null;
  category: { name: string; slug: string } | null;
  pricing_model: string;
  tags: string[];
  endpoint_count: number;
  pricing: PublicProfileApiPricingPlan[];
  published_at: string | null;
  updated_at: string;
  star_count: number;
  viewer_has_starred: boolean;
}

export interface PublicProfileActivity {
  id: string;
  label: string;
  kind: string;
  at: string;
}

export interface PublicProfileResponse {
  profile: {
    name: string;
    username: string;
    avatar_url: string | null;
    job_title: string | null;
    company: string | null;
    bio: string | null;
    github: string | null;
    website: string | null;
    skills: string[];
    experience: ProfileExperience[];
    education: ProfileEducation[];
  };
  achievements: ProfileAchievement[];
  certificates: PublicProfileCertificate[];
  published_apis: PublicProfileApi[];
  activity: PublicProfileActivity[];
}
