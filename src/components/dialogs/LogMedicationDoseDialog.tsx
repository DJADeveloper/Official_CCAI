'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import toast from 'react-hot-toast';
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
  Typography,
  Box,
  Divider,
} from '@mui/material';
import { format } from 'date-fns';

// Zod schema for validation
const logSchema = z.object({
  status: z.enum(['GIVEN', 'MISSED', 'REFUSED'], { required_error: 'Status is required' }),
  notes: z.string().optional(),
});

type LogFormData = z.infer<typeof logSchema>;

interface LogMedicationDoseDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  medicationId: string | null;
  residentId: string | null;
  medicationName?: string; // For display
  residentName?: string; // For display
}

const LogMedicationDoseDialog: React.FC<LogMedicationDoseDialogProps> = ({ 
  open,
  onClose,
  onSuccess,
  medicationId,
  residentId,
  medicationName = 'N/A',
  residentName = 'N/A'
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const administeredAtTime = new Date(); // Capture time when dialog opens/renders

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LogFormData>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      status: 'GIVEN', // Default to GIVEN
      notes: '',
    },
  });

  // Reset form when dialog opens/closes or relevant IDs change
  useEffect(() => {
    if (open) {
      reset({ status: 'GIVEN', notes: '' });
    } else {
      reset(); // Clear form fully when closed
    }
  }, [open, medicationId, residentId, reset]);

  const onSubmit = async (data: LogFormData) => {
    if (!user || !medicationId || !residentId) {
      toast.error('Missing required information (user, medication, or resident).');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('medication_log')
        .insert({
          medication_id: medicationId,
          resident_id: residentId,
          administered_at: administeredAtTime.toISOString(), // Use the time captured earlier
          administered_by: user.id,
          status: data.status,
          notes: data.notes || null, // Ensure null if empty
        });

      if (error) {
        throw error;
      }

      toast.success(`Medication dose logged as ${data.status}.`);
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error logging medication dose:', error);
      toast.error(`Failed to log dose: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Log Medication Dose</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Typography variant="subtitle1">Medication: <strong>{medicationName}</strong></Typography>
          <Typography variant="subtitle1" gutterBottom>Resident: <strong>{residentName}</strong></Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Administration Time: {format(administeredAtTime, 'Pp')} (approx.)
          </Typography>
          
          <Divider sx={{ my: 2 }} />

          <FormControl fullWidth margin="normal" required error={!!errors.status}>
            <InputLabel id="status-select-label">Status</InputLabel>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="status-select-label"
                  label="Status"
                >
                  <MenuItem value="GIVEN">Given</MenuItem>
                  <MenuItem value="MISSED">Missed</MenuItem>
                  <MenuItem value="REFUSED">Refused</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>{errors.status?.message}</FormHelperText>
          </FormControl>

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Notes (Optional)"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                margin="normal"
                error={!!errors.notes}
                helperText={errors.notes?.message}
              />
            )}
          />

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isLoading} color="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? <CircularProgress size={24} /> : 'Log Dose'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default LogMedicationDoseDialog; 