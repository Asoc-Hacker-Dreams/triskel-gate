import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface PasskeyUser {
  id: string | number;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | PasskeyUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setPasskeySession: (user: PasskeyUser, token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  setPasskeySession: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | PasskeyUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        localStorage.setItem('token', session.access_token);
      } else {
        // Check for a persisted passkey session
        const passkeyUser = localStorage.getItem('passkey_user');
        const token = localStorage.getItem('token');
        if (passkeyUser && token) {
          setUser(JSON.parse(passkeyUser));
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUser(session.user);
        localStorage.setItem('token', session.access_token);
      } else {
        // Don't evict a passkey session on Supabase sign-out events
        if (!localStorage.getItem('passkey_user')) {
          setUser(null);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setPasskeySession = (passkeyUser: PasskeyUser, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('passkey_user', JSON.stringify(passkeyUser));
    setUser(passkeyUser);
    setLoading(false);
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('passkey_user');
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, setPasskeySession }}>
      {children}
    </AuthContext.Provider>
  );
};
