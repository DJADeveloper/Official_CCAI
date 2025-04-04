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
  Autocomplete, // Use Autocomplete for better resident/prescriber selection
  Box,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'; // Using v3 adapter

// Define types for props (adapt based on actual data structure)
type ResidentProfile = {
  id: string; // Resident ID
  profiles: {
    id: string; // Profile ID
    full_name: string | null;
  } | null;
};

type PrescriberProfile = {
  id: string; // Profile ID
  full_name: string | null;
};

// Zod schema for validation
const medicationSchema = z.object({
  resident_id: z.string().uuid('Please select a resident'),
  name: z.string().min(2, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  prescribed_by: z.string().uuid('Please select a prescriber'),
  start_date: z.date({ required_error: 'Start date is required' }),
  end_date: z.date().nullable().optional(),
  notes: z.string().optional(),
}).refine(data => !data.end_date || data.end_date >= data.start_date, {
  message: "End date cannot be before start date",
  path: ["end_date"],
});

type MedicationFormData = z.infer<typeof medicationSchema>;

interface CreateMedicationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  residents: ResidentProfile[]; // List of residents to choose from
  prescribers: PrescriberProfile[]; // List of potential prescribers (Staff/Admin)
}

const CreateMedicationDialog: React.FC<CreateMedicationDialogProps> = ({
  open,
  onClose,
  onSuccess,
  residents = [],
  prescribers = [],
}) => {
  const { user } = useAuth(); // Get current user if needed (e.g., for default prescriber?)
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<MedicationFormData>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      resident_id: '',
      name: '',
      dosage: '',
      frequency: '',
      prescribed_by: '',
      start_date: new Date(), // Default start date to today
      end_date: null,
      notes: '',
    },
  });

  // Reset form when dialog opens or closes
  useEffect(() => {
    if (open) {
      // Maybe set default prescriber to current user if they are staff/admin?
      // Example: const defaultPrescriber = prescribers.find(p => p.id === user?.id);
      // if (defaultPrescriber) setValue('prescribed_by', defaultPrescriber.id);
       reset({
         resident_id: '', name: '', dosage: '', frequency: '',
         prescribed_by: '', // Reset prescriber too
         start_date: new Date(), end_date: null, notes: ''
       });
    }
  }, [open, reset, setValue, user?.id, prescribers]); // Added dependencies

  const onSubmit = async (data: MedicationFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('medications')
        .insert({
          resident_id: data.resident_id,
          name: data.name,
          dosage: data.dosage,
          frequency: data.frequency,
          prescribed_by: data.prescribed_by,
          start_date: data.start_date.toISOString(),
          end_date: data.end_date ? data.end_date.toISOString() : null,
          notes: data.notes || null,
        });

      if (error) {
        throw error;
      }

      toast.success('Medication added successfully!');
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding medication:', error);
      toast.error(`Failed to add medication: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      reset(); // Reset form on manual close
      onClose();
    }
  };

  return (
    // Wrap with LocalizationProvider for DatePickers
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Medication</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>

            {/* Resident Selection */}
            <FormControl fullWidth margin="normal" required error={!!errors.resident_id}>
               <Controller
                 name="resident_id"
                 control={control}
                 render={({ field }) => (
                   <Autocomplete
                     options={residents}
                     getOptionLabel={(option) => option.profiles?.full_name || `Unknown Resident (ID: ${option.id.substring(0, 8)}...)`}
                     value={residents.find(res => res.id === field.value) || null}
                     onChange={(_, newValue) => {
                       field.onChange(newValue ? newValue.id : '');
                     }}
                     renderInput={(params) => (
                       <TextField
                         {...params}
                         label="Select Resident"
                         error={!!errors.resident_id}
                         helperText={errors.resident_id?.message}
                       />
                     )}
                     isOptionEqualToValue={(option, value) => option.id === value.id}
                   />
                 )}
               />
             </FormControl>

            {/* Medication Name */}
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Medication Name"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  required
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />

            {/* Dosage */}
            <Controller
              name="dosage"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Dosage (e.g., 10mg, 1 tablet)"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  required
                  error={!!errors.dosage}
                  helperText={errors.dosage?.message}
                />
              )}
            />

            {/* Frequency */}
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Frequency (e.g., Once daily, Twice a day)"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  required
                  error={!!errors.frequency}
                  helperText={errors.frequency?.message}
                />
              )}
            />

            {/* Prescriber Selection */}
             <FormControl fullWidth margin="normal" required error={!!errors.prescribed_by}>
               <Controller
                 name="prescribed_by"
                 control={control}
                 render={({ field }) => (
                   <Autocomplete
                     options={prescribers}
                     getOptionLabel={(option) => option.full_name || 'Unknown Prescriber'}
                     value={prescribers.find(p => p.id === field.value) || null}
                     onChange={(_, newValue) => {
                       field.onChange(newValue ? newValue.id : '');
                     }}
                     renderInput={(params) => (
                       <TextField
                         {...params}
                         label="Select Prescriber"
                         error={!!errors.prescribed_by}
                         helperText={errors.prescribed_by?.message}
                       />
                     )}
                     isOptionEqualToValue={(option, value) => option.id === value.id}
                   />
                 )}
               />
             </FormControl>

            {/* Start Date */}
            <Controller
              name="start_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Start Date"
                  value={field.value}
                  onChange={(newValue) => field.onChange(newValue)}
                  // No need for renderInput prop in MUI v6+ (using slotProps instead)
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal',
                      required: true,
                      error: !!errors.start_date,
                      helperText: errors.start_date?.message,
                    }
                  }}
                />
              )}
            />

            {/* End Date (Optional) */}
            <Controller
              name="end_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="End Date (Optional)"
                  value={field.value}
                  onChange={(newValue) => field.onChange(newValue)}
                  minDate={control._formValues.start_date} // Prevent end date before start date
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: 'normal',
                      error: !!errors.end_date,
                      helperText: errors.end_date?.message,
                    }
                  }}
                />
              )}
            />

            {/* Notes (Optional) */}
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
              {isLoading ? <CircularProgress size={24} /> : 'Add Medication'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateMedicationDialog; 