import React from 'react';
import { CatalogApi } from '../../../services/api/catalog';

interface ApiThumbnailProps {
  api: {
    id?: string;
    name: string;
    categoryName?: string;
    categoryIcon?: string;
    logoUrl?: string;
    slug?: string;
  };
  className?: string;
}

export const ApiThumbnail: React.FC<ApiThumbnailProps> = ({ api, className = '' }) => {
  if (api.logoUrl && api.logoUrl.trim() !== '') {
    return <img src={api.logoUrl} alt="" className={`api-thumbnail-image ${className}`} />;
  }

  const slug = (api.slug || api.id || api.name || '').toLowerCase();

  // 1. OpenAI
  if (slug.includes('openai') || slug.includes('chatgpt') || slug.includes('gpt')) {
    return (
      <div className={`api-brand-thumb openai ${className}`} title="OpenAI">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#10a37f" />
          <path
            d="M17.5 10.2a4.3 4.3 0 0 0-.4-3.3 4.4 4.4 0 0 0-4.1-2.1 4.5 4.5 0 0 0-2.3.6 4.3 4.3 0 0 0-2.8 1.4 4.4 4.4 0 0 0-.8 3.3 4.3 4.3 0 0 0-2.4 1.4 4.4 4.4 0 0 0-.7 3.3 4.3 4.3 0 0 0 2.4 3 4.4 4.4 0 0 0 2.3.6 4.3 4.3 0 0 0 2.8-1.4 4.4 4.4 0 0 0 .8-3.3 4.3 4.3 0 0 0 2.4-1.4 4.4 4.4 0 0 0 .7-3.3zm-5.5 8.3a3.1 3.1 0 0 1-2.2-.9l.1-.6 2.5-1.5a.7.7 0 0 0 .3-.6v-3.4l1.1.6a.1.1 0 0 1 .1.1v3.2a3.2 3.2 0 0 1-1.9 2.6zm-5-2.2a3.1 3.1 0 0 1-.4-2.4l.5.3 2.5 1.5a.7.7 0 0 0 .7 0l2.9-1.7v1.3a.1.1 0 0 1 0 .1l-2.8 1.6a3.2 3.2 0 0 1-3.4-.7zm-1.2-5.4a3.1 3.1 0 0 1 1.8-1.5v3l2.5 1.5a.7.7 0 0 0 .7 0l2.9-1.7-1.1-.6a.1.1 0 0 1-.1-.1l-2.8-1.6a3.2 3.2 0 0 1-3.8 1zm8.7-2.3l-2.9 1.7v-1.3a.1.1 0 0 1 0-.1l2.8-1.6a3.2 3.2 0 0 1 3.4.7 3.1 3.1 0 0 1 .4 2.4l-.5-.3-2.5-1.5a.7.7 0 0 0-.7 0zm2.2 4.6l-2.5-1.5a.7.7 0 0 0-.7 0l-2.9 1.7 1.1.6a.1.1 0 0 1 .1.1l2.8 1.6a3.2 3.2 0 0 1 3.8-1 3.1 3.1 0 0 1-1.7 1.5v-3zm-6.2.8l1.3-.8 1.3.8v1.5l-1.3.8-1.3-.8v-1.5z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 2. Anthropic Claude
  if (slug.includes('claude') || slug.includes('anthropic')) {
    return (
      <div className={`api-brand-thumb claude ${className}`} title="Anthropic Claude">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#cc785c" />
          <path
            d="M13.6 5h2.1l5 14h-2.3l-1.1-3.3h-5.2L11 19H8.7l4.9-14zm1.9 8.7l-1.7-5.1h-.1l-1.8 5.1h3.6zM5.3 19l4.5-12.7H7.6L4.2 16.5 5.3 19z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 3. Stripe
  if (slug.includes('stripe')) {
    return (
      <div className={`api-brand-thumb stripe ${className}`} title="Stripe">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#6366f1" />
          <path
            d="M14.6 10.3c0-.9-.7-1.4-1.9-1.4-1.6 0-3.3.6-4.5 1.4l-.8-2.3C8.8 7.3 11 6.7 13 6.7c3 0 4.8 1.5 4.8 4.2 0 4-5.6 3.4-5.6 5.2 0 .9.8 1.3 2 1.3 1.8 0 3.6-.8 4.6-1.5l.8 2.3c-1.4.9-3.4 1.4-5.5 1.4-3.2 0-5.1-1.6-5.1-4.2 0-4.2 5.6-3.6 5.6-5.1z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 4. GitHub
  if (slug.includes('github')) {
    return (
      <div className={`api-brand-thumb github ${className}`} title="GitHub">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#24292e" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 4C7.58 4 4 7.58 4 12c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 20 12c0-4.42-3.58-8-8-8z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 5. Google Maps
  if (slug.includes('google-maps') || (slug.includes('google') && slug.includes('map'))) {
    return (
      <div className={`api-brand-thumb google-maps ${className}`} title="Google Maps">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#ffffff" />
          <path
            d="M12 3C8.13 3 5 6.13 5 10c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
            fill="#ea4335"
          />
          <path d="M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="#4285f4" />
        </svg>
      </div>
    );
  }

  // 6. WeatherAPI / OpenWeather
  if (slug.includes('weather')) {
    return (
      <div className={`api-brand-thumb weather ${className}`} title="Weather API">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#0284c7" />
          <circle cx="9" cy="9" r="3.5" fill="#facc15" />
          <path
            d="M7 16a3.5 3.5 0 0 1 3.5-3.5c.3 0 .6.04.9.1A4.5 4.5 0 0 1 19 14.5a3.5 3.5 0 0 1-3.5 3.5H10.5A3.5 3.5 0 0 1 7 16z"
            fill="#e0f2fe"
          />
          <path d="M11 19l-1 2M15 19l-1 2" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 7. Hugging Face
  if (slug.includes('huggingface') || slug.includes('hugging-face')) {
    return (
      <div className={`api-brand-thumb huggingface ${className}`} title="Hugging Face">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#f59e0b" />
          <circle cx="12" cy="12" r="7" fill="#fde047" />
          <circle cx="9.5" cy="10.5" r="1" fill="#1e293b" />
          <circle cx="14.5" cy="10.5" r="1" fill="#1e293b" />
          <path d="M9 14c.8 1.2 2.2 1.5 3 1.5s2.2-.3 3-1.5" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5.5 12.5C5 14 6 16 7.5 15M18.5 12.5C19 14 18 16 16.5 15" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 8. Slack
  if (slug.includes('slack')) {
    return (
      <div className={`api-brand-thumb slack ${className}`} title="Slack">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#4a154b" />
          <path d="M7 10a1.5 1.5 0 1 1-1.5-1.5H7V10zm1 0a1.5 1.5 0 0 1 3 0v4a1.5 1.5 0 0 1-3 0v-4z" fill="#36c5f0" />
          <path d="M10 7a1.5 1.5 0 1 1-1.5-1.5V7H10zm0 1a1.5 1.5 0 0 1 0 3H6a1.5 1.5 0 0 1 0-3h4z" fill="#2eb67d" />
          <path d="M17 14a1.5 1.5 0 1 1 1.5 1.5H17V14zm-1 0a1.5 1.5 0 0 1-3 0v-4a1.5 1.5 0 0 1 3 0v4z" fill="#e01e5a" />
          <path d="M14 17a1.5 1.5 0 1 1 1.5 1.5V17H14zm0-1a1.5 1.5 0 0 1 0-3h4a1.5 1.5 0 0 1 0 3h-4z" fill="#ecb22e" />
        </svg>
      </div>
    );
  }

  // 9. Twilio
  if (slug.includes('twilio')) {
    return (
      <div className={`api-brand-thumb twilio ${className}`} title="Twilio">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#f22f46" />
          <circle cx="9" cy="9" r="2.2" fill="#ffffff" />
          <circle cx="15" cy="9" r="2.2" fill="#ffffff" />
          <circle cx="9" cy="15" r="2.2" fill="#ffffff" />
          <circle cx="15" cy="15" r="2.2" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 10. SendGrid
  if (slug.includes('sendgrid')) {
    return (
      <div className={`api-brand-thumb sendgrid ${className}`} title="SendGrid">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#009dd9" />
          <rect x="5.5" y="5.5" width="5.5" height="5.5" rx="1" fill="#ffffff" />
          <rect x="13" y="5.5" width="5.5" height="5.5" rx="1" fill="#80cef0" />
          <rect x="5.5" y="13" width="5.5" height="5.5" rx="1" fill="#80cef0" />
          <rect x="13" y="13" width="5.5" height="5.5" rx="1" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 11. Supabase
  if (slug.includes('supabase')) {
    return (
      <div className={`api-brand-thumb supabase ${className}`} title="Supabase">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#1c1c1c" />
          <path
            d="M13.2 4.5l-6.8 8.8c-.3.4 0 1 .5 1h5.6l-2.1 5.2c-.3.7.6 1.2 1.1.6l6.8-8.8c.3-.4 0-1-.5-1h-5.6l2.1-5.2c.3-.7-.6-1.2-1.1-.6z"
            fill="#3ecf8e"
          />
        </svg>
      </div>
    );
  }

  // 12. Resend
  if (slug.includes('resend')) {
    return (
      <div className={`api-brand-thumb resend ${className}`} title="Resend">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#000000" />
          <path
            d="M6 8l6 4.5L18 8v8H6V8zm0-1.5C5.2 6.5 4.5 7.2 4.5 8v8c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5V8c0-.8-.7-1.5-1.5-1.5H6z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 13. Perplexity
  if (slug.includes('perplexity')) {
    return (
      <div className={`api-brand-thumb perplexity ${className}`} title="Perplexity">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#13343b" />
          <path
            d="M12 5v14M5 12h14M7 7l10 10M17 7L7 17"
            stroke="#20b2aa"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 14. ElevenLabs
  if (slug.includes('elevenlabs') || slug.includes('eleven')) {
    return (
      <div className={`api-brand-thumb elevenlabs ${className}`} title="ElevenLabs">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#0f172a" />
          <rect x="8" y="6" width="3" height="12" rx="1.5" fill="#ffffff" />
          <rect x="13" y="6" width="3" height="12" rx="1.5" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 15. Mapbox
  if (slug.includes('mapbox')) {
    return (
      <div className={`api-brand-thumb mapbox ${className}`} title="Mapbox">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#4264fb" />
          <path
            d="M6 16l4-2.5 4 2.5 4-2.5V7.5L14 10 10 7.5 6 10v6z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 16. Pinecone
  if (slug.includes('pinecone')) {
    return (
      <div className={`api-brand-thumb pinecone ${className}`} title="Pinecone">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#18181b" />
          <path d="M12 5l-4 3v5l4 3 4-3V8l-4-3zm0 2.2l2.5 1.9-2.5 1.9-2.5-1.9L12 7.2z" fill="#22c55e" />
        </svg>
      </div>
    );
  }

  // 17. Vercel
  if (slug.includes('vercel')) {
    return (
      <div className={`api-brand-thumb vercel ${className}`} title="Vercel">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#000000" />
          <path d="M12 6l6 11H6l6-11z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 18. YouTube
  if (slug.includes('youtube')) {
    return (
      <div className={`api-brand-thumb youtube ${className}`} title="YouTube">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#ff0000" />
          <path d="M10 8.5l5 3.5-5 3.5v-7z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 19. Spotify
  if (slug.includes('spotify')) {
    return (
      <div className={`api-brand-thumb spotify ${className}`} title="Spotify">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#1ed760" />
          <path
            d="M6.5 9.5c3.5-1 7.5-.8 11 .8m-10.5 3c3-.8 6.5-.6 9.5.8m-8.5 3c2.5-.7 5.2-.5 7.5.7"
            stroke="#121212"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 20. Twitch
  if (slug.includes('twitch')) {
    return (
      <div className={`api-brand-thumb twitch ${className}`} title="Twitch">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#9146ff" />
          <path d="M6 5h12v9l-3 3h-3l-2 2v-2H6V5zm8 4h-2v4h2V9zm-5 0H7v4h2V9z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 21. Discord
  if (slug.includes('discord')) {
    return (
      <div className={`api-brand-thumb discord ${className}`} title="Discord">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#5865f2" />
          <path
            d="M17.5 7.5s-1.2-.9-2.5-1.1c-.2.3-.3.8-.5 1.1-1.3-.2-2.7-.2-4 0-.2-.4-.3-.8-.5-1.1-1.3.2-2.5 1.1-2.5 1.1S5.5 11.5 6 15.5c1.4 1 2.8 1 2.8 1s.4-.5.7-.9c-1-.3-1.4-.9-1.4-.9s.1.1.2.1c1.3.8 2.6 1.1 3.7 1.1s2.4-.3 3.7-1.1c.1 0 .2-.1.2-.1s-.4.6-1.4.9c.3.4.7.9.7.9s1.4 0 2.8-1c.5-4-.5-8-1.5-8zm-7.2 6.5c-.8 0-1.4-.7-1.4-1.5s.6-1.5 1.4-1.5c.8 0 1.4.7 1.4 1.5s-.6 1.5-1.4 1.5zm3.4 0c-.8 0-1.4-.7-1.4-1.5s.6-1.5 1.4-1.5c.8 0 1.4.7 1.4 1.5s-.6 1.5-1.4 1.5z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 22. CoinGecko
  if (slug.includes('coingecko')) {
    return (
      <div className={`api-brand-thumb coingecko ${className}`} title="CoinGecko">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#8dc63f" />
          <circle cx="12" cy="12" r="6" fill="#facc15" />
          <circle cx="10" cy="11" r="1" fill="#1f2937" />
          <path d="M10 14c1 .8 3 .8 4 0" stroke="#1f2937" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 23. NewsAPI
  if (slug.includes('news')) {
    return (
      <div className={`api-brand-thumb news ${className}`} title="NewsAPI">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#0284c7" />
          <path d="M6 7h12v10H6V7zm3 3h6m-6 3h4" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 24. IP Geolocation
  if (slug.includes('geo') || slug.includes('ip')) {
    return (
      <div className={`api-brand-thumb geolocation ${className}`} title="IP Geolocation">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#0d9488" />
          <circle cx="12" cy="12" r="6.5" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M5.5 12h13M12 5.5c2 2.5 2 10.5 0 13M12 5.5c-2 2.5-2 10.5 0 13" stroke="#ffffff" strokeWidth="1.2" />
        </svg>
      </div>
    );
  }

  // 25. WhatsApp Business
  if (slug.includes('whatsapp')) {
    return (
      <div className={`api-brand-thumb whatsapp ${className}`} title="WhatsApp">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#25d366" />
          <path
            d="M12 5a7 7 0 0 0-6 10.5L5 19l3.6-1A7 7 0 1 0 12 5zm3.5 9.5c-.2.5-.9.9-1.4.9-.4 0-.8-.1-1.3-.3-1.6-.7-2.6-2.2-2.7-2.3 0-.1-.6-.8-.6-1.5 0-.7.4-1.1.5-1.2.2-.2.4-.2.5-.2h.4c.1 0 .3 0 .4.3.2.4.6 1.4.6 1.5 0 .1 0 .3-.1.4-.1.1-.2.2-.3.3l-.2.2c-.1.1-.2.2-.1.4.2.4.6 1.1 1.2 1.6.8.7 1.4.9 1.7 1 .1 0 .3 0 .4-.1l.5-.6c.2-.2.3-.2.5-.1.1 0 1.2.6 1.4.7.2.1.3.2.3.3 0 .2-.1.7-.3.9z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 26. PayPal
  if (slug.includes('paypal')) {
    return (
      <div className={`api-brand-thumb paypal ${className}`} title="PayPal">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#003087" />
          <path
            d="M8.5 7h4c2.2 0 3.5 1.1 3.2 3.1-.3 2.1-2 3.4-4.2 3.4h-1.5l-.8 4.5H7l2.2-11zm2.3 4.8h1.4c1.1 0 2-.6 2.2-1.7.2-1-.5-1.5-1.6-1.5h-1.3l-.7 3.2z"
            fill="#0079c1"
          />
          <path
            d="M10 9h4c2.2 0 3.5 1.1 3.2 3.1-.3 2.1-2 3.4-4.2 3.4h-1.5l-.8 4.5H8.5l2.2-11zm2.3 4.8h1.4c1.1 0 2-.6 2.2-1.7.2-1-.5-1.5-1.6-1.5h-1.3l-.7 3.2z"
            fill="#ffffff"
          />
        </svg>
      </div>
    );
  }

  // 27. AssemblyAI
  if (slug.includes('assembly')) {
    return (
      <div className={`api-brand-thumb assemblyai ${className}`} title="AssemblyAI">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#1e1b4b" />
          <path d="M6 12h2m2-4v8m2-10v12m2-8v4m2-6v8m2-4h2" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 28. OpenSea
  if (slug.includes('opensea')) {
    return (
      <div className={`api-brand-thumb opensea ${className}`} title="OpenSea">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#2081e2" />
          <path d="M12 4l-5 9h10l-5-9zm-6 10l6 6 6-6H6z" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // 29. Amazon Pay
  if (slug.includes('amazon')) {
    return (
      <div className={`api-brand-thumb amazon ${className}`} title="Amazon Pay">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#232f3e" />
          <path d="M6 15c4 2 8 2 12 0" stroke="#ff9900" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 14l2 1-1.5 1.5" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 30. Netflix
  if (slug.includes('netflix')) {
    return (
      <div className={`api-brand-thumb netflix ${className}`} title="Netflix">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#141414" />
          <path d="M7 5h2.5v14H7V5zm7.5 0H17v14h-2.5V5z" fill="#b81d24" />
          <path d="M7 5l7.5 14H17L9.5 5H7z" fill="#e50914" />
        </svg>
      </div>
    );
  }

  // 31. Shopify
  if (slug.includes('shopify')) {
    return (
      <div className={`api-brand-thumb shopify ${className}`} title="Shopify">
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="#95bf47" />
          <path d="M8 9l6-2 3 12H7L8 9z" fill="#5e8e3e" />
          <path d="M11 7V5a2 2 0 0 1 2-2h.5a2 2 0 0 1 2 2v2" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M12.5 11c-.8 0-1.2.4-1.2 1 0 .8 1.8 1 1.8 1.8 0 .6-.5 1-1.2 1-.8 0-1.2-.4-1.4-.7" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Default: Elegant Tech Insignia with category color aura and clean geometry (no dummy 3-line wireframe!)
  const initials = api.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isAi = api.categoryName?.toLowerCase().includes('ai') || api.categoryName?.toLowerCase().includes('ml');
  const isFinance = api.categoryName?.toLowerCase().includes('fin');
  const isDev = api.categoryName?.toLowerCase().includes('dev');
  const isSec = api.categoryName?.toLowerCase().includes('sec');

  const bgGrad = isAi
    ? 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)'
    : isFinance
    ? 'linear-gradient(135deg, #0f766e 0%, #059669 100%)'
    : isSec
    ? 'linear-gradient(135deg, #be185d 0%, #9333ea 100%)'
    : isDev
    ? 'linear-gradient(135deg, #334155 0%, #475569 100%)'
    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';

  return (
    <>
      <div className={`api-brand-thumb custom ${className}`} style={{ background: bgGrad }} title={api.name}>
        <svg viewBox="0 0 24 24" fill="none" className="api-brand-svg">
          <rect width="24" height="24" rx="6" fill="transparent" />
          <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <text
            x="12"
            y="15.5"
            fill="#ffffff"
            fontSize="8.5"
            fontWeight="800"
            textAnchor="middle"
            letterSpacing="0.8"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {initials}
          </text>
        </svg>
      </div>
      <style>{`
        .api-brand-thumb {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: inherit;
          overflow: hidden;
          box-sizing: border-box;
        }
        .api-brand-svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        .api-thumbnail-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }
      `}</style>
    </>
  );
};

export default ApiThumbnail;
