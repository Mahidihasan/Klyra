import { pool } from '../src/services/database.service';

interface SeedApi {
  name: string;
  slug: string;
  description: string;
  categorySlug: string;
  providerName: string;
  providerEmail: string;
  providerBio: string;
  providerCompany: string;
  providerWebsite: string;
  baseUrl: string;
  docsUrl: string;
  logoUrl: string;
  pricingModel: 'FREE' | 'FREEMIUM' | 'PAID';
  rating: number;
  totalReviews: number;
  totalSubscribers: number;
  totalRequests: number;
  latencyMs: number;
  uptimePercentage: number;
  tags: string[];
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
    sampleRequest?: string;
    sampleResponse?: string;
  }>;
  plans: Array<{
    name: string;
    slug: string;
    description: string;
    price: number;
    billingInterval: string;
    features: string[];
    rateLimit: number;
  }>;
  reviews: Array<{
    reviewerName: string;
    reviewerEmail: string;
    rating: number;
    title: string;
    content: string;
  }>;
}

const SEED_APIS: SeedApi[] = [
  {
    name: 'OpenAI API',
    slug: 'openai-api',
    description: 'Advanced AI models including GPT-4o, embeddings, and vision recognition for modern intelligent workflows.',
    categorySlug: 'ai-ml',
    providerName: 'OpenAI Inc.',
    providerEmail: 'platform@openai.com',
    providerBio: 'Research and deployment company dedicated to developing safe and beneficial artificial general intelligence.',
    providerCompany: 'OpenAI Inc.',
    providerWebsite: 'https://openai.com',
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/docs',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
    pricingModel: 'FREEMIUM',
    rating: 4.92,
    totalReviews: 342,
    totalSubscribers: 14850,
    totalRequests: 24500000,
    latencyMs: 135,
    uptimePercentage: 99.98,
    tags: ['ai', 'gpt-4o', 'llm', 'nlp', 'embeddings'],
    endpoints: [
      {
        method: 'POST',
        path: '/chat/completions',
        description: 'Creates a model response for the given chat conversation.',
        sampleRequest: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Summarize distributed consensus algorithms.' }],
          temperature: 0.7,
        }, null, 2),
        sampleResponse: JSON.stringify({
          id: 'chatcmpl-9A8zB2',
          object: 'chat.completion',
          model: 'gpt-4o',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Distributed consensus algorithms ensure nodes in a network agree on a single source of truth despite node failures or network partitions (e.g. Raft, Paxos).' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 14, completion_tokens: 38, total_tokens: 52 },
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/embeddings',
        description: 'Computes high-dimensional vector representations of arbitrary input text.',
        sampleRequest: JSON.stringify({
          model: 'text-embedding-3-small',
          input: 'Semantic retrieval across modern multi-modal indexes',
        }, null, 2),
        sampleResponse: JSON.stringify({
          object: 'list',
          data: [{ object: 'embedding', index: 0, embedding: [-0.0142, 0.0384, 0.0091, -0.0821] }],
        }, null, 2),
      },
    ],
    plans: [
      {
        name: 'Developer Free',
        slug: 'free',
        description: 'Sandbox access with baseline rate limits.',
        price: 0,
        billingInterval: 'monthly',
        features: ['500 requests / day', 'GPT-4o mini access', 'Community Discord support'],
        rateLimit: 60,
      },
      {
        name: 'Pro Tier',
        slug: 'pro',
        description: 'High throughput, priority latency routing, and expanded model tiers.',
        price: 29.00,
        billingInterval: 'monthly',
        features: ['100,000 requests / month', 'GPT-4o priority queue', 'Batch processing API', 'Email support'],
        rateLimit: 500,
      },
      {
        name: 'Enterprise Ultra',
        slug: 'enterprise',
        description: 'Dedicated isolated GPU clusters, zero data retention SLA, custom fine-tuning.',
        price: 299.00,
        billingInterval: 'monthly',
        features: ['Unlimited throughput', 'Custom fine-tuned weights', 'Dedicated TAM', '99.99% uptime SLA'],
        rateLimit: 2500,
      },
    ],
    reviews: [
      {
        reviewerName: 'Alex Mercer',
        reviewerEmail: 'alex@synthetix.dev',
        rating: 5,
        title: 'Unbelievable latency improvements in v1.4',
        content: 'The streaming response tokens are lightning fast. Integration into our developer copilot took under 20 minutes.',
      },
      {
        reviewerName: 'Sarah Lin',
        reviewerEmail: 'sarah@quantumbot.io',
        rating: 5,
        title: 'Mission critical for our AI agent fleet',
        content: 'Rock solid reliability. The function-calling schema matches our TypeScript types flawlessly.',
      },
    ],
  },
  {
    name: 'WeatherAPI Global',
    slug: 'weather-api',
    description: 'Ultra-accurate real-time weather, high-resolution radar, air quality telemetry, and 14-day forecasts.',
    categorySlug: 'weather',
    providerName: 'WeatherAPI Global Ltd.',
    providerEmail: 'support@weatherapi.com',
    providerBio: 'Global meteorological data network operating 12,000 automated telemetry stations worldwide.',
    providerCompany: 'WeatherAPI Global Ltd.',
    providerWebsite: 'https://weatherapi.com',
    baseUrl: 'https://api.weatherapi.com/v1',
    docsUrl: 'https://weatherapi.com/docs',
    logoUrl: 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=128&auto=format&fit=crop&q=80',
    pricingModel: 'FREEMIUM',
    rating: 4.88,
    totalReviews: 219,
    totalSubscribers: 8940,
    totalRequests: 18200000,
    latencyMs: 78,
    uptimePercentage: 99.99,
    tags: ['weather', 'forecast', 'radar', 'telemetry', 'air-quality'],
    endpoints: [
      {
        method: 'GET',
        path: '/current.json?q=London',
        description: 'Fetch real-time weather details for specified coordinates or city query.',
        sampleResponse: JSON.stringify({
          location: { name: 'London', country: 'United Kingdom', lat: 51.52, lon: -0.11 },
          current: { temp_c: 18.5, condition: { text: 'Partly cloudy' }, humidity: 62, wind_kph: 14.2 },
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/forecast.json?q=Tokyo&days=7',
        description: 'Retrieve detailed daily and hourly meteorological forecasts up to 14 days.',
      },
    ],
    plans: [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'Free basic weather feed for hobbyists.',
        price: 0,
        billingInterval: 'monthly',
        features: ['1,000,000 calls / month', 'Current weather', '3-day forecast'],
        rateLimit: 120,
      },
      {
        name: 'Business Weather',
        slug: 'business',
        description: 'High-precision radar imagery, air quality, historical archives.',
        price: 39.00,
        billingInterval: 'monthly',
        features: ['10,000,000 calls / month', 'Historical data back to 2010', '14-day forecasts', 'Sub-minute alert webhooks'],
        rateLimit: 1200,
      },
    ],
    reviews: [
      {
        reviewerName: 'Marcus Vance',
        reviewerEmail: 'marcus@agritech.co',
        rating: 5,
        title: 'Indispensable for our drone flight routing',
        content: 'Sub-minute weather alert feeds prevented multiple lost flights during localized storms.',
      },
    ],
  },
  {
    name: 'Stripe Payments API',
    slug: 'stripe-payments',
    description: 'Financial infrastructure for the internet: recurring billing, global card processing, and payouts.',
    categorySlug: 'finance',
    providerName: 'Stripe Inc.',
    providerEmail: 'devs@stripe.com',
    providerBio: 'Financial infrastructure engine powering millions of businesses across 135+ countries.',
    providerCompany: 'Stripe Inc.',
    providerWebsite: 'https://stripe.com',
    baseUrl: 'https://api.stripe.com/v1',
    docsUrl: 'https://stripe.com/docs/api',
    logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=128&auto=format&fit=crop&q=80',
    pricingModel: 'PAID',
    rating: 4.95,
    totalReviews: 512,
    totalSubscribers: 22400,
    totalRequests: 42000000,
    latencyMs: 95,
    uptimePercentage: 99.99,
    tags: ['payments', 'finance', 'billing', 'subscriptions', 'cards'],
    endpoints: [
      {
        method: 'POST',
        path: '/payment_intents',
        description: 'Creates a PaymentIntent to initiate and track customer payment confirmation.',
        sampleRequest: JSON.stringify({ amount: 2000, currency: 'usd', automatic_payment_methods: { enabled: true } }, null, 2),
        sampleResponse: JSON.stringify({ id: 'pi_3L4h872eZvKYlo2C1', object: 'payment_intent', amount: 2000, status: 'requires_payment_method' }, null, 2),
      },
      {
        method: 'GET',
        path: '/customers',
        description: 'List and filter customers registered in your billing portfolio.',
      },
    ],
    plans: [
      {
        name: 'Standard Processing',
        slug: 'standard',
        description: '2.9% + 30¢ per successful card charge. No monthly fixed fees.',
        price: 0,
        billingInterval: 'monthly',
        features: ['Global card acceptance', 'Automated dispute handling', 'Standard payout speed'],
        rateLimit: 300,
      },
      {
        name: 'Scale & Custom',
        slug: 'scale',
        description: 'Interchange plus pricing for volume merchants exceeding $100k/mo.',
        price: 99.00,
        billingInterval: 'monthly',
        features: ['Volume discounts', 'Instant account verification', 'Dedicated risk management'],
        rateLimit: 1500,
      },
    ],
    reviews: [
      {
        reviewerName: 'Elena Rostova',
        reviewerEmail: 'elena@payflow.tech',
        rating: 5,
        title: 'Gold standard in API developer ergonomics',
        content: 'Webhooks are idempotent and retry cleanly. SDKs in every language make integration a delight.',
      },
    ],
  },
  {
    name: 'GitHub GraphQL API',
    slug: 'github-graphql',
    description: 'Query and mutate repositories, pull requests, issues, CI checks, and developer discussions.',
    categorySlug: 'developer-tools',
    providerName: 'GitHub Inc.',
    providerEmail: 'api@github.com',
    providerBio: 'The world leading AI-powered developer collaboration platform.',
    providerCompany: 'GitHub Inc.',
    providerWebsite: 'https://github.com',
    baseUrl: 'https://api.github.com/graphql',
    docsUrl: 'https://docs.github.com/en/graphql',
    logoUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=128&auto=format&fit=crop&q=80',
    pricingModel: 'FREE',
    rating: 4.87,
    totalReviews: 184,
    totalSubscribers: 11200,
    totalRequests: 16500000,
    latencyMs: 112,
    uptimePercentage: 99.96,
    tags: ['github', 'git', 'graphql', 'code', 'collaboration'],
    endpoints: [
      {
        method: 'POST',
        path: '/graphql',
        description: 'Execute arbitrary GraphQL queries against GitHub comprehensive data graph.',
        sampleRequest: JSON.stringify({ query: 'query { viewer { login repositories(first: 5) { nodes { name stargazers { totalCount } } } } }' }, null, 2),
      },
    ],
    plans: [
      {
        name: 'Public Developer Access',
        slug: 'developer',
        description: '5,000 points per hour rate limit under personal access tokens.',
        price: 0,
        billingInterval: 'monthly',
        features: ['5,000 points / hour', 'Full repository graph', 'GraphQL schema introspection'],
        rateLimit: 100,
      },
    ],
    reviews: [
      {
        reviewerName: 'Liam O\'Connor',
        reviewerEmail: 'liam@devopsmesh.org',
        rating: 5,
        title: 'Eliminated dozens of REST round-trips',
        content: 'Fetching PR reviews, commit statuses, and issue labels in a single GraphQL query reduced our sync times by 70%.',
      },
    ],
  },
  {
    name: 'Resend Email Gateway',
    slug: 'resend-email',
    description: 'Modern developer-first transactional and marketing email delivery built on top-tier deliverability IPs.',
    categorySlug: 'communication',
    providerName: 'Resend Technologies',
    providerEmail: 'team@resend.com',
    providerBio: 'Email infrastructure built specifically for developers with React email components.',
    providerCompany: 'Resend Technologies Inc.',
    providerWebsite: 'https://resend.com',
    baseUrl: 'https://api.resend.com',
    docsUrl: 'https://resend.com/docs',
    logoUrl: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=128&auto=format&fit=crop&q=80',
    pricingModel: 'FREEMIUM',
    rating: 4.91,
    totalReviews: 147,
    totalSubscribers: 6850,
    totalRequests: 9400000,
    latencyMs: 65,
    uptimePercentage: 99.99,
    tags: ['email', 'transactional', 'smtp', 'delivery', 'resend'],
    endpoints: [
      {
        method: 'POST',
        path: '/emails',
        description: 'Dispatch a transactional email with HTML, plaintext, attachments, or React components.',
        sampleRequest: JSON.stringify({ from: 'onboarding@resend.dev', to: 'developer@example.com', subject: 'Welcome to Klyra', html: '<p>Welcome aboard!</p>' }, null, 2),
        sampleResponse: JSON.stringify({ id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794', from: 'onboarding@resend.dev', to: ['developer@example.com'], created_at: '2026-09-14T20:00:00.000Z' }, null, 2),
      },
    ],
    plans: [
      {
        name: 'Free Starter',
        slug: 'free',
        description: 'Send up to 3,000 emails per month completely free.',
        price: 0,
        billingInterval: 'monthly',
        features: ['3,000 emails / month', '1 domain', '1 day log retention'],
        rateLimit: 10,
      },
      {
        name: 'Pro Delivery',
        slug: 'pro',
        description: '50,000 emails / month with dedicated IP options.',
        price: 20.00,
        billingInterval: 'monthly',
        features: ['50,000 emails / month', 'Unlimited domains', '30-day log retention', 'Webhook analytics'],
        rateLimit: 100,
      },
    ],
    reviews: [
      {
        reviewerName: 'David Chen',
        reviewerEmail: 'david@microapps.co',
        rating: 5,
        title: 'Deliverability jumped from 82% to 99.4%',
        content: 'Switching to Resend solved all our spam-box issues with Gmail and Outlook.',
      },
    ],
  },
  {
    name: 'Supabase Data & Auth',
    slug: 'supabase-api',
    description: 'PostgreSQL database backend, instantaneous REST/GraphQL endpoints, Auth, Realtime websockets, and Storage.',
    categorySlug: 'cloud-devops',
    providerName: 'Supabase Inc.',
    providerEmail: 'hello@supabase.com',
    providerBio: 'The open-source Firebase alternative with enterprise Postgres at its foundation.',
    providerCompany: 'Supabase Inc.',
    providerWebsite: 'https://supabase.com',
    baseUrl: 'https://api.supabase.com/v1',
    docsUrl: 'https://supabase.com/docs',
    logoUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=128&auto=format&fit=crop&q=80',
    pricingModel: 'FREEMIUM',
    rating: 4.89,
    totalReviews: 290,
    totalSubscribers: 15300,
    totalRequests: 31000000,
    latencyMs: 52,
    uptimePercentage: 99.98,
    tags: ['database', 'postgres', 'auth', 'realtime', 'storage'],
    endpoints: [
      {
        method: 'GET',
        path: '/rest/v1/projects',
        description: 'Perform schema-driven auto-generated REST queries on Postgres tables.',
      },
    ],
    plans: [
      {
        name: 'Community Tier',
        slug: 'free',
        description: 'Up to 2 active projects, 500MB database, 50,000 monthly active users.',
        price: 0,
        billingInterval: 'monthly',
        features: ['500MB Postgres database', '5GB bandwidth', '50k monthly active users'],
        rateLimit: 200,
      },
      {
        name: 'Team Pro',
        slug: 'pro',
        description: '8GB disk, 100GB bandwidth, daily automated backups, no project pausing.',
        price: 25.00,
        billingInterval: 'monthly',
        features: ['8GB storage included', '100GB egress', '7-day point-in-time recovery', 'No pausing'],
        rateLimit: 1000,
      },
    ],
    reviews: [
      {
        reviewerName: 'Kavita Patel',
        reviewerEmail: 'kavita@stackorbit.io',
        rating: 5,
        title: 'Replaced our entire custom backend',
        content: 'Row Level Security directly inside Postgres allows us to write frontend code without building boilerplate CRUD microservices.',
      },
    ],
  },
];

export async function seedMarketplace() {
  console.log('[seed:marketplace] Starting marketplace database seed...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch category map (slug -> id)
    const catRows = (await client.query('SELECT id, slug FROM categories')).rows;
    const catMap = new Map<string, string>(catRows.map(r => [r.slug, r.id]));

    const insertedApiIds: string[] = [];

    for (const item of SEED_APIS) {
      const categoryId = catMap.get(item.categorySlug);
      if (!categoryId) {
        console.warn(`[seed:marketplace] Category ${item.categorySlug} not found, skipping ${item.name}`);
        continue;
      }

      // 2. Ensure provider user exists
      let providerId: string;
      const userRes = await client.query('SELECT id FROM users WHERE email = $1', [item.providerEmail]);
      if (userRes.rows.length > 0) {
        providerId = userRes.rows[0].id;
        await client.query(
          `UPDATE users SET name = $1, bio = $2, company = $3, website = $4, avatar_url = $5, role = 'PROVIDER' WHERE id = $6`,
          [item.providerName, item.providerBio, item.providerCompany, item.providerWebsite, item.logoUrl, providerId]
        );
      } else {
        const newUser = await client.query(
          `INSERT INTO users (name, email, password_hash, role, bio, company, website, avatar_url, email_verified_at, status)
           VALUES ($1, $2, 'seeded_hashed_password', 'PROVIDER', $3, $4, $5, $6, NOW(), 'ACTIVE')
           RETURNING id`,
          [item.providerName, item.providerEmail, item.providerBio, item.providerCompany, item.providerWebsite, item.logoUrl]
        );
        providerId = newUser.rows[0].id;
      }

      // Calculate algorithmic scores
      const trendingScore = (item.totalRequests / 100000) * 0.4 + item.totalSubscribers * 0.3 + item.rating * 20;
      const popularityScore = item.totalSubscribers * 50 + item.totalRequests / 1000 + item.rating * 100;

      // 3. Upsert API
      const apiSpecJson = {
        openapi: '3.0.3',
        info: { title: item.name, version: '1.0.0', description: item.description },
        paths: Object.fromEntries(item.endpoints.map(ep => [
          ep.path.split('?')[0],
          {
            [ep.method.toLowerCase()]: {
              summary: ep.description,
              responses: { '200': { description: 'Successful response' } },
            },
          },
        ])),
      };

      const apiRes = await client.query(
        `INSERT INTO apis (
           name, slug, description, current_version, base_url, docs_url, logo_url,
           category_id, owner_id, pricing_model, status, is_public, api_spec, tags,
           rating, total_reviews, total_subscribers, total_requests, latency_ms,
           uptime_percentage, trending_score, popularity_score, last_published_at
         )
         VALUES ($1, $2, $3, '1.0.0', $4, $5, $6, $7, $8, $9, 'PUBLISHED', true, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           base_url = EXCLUDED.base_url,
           docs_url = EXCLUDED.docs_url,
           logo_url = EXCLUDED.logo_url,
           category_id = EXCLUDED.category_id,
           pricing_model = EXCLUDED.pricing_model,
           api_spec = EXCLUDED.api_spec,
           tags = EXCLUDED.tags,
           rating = EXCLUDED.rating,
           total_reviews = EXCLUDED.total_reviews,
           total_subscribers = EXCLUDED.total_subscribers,
           total_requests = EXCLUDED.total_requests,
           latency_ms = EXCLUDED.latency_ms,
           uptime_percentage = EXCLUDED.uptime_percentage,
           trending_score = EXCLUDED.trending_score,
           popularity_score = EXCLUDED.popularity_score,
           status = 'PUBLISHED',
           is_public = true,
           updated_at = NOW()
         RETURNING id`,
        [
          item.name,
          item.slug,
          item.description,
          item.baseUrl,
          item.docsUrl,
          item.logoUrl,
          categoryId,
          providerId,
          item.pricingModel,
          JSON.stringify(apiSpecJson),
          item.tags,
          item.rating,
          item.totalReviews,
          item.totalSubscribers,
          item.totalRequests,
          item.latencyMs,
          item.uptimePercentage,
          trendingScore,
          popularityScore,
        ]
      );

      const apiId = apiRes.rows[0].id;
      insertedApiIds.push(apiId);

      // 4. Ensure API version exists
      await client.query(
        `INSERT INTO api_versions (api_id, version, api_spec, is_current, is_deprecated, released_at)
         VALUES ($1, '1.0.0', $2, true, false, NOW())
         ON CONFLICT (api_id, version) DO UPDATE SET
           api_spec = EXCLUDED.api_spec,
           is_current = true`,
        [apiId, JSON.stringify(apiSpecJson)]
      );

      // 5. Ensure subscription plans exist
      for (const plan of item.plans) {
        await client.query(
          `INSERT INTO subscription_plans (api_id, name, slug, description, price, billing_interval, features, rate_limit, is_active)
           VALUES ($1, $2, $3, $4, $5, $6::billing_interval, $7, $8, true)
           ON CONFLICT (api_id, slug) DO UPDATE SET
             name = EXCLUDED.name,
             price = EXCLUDED.price,
             features = EXCLUDED.features,
             rate_limit = EXCLUDED.rate_limit`,
          [
            apiId,
            plan.name,
            plan.slug,
            plan.description,
            plan.price,
            plan.billingInterval.toUpperCase(),
            JSON.stringify(plan.features),
            plan.rateLimit,
          ]
        );
      }

      // 6. Ensure sample reviews exist
      for (const rev of item.reviews) {
        let reviewerId: string;
        const revUserRes = await client.query('SELECT id FROM users WHERE email = $1', [rev.reviewerEmail]);
        if (revUserRes.rows.length > 0) {
          reviewerId = revUserRes.rows[0].id;
        } else {
          const newRevUser = await client.query(
            `INSERT INTO users (name, email, password_hash, role, status)
             VALUES ($1, $2, 'hashed_demo_pw', 'USER', 'ACTIVE')
             RETURNING id`,
            [rev.reviewerName, rev.reviewerEmail]
          );
          reviewerId = newRevUser.rows[0].id;
        }

        await client.query(
          `INSERT INTO api_reviews (user_id, api_id, rating, title, content, is_verified, is_approved)
           VALUES ($1, $2, $3, $4, $5, true, true)
           ON CONFLICT (user_id, api_id) DO UPDATE SET
             rating = EXCLUDED.rating,
             title = EXCLUDED.title,
             content = EXCLUDED.content,
             is_approved = true`,
          [reviewerId, apiId, rev.rating, rev.title, rev.content]
        );
      }
    }

    // 7. Update featured_apis in system_settings
    if (insertedApiIds.length > 0) {
      await client.query(
        `INSERT INTO system_settings (key, value, description, is_public)
         VALUES ('featured_apis', $1::jsonb, 'Handpicked APIs highlighted in the marketplace', true)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = NOW()`,
        [JSON.stringify(insertedApiIds.slice(0, 4))]
      );
    }

    await client.query('COMMIT');
    console.log(`[seed:marketplace] Successfully seeded ${insertedApiIds.length} production-grade APIs!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed:marketplace] Failed to seed marketplace:', err);
    throw err;
  } finally {
    client.release();
  }
}

// When executed directly via node/ts-node
if (require.main === module) {
  seedMarketplace()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
