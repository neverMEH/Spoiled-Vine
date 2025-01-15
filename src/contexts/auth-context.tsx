import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';
import { useToast } from '@/hooks/use-toast';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: any; data: any }>;
  signOut: () => Promise<void>;
  updateProfile: (data: { full_name?: string; avatar_url?: string; bio?: string; location?: string }) => Promise<void>;
  resetPasswordRequest: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err) {
      setError(err as AuthError);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      return { error: null, data };
    } catch (err) {
      setError(err as AuthError);
      return { error: err, data: null };
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      setError(err as AuthError);
      throw err;
    }
  };

  const updateProfile = async (data: {
    full_name?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
  }) => {
    try {
      setError(null);
      if (!user) throw new Error('No user logged in');

      const updates = {
        id: user.id,
        updated_at: new Date().toISOString(),
        ...data,
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (err) {
      setError(err as AuthError);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const resetPasswordRequest = async (email: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (err) {
      setError(err as AuthError);
      throw err;
    }
  };

  const resetPassword = async (newPassword: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    } catch (err) {
      setError(err as AuthError);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        isAuthenticated: !!session,
        error,
        signIn,
        signUp,
        signOut,
        updateProfile,
        resetPasswordRequest,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}