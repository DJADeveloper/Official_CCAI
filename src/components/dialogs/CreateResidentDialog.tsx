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
  Chip,
  Box,
  Typography,
} from '@mui/material';

// Zod schema for resident form validation (NO email/password)
const residentSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  room_number: z.string().min(1, 'Room number is required'),
  emergency_contact: z.string().min(1, 'Emergency contact is required'),
  care_level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  medical_conditions: z.array(z.string()), // Define as just an array of strings
});

type ResidentFormData = z.infer<typeof residentSchema>;

interface CreateResidentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Optional callback for success
}

export default function CreateResidentDialog({ open, onClose, onSuccess }: CreateResidentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempConditions, setTempConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ResidentFormData>({
    resolver: zodResolver(residentSchema),
    defaultValues: {
      fullName: '',
      room_number: '',
      emergency_contact: '',
      care_level: 'LOW',
      medical_conditions: [], // Still provide default here
    },
  });

  const handleAddCondition = () => {
    if (conditionInput.trim() && !tempConditions.includes(conditionInput.trim())) {
      const newConditions = [...tempConditions, conditionInput.trim()];
      setTempConditions(newConditions);
      setValue('medical_conditions', newConditions, { shouldValidate: true }); // Update form state
      setConditionInput(''); // Clear input
    }
  };

  const handleDeleteCondition = (conditionToDelete: string) => {
    const newConditions = tempConditions.filter(cond => cond !== conditionToDelete);
    setTempConditions(newConditions);
    setValue('medical_conditions', newConditions, { shouldValidate: true }); // Update form state
  };

  const onSubmit = async (data: ResidentFormData) => {
    setIsSubmitting(true);
    const toastId = toast.loading('Creating resident profile...');
    let profileId: string | null = null;

    try {
      // Step 1: Create Profile entry first (no auth user needed)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          full_name: data.fullName,
          role: 'RESIDENT',
          email: '', // Use empty string instead of null
          // No ID provided, let database generate it
        })
        .select('id') // Select the generated ID
        .single(); // Expect a single row back

      if (profileError) {
        throw new Error(`Profile Creation Error: ${profileError.message}`);
      }
      if (!profileData || !profileData.id) {
        throw new Error('Profile creation failed: No ID returned');
      }
      profileId = profileData.id; // Store the new profile ID

      toast.loading('Profile created, adding resident details...', { id: toastId });

      // Step 2: Create Resident entry using the new profileId
      const { error: residentError } = await supabase
        .from('residents')
        .insert({
          profile_id: profileId, // Link to the profile we just created
          room_number: data.room_number,
          emergency_contact: data.emergency_contact,
          care_level: data.care_level,
          medical_conditions: data.medical_conditions,
        });

      if (residentError) {
        // Attempt cleanup: Delete the profile if resident creation failed?
        // This might be complex. For now, just report the error.
        console.warn(`Resident insert failed for profile ${profileId}. Profile might be orphaned.`);
        throw new Error(`Resident Details Error: ${residentError.message}`);
      }

      toast.success('Resident created successfully!', { id: toastId });
      reset(); // Reset form fields
      setTempConditions([]); // Clear temp conditions
      onSuccess?.(); // Call success callback if provided
      onClose(); // Close the dialog

    } catch (error) {
      console.error('Resident creation failed:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred', { id: toastId });
      // Consider more robust cleanup if profile was created but resident failed
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      reset(); // Reset form on close if not submitting
      setTempConditions([]); // Clear temp conditions
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Resident</DialogTitle>
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
            {...register('room_number')}
            label="Room Number"
            fullWidth
            margin="dense"
            required
            error={!!errors.room_number}
            helperText={errors.room_number?.message}
            disabled={isSubmitting}
          />
          <TextField
            {...register('emergency_contact')}
            label="Emergency Contact"
            fullWidth
            margin="dense"
            required
            error={!!errors.emergency_contact}
            helperText={errors.emergency_contact?.message}
            disabled={isSubmitting}
          />
          <FormControl fullWidth margin="dense" error={!!errors.care_level} disabled={isSubmitting}>
            <InputLabel>Care Level</InputLabel>
            <Select
              {...register('care_level')}
              label="Care Level"
              defaultValue="LOW"
            >
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
            </Select>
            {errors.care_level && <FormHelperText>{errors.care_level.message}</FormHelperText>}
          </FormControl>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Medical Conditions</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <TextField
                label="Add Condition"
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                size="small"
                sx={{ flexGrow: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission on Enter
                    handleAddCondition();
                  }
                }}
              />
              <Button onClick={handleAddCondition} variant="outlined" size="small" disabled={!conditionInput.trim()}>Add</Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {tempConditions.map((condition) => (
                <Chip
                  key={condition}
                  label={condition}
                  onDelete={() => handleDeleteCondition(condition)}
                  size="small"
                />
              ))}
            </Box>
            {errors.medical_conditions && <FormHelperText error>{errors.medical_conditions.message}</FormHelperText>}
          </Box>

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleCloseDialog} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Create Resident'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 