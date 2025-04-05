'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Box, Typography, CircularProgress, Alert, Paper, Button, Avatar, Stack, Chip, Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridValueGetterParams, GridRenderCellParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';
import Link from 'next/link';
import UpdateResidentDialog from '@/components/dialogs/UpdateResidentDialog';

// Define types (adapt if you have proper types generated)
type Profile = any;
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

export default function ResidentsPage() {
  const [residents, setResidents] = useState<ResidentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [residentToUpdate, setResidentToUpdate] = useState<ResidentWithProfile | null>(null);

  const fetchResidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('residents')
        .select(`
          *,
          profiles (*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setResidents(data || []);
    } catch (err: any) {
      console.error("Error fetching residents:", err);
      setError(`Failed to load residents: ${err.message}`);
      toast.error(`Failed to load residents: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const handleUpdate = (id: string) => {
    const resident = residents.find(res => res.id === id);
    if (resident) {
      setResidentToUpdate(resident);
      setIsUpdateDialogOpen(true);
    } else {
      toast.error('Could not find resident to update.');
    }
  };

  const handleCloseUpdateDialog = () => {
    setIsUpdateDialogOpen(false);
    setResidentToUpdate(null);
  };

  const handleResidentUpdated = () => {
    handleCloseUpdateDialog();
    fetchResidents();
    toast.success('Resident details updated successfully!');
  };

  const handleDelete = async (residentId: string, profileId: string | undefined) => {
    if (!profileId) {
      toast.error('Cannot delete resident: Profile ID is missing.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this resident and their associated profile? This action cannot be undone.')) {
      setDeleting(true);
      try {
        const { error: residentDeleteError } = await supabase
          .from('residents')
          .delete()
          .eq('id', residentId);

        if (residentDeleteError) {
          throw new Error(`Failed to delete resident record: ${residentDeleteError.message}`);
        }

        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', profileId);

        if (profileDeleteError) {
          console.error(`Failed to delete profile (${profileId}) associated with resident (${residentId}):`, profileDeleteError);
          toast.error(`Resident record deleted, but failed to delete associated profile: ${profileDeleteError.message}`);
        } else {
          toast.success('Resident and associated profile deleted successfully!');
        }

        fetchResidents();

      } catch (error: any) {
        console.error('Error deleting resident:', error);
        toast.error(`Failed to delete resident: ${error.message}`);
      } finally {
        setDeleting(false);
      }
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'profiles.full_name',
      headerName: 'Name',
      minWidth: 220,
      flex: 1,
      renderCell: (params: GridRenderCellParams) => {
        const name = params.row.profiles?.full_name;
        const email = params.row.profiles?.email;
        const profileId = params.row.profiles?.id;
        return (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
              {name ? name[0]?.toUpperCase() : '-'}
            </Avatar>
            <Box>
              <Link href={`/dashboard/profile/${profileId}`} passHref style={{ textDecoration: 'none' }}>
                <Typography 
                  variant="body2" 
                  fontWeight={500} 
                  component="a"
                  sx={{ 
                    color: 'text.primary', 
                    '&:hover': { textDecoration: 'underline' } 
                  }}
                >
                  {name || 'N/A'}
                </Typography>
              </Link>
              <Typography variant="caption" color="text.secondary">
                {email || 'No Email'}
              </Typography>
            </Box>
          </Stack>
        );
      },
    },
    {
      field: 'care_level',
      headerName: 'Care Level',
      minWidth: 120,
      renderCell: (params: GridRenderCellParams) => {
        const level = params.value as ResidentWithProfile['care_level'];
        let color: "error" | "warning" | "success" | "default" = 'default';
        if (level === 'HIGH') color = 'error';
        else if (level === 'MEDIUM') color = 'warning';
        else if (level === 'LOW') color = 'success';

        return (
          <Chip label={level || 'N/A'} color={color} size="small" variant="outlined" />
        );
      },
    },
    { field: 'room_number', headerName: 'Room', minWidth: 80 },
    {
      field: 'medical_conditions',
      headerName: 'Medical Conditions',
      minWidth: 200,
      valueGetter: (params: GridValueGetterParams) => params.row.medical_conditions?.join(', ') || '-',
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title={params.value || '-'}>
          <Typography variant="body2" noWrap>{params.value || '-'}</Typography>
        </Tooltip>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      minWidth: 100,
      align: 'right',
      getActions: ({ id, row }) => [
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
          onClick={() => handleDelete(id as string, row.profile_id as string | undefined)}
          color="error"
          disabled={deleting}
        />,
      ],
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading residents...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, height: '85vh', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Manage Residents
      </Typography>
      <Box sx={{ height: 'calc(100% - 70px)', width: '100%' }}>
         <DataGrid
           rows={residents}
           columns={columns}
           loading={loading || deleting}
           getRowHeight={() => 'auto'}
           initialState={{
             pagination: {
               paginationModel: { page: 0, pageSize: 10 },
             },
           }}
           pageSizeOptions={[5, 10, 20]}
           checkboxSelection={false}
           disableRowSelectionOnClick
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

      <UpdateResidentDialog
        open={isUpdateDialogOpen}
        onClose={handleCloseUpdateDialog}
        onSuccess={handleResidentUpdated}
        resident={residentToUpdate}
      />
    </Paper>
  );
} 