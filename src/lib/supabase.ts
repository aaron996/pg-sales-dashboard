/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function createMockSupabaseClient() {
  console.log("🔌 VITE_SUPABASE_URL not configured. Initializing mock Supabase client for preview...");
  
  const mockUser = {
    id: 'mock-user-id',
    email: 'luongthevinh996@gmail.com',
    user_metadata: {
      full_name: 'Admin Developer (Preview)',
      avatar_url: 'https://i.ibb.co/DDQVDRbH/image.png'
    }
  };
  
  const mockSession = {
    user: mockUser,
    access_token: 'mock-token',
  };

  const dummyPromise = Promise.resolve({ data: null, error: null });
  
  const builder = {
    select: () => builder,
    insert: () => dummyPromise,
    upsert: () => dummyPromise,
    update: () => dummyPromise,
    delete: () => dummyPromise,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({
      data: {
        uid: 'mock-user-id',
        email: 'luongthevinh996@gmail.com',
        displayName: 'Admin Developer (Preview)',
        photoURL: 'https://i.ibb.co/DDQVDRbH/image.png',
        role: 'dev'
      },
      error: null
    }),
    single: () => dummyPromise,
  };

  return {
    auth: {
      onAuthStateChange: (callback: any) => {
        // Automatically mock a successful login state to bypass the login screen
        const timer = setTimeout(() => {
          callback('SIGNED_IN', mockSession);
        }, 50);
        return { data: { subscription: { unsubscribe: () => clearTimeout(timer) } } };
      },
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
      signInWithOAuth: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => builder,
  } as any;
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabaseClient();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  let userId = '';
  let email = '';
  try {
    const session = (supabase.auth as any).session ? (supabase.auth as any).session() : null;
    if (session?.user) {
      userId = session.user.id;
      email = session.user.email || '';
    }
  } catch (e) {
    // Ignore sync session access error
  }

  const errInfo: SupabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId || null,
      email: email || null,
    },
    operationType,
    path
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { handleSupabaseError as handleFirestoreError };
