'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';

// --- Zod Schemas ---
const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  // Add avatar_url later if needed
});

const passwordSchema = z.object({
  // currentPassword: z.string().min(6, 'Current password is required'), // Supabase update doesn't require current password
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // Error applies to the confirmation field
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

// --- Component ---
export default function SettingsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // --- Profile Form --- 
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfileForm,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: ''
    }
  });

  // --- Password Form ---
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  // --- Effects ---
  // Pre-fill profile form when profile data loads
  useEffect(() => {
    if (profile) {
      resetProfileForm({ fullName: profile.full_name || '' });
    }
  }, [profile, resetProfileForm]);

  // --- Handlers ---
  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setProfileUpdateLoading(true);
    setProfileError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: data.fullName })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully!');
      // Optionally refresh auth context or rely on its listener
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setProfileError(`Failed to update profile: ${err.message}`);
      toast.error(`Failed to update profile: ${err.message}`);
    } finally {
      setProfileUpdateLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setPasswordUpdateLoading(true);
    setPasswordError(null);
    try {
      // Supabase handles password update directly via auth
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) throw error;
      toast.success('Password updated successfully!');
      resetPasswordForm(); // Clear password fields
    } catch (err: any) {
      console.error("Error updating password:", err);
      setPasswordError(`Failed to update password: ${err.message}`);
      toast.error(`Failed to update password: ${err.message}`);
    } finally {
      setPasswordUpdateLoading(false);
    }
  };

  // --- Render ---
  if (authLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  }

  if (!user || !profile) {
    return <Alert severity="error">Could not load user data. Please try again.</Alert>;
  }

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Profile Settings */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>Update Profile</Typography>
        <Divider sx={{ mb: 2 }}/>
        {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}
        <form onSubmit={handleSubmitProfile(onProfileSubmit)}>
          <TextField
            label="Email"
            value={user.email || ''}
            fullWidth
            margin="normal"
            disabled // Email is not editable here
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            {...registerProfile('fullName')}
            label="Full Name"
            fullWidth
            margin="normal"
            required
            error={!!profileErrors.fullName}
            helperText={profileErrors.fullName?.message}
            disabled={profileUpdateLoading}
            InputLabelProps={{ shrink: true }} // Keep label floated
          />
          {/* Add Avatar upload here later */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={profileUpdateLoading}
            >
              {profileUpdateLoading ? <CircularProgress size={24} /> : 'Save Profile'}
            </Button>
          </Box>
        </form>
      </Paper>

      {/* Password Settings */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Change Password</Typography>
        <Divider sx={{ mb: 2 }}/>
        {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}
        <form onSubmit={handleSubmitPassword(onPasswordSubmit)}>
          {/* Supabase doesn't require current password for user update */}
          <TextField
            {...registerPassword('newPassword')}
            label="New Password"
            type="password"
            fullWidth
            margin="normal"
            required
            error={!!passwordErrors.newPassword}
            helperText={passwordErrors.newPassword?.message}
            disabled={passwordUpdateLoading}
          />
          <TextField
            {...registerPassword('confirmPassword')}
            label="Confirm New Password"
            type="password"
            fullWidth
            margin="normal"
            required
            error={!!passwordErrors.confirmPassword}
            helperText={passwordErrors.confirmPassword?.message}
            disabled={passwordUpdateLoading}
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={passwordUpdateLoading}
            >
              {passwordUpdateLoading ? <CircularProgress size={24} /> : 'Update Password'}
            </Button>
          </Box>
        </form>
      </Paper>

      {/* Add Theme Settings later */}

    </Container>
  );
} 