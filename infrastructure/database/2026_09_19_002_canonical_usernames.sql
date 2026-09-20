BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);

CREATE TEMP TABLE username_backfill (id UUID PRIMARY KEY, username VARCHAR(30) NOT NULL) ON COMMIT DROP;
INSERT INTO username_backfill (id, username) VALUES
  ('796c3b3d-b2e0-4303-8af8-47a03e7621ea', 'demo10'),
  ('1865d553-3615-4873-b0e0-9f43dfdc36eb', 'nazmul'),
  ('7857d0dc-0d92-4b2a-9170-b8f4076e87b8', 'demo15'),
  ('d1093a53-97c3-4a9d-aebc-018f6c2c1344', 'sabbir'),
  ('c2bcfe8e-d66a-430b-ab55-7c7ab3edf719', 'nazmul-islam'),
  ('755eaaad-6f2e-4d16-afe4-dca4a7410275', 'disposable'),
  ('e071c004-6b23-4dd3-9617-d6de45419395', 'samir'),
  ('ea911427-1709-4861-8c98-4d0a044fb9a9', 'ahmed'),
  ('09bd6f3d-4ef2-4439-9fa1-06a54c3c4ffa', 'shuvra'),
  ('20d9558b-6e32-4872-b6d1-151ffbfc2a48', 'kavita-patel'),
  ('221a54d8-d601-4d67-b1d1-4fa6ede77267', 'github-inc'),
  ('2c1d1d44-781e-4aeb-b656-f155cd6888f1', 'weatherapi-global-ltd'),
  ('76d82efd-2cb3-4724-917b-1eaf715f1d67', 'alex-mercer'),
  ('8270f9cb-2b67-490b-ba8f-b4d5459de512', 'resend-technologies'),
  ('8f243d28-2388-4056-b66a-c1ed6b2a47c4', 'supabase-inc'),
  ('9274a299-e6e8-4e63-b0b5-d7564fe882e6', 'marcus-vance'),
  ('98b5eebe-0c26-4b4a-a541-795712718867', 'stripe-inc'),
  ('abcfdc99-a0a9-47e9-ae37-bf9e597daa9d', 'openai-inc'),
  ('cd6fafcd-7ead-4525-9ac4-56e91b2184f6', 'david-chen'),
  ('d8334aed-b828-42e9-b9dd-3ec26c05349b', 'elena-rostova'),
  ('fea387ac-351d-4318-92e0-720e9753d0de', 'sarah-lin'),
  ('6241905a-f51f-4ab2-81d7-e554836c7090', 'redwan'),
  ('76d09251-e659-4210-9be2-416301da1105', 'micro'),
  ('5096423d-a3a2-45d3-a0c0-08aca1b356b3', 'doraemon');

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) <> 24
     OR (SELECT COUNT(*) FROM username_backfill) <> 24
     OR (SELECT COUNT(*) FROM users u JOIN username_backfill b ON b.id = u.id WHERE u.deleted_at IS NULL) <> 24 THEN
    RAISE EXCEPTION 'Username backfill preflight failed: live users no longer match the approved 24-user snapshot.';
  END IF;
  IF EXISTS (SELECT 1 FROM username_backfill WHERE username !~ '^[a-z][a-z0-9_-]{1,28}[a-z0-9]$')
     OR EXISTS (SELECT lower(username) FROM username_backfill GROUP BY lower(username) HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Username backfill preflight failed: invalid or duplicate candidate.';
  END IF;
END $$;

UPDATE users u
SET username = b.username,
    metadata = jsonb_set(COALESCE(u.metadata, '{}'::jsonb), '{personal_info}',
      COALESCE(u.metadata -> 'personal_info', '{}'::jsonb) || jsonb_build_object('handle', b.username), true),
    updated_at = NOW()
FROM username_backfill b
WHERE u.id = b.id;

CREATE UNIQUE INDEX users_username_lower_unique ON users (LOWER(username));
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

COMMIT;
