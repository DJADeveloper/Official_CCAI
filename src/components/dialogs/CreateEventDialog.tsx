'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useAuth } from '@/lib/hooks/useAuth'; // To get organizer ID

// Zod schema - use z.date() again
const eventSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  start_time: z.date({ required_error: 'Start time is required' }),
  end_time: z.date().optional().nullable(),
  location: z.string().optional(),
}).refine((data) => !data.end_time || data.end_time > data.start_time, { // Compare Date objects
  message: "End time must be after start time",
  path: ["end_time"],
});

type EventFormData = z.infer<typeof eventSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEventDialog: React.FC<CreateEventDialogProps> = ({ open, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      start_time: new Date(), // Default to Date object
      end_time: null,
      location: '',
    },
  });

  const onSubmit = async (data: EventFormData) => {
    setIsLoading(true);
    try {
      if (!user) throw new Error("User not authenticated");

      // Data is already Date objects, just format to ISO
      const startTimeISO = data.start_time.toISOString();
      const endTimeISO = data.end_time ? data.end_time.toISOString() : null;

      const { error } = await supabase
        .from('events')
        .insert({
          title: data.title,
          description: data.description || null,
          start_time: startTimeISO,
          end_time: endTimeISO,
          location: data.location || null,
          organizer_id: user.id,
        });

      if (error) {
        // Check specifically for the NOT NULL violation before making schema changes
        if (error.message.includes('violates not-null constraint') && (error.message.includes('"description"') || error.message.includes('"location"'))) {
           toast.error(`Failed to create event: ${error.message}. The ${error.message.includes('"description"') ? 'description' : 'location'} field might be required by the database.`);
        } else {
           throw error; // Re-throw other errors
        }
      } else {
         toast.success('Event created successfully!');
         reset();
         onSuccess();
         onClose();
      }
    } catch (error: any) {
      console.error('Error creating event:', error);
      // Generic error toast if not handled above
      if (!error.message.includes('violates not-null constraint')) {
         toast.error(`Failed to create event: ${error.message}`);
      }
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
      <DialogTitle>Create New Event</DialogTitle>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Event Title"
                  variant="outlined"
                  fullWidth
                  margin="normal"
                  required
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  disabled={isLoading}
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description (Optional)"
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={3}
                  margin="normal"
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  disabled={isLoading}
                />
              )}
            />

            <Controller
              name="start_time"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  {...field}
                  label="Start Time *"
                  ampm={true}
                  slotProps={{ 
                    textField: {
                      fullWidth: true,
                      margin: "normal",
                      required: true,
                      error: !!errors.start_time,
                      helperText: errors.start_time?.message,
                    },
                  }}
                  disabled={isLoading}
                />
              )}
            />

            <Controller
              name="end_time"
              control={control}
              render={({ field }) => (
                 <DateTimePicker
                  {...field}
                  label="End Time (Optional)"
                  ampm={true}
                  slotProps={{ 
                    textField: {
                      fullWidth: true,
                      margin: "normal",
                      error: !!errors.end_time,
                      helperText: errors.end_time?.message,
                    },
                  }}
                  disabled={isLoading}
                />
              )}
            />

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
                  disabled={isLoading}
                />
              )}
            />
          </DialogContent>
          <DialogActions sx={{ padding: '16px 24px' }}>
            <Button onClick={handleClose} disabled={isLoading} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isLoading}>
              {isLoading ? <CircularProgress size={24} /> : 'Create Event'}
            </Button>
          </DialogActions>
        </form>
      </LocalizationProvider>
    </Dialog>
  );
};

export default CreateEventDialog;
