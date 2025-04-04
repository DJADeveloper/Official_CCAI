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
  Typography,
} from '@mui/material';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// Define types (adapt based on your actual schema if available)
type ResidentProfile = {
  id: string; // Resident ID
  profiles: {
    id: string; // Profile ID
    full_name: string | null;
  } | null;
  // Add other resident fields if needed
};

type StaffOrAdminProfile = {
  id: string; // Profile ID
  full_name: string | null;
  email: string | null;
  // Add other profile fields if needed
};

// Zod schema for validation - Updated status enum
const incidentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH'], { required_error: 'Severity is required' }),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED'], { required_error: 'Status is required' }), // Updated status values
  resident_id: z.string({ required_error: 'Please select the resident involved' }), // FK to residents table
  reported_by: z.string({ required_error: 'Reporter ID missing' }), // FK to profiles table (reporter)
  assigned_to: z.string().uuid('Invalid assignee ID').optional(), // FK to profiles table (assignee)
  // location: z.string().optional(), // Removed as per user request
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface CreateIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  residents: ResidentProfile[]; // Pass the list of residents with profiles
  assignees: StaffOrAdminProfile[]; // Pass the list of potential assignees (Staff/Admin)
}

const CreateIncidentDialog: React.FC<CreateIncidentDialogProps> = ({
  open,
  onClose,
  onSuccess,
  residents = [], // Default to empty array
  assignees = [], // Default to empty array
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reporterId, setReporterId] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      title: '',
      description: '',
      severity: 'MEDIUM', // Default severity
      status: 'OPEN', // Updated default status
      resident_id: '',
      reported_by: '', // Will be set in useEffect
      assigned_to: '', // Optional
      // location: '', // Removed
    },
  });

  // Get the current user's profile ID to set as reporter_by
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setReporterId(user.id);
        setValue('reported_by', user.id); // Set the hidden reported_by field
      }
    };
    if (open) { // Only fetch when dialog opens
      fetchUserId();
    }
  }, [open, setValue]);

  const onSubmit = async (data: IncidentFormData) => {
    setIsLoading(true);
    try {
      const { data: incidentData, error } = await supabase
        .from('incidents')
        .insert([
          {
            title: data.title,
            description: data.description,
            severity: data.severity,
            status: data.status,
            resident_id: data.resident_id,
            reported_by: data.reported_by, // Use the ID from form data
            assigned_to: data.assigned_to || null, // Handle optional field
            // location: data.location || null, // Removed
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      toast.success('Incident reported successfully!');
      reset(); // Clear the form
      onSuccess(); // Trigger data refresh in parent
      onClose(); // Close the dialog
    } catch (error: any) {
      console.error('Error reporting incident:', error);
      toast.error(`Failed to report incident: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle closing the dialog
  const handleClose = () => {
    if (!isLoading) {
      reset(); // Clear form on close
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Log New Incident</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Typography variant="caption" display="block" gutterBottom>
            Reported by: {reporterId || 'Loading...'} (Auto-detected)
          </Typography>

          {/* Title Field */}
          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Incident Title"
                variant="outlined"
                fullWidth
                margin="normal"
                error={!!errors.title}
                helperText={errors.title?.message}
                required
              />
            )}
          />

          {/* Description Field */}
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Detailed Description"
                variant="outlined"
                fullWidth
                multiline
                rows={4}
                margin="normal"
                error={!!errors.description}
                helperText={errors.description?.message}
                required
              />
            )}
          />

          {/* Resident Selection */}
          <FormControl fullWidth margin="normal" required error={!!errors.resident_id}>
            <InputLabel id="resident-select-label">Resident Involved</InputLabel>
            <Controller
              name="resident_id"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="resident-select-label"
                  label="Resident Involved"
                  disabled={residents.length === 0}
                >
                  <MenuItem value="" disabled><em>Select a resident...</em></MenuItem>
                  {residents.map((res) => (
                    <MenuItem key={res.id} value={res.id}>
                      {res.profiles?.full_name || `Resident ID: ${res.id}`}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            <FormHelperText>{errors.resident_id?.message || (residents.length === 0 && "Loading residents...")}</FormHelperText>
          </FormControl>

          {/* Severity Selection */}
          <FormControl fullWidth margin="normal" required error={!!errors.severity}>
            <InputLabel id="severity-select-label">Severity</InputLabel>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="severity-select-label"
                  label="Severity"
                >
                  <MenuItem value="LOW">Low</MenuItem>
                  <MenuItem value="MEDIUM">Medium</MenuItem>
                  <MenuItem value="HIGH">High</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>{errors.severity?.message}</FormHelperText>
          </FormControl>

          {/* Status Selection - Updated MenuItems */}
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
                  <MenuItem value="OPEN">Open</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="RESOLVED">Resolved</MenuItem>
                  {/* Removed CLOSED and REPORTED/INVESTIGATING */}
                </Select>
              )}
            />
            <FormHelperText>{errors.status?.message}</FormHelperText>
          </FormControl>

          {/* Assignee Selection (Optional) */}
          <FormControl fullWidth margin="normal" error={!!errors.assigned_to}>
            <InputLabel id="assignee-select-label">Assign To (Optional)</InputLabel>
            <Controller
              name="assigned_to"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  labelId="assignee-select-label"
                  label="Assign To (Optional)"
                  disabled={assignees.length === 0}
                >
                  <MenuItem value=""><em>None / Unassigned</em></MenuItem>
                  {assignees.map((assignee) => (
                    <MenuItem key={assignee.id} value={assignee.id}>
                      {assignee.full_name || assignee.email}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            <FormHelperText>{errors.assigned_to?.message || (assignees.length === 0 && "Loading potential assignees...")}</FormHelperText>
          </FormControl>

          {/* Location Field (Removed) */}
          {/*
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Location (Optional)"
                variant="outlined"
                fullWidth
                margin="normal"
                error={!!errors.location}
                helperText={errors.location?.message}
              />
            )}
          />
          */}

        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px' }}>
          <Button onClick={handleClose} disabled={isLoading} color="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? <CircularProgress size={24} /> : 'Log Incident'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateIncidentDialog; 