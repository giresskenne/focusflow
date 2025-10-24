/**
 * Optional integration test for Supabase auth.
 * Skips unless TEST_USER_EMAIL/TEST_USER_PASSWORD are provided.
 * If SUPABASE_SERVICE_ROLE_KEY is present and the user doesn't exist, attempts to create it.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY; // optional, local-only

const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

const supabase = (url && anon) ? createClient(url, anon) : null;

const maybe = (cond) => (cond ? describe : describe.skip);

maybe(!!(url && anon && TEST_EMAIL && TEST_PASSWORD))('Supabase auth (integration)', () => {
  it('can sign in with a test user', async () => {
    if (!supabase) throw new Error('Supabase not configured');

    // Try sign in first
    let { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    // If user not found or email not confirmed, attempt to create via Admin API (local only)
    if (error && svc) {
      const endpoint = url.replace(/\/$/, '') + '/auth/v1/admin/users';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${svc}`,
          'apikey': svc,
        },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Admin create user failed: ${res.status} ${t}`);
      }

      // Retry sign in
      const retry = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
      data = retry.data;
      error = retry.error;
    }

    expect(error).toBeNull();
    expect(data?.user?.email).toBe(TEST_EMAIL);
  }, 20000);
});
