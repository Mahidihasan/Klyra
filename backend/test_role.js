require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const email = 'sabbirrahman0084@gmail.com';
  const userRes = await pool.query(
    `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  const user = userRes.rows[0];
  console.log("DB User Role:", user.role);
  pool.end();
}
main();
