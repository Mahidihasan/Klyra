const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'klyra', // Update if your db name is different
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function createAdmin() {
  const email = 'admin@example.com';
  const password = 'adminpassword123';
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Attempt to insert
    const res = await pool.query(`
      INSERT INTO users (email, password_hash, role, name, status) 
      VALUES ($1, $2, 'ADMIN', 'Admin User', 'ACTIVE')
      ON CONFLICT (email) 
      DO UPDATE SET role = 'ADMIN', password_hash = $2
      RETURNING id, email;
    `, [email, hashedPassword]);

    console.log('✅ Admin account created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
  } catch (err) {
    console.error('❌ Error creating admin account:', err.message);
  } finally {
    pool.end();
  }
}

createAdmin();
