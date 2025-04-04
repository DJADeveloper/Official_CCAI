'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  CircularProgress,
} from '@mui/material';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// Define type for Staff/Admin Profile
type StaffProfile = {
  id: string; // Profile ID (usually UUID)
  updated_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  email: string | null;
  role: 'STAFF' | 'ADMIN' | 'FAMILY' | 'RESIDENT' | null;
  created_at: string;
};

// Zod schema for validation
// Note: Email is usually not updatable directly as it's linked to auth.
// Role update might require specific permissions.
const staffUpdateSchema = z.object({
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  role: z.enum(['STAFF', 'ADMIN'], { required_error: 'Role is required' }), // Allow changing between STAFF and ADMIN
});

type StaffUpdateFormData = z.infer<typeof staffUpdateSchema>;

interface UpdateStaffDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffMember: StaffProfile | null; // The staff member being edited
}

const UpdateStaffDialog: React.FC<UpdateStaffDialogProps> = ({ open, onClose, onSuccess, staffMember }) => {
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<StaffUpdateFormData>({
    resolver: zodResolver(staffUpdateSchema),
    defaultValues: {
      full_name: '',
      role: 'STAFF', // Default role
    },
  });

  // Pre-fill form when staff member data is available
  useEffect(() => {
    if (staffMember) {
      reset({
        full_name: staffMember.full_name || '',
        role: staffMember.role === 'ADMIN' ? 'ADMIN' : 'STAFF', // Ensure only valid roles are set
      });
    } else {
      reset({ full_name: '', role: 'STAFF' }); // Clear form if no staff member
    }
  }, [staffMember, reset]);

  const onSubmit = async (data: StaffUpdateFormData) => {
    if (!staffMember) {
      toast.error('Cannot update: Staff member data missing.');
      return;
    }

    // Prevent demoting the last admin or the current user if they are admin?
    // Add more robust checks if needed

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          role: data.role,
        })
        .eq('id', staffMember.id);

      if (error) {
        throw error;
      }

      toast.success('Staff member updated successfully!');
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating staff member:', error);
      toast.error(`Failed to update staff member: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Staff/Admin Details</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <TextField
            label="Email (Read-only)"
            value={staffMember?.email || ''}
            variant="outlined"
            fullWidth
            margin="normal"
            disabled // Email is typically linked to auth user and not directly editable here
          />

          <Controller
            name="full_name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Full Name"
                variant="outlined"
                fullWidth
                margin="normal"
                required
                error={!!errors.full_name}
                helperText={errors.full_name?.message}
              />
            )}
          />

          <FormControl fullWidth margin="normal" required error={!!errors.role}>
            <InputLabel id="role-select-label">Role</InputLabel>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="role-select-label"
                  label="Role"
                >
                  <MenuItem value="STAFF">Staff</MenuItem>
                  <MenuItem value="ADMIN">Admin</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>{errors.role?.message}</FormHelperText>
          </FormControl>

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isLoading} color="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UpdateStaffDialog; 