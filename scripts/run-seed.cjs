require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { URL } = require('url');

const DIRECT_CONNECTION = process.env.NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION;
if (!DIRECT_CONNECTION) { console.error('Error: no direct conn'); process.exit(1); }

const connUrl = new URL(DIRECT_CONNECTION);
const pool = new Pool({ host: connUrl.hostname, port: connUrl.port || 5432, database: connUrl.pathname.slice(1), user: decodeURIComponent(connUrl.username), password: decodeURIComponent(connUrl.password), family: 4, max: 10 });

async function main() {
  const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
  const seed = fs.readFileSync(seedPath, 'utf8');
  console.log('Running seed...');
  try {
    await pool.query(seed);
    console.log('Seed execution complete!');
  } catch (error) {
    console.error('Error:', error.message);
  }
  await pool.end();
}
main();
