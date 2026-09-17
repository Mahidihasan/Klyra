import React from 'react';
import { CatalogApi } from '../../../services/api/catalog';

interface ApiThumbnailProps {
  api: Pick<CatalogApi, 'name' | 'categoryName' | 'categoryIcon' | 'logoUrl' | 'slug'>;
  className?: string;
}

const CATEGORY_COLORS: Record<string, [string, string]> = {
  'AI & ML': ['#7c3aed', '#22d3ee'],
  Finance: ['#0f766e', '#f59e0b'],
  Weather: ['#2563eb', '#38bdf8'],
  'Developer Tools': ['#334155', '#a78bfa'],
  Communication: ['#be185d', '#fb7185'],
  'E-commerce': ['#c2410c', '#facc15'],
  News: ['#0369a1', '#67e8f9'],
};

export const ApiThumbnail: React.FC<ApiThumbnailProps> = ({ api, className = '' }) => {
  const [start, end] = CATEGORY_COLORS[api.categoryName] || ['#4f46e5', '#a78bfa'];
  const initials = api.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const gradientId = `api-thumb-${api.slug || api.name.replace(/\W/g, '')}`;

  if (api.logoUrl) {
    return <img src={api.logoUrl} alt="" className={`api-thumbnail-image ${className}`} />;
  }

  return (
    <div
      className={`api-thumbnail ${className}`}
      style={{ '--thumb-start': start, '--thumb-end': end } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 88 88" role="presentation">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={start} />
            <stop offset="1" stopColor={end} />
          </linearGradient>
        </defs>
        <rect width="88" height="88" rx="18" fill={`url(#${gradientId})`} />
        <path d="M-8 66C15 42 31 83 54 56S83 33 98 47V96H-8Z" fill="rgba(255,255,255,.13)" />
        <circle cx="69" cy="18" r="14" fill="rgba(255,255,255,.12)" />
        <path
          d="M25 31h38M25 43h24M25 55h31"
          stroke="rgba(255,255,255,.52)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <text
          x="44"
          y="73"
          fill="#fff"
          fontSize="14"
          fontWeight="800"
          textAnchor="middle"
          letterSpacing="1"
        >
          {initials}
        </text>
      </svg>
    </div>
  );
};

export default ApiThumbnail;
