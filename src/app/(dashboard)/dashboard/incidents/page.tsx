'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Box, Typography, CircularProgress, Alert, Paper, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridValueGetterParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';
import UpdateIncidentDialog from '@/components/dialogs/UpdateIncidentDialog';

// Define types
type IncidentWithDetails = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  resident_id: string;
  reported_by: string;
  assigned_to: string | null;
  residents: {
    profiles: {
      full_name: string | null;
    } | null;
  } | null;
  reported_by_profile: {
    full_name: string | null;
  } | null;
  assigned_to_profile: {
    full_name: string | null;
  } | null;
};

type StaffOrAdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentWithDetails[]>([]);
  const [potentialAssignees, setPotentialAssignees] = useState<StaffOrAdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [incidentToUpdate, setIncidentToUpdate] = useState<IncidentWithDetails | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidentsRes, assigneesRes] = await Promise.all([
        supabase
          .from('incidents')
          .select(`
            *,
            residents ( profiles ( full_name ) ),
            reported_by_profile:profiles!reported_by ( full_name ),
            assigned_to_profile:profiles!assigned_to ( full_name )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('role', ['ADMIN', 'STAFF'])
          // TODO: Re-enable soft delete filter when Supabase local schema cache issue is resolved
          // .eq('status', 'active') // <-- Temporarily commented out due to "column does not exist" error
          .order('full_name'),
      ]);

      if (incidentsRes.error) {
        throw new Error(`Incidents fetch failed: ${incidentsRes.error.message}`);
      }
      if (assigneesRes.error) {
        throw new Error(`Assignees fetch failed: ${assigneesRes.error.message}`);
      }

      setIncidents(incidentsRes.data || []);
      setPotentialAssignees(assigneesRes.data || []);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(`Failed to load data: ${err.message}`);
      toast.error(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = (id: string) => {
    const incident = incidents.find(inc => inc.id === id);
    if (incident) {
      setIncidentToUpdate(incident);
      setIsUpdateDialogOpen(true);
    } else {
      toast.error('Could not find incident to update.');
    }
  };

  const handleCloseUpdateDialog = () => {
    setIsUpdateDialogOpen(false);
    setIncidentToUpdate(null);
  };

  const handleIncidentUpdated = () => {
    handleCloseUpdateDialog();
    fetchData();
    toast.success('Incident details updated successfully!');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this incident? This action cannot be undone.')) {
      setDeleting(true);
      try {
        const { error: deleteError } = await supabase
          .from('incidents')
          .delete()
          .eq('id', id);

        if (deleteError) {
          throw deleteError;
        }

        toast.success('Incident deleted successfully!');
        fetchData();

      } catch (error: any) {
        console.error('Error deleting incident:', error);
        toast.error(`Failed to delete incident: ${error.message}`);
      } finally {
        setDeleting(false);
      }
    }
  };

  const columns: GridColDef[] = [
    { field: 'title', headerName: 'Title', width: 200 },
    {
      field: 'resident',
      headerName: 'Resident',
      width: 150,
      valueGetter: (params: GridValueGetterParams) => params.row.residents?.profiles?.full_name || 'N/A',
    },
    {
      field: 'reported_by',
      headerName: 'Reported By',
      width: 150,
      valueGetter: (params: GridValueGetterParams) => params.row.reported_by_profile?.full_name || 'N/A',
    },
    {
      field: 'assigned_to',
      headerName: 'Assigned To',
      width: 150,
      valueGetter: (params: GridValueGetterParams) => params.row.assigned_to_profile?.full_name || 'Unassigned',
    },
    {
      field: 'severity',
      headerName: 'Severity',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} color={params.value === 'HIGH' ? 'error' : params.value === 'MEDIUM' ? 'warning' : 'default'} size="small" />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={params.value === 'OPEN' ? 'primary' : params.value === 'RESOLVED' ? 'success' : 'default'} size="small" />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Reported At',
      width: 180,
      type: 'dateTime',
      valueGetter: (params: GridValueGetterParams) => new Date(params.value),
    },
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
          onClick={() => handleUpdate(id as string)}
          color="inherit"
          disabled={deleting}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => handleDelete(id as string)}
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
        <Typography sx={{ ml: 2 }}>Loading incidents...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, height: '80vh', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Manage Incidents
      </Typography>
      <Box sx={{ height: 'calc(100% - 60px)', width: '100%' }}>
         <DataGrid
           rows={incidents}
           columns={columns}
           loading={loading || deleting}
           initialState={{
             pagination: {
               paginationModel: { page: 0, pageSize: 10 },
             },
             sorting: {
               sortModel: [{ field: 'created_at', sort: 'desc' }],
             },
           }}
           pageSizeOptions={[5, 10, 20]}
           checkboxSelection={false}
           disableRowSelectionOnClick
         />
      </Box>

      <UpdateIncidentDialog
        open={isUpdateDialogOpen}
        onClose={handleCloseUpdateDialog}
        onSuccess={handleIncidentUpdated}
        incident={incidentToUpdate}
        assignees={potentialAssignees}
      />
    </Paper>
  );
} 