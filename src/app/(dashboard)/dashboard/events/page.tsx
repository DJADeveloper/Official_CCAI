'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Box, Typography, CircularProgress, Alert, Paper, Button } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridValueGetterParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';
import CreateEventDialog from '@/components/dialogs/CreateEventDialog';
import UpdateEventDialog from '@/components/dialogs/UpdateEventDialog';

// Define type for Event (align with your Supabase schema)
type Event = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  start_time: string; // Stored as ISO string
  end_time: string | null; // Stored as ISO string
  location: string | null;
  organizer_id: string | null; // Assuming organizer is a profile ID
  attendees: string[] | null; // Assuming array of profile IDs
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [eventToUpdate, setEventToUpdate] = useState<Event | null>(null);

  // Fetch events function
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*') // Select specific columns later if needed
        .order('start_time', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }
      setEvents(data || []);
    } catch (err: any) {
      console.error("Error fetching events:", err);
      setError(`Failed to load events: ${err.message}`);
      toast.error(`Failed to load events: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // --- Handlers ---
  const handleCreateEvent = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const handleEventCreated = () => {
    handleCloseCreateDialog();
    fetchEvents();
  };

  const handleUpdateEvent = (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      setEventToUpdate(event);
      setIsUpdateDialogOpen(true);
    } else {
      toast.error('Could not find event to update.');
    }
  };

  const handleCloseUpdateDialog = () => {
    setIsUpdateDialogOpen(false);
    setEventToUpdate(null);
  };

  const handleEventUpdated = () => {
    handleCloseUpdateDialog();
    fetchEvents();
  };

  const handleDeleteEvent = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      setDeleting(true);
      try {
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', id);

        if (deleteError) {
          throw deleteError;
        }

        toast.success('Event deleted successfully!');
        fetchEvents(); // Refresh list after delete

      } catch (err: any) {
        console.error("Error deleting event:", err);
        toast.error(`Failed to delete event: ${err.message}`);
      } finally {
        setDeleting(false);
      }
    }
  };

  // Define columns for DataGrid
  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      minWidth: 200,
      flex: 1,
    },
    {
      field: 'start_time',
      headerName: 'Start Time',
      width: 220,
      type: 'string',
      renderCell: (params) => {
        try {
          return params.value ? new Date(params.value as string).toLocaleString() : 'N/A';
        } catch (e) {
          return params.value || 'Invalid Date';
        }
      }
    },
    {
      field: 'end_time',
      headerName: 'End Time',
      width: 220,
      type: 'string',
      renderCell: (params) => {
        try {
          return params.value ? new Date(params.value as string).toLocaleString() : 'N/A';
        } catch (e) {
          return params.value || 'Invalid Date';
        }
      }
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 150,
      valueGetter: (params: GridValueGetterParams) => params.value || 'N/A',
    },
    // Consider adding 'Organizer' if needed, requires join/lookup
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      getActions: ({ id }) => [
        <GridActionsCellItem
          key="update"
          icon={<EditIcon />}
          label="Update"
          onClick={() => handleUpdateEvent(id as string)}
          color="inherit"
          disabled={deleting}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => handleDeleteEvent(id as string)}
          color="inherit"
          disabled={deleting}
        />,
      ],
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading events...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, height: '85vh', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Manage Events
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateEvent}
        >
          Create Event
        </Button>
      </Box>
      <Box sx={{ height: 'calc(100% - 70px)', width: '100%' }}>
         <DataGrid
           rows={events}
           columns={columns}
           loading={loading || deleting}
           initialState={{
             pagination: {
               paginationModel: { page: 0, pageSize: 10 },
             },
             sorting: {
               sortModel: [{ field: 'start_time', sort: 'asc' }],
             },
           }}
           pageSizeOptions={[5, 10, 20]}
           checkboxSelection={false}
           disableRowSelectionOnClick
           getRowHeight={() => 'auto'}
           sx={{
             border: 0,
             '& .MuiDataGrid-columnHeaders': {
               borderBottom: '1px solid',
               borderColor: 'divider',
             },
             '& .MuiDataGrid-columnHeaderTitle': {
               fontWeight: 600,
               textTransform: 'none',
             },
             '& .MuiDataGrid-cell': {
               borderBottom: '1px solid',
               borderColor: 'divider',
               py: 0.5,
             },
             '& .MuiDataGrid-footerContainer': {
               borderTop: '1px solid',
               borderColor: 'divider',
             },
             '& .MuiDataGrid-columnSeparator': {
               display: 'none',
             },
             '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
               outline: 'none',
             },
             '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
               outline: 'none',
             },
           }}
         />
      </Box>

      <CreateEventDialog
        open={isCreateDialogOpen}
        onClose={handleCloseCreateDialog}
        onSuccess={handleEventCreated}
      />

      <UpdateEventDialog
        open={isUpdateDialogOpen}
        onClose={handleCloseUpdateDialog}
        onSuccess={handleEventUpdated}
        event={eventToUpdate}
      />
    </Paper>
  );
} 