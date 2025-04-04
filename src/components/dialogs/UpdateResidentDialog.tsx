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
  Box,
  Chip,
} from '@mui/material';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// Define the types needed (same as in ResidentsPage)
type ResidentWithProfile = {
  id: string; // Resident table PK
  created_at: string;
  profile_id: string; // FK to profiles
  room_number: string | null;
  emergency_contact: string | null;
  medical_conditions: string[] | null;
  care_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
};

// Zod schema for validation
const residentUpdateSchema = z.object({
  // Profile fields
  full_name: z.string().min(3, 'Full name must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  // Resident fields
  room_number: z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  medical_conditions: z.string().optional().nullable(), // Input as comma-separated string
  care_level: z.enum(['LOW', 'MEDIUM', 'HIGH'], { required_error: 'Care level is required' }),
});

type ResidentUpdateFormData = z.infer<typeof residentUpdateSchema>;

interface UpdateResidentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  resident: ResidentWithProfile | null; // The resident being edited
}

const UpdateResidentDialog: React.FC<UpdateResidentDialogProps> = ({ open, onClose, onSuccess, resident }) => {
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<ResidentUpdateFormData>({
    resolver: zodResolver(residentUpdateSchema),
    defaultValues: {
      full_name: '',
      email: '',
      room_number: '',
      emergency_contact: '',
      medical_conditions: '', // Initialize as empty string
      care_level: 'MEDIUM',
    },
  });

  // Pre-fill form when resident data is available or changes
  useEffect(() => {
    if (resident) {
      reset({
        full_name: resident.profiles?.full_name || '',
        email: resident.profiles?.email || '',
        room_number: resident.room_number || '',
        emergency_contact: resident.emergency_contact || '',
        medical_conditions: resident.medical_conditions?.join(', ') || '', // Join array for TextField
        care_level: resident.care_level || 'MEDIUM',
      });
    } else {
      reset(); // Clear form if no resident is selected
    }
  }, [resident, reset]);

  const onSubmit = async (data: ResidentUpdateFormData) => {
    if (!resident || !resident.profiles) {
      toast.error('Cannot update: Resident data is missing.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Update the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: data.full_name, email: data.email })
        .eq('id', resident.profile_id);

      if (profileError) {
        throw new Error(`Profile update failed: ${profileError.message}`);
      }

      // 2. Update the resident record
      const { error: residentError } = await supabase
        .from('residents')
        .update({
          room_number: data.room_number || null,
          emergency_contact: data.emergency_contact || null,
          medical_conditions: data.medical_conditions?.split(',').map(s => s.trim()).filter(Boolean) || null, // Split string back to array
          care_level: data.care_level,
        })
        .eq('id', resident.id);

      if (residentError) {
        throw new Error(`Resident update failed: ${residentError.message}`);
      }

      toast.success('Resident updated successfully!');
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating resident:', error);
      toast.error(`Failed to update resident: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      reset(); // Ensure form is cleared if closed manually
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Resident Details</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {/* Profile Fields */}          <Controller
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

          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Email"
                type="email"
                variant="outlined"
                fullWidth
                margin="normal"
                required
                error={!!errors.email}
                helperText={errors.email?.message}
              />
            )}
          />

          {/* Resident Fields */}          <Controller
            name="room_number"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Room Number (Optional)"
                variant="outlined"
                fullWidth
                margin="normal"
                error={!!errors.room_number}
                helperText={errors.room_number?.message}
              />
            )}
          />

          <Controller
            name="emergency_contact"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Emergency Contact (Optional)"
                variant="outlined"
                fullWidth
                margin="normal"
                error={!!errors.emergency_contact}
                helperText={errors.emergency_contact?.message}
              />
            )}
          />

          <Controller
            name="medical_conditions"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Medical Conditions (Optional, comma-separated)"
                variant="outlined"
                fullWidth
                margin="normal"
                multiline
                rows={3}
                error={!!errors.medical_conditions}
                helperText={errors.medical_conditions?.message}
              />
            )}
          />

          <FormControl fullWidth margin="normal" required error={!!errors.care_level}>
            <InputLabel id="care-level-select-label">Care Level</InputLabel>
            <Controller
              name="care_level"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="care-level-select-label"
                  label="Care Level"
                >
                  <MenuItem value="LOW">Low</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>{errors.care_level?.message}</FormHelperText>
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

export default UpdateResidentDialog; 