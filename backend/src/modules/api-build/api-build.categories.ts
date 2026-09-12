import { pool } from '../../services/database.service';

export interface ApiCategoryRow {
  name: string;
  slug: string;
  project_count: number;
  is_custom: boolean;
}

/** All marketplace categories ordered by popularity (project count desc). */
export async function listCategories(): Promise<ApiCategoryRow[]> {
  const result = await pool.query(
    'SELECT name, slug, project_count, is_custom FROM api_build_categories ORDER BY project_count DESC, created_at ASC',
  );
  return result.rows;
}

/**
 * Creates a user-defined category (from the "New project" wizard) or, when it
 * already exists, bumps its project counter. Duplicate-safe via ON CONFLICT.
 */
export async function addCategory(name: string): Promise<ApiCategoryRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required.');
  if (trimmed.length > 80) throw new Error('Category name must be 80 characters or fewer.');
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `cat-${Date.now()}`;
  const result = await pool.query(
    `INSERT INTO api_build_categories (name, slug, project_count, is_custom)
       VALUES ($1, $2, 1, TRUE)
     ON CONFLICT (name) DO UPDATE SET project_count = api_build_categories.project_count + 1
     RETURNING name, slug, project_count, is_custom`,
    [trimmed, slug],
  );
  return result.rows[0];
}

/** Removes a user-created category (kept for hygiene; never deletes seeded ones). */
export async function removeCategory(name: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM api_build_categories WHERE name = $1 AND is_custom = TRUE',
    [name],
  );
  return (result.rowCount ?? 0) > 0;
}