'use client';

import React, { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Typography,
  Tooltip,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { parseISO } from 'date-fns';

// Define type for Event (should match the one in EventsPage)
type Event = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  start_time: string; // Stored as ISO string
  end_time: string | null; // Stored as ISO string
  location: string | null;
  organizer_id: string | null;
  attendees: string[] | null;
};

// Zod schema - use z.date() again
const eventUpdateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  start_time: z.date({ required_error: 'Start time is required' }),
  end_time: z.date().optional().nullable(),
  location: z.string().optional(),
}).refine((data) => !data.end_time || data.end_time > data.start_time, { // Compare Date objects
  message: "End time must be after start time",
  path: ["end_time"],
});

type EventUpdateFormData = z.infer<typeof eventUpdateSchema>;

interface UpdateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: Event | null;
}

const UpdateEventDialog: React.FC<UpdateEventDialogProps> = ({ open, onClose, onSuccess, event }) => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventUpdateFormData>({
    resolver: zodResolver(eventUpdateSchema),
    defaultValues: {
      title: '',
      description: '',
      start_time: new Date(), // Default to Date object
      end_time: null,
      location: '',
    },
  });

  // Pre-fill form when the event prop changes
  useEffect(() => {
    if (event && open) {
      reset({
        title: event.title || '',
        description: event.description || '',
        start_time: event.start_time ? parseISO(event.start_time) : new Date(),
        end_time: event.end_time ? parseISO(event.end_time) : null,
        location: event.location || '',
      });
    } else if (!open) {
       reset();
    }
  }, [event, open, reset]);

  const onSubmit = async (data: EventUpdateFormData) => {
    if (!event) {
      toast.error("No event selected for update.");
      return;
    }
    setIsLoading(true);
    try {
      const startTimeISO = data.start_time.toISOString();
      const endTimeISO = data.end_time ? data.end_time.toISOString() : null;

      const { error } = await supabase
        .from('events')
        .update({
          title: data.title,
          description: data.description || null,
          start_time: startTimeISO,
          end_time: endTimeISO,
          location: data.location || null,
        })
        .eq('id', event.id);

      if (error) {
        if (error.message.includes('violates not-null constraint') && (error.message.includes('"description"') || error.message.includes('"location"'))) {
           toast.error(`Failed to update event: ${error.message}. The ${error.message.includes('"description"') ? 'description' : 'location'} field might be required by the database.`);
        } else {
          throw error;
        }
      } else {
         toast.success('Event updated successfully!');
         onSuccess();
         onClose();
      }
    } catch (error: any) {
      console.error('Error updating event:', error);
      if (!error.message.includes('violates not-null constraint')) {
          toast.error(`Failed to update event: ${error.message}`);
      }
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
      <DialogTitle>Update Event</DialogTitle>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
             {/* Title Controller */}
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

            {/* Description Controller */}
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

            {/* Start Time DateTimePicker */}
            <Controller
              name="start_time"
              control={control}
              render={({ field }) => (
                 <DateTimePicker
                   {...field}
                   label="Start Time *"
                   ampm={true}
                   value={field.value || null} // Ensure value is Date or null
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

            {/* End Time DateTimePicker */}
            <Controller
              name="end_time"
              control={control}
              render={({ field }) => (
                 <DateTimePicker
                  {...field}
                  label="End Time (Optional)"
                  ampm={true}
                  value={field.value || null} // Ensure value is Date or null
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

            {/* Location Controller */}
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
              {isLoading ? <CircularProgress size={24} /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </LocalizationProvider>
    </Dialog>
  );
};

export default UpdateEventDialog;