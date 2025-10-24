/*
  Local-only helper to create a confirmed test user in Supabase Auth using the Admin API.
  Requirements:
  - SUPABASE_SERVICE_ROLE_KEY environment variable (NEVER commit or ship this; local dev only)
  - EXPO_PUBLIC_SUPABASE_URL (already in .env)

  Usage:
    SUPABASE_SERVICE_ROLE_KEY=... node scripts/createTestUser.js test@example.com Passw0rd!
*/

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!url) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
  if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  if (!email || !password) throw new Error('Usage: node scripts/createTestUser.js <email> <password>');

  const endpoint = url.replace(/\/$/, '') + '/auth/v1/admin/users';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRole}`,
      'apikey': serviceRole,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin create user failed: ${res.status} ${text}`);
  }

  const body = await res.json();
  console.log('Created user:', body.user?.email || email);
}

// Node 18+ has global fetch
if (typeof fetch === 'undefined') {
  global.fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
