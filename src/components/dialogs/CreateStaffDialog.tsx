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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';

// Zod schema for staff form validation
const staffSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  department: z.string().optional(),
  position: z.string().optional(),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']).optional(),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface CreateStaffDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Optional callback for success
}

export default function CreateStaffDialog({ open, onClose, onSuccess }: CreateStaffDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      department: '',
      position: '',
      shift: 'MORNING', // Default value
    },
  });

  const onSubmit = async (data: StaffFormData) => {
    setIsSubmitting(true);
    const toastId = toast.loading('Creating staff member...');
    let authUserId: string | null = null;
    let profileId: string | null = null;

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
          role: 'STAFF', // Set role explicitly
        })
        .select('id')
        .single();

      if (profileError) {
        throw new Error(`Profile Error: ${profileError.message}`);
      }
      if (!profileData) {
        throw new Error('Profile creation failed: No profile data returned');
      }
      profileId = profileData.id;
      toast.loading('Profile created, creating staff record...', { id: toastId });

      // 3. Create Staff Record
      const { error: staffError } = await supabase
        .from('staff') // Target the 'staff' table
        .insert({
          profile_id: profileId,
          department: data.department || null,
          position: data.position || null,
          shift: data.shift || 'MORNING',
        });

      if (staffError) {
        throw new Error(`Staff Record Error: ${staffError.message}`);
      }

      toast.success('Staff member created successfully!', { id: toastId });
      reset(); // Reset form fields
      onSuccess?.(); // Call success callback if provided
      onClose(); // Close the dialog

    } catch (error) {
      console.error('Staff creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred', { id: toastId });
      // Cleanup is complex and likely needs server-side handling
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
      <DialogTitle>Create New Staff Member</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
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
            {...register('department')}
            label="Department"
            fullWidth
            margin="dense"
            error={!!errors.department}
            helperText={errors.department?.message}
            disabled={isSubmitting}
          />
          <TextField
            {...register('position')}
            label="Position"
            fullWidth
            margin="dense"
            error={!!errors.position}
            helperText={errors.position?.message}
            disabled={isSubmitting}
          />
          <FormControl fullWidth margin="dense" error={!!errors.shift} disabled={isSubmitting}>
            <InputLabel>Shift</InputLabel>
            <Select
              {...register('shift')}
              label="Shift"
              defaultValue="MORNING"
            >
              <MenuItem value="MORNING">Morning</MenuItem>
              <MenuItem value="AFTERNOON">Afternoon</MenuItem>
              <MenuItem value="NIGHT">Night</MenuItem>
            </Select>
            {errors.shift && <FormHelperText>{errors.shift.message}</FormHelperText>}
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleCloseDialog} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Create Staff'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 