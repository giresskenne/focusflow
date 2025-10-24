import { getSupabase } from '../lib/supabase';
import { setAuthUser, clearAuthUser } from '../storage';

// Initialize auth session on app start
export async function initializeAuth() {
  try {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('[Auth] Session check failed:', error.message);
      await clearAuthUser();
      return null;
    }
    
    if (session?.user) {
      // Update cached user info
      await setAuthUser({ 
        id: session.user.id, 
        email: session.user.email 
      });
      return session.user;
    } else {
      // No active session, clear cache
      await clearAuthUser();
      return null;
    }
  } catch (e) {
    console.warn('[Auth] Initialize failed:', e.message);
    await clearAuthUser();
    return null;
  }
}

// Set up auth state listener for real-time updates
export function setupAuthListener(onAuthChange) {
  const supabase = getSupabase();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth] State change:', event, session?.user?.email || 'no user');
    
    if (session?.user) {
      await setAuthUser({ 
        id: session.user.id, 
        email: session.user.email 
      });
      onAuthChange(session.user);
    } else {
      await clearAuthUser();
      onAuthChange(null);
    }
  });
  
  return () => subscription.unsubscribe();
}