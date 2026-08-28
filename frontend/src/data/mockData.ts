import { ApiItem, CollectionItem, NotificationItem } from '../types/api';

export const MOCK_TRENDING_APIS: ApiItem[] = [
  {
    id: 'openai-api',
    name: 'OpenAI API',
    description: 'Advanced AI models for text, image, and more',
    longDescription: 'Access state-of-the-art artificial intelligence models including GPT-4o, DALL-E 3, and Whisper for natural language processing, computer vision, and voice recognition.',
    category: 'AI & ML',
    rating: 4.9,
    requestCount: '2.4M',
    isTrending: true,
    status: 'Active',
    icon: 'openai',
    accentColor: '#10a37f',
    provider: 'OpenAI Inc.',
    latencyMs: 140,
    uptime: '99.95%',
    endpointsCount: 14,
    baseUrl: 'https://api.openai.com/v1',
    version: 'v1.4.0',
    authType: 'Bearer Token',
    endpoints: [
      {
        id: 'ep-1',
        method: 'POST',
        path: '/chat/completions',
        description: 'Creates a model response for the given chat conversation.',
        sampleRequest: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Explain vector databases in 2 sentences." }],
          temperature: 0.7
        }, null, 2),
        sampleResponse: JSON.stringify({
          id: "chatcmpl-9A8zB2...",
          object: "chat.completion",
          created: 1712345678,
          model: "gpt-4o",
          choices: [{
            index: 0,
            message: { role: "assistant", content: "A vector database stores and indexes high-dimensional mathematical representations (embeddings) of data for semantic search. This allows systems to find conceptually similar content instantly using distance algorithms." },
            finish_reason: "stop"
          }],
          usage: { prompt_tokens: 18, completion_tokens: 42, total_tokens: 60 }
        }, null, 2)
      },
      {
        id: 'ep-2',
        method: 'POST',
        path: '/embeddings',
        description: 'Creates a vector representation of a given input text.',
        sampleRequest: JSON.stringify({
          model: "text-embedding-3-small",
          input: "The quick brown fox jumps over the lazy dog"
        }, null, 2),
        sampleResponse: JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: [-0.012, 0.043, 0.008, -0.092, 0.015] }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 9, total_tokens: 9 }
        }, null, 2)
      }
    ]
  },
  {
    id: 'weather-api',
    name: 'WeatherAPI',
    description: 'Real-time weather data and forecasts',
    longDescription: 'High-resolution meteorological forecast data, historical observations, interactive weather maps, air quality index, and severe weather alert feeds.',
    category: 'Weather',
    rating: 4.8,
    requestCount: '1.8M',
    isTrending: true,
    status: 'Active',
    icon: 'weather',
    accentColor: '#f59e0b',
    provider: 'WeatherAPI Global',
    latencyMs: 85,
    uptime: '99.99%',
    endpointsCount: 8,
    baseUrl: 'https://api.weatherapi.com/v1',
    version: 'v2.1.0',
    authType: 'API Key',
    endpoints: [
      {
        id: 'ep-w1',
        method: 'GET',
        path: '/current.json?q=London',
        description: 'Fetch real-time weather details for specified city or coordinates.',
        sampleResponse: JSON.stringify({
          location: { name: "London", country: "United Kingdom", lat: 51.52, lon: -0.11 },
          current: { temp_c: 18.5, condition: { text: "Partly cloudy", icon: "//cdn.weatherapi.com/weather/64x64/day/116.png" }, humidity: 62, wind_kph: 14.5 }
        }, null, 2)
      }
    ]
  },
  {
    id: 'stripe-api',
    name: 'Stripe API',
    description: 'Payment processing for internet businesses',
    longDescription: 'Complete financial suite for subscription management, credit card payments, invoicing, fraud detection, and multi-currency global payouts.',
    category: 'Finance',
    rating: 4.7,
    requestCount: '1.6M',
    isTrending: true,
    status: 'Active',
    icon: 'stripe',
    accentColor: '#6366f1',
    provider: 'Stripe, Inc.',
    latencyMs: 110,
    uptime: '99.999%',
    endpointsCount: 42,
    baseUrl: 'https://api.stripe.com/v1',
    version: '2023-10-16',
    authType: 'Bearer Token',
    endpoints: [
      {
        id: 'ep-s1',
        method: 'POST',
        path: '/payment_intents',
        description: 'Create a PaymentIntent to guide customer through checkout flow.',
        sampleRequest: JSON.stringify({
          amount: 2999,
          currency: "usd",
          automatic_payment_methods: { enabled: true }
        }, null, 2),
        sampleResponse: JSON.stringify({
          id: "pi_3N9xYz2eZvKYlo2C0",
          object: "payment_intent",
          amount: 2999,
          currency: "usd",
          status: "requires_payment_method",
          client_secret: "pi_3N9xYz2eZvKYlo2C0_secret_7x9A"
        }, null, 2)
      }
    ]
  },
  {
    id: 'github-api',
    name: 'GitHub API',
    description: 'Integrate with GitHub repositories and more',
    longDescription: 'Programmatic interface to manage repositories, pull requests, issues, webhooks, GitHub Actions workflows, and user profiles.',
    category: 'Developer Tools',
    rating: 4.8,
    requestCount: '1.2M',
    isTrending: true,
    status: 'Active',
    icon: 'github',
    accentColor: '#8b5cf6',
    provider: 'GitHub / Microsoft',
    latencyMs: 95,
    uptime: '99.92%',
    endpointsCount: 60,
    baseUrl: 'https://api.github.com',
    version: 'v3',
    authType: 'Bearer Token',
    endpoints: [
      {
        id: 'ep-gh1',
        method: 'GET',
        path: '/user/repos',
        description: 'List repositories for the authenticated user.',
        sampleResponse: JSON.stringify([
          { id: 4891230, name: "api-marketplace", full_name: "dev/api-marketplace", private: false, stargazers_count: 1420 }
        ], null, 2)
      }
    ]
  },
  {
    id: 'claude-api',
    name: 'Anthropic Claude API',
    description: 'Next-generation AI for reasoning and coding',
    category: 'AI & ML',
    rating: 4.9,
    requestCount: '2.0M',
    isTrending: true,
    status: 'Active',
    icon: 'anthropic',
    accentColor: '#d97706',
    provider: 'Anthropic PBC',
    latencyMs: 130,
    uptime: '99.96%',
    endpointsCount: 8,
    baseUrl: 'https://api.anthropic.com/v1',
    version: '2023-06-01',
    authType: 'API Key'
  },
  {
    id: 'google-maps-api',
    name: 'Google Maps API',
    description: 'Maps, directions, and place data',
    category: 'Developer Tools',
    rating: 4.8,
    requestCount: '2.7M',
    isTrending: true,
    status: 'Active',
    icon: 'googlemaps',
    accentColor: '#34a853',
    provider: 'Google',
    latencyMs: 75,
    uptime: '99.97%',
    endpointsCount: 18,
    baseUrl: 'https://maps.googleapis.com/maps/api',
    version: 'v3',
    authType: 'API Key'
  },
  {
    id: 'huggingface-api',
    name: 'Hugging Face API',
    description: 'Transformer models and inference APIs',
    category: 'AI & ML',
    rating: 4.7,
    requestCount: '1.5M',
    isTrending: true,
    status: 'Active',
    icon: 'huggingface',
    accentColor: '#ffd21e',
    provider: 'Hugging Face, Inc.',
    latencyMs: 170,
    uptime: '99.88%',
    endpointsCount: 22,
    baseUrl: 'https://api-inference.huggingface.co',
    version: 'v2',
    authType: 'Bearer Token'
  },
  {
    id: 'slack-api',
    name: 'Slack API',
    description: 'Messaging, bots, and workspace automation',
    category: 'Communication',
    rating: 4.7,
    requestCount: '2.2M',
    isTrending: true,
    status: 'Active',
    icon: 'slack',
    accentColor: '#611f69',
    provider: 'Slack Technologies',
    latencyMs: 95,
    uptime: '99.94%',
    endpointsCount: 30,
    baseUrl: 'https://slack.com/api',
    version: 'v2',
    authType: 'Bearer Token'
  }
];

export const MOCK_POPULAR_APIS: ApiItem[] = [
  {
    id: 'twilio-api',
    name: 'Twilio API',
    description: 'Communications platform for SMS, voice, and video',
    category: 'Communication',
    rating: 4.9,
    requestCount: '3.2M',
    status: 'Active',
    icon: 'twilio',
    accentColor: '#f22f46',
    provider: 'Twilio Inc.',
    latencyMs: 120,
    uptime: '99.98%',
    endpointsCount: 28,
    baseUrl: 'https://api.twilio.com/2010-04-01',
    version: '2010-04-01',
    authType: 'API Key',
    endpoints: [
      {
        id: 'ep-tw1',
        method: 'POST',
        path: '/Accounts/{AccountSid}/Messages.json',
        description: 'Send an SMS or WhatsApp message instantly.',
        sampleResponse: JSON.stringify({ sid: "SM890a...", status: "queued", body: "Your verification code is 49201" }, null, 2)
      }
    ]
  },
  {
    id: 'sendgrid-api',
    name: 'SendGrid API',
    description: 'Email delivery service for developers',
    category: 'Communication',
    rating: 4.8,
    requestCount: '2.1M',
    status: 'Active',
    icon: 'sendgrid',
    accentColor: '#1a82e2',
    provider: 'Twilio SendGrid',
    latencyMs: 105,
    uptime: '99.95%',
    endpointsCount: 22,
    baseUrl: 'https://api.sendgrid.com/v3',
    version: 'v3',
    authType: 'Bearer Token',
    endpoints: [
      {
        id: 'ep-sg1',
        method: 'POST',
        path: '/mail/send',
        description: 'Send transactional or marketing emails.',
        sampleResponse: JSON.stringify({ message: "Accepted for delivery" }, null, 2)
      }
    ]
  },
  {
    id: 'coingecko-api',
    name: 'CoinGecko API',
    description: 'Cryptocurrency data and market information',
    category: 'Finance',
    rating: 4.7,
    requestCount: '1.9M',
    status: 'Active',
    icon: 'coingecko',
    accentColor: '#8dc63f',
    provider: 'CoinGecko',
    latencyMs: 75,
    uptime: '99.90%',
    endpointsCount: 35,
    baseUrl: 'https://api.coingecko.com/api/v3',
    version: 'v3',
    authType: 'None',
    endpoints: [
      {
        id: 'ep-cg1',
        method: 'GET',
        path: '/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
        description: 'Get current prices of cryptocurrencies.',
        sampleResponse: JSON.stringify({ bitcoin: { usd: 67450.25 }, ethereum: { usd: 3520.10 } }, null, 2)
      }
    ]
  },
  {
    id: 'news-api',
    name: 'NewsAPI',
    description: 'Live worldwide news and headlines',
    category: 'News',
    rating: 4.6,
    requestCount: '1.6M',
    status: 'Active',
    icon: 'newsapi',
    accentColor: '#e11d48',
    provider: 'NewsAPI Org',
    latencyMs: 90,
    uptime: '99.91%',
    endpointsCount: 6,
    baseUrl: 'https://newsapi.org/v2',
    version: 'v2',
    authType: 'API Key',
    endpoints: [
      {
        id: 'ep-news1',
        method: 'GET',
        path: '/top-headlines?country=us',
        description: 'Retrieve live breaking news headlines.',
        sampleResponse: JSON.stringify({ status: "ok", totalResults: 38, articles: [] }, null, 2)
      }
    ]
  },
  {
    id: 'ip-geolocation-api',
    name: 'IP Geolocation API',
    description: 'Geolocate IP addresses',
    category: 'Developer Tools',
    rating: 4.6,
    requestCount: '1.3M',
    status: 'Active',
    icon: 'ipgeo',
    accentColor: '#3b82f6',
    provider: 'IPify / GeoIP',
    latencyMs: 45,
    uptime: '99.99%',
    endpointsCount: 4,
    baseUrl: 'https://api.ipgeolocation.io/ipgeo',
    version: 'v1',
    authType: 'API Key',
    endpoints: [
      {
        id: 'ep-ip1',
        method: 'GET',
        path: '/ipgeo?ip=8.8.8.8',
        description: 'Lookup detailed location, ISP, and timezone data by IP.',
        sampleResponse: JSON.stringify({ ip: "8.8.8.8", country_name: "United States", city: "Mountain View", isp: "Google LLC" }, null, 2)
      }
    ]
  },
  {
    id: 'whatsapp-api',
    name: 'WhatsApp Business API',
    description: 'Messaging, notifications, and customer support',
    category: 'Communication',
    rating: 4.7,
    requestCount: '2.9M',
    status: 'Active',
    icon: 'whatsapp',
    accentColor: '#25d366',
    provider: 'Meta Platforms',
    latencyMs: 85,
    uptime: '99.96%',
    endpointsCount: 16,
    baseUrl: 'https://graph.facebook.com/v18.0',
    version: 'v18.0',
    authType: 'Bearer Token'
  },
  {
    id: 'paypal-api',
    name: 'PayPal API',
    description: 'Payments, subscriptions, and invoicing',
    category: 'Finance',
    rating: 4.7,
    requestCount: '2.6M',
    status: 'Active',
    icon: 'paypal',
    accentColor: '#003087',
    provider: 'PayPal Holdings',
    latencyMs: 115,
    uptime: '99.92%',
    endpointsCount: 20,
    baseUrl: 'https://api-m.paypal.com/v1',
    version: 'v1',
    authType: 'OAuth 2.0'
  },
  {
    id: 'openweather-api',
    name: 'OpenWeather API',
    description: 'Weather data, forecasts, and maps',
    category: 'Weather',
    rating: 4.6,
    requestCount: '2.3M',
    status: 'Active',
    icon: 'openweather',
    accentColor: '#eb6e4b',
    provider: 'OpenWeather Ltd.',
    latencyMs: 70,
    uptime: '99.95%',
    endpointsCount: 12,
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    version: 'v2.5',
    authType: 'API Key'
  }
];

export const MOCK_NEWLY_LAUNCHED_APIS: ApiItem[] = [
  {
    id: 'resend-api',
    name: 'Resend API',
    description: 'Modern email API for React developers',
    category: 'Communication',
    rating: 4.9,
    requestCount: '1.1M',
    status: 'Active',
    icon: 'resend',
    accentColor: '#ffffff',
    provider: 'Resend Labs',
    latencyMs: 60,
    uptime: '99.99%',
    endpointsCount: 10,
    baseUrl: 'https://api.resend.com',
    version: 'v1',
    authType: 'Bearer Token'
  },
  {
    id: 'perplexity-api',
    name: 'Perplexity API',
    description: 'Real-time web search with generative answers',
    category: 'AI & ML',
    rating: 4.8,
    requestCount: '890K',
    status: 'Beta',
    icon: 'perplexity',
    accentColor: '#20808d',
    provider: 'Perplexity AI',
    latencyMs: 160,
    uptime: '99.87%',
    endpointsCount: 5,
    baseUrl: 'https://api.perplexity.ai',
    version: 'v1',
    authType: 'Bearer Token'
  },
  {
    id: 'supabase-api',
    name: 'Supabase API',
    description: 'Postgres database, auth & storage API',
    category: 'Developer Tools',
    rating: 4.8,
    requestCount: '760K',
    status: 'Active',
    icon: 'supabase',
    accentColor: '#3ecf8e',
    provider: 'Supabase Labs',
    latencyMs: 55,
    uptime: '99.99%',
    endpointsCount: 18,
    baseUrl: 'https://api.supabase.co',
    version: 'v1',
    authType: 'Bearer Token'
  },
  {
    id: 'assemblyai-api',
    name: 'AssemblyAI API',
    description: 'Speech-to-text and audio intelligence',
    category: 'AI & ML',
    rating: 4.7,
    requestCount: '540K',
    status: 'Active',
    icon: 'assemblyai',
    accentColor: '#3547e0',
    provider: 'AssemblyAI',
    latencyMs: 180,
    uptime: '99.93%',
    endpointsCount: 12,
    baseUrl: 'https://api.assemblyai.com/v2',
    version: 'v2',
    authType: 'API Key'
  },
  {
    id: 'mapbox-api',
    name: 'Mapbox API',
    description: 'Maps, geocoding, and navigation services',
    category: 'Developer Tools',
    rating: 4.6,
    requestCount: '480K',
    status: 'Active',
    icon: 'mapbox',
    accentColor: '#171717',
    provider: 'Mapbox, Inc.',
    latencyMs: 70,
    uptime: '99.96%',
    endpointsCount: 25,
    baseUrl: 'https://api.mapbox.com',
    version: 'v2023-10-01',
    authType: 'API Key'
  },
  {
    id: 'elevenlabs-api',
    name: 'ElevenLabs API',
    description: 'AI voice generation and text-to-speech',
    category: 'AI & ML',
    rating: 4.8,
    requestCount: '620K',
    status: 'Beta',
    icon: 'elevenlabs',
    accentColor: '#000000',
    provider: 'ElevenLabs',
    latencyMs: 150,
    uptime: '99.84%',
    endpointsCount: 7,
    baseUrl: 'https://api.elevenlabs.io/v1',
    version: 'v1',
    authType: 'API Key'
  },
  {
    id: 'pinecone-api',
    name: 'Pinecone API',
    description: 'Vector database for AI applications',
    category: 'AI & ML',
    rating: 4.7,
    requestCount: '410K',
    status: 'Active',
    icon: 'pinecone',
    accentColor: '#00c853',
    provider: 'Pinecone Systems',
    latencyMs: 65,
    uptime: '99.95%',
    endpointsCount: 9,
    baseUrl: 'https://api.pinecone.io',
    version: 'v1',
    authType: 'API Key'
  },
  {
    id: 'vercel-api',
    name: 'Vercel API',
    description: 'Deployments, domains, and serverless functions',
    category: 'Developer Tools',
    rating: 4.8,
    requestCount: '520K',
    status: 'Active',
    icon: 'vercel',
    accentColor: '#ffffff',
    provider: 'Vercel Inc.',
    latencyMs: 50,
    uptime: '99.99%',
    endpointsCount: 16,
    baseUrl: 'https://api.vercel.com',
    version: 'v13',
    authType: 'Bearer Token'
  }
];

export const MOCK_RECOMMENDED_APIS: ApiItem[] = [
  {
    id: 'youtube-data-api',
    name: 'YouTube Data API',
    description: 'Search videos, channels, and playlists',
    category: 'Media',
    rating: 4.9,
    requestCount: '3.8M',
    status: 'Active',
    icon: 'youtube',
    accentColor: '#ff0000',
    provider: 'Google',
    latencyMs: 100,
    uptime: '99.95%',
    endpointsCount: 20,
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    version: 'v3',
    authType: 'API Key'
  },
  {
    id: 'spotify-api',
    name: 'Spotify API',
    description: 'Streaming, playlists, and music metadata',
    category: 'Media',
    rating: 4.8,
    requestCount: '2.9M',
    status: 'Active',
    icon: 'spotify',
    accentColor: '#1db954',
    provider: 'Spotify AB',
    latencyMs: 90,
    uptime: '99.94%',
    endpointsCount: 30,
    baseUrl: 'https://api.spotify.com/v1',
    version: 'v1',
    authType: 'OAuth 2.0'
  },
  {
    id: 'twitch-api',
    name: 'Twitch API',
    description: 'Live streaming data and chat integration',
    category: 'Media',
    rating: 4.6,
    requestCount: '1.7M',
    status: 'Active',
    icon: 'twitch',
    accentColor: '#9146ff',
    provider: 'Twitch Interactive',
    latencyMs: 80,
    uptime: '99.89%',
    endpointsCount: 15,
    baseUrl: 'https://api.twitch.tv/helix',
    version: 'v5',
    authType: 'OAuth 2.0'
  },
  {
    id: 'discord-api',
    name: 'Discord API',
    description: 'Bots, webhooks, and server management',
    category: 'Communication',
    rating: 4.7,
    requestCount: '2.5M',
    status: 'Active',
    icon: 'discord',
    accentColor: '#5865f2',
    provider: 'Discord Inc.',
    latencyMs: 65,
    uptime: '99.97%',
    endpointsCount: 45,
    baseUrl: 'https://discord.com/api/v10',
    version: 'v10',
    authType: 'Bearer Token'
  },
  {
    id: 'opensea-api',
    name: 'OpenSea API',
    description: 'NFT marketplace and digital assets data',
    category: 'Finance',
    rating: 4.5,
    requestCount: '930K',
    status: 'Beta',
    icon: 'opensea',
    accentColor: '#2081e2',
    provider: 'OpenSea',
    latencyMs: 140,
    uptime: '99.82%',
    endpointsCount: 11,
    baseUrl: 'https://api.opensea.io/api/v2',
    version: 'v2',
    authType: 'API Key'
  },
  {
    id: 'amazon-pay-api',
    name: 'Amazon Pay API',
    description: 'Checkout and payments via Amazon',
    category: 'Finance',
    rating: 4.6,
    requestCount: '1.4M',
    status: 'Active',
    icon: 'amazonpay',
    accentColor: '#ff9900',
    provider: 'Amazon',
    latencyMs: 110,
    uptime: '99.93%',
    endpointsCount: 14,
    baseUrl: 'https://pay-api.amazon.com/v2',
    version: 'v2',
    authType: 'OAuth 2.0'
  },
  {
    id: 'netflix-api',
    name: 'Netflix API',
    description: 'Streaming catalog and metadata services',
    category: 'Media',
    rating: 4.5,
    requestCount: '1.1M',
    status: 'Beta',
    icon: 'netflix',
    accentColor: '#e50914',
    provider: 'Netflix, Inc.',
    latencyMs: 120,
    uptime: '99.85%',
    endpointsCount: 8,
    baseUrl: 'https://api.netflix.com',
    version: 'v1',
    authType: 'OAuth 2.0'
  },
  {
    id: 'shopify-api',
    name: 'Shopify API',
    description: 'E-commerce storefront and order management',
    category: 'E-commerce',
    rating: 4.7,
    requestCount: '1.9M',
    status: 'Active',
    icon: 'shopify',
    accentColor: '#96bf48',
    provider: 'Shopify Inc.',
    latencyMs: 100,
    uptime: '99.96%',
    endpointsCount: 40,
    baseUrl: 'https://shopify.dev/api',
    version: '2023-10',
    authType: 'Bearer Token'
  }
];

export const MOCK_COLLECTIONS: CollectionItem[] = [
  {
    id: 'c-1',
    name: 'E-commerce APIs',
    apiCount: 12,
    color: '#10b981', // Emerald Green
    iconName: 'shopping-bag',
    description: 'Payment gateways, inventory tracking, shipping, and order management.',
    apis: ['stripe-api', 'twilio-api']
  },
  {
    id: 'c-2',
    name: 'Social Media APIs',
    apiCount: 8,
    color: '#ef4444', // Red
    iconName: 'share-2',
    description: 'Authentications, user feeds, social sharing, and analytics integrations.',
    apis: ['github-api']
  },
  {
    id: 'c-3',
    name: 'AI & Machine Learning',
    apiCount: 15,
    color: '#14b8a6', // Teal
    iconName: 'cpu',
    description: 'Large language models, vision APIs, speech synthesis, and embeddings.',
    apis: ['openai-api', 'claude-api']
  },
  {
    id: 'c-4',
    name: 'Payment Gateways',
    apiCount: 6,
    color: '#f59e0b', // Yellow / Amber
    iconName: 'credit-card',
    description: 'Stripe, PayPal, Square, and crypto payout APIs.',
    apis: ['stripe-api', 'coingecko-api']
  },
  {
    id: 'c-5',
    name: 'Developer Tools',
    apiCount: 10,
    color: '#3b82f6', // Blue
    iconName: 'terminal',
    description: 'CI/CD automation, IP geolocation, monitoring, and logging endpoints.',
    apis: ['github-api', 'ip-geolocation-api', 'resend-api']
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'OpenAI API Updated',
    message: 'New GPT-4o mini endpoint released with lower latency and cheaper pricing.',
    time: '10 min ago',
    read: false,
    type: 'update'
  },
  {
    id: 'n-2',
    title: 'Rate Limit Warning',
    message: 'Stripe API request rate reached 85% of tier limit.',
    time: '1 hour ago',
    read: false,
    type: 'alert'
  },
  {
    id: 'n-3',
    title: 'Environment Switch',
    message: 'Active workspace changed to "Production-US-East".',
    time: '3 hours ago',
    read: true,
    type: 'system'
  }
];

export const CATEGORIES_LIST = [
  'All Categories',
  'AI & ML',
  'Finance',
  'Weather',
  'Developer Tools',
  'Communication',
  'E-commerce',
  'News',
  'More'
];