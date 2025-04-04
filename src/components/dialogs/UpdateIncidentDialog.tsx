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

// Types needed for the form and props
type Incident = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  resident_id: string;
  reported_by: string;
  assigned_to: string | null;
};

type StaffOrAdminProfile = {
  id: string; // Profile ID
  full_name: string | null;
  email: string | null;
};

// Zod schema for validation
const incidentUpdateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']), // Use DB-valid statuses
  assigned_to: z.string().uuid('Invalid assignee ID').optional().nullable(), // Allow unassigning
});

type IncidentUpdateFormData = z.infer<typeof incidentUpdateSchema>;

interface UpdateIncidentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  incident: Incident | null; // The incident being edited
  assignees: StaffOrAdminProfile[]; // List of potential assignees
}

const UpdateIncidentDialog: React.FC<UpdateIncidentDialogProps> = ({
  open,
  onClose,
  onSuccess,
  incident,
  assignees = [],
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<IncidentUpdateFormData>({
    resolver: zodResolver(incidentUpdateSchema),
    defaultValues: {
      title: '',
      description: '',
      severity: 'MEDIUM',
      status: 'OPEN',
      assigned_to: '',
    },
  });

  // Pre-fill form when incident data is available
  useEffect(() => {
    if (incident) {
      reset({
        title: incident.title || '',
        description: incident.description || '',
        severity: incident.severity || 'MEDIUM',
        status: incident.status || 'OPEN',
        assigned_to: incident.assigned_to || '',
      });
    } else {
      reset(); // Clear if no incident
    }
  }, [incident, reset]);

  const onSubmit = async (data: IncidentUpdateFormData) => {
    if (!incident) {
      toast.error('Cannot update: Incident data missing.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          title: data.title,
          description: data.description,
          severity: data.severity,
          status: data.status,
          assigned_to: data.assigned_to || null, // Handle optional/nullable
        })
        .eq('id', incident.id);

      if (error) {
        throw error;
      }

      toast.success('Incident updated successfully!');
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating incident:', error);
      toast.error(`Failed to update incident: ${error.message}`);
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
      <DialogTitle>Update Incident Details</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {/* Title */}          <Controller
            name="title"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Title"
                variant="outlined"
                fullWidth
                margin="normal"
                required
                error={!!errors.title}
                helperText={errors.title?.message}
              />
            )}
          />

          {/* Description */}          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                variant="outlined"
                fullWidth
                margin="normal"
                required
                multiline
                rows={4}
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />

          {/* Severity Selection */}          <FormControl fullWidth margin="normal" required error={!!errors.severity}>
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

          {/* Status Selection */}          <FormControl fullWidth margin="normal" required error={!!errors.status}>
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
                </Select>
              )}
            />
            <FormHelperText>{errors.status?.message}</FormHelperText>
          </FormControl>

          {/* Assignee Selection (Optional) */}          <FormControl fullWidth margin="normal" error={!!errors.assigned_to}>
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
                  value={field.value || ''} // Ensure value is controlled, handle null/undefined
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

export default UpdateIncidentDialog; 