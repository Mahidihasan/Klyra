/* Scratch: confirm the seed leaves exactly one deployment and one activity trail. */
import { pool } from '../src/services/database.service';

async function main() {
  const deployments = await pool.query(
    `SELECT version, environment, source, status, author
     FROM api_build_deployments WHERE project_id = $1 ORDER BY deployed_at`,
    ['proj-open-meteo-weather'],
  );
  console.log('deployments:', JSON.stringify(deployments.rows, null, 2));

  const activity = await pool.query(
    `SELECT label, kind FROM api_build_activity WHERE project_id = $1 ORDER BY created_at`,
    ['proj-open-meteo-weather'],
  );
  console.log('activity:', JSON.stringify(activity.rows, null, 2));

  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM api_build_endpoints WHERE project_id = $1) AS endpoints,
       (SELECT COUNT(*)::int FROM api_build_versions WHERE project_id = $1) AS versions,
       (SELECT COUNT(*)::int FROM api_build_plans WHERE project_id = $1) AS plans,
       (SELECT COUNT(*)::int FROM apis WHERE slug = 'open-meteo-weather') AS legacy_apis`,
    ['proj-open-meteo-weather'],
  );
  console.log('counts:', JSON.stringify(counts.rows[0]));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void pool.end());