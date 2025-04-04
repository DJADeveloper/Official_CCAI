'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Box, Typography, CircularProgress, Alert, Paper, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridValueGetterParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';
import UpdateStaffDialog from '@/components/dialogs/UpdateStaffDialog';

// Define type for Staff/Admin Profile
type StaffProfile = {
  id: string; // Profile ID (usually UUID)
  updated_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
  website: string | null;
  email: string | null;
  role: 'STAFF' | 'ADMIN' | 'FAMILY' | 'RESIDENT' | null;
  created_at: string;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for the update dialog
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [staffToUpdate, setStaffToUpdate] = useState<StaffProfile | null>(null);

  // Fetch staff data function
  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['STAFF', 'ADMIN'])
        // TODO: Re-enable soft delete filter when Supabase local schema cache issue is resolved
        // .eq('status', 'active') // <-- Temporarily commented out due to "column does not exist" error
        .order('full_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }
      setStaff(data || []);
    } catch (err: any) {
      console.error("Error fetching staff:", err);
      setError(`Failed to load staff: ${err.message}`);
      toast.error(`Failed to load staff: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff data on component mount
  useEffect(() => {
    fetchStaff();
  }, []);

  // Update Handler: Find staff member and open dialog
  const handleUpdate = (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    if (staffMember) {
      setStaffToUpdate(staffMember);
      setIsUpdateDialogOpen(true);
    } else {
      toast.error('Could not find staff member to update.');
    }
  };

  // Close handler for the update dialog
  const handleCloseUpdateDialog = () => {
    setIsUpdateDialogOpen(false);
    setStaffToUpdate(null);
  };

  // Success handler for the update dialog
  const handleStaffUpdated = () => {
    handleCloseUpdateDialog();
    fetchStaff();
    toast.success('Staff member details updated successfully!');
  };

  // Delete Handler: Update status to 'inactive' (Soft Delete)
  const handleDelete = async (id: string) => {
    // TODO: Re-enable soft delete logic (update status) when filter issue is resolved.
    // if (window.confirm('Are you sure you want to deactivate this staff/admin profile? They will no longer appear in lists or be assignable.')) {
    // Temporarily reverting to hard delete due to status filter issues.
    if (window.confirm('Are you sure you want to PERMANENTLY DELETE this staff/admin profile? This cannot be undone and might break related records.')) {
      setDeleting(true);
      try {
        // Update the status to 'inactive' instead of deleting
        // const { error: updateError } = await supabase
        //   .from('profiles')
        //   .update({ status: 'inactive' })
        //   .eq('id', id);

        // Temporarily revert to hard delete
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        // if (updateError) {
        //   throw updateError;
        // }
        if (deleteError) {
          throw deleteError;
        }

        // toast.success('Staff/Admin profile deactivated successfully!');
        toast.success('Staff/Admin profile DELETED successfully! (Temporary behavior)');
        fetchStaff(); // Refresh the list

      } catch (error: any) {
        // console.error('Error deactivating staff profile:', error);
        // toast.error(`Failed to deactivate staff profile: ${error.message}`);
        console.error('Error deleting staff profile:', error);
        toast.error(`Failed to delete staff profile: ${error.message}`);
      } finally {
        setDeleting(false);
      }
    }
  };

  // Define columns for DataGrid
  const columns: GridColDef[] = [
    { field: 'full_name', headerName: 'Full Name', width: 200 },
    { field: 'email', headerName: 'Email', width: 250 },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={params.value === 'ADMIN' ? 'secondary' : 'primary'} size="small" />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Created At',
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
        <Typography sx={{ ml: 2 }}>Loading staff members...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, height: '80vh', width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Manage Staff & Admins
      </Typography>
      <Box sx={{ height: 'calc(100% - 60px)', width: '100%' }}>
         <DataGrid
           rows={staff}
           columns={columns}
           loading={loading || deleting}
           initialState={{
             pagination: {
               paginationModel: { page: 0, pageSize: 10 },
             },
             sorting: {
               sortModel: [{ field: 'full_name', sort: 'asc' }],
             },
           }}
           pageSizeOptions={[5, 10, 20]}
           checkboxSelection={false}
           disableRowSelectionOnClick
         />
      </Box>

      {/* Render the Update Dialog */}
      <UpdateStaffDialog
        open={isUpdateDialogOpen}
        onClose={handleCloseUpdateDialog}
        onSuccess={handleStaffUpdated}
        staffMember={staffToUpdate}
      />
    </Paper>
  );
} 