-- API Build extras: user-defined marketplace categories (created at wizard step 1)
-- so a brand-new category is stored in Postgres AND shown in the marketplace.
CREATE TABLE IF NOT EXISTS api_build_categories (
  name TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  project_count INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the default taxonomy so the marketplace always has a base set.
INSERT INTO api_build_categories (name, slug, project_count, is_custom) VALUES
  ('AI / Developer Tools', 'ai-developer-tools', 12, FALSE),
  ('Media',                 'media',                 6,  FALSE),
  ('Finance',               'finance',               8,  FALSE),
  ('Communication',         'communication',         5,  FALSE),
  ('E-commerce',            'ecommerce',             7,  FALSE),
  ('Weather',               'weather',               4,  FALSE),
  ('DevOps',                'devops',                3,  FALSE)
ON CONFLICT (name) DO NOTHING;