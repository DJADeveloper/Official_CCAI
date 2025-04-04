'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase/client';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  // We might need a way to select the resident later
  // Autocomplete, // For selecting resident
} from '@mui/material';

// Zod schema for family member form validation
const familySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  relationship: z.string().optional(), // e.g., Son, Daughter, Spouse
  // residentId: z.string().uuid('Must select a valid resident'), // Add later when integrating
});

type FamilyFormData = z.infer<typeof familySchema>;

interface CreateFamilyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Optional callback for success
  // residents: Resident[]; // Pass residents list for selection later
}

export default function CreateFamilyDialog({ open, onClose, onSuccess }: CreateFamilyDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    // control, // For Autocomplete if used
    formState: { errors },
  } = useForm<FamilyFormData>({
    resolver: zodResolver(familySchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      relationship: '',
      // residentId: '',
    },
  });

  const onSubmit = async (data: FamilyFormData) => {
    setIsSubmitting(true);
    const toastId = toast.loading('Creating family member...');
    let authUserId: string | null = null;

    try {
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new Error(`Auth Error: ${authError.message}`);
      }
      if (!authData.user) {
        throw new Error('Auth user creation failed: No user returned');
      }
      authUserId = authData.user.id;
      toast.loading('Auth user created, creating profile...', { id: toastId });

      // 2. Create Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUserId,
          email: data.email,
          full_name: data.fullName,
          role: 'FAMILY', // Set role explicitly
          // We will need to add resident_id association later
          // relationship: data.relationship, // Maybe add to profiles or a separate family_links table
        })
        .select('id')
        .single();

      if (profileError) {
        // Attempt to delete the orphaned auth user if profile creation fails
        // NOTE: Requires admin privileges, won't work from client-side directly
        // await supabase.auth.admin.deleteUser(authUserId);
        throw new Error(`Profile Error: ${profileError.message}`);
      }
      if (!profileData) {
        throw new Error('Profile creation failed: No profile data returned');
      }

      // 3. TODO: Link family member to resident(s) - this might need a separate table `family_resident_links`
      // e.g., supabase.from('family_resident_links').insert({ family_profile_id: profileData.id, resident_profile_id: data.residentId })
      toast.loading('Profile created. Linking to resident... (Not implemented yet)', { id: toastId });

      toast.success('Family member created successfully! (Linking step pending)', { id: toastId });
      reset(); // Reset form fields
      onSuccess?.(); // Call success callback if provided
      onClose(); // Close the dialog

    } catch (error) {
      console.error('Family member creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred', { id: toastId });
      // Cleanup is complex
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      reset(); // Reset form on close if not submitting
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Family Member</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {/* TODO: Add Resident Selection Dropdown/Autocomplete here */}
          {/* <Autocomplete
            options={residents}
            getOptionLabel={(option) => option.profile.full_name || 'Unknown'}
            // ... other props ...
          /> */}

          <TextField
            {...register('fullName')}
            label="Full Name"
            fullWidth
            margin="dense"
            required
            error={!!errors.fullName}
            helperText={errors.fullName?.message}
            disabled={isSubmitting}
          />
          <TextField
            {...register('email')}
            label="Email"
            type="email"
            fullWidth
            margin="dense"
            required
            error={!!errors.email}
            helperText={errors.email?.message}
            disabled={isSubmitting}
          />
          <TextField
            {...register('password')}
            label="Password"
            type="password"
            fullWidth
            margin="dense"
            required
            error={!!errors.password}
            helperText={errors.password?.message}
            disabled={isSubmitting}
          />
          <TextField
            {...register('relationship')}
            label="Relationship to Resident(s)"
            fullWidth
            margin="dense"
            error={!!errors.relationship}
            helperText={errors.relationship?.message}
            disabled={isSubmitting}
          />
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleCloseDialog} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Create Family Member'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 