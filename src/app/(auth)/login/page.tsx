'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@mui/material';
import { TextField } from '@mui/material';
import { Box, Typography, Paper, Alert, CircularProgress, Divider } from '@mui/material';
import { supabase } from '@/lib/supabase/client';
import { AuthService } from '@/lib/services/AuthService';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>({
    initialCheck: 'Starting',
    timestamp: new Date().toISOString(),
  });
  
  const redirectPath = searchParams.get('redirectedFrom') || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@example.com',
      password: 'adminpassword123', // Pre-fill password for easier login
    }
  });

  // Initial check for existing session - with a timeout failsafe
  useEffect(() => {
    // Set a timeout to stop checking after 5 seconds no matter what
    const timeoutId = setTimeout(() => {
      setIsAuthChecking(false);
      console.log('Auth check timeout reached, showing login form');
      setDebugInfo(prev => ({
        ...prev,
        authCheckStatus: 'timeout_reached',
        timestamp: new Date().toISOString(),
      }));
    }, 5000);

    const checkAuthentication = async () => {
      try {
        console.log('Checking for existing authentication');
        setDebugInfo(prev => ({
          ...prev,
          initialCheck: 'Checking authentication',
          timestamp: new Date().toISOString(),
        }));
        
        // Check if already logged in
        const isAuthenticated = await AuthService.isAuthenticated();
        
        // Capture debug info
        const { data } = await supabase.auth.getSession();
        setDebugInfo(prev => ({
          ...prev,
          initialCheck: 'Auth check complete',
          timestamp: new Date().toISOString(),
          isAuthenticated,
          sessionData: data,
          environment: {
            url: window.location.href,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
          }
        }));
        
        // If already authenticated, redirect
        if (isAuthenticated) {
          console.log('User is already authenticated, redirecting to', redirectPath);
          setDebugInfo(prev => ({
            ...prev,
            initialCheck: 'Authenticated, redirecting...',
            timestamp: new Date().toISOString(),
          }));
          window.location.href = redirectPath; // Use window.location for harder refresh
          return;
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        setDebugInfo(prev => ({
          ...prev,
          initialCheck: 'Error during auth check',
          authCheckError: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }));
      } finally {
        // Always set checking to false and clear the timeout
        setIsAuthChecking(false);
        clearTimeout(timeoutId);
      }
    };
    
    checkAuthentication();
    
    // Clean up timeout if component unmounts
    return () => clearTimeout(timeoutId);
  }, [redirectPath]);

  // Helper function to set test account credentials
  const handleAutoFill = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      setDebugInfo(prev => ({
        ...prev,
        loginAttempt: {
          email: data.email,
          status: 'starting',
          timestamp: new Date().toISOString(),
        }
      }));
      
      console.log(`Attempting login with ${data.email}`);
      
      // Use the direct AuthService instead of the hook
      await AuthService.signIn(data.email, data.password);
      
      // Log successful login
      console.log('Login successful, redirecting to', redirectPath);
      
      setDebugInfo(prev => ({
        ...prev,
        loginAttempt: {
          ...prev.loginAttempt,
          status: 'success',
          timestamp: new Date().toISOString(),
        }
      }));
      
      // Force a hard refresh to ensure Supabase cookies are properly set
      window.location.href = redirectPath;
    } catch (err) {
      console.error('Login error:', err);
      
      // Show friendly error message
      if (err instanceof Error) {
        // Handle known error types
        if (err.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred during login');
      }
      
      // Capture debug info
      setDebugInfo(prev => ({
        ...prev,
        loginAttempt: {
          ...prev.loginAttempt,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct login that doesn't rely on the service to check first
  const handleDirectLogin = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      setDebugInfo(prev => ({
        ...prev,
        directLogin: {
          status: 'starting',
          timestamp: new Date().toISOString(),
        }
      }));
      
      console.log('Attempting direct login with Supabase client');
      
      // First, make sure we're logged out
      await supabase.auth.signOut();
      
      // Try direct login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@example.com',
        password: 'adminpassword123'
      });
      
      if (error) {
        throw error;
      }
      
      setDebugInfo(prev => ({
        ...prev,
        directLogin: {
          status: 'success',
          sessionData: data,
          timestamp: new Date().toISOString(),
        }
      }));
      
      console.log('Direct login successful, redirecting to', redirectPath);
      
      // Force a hard refresh
      window.location.href = redirectPath;
    } catch (err) {
      console.error('Direct login error:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during direct login');
      }
      
      setDebugInfo(prev => ({
        ...prev,
        directLogin: {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          mx: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Login
        </Typography>

        {isAuthChecking && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              <Typography variant="body2">Checking authentication...</Typography>
            </Box>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* Test account buttons */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Test Accounts:
          </Typography>
          <Button 
            size="small"
            variant="text"
            onClick={() => handleAutoFill('admin@example.com', 'adminpassword123')}
          >
            Admin
          </Button>
          <Button 
            size="small"
            variant="text"
            onClick={() => handleAutoFill('staff@example.com', 'password123')}
          >
            Staff
          </Button>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <TextField
            {...register('email')}
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            error={!!errors.email}
            helperText={errors.email?.message}
            disabled={isSubmitting}
          />

          <TextField
            {...register('password')}
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            error={!!errors.password}
            helperText={errors.password?.message}
            disabled={isSubmitting}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle2" gutterBottom align="center">
          Having trouble? Try direct login:
        </Typography>
        
        <Button
          variant="outlined"
          fullWidth
          onClick={handleDirectLogin}
          disabled={isSubmitting}
        >
          Direct Login (Admin)
        </Button>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
            <Typography color="primary">Forgot Password?</Typography>
          </Link>
        </Box>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2">
            Don't have an account?{' '}
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Typography component="span" color="primary">
                Register
              </Typography>
            </Link>
          </Typography>
        </Box>
        
        {debugInfo && (
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="h6">Debug Information:</Typography>
            <pre style={{ overflow: 'auto', maxHeight: '200px' }}>{JSON.stringify(debugInfo, null, 2)}</pre>
          </Paper>
        )}
      </Paper>
    </Box>
  );
}