'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Button,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridValueGetterParams } from '@mui/x-data-grid';
import { format } from 'date-fns';
import AddTaskIcon from '@mui/icons-material/AddTask'; // Icon for logging dose
import HistoryIcon from '@mui/icons-material/History'; // Icon for viewing history
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'; // Icon for Add button
import toast from 'react-hot-toast';
import LogMedicationDoseDialog from '@/components/dialogs/LogMedicationDoseDialog'; // Import the dialog
import CreateMedicationDialog from '@/components/dialogs/CreateMedicationDialog'; // Import the new dialog

// Define types (adapt based on actual schema and joins)
type MedicationWithDetails = {
  id: string;
  created_at: string;
  resident_id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribed_by: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  residents: {
    profiles: {
      full_name: string | null;
    } | null;
    room_number: string | null;
  } | null;
  prescriber: {
    full_name: string | null;
  } | null;
};

// Type for the resident dropdown in Create Dialog
type ResidentProfileOption = {
  id: string; // Resident ID
  profiles: {
    id: string; // Profile ID
    full_name: string | null;
  } | null;
};

// Type for the prescriber dropdown in Create Dialog
type PrescriberProfileOption = {
  id: string; // Profile ID
  full_name: string | null;
};

export default function MedicationsPage() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<MedicationWithDetails[]>([]);
  const [allResidents, setAllResidents] = useState<ResidentProfileOption[]>([]); // For Create Dialog
  const [potentialPrescribers, setPotentialPrescribers] = useState<PrescriberProfileOption[]>([]); // For Create Dialog
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for the Log Dose dialog
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logMedicationInfo, setLogMedicationInfo] = useState<{
    medicationId: string | null;
    residentId: string | null;
    medicationName?: string;
    residentName?: string;
  }>({ medicationId: null, residentId: null });

  // State for the Create Medication dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();

      // Fetch active medications, all residents for dropdown, and potential prescribers
      const [
        medicationsRes,
        residentsRes,
        prescribersRes
      ] = await Promise.all([
        supabase // Fetch current medications
          .from('medications')
          .select('*, residents(room_number, profiles(full_name)), prescriber:profiles!prescribed_by(full_name)')
          .or(`end_date.is.null,end_date.gt.${now}`)
          .order('room_number', { ascending: true, foreignTable: 'residents' })
          .order('name', { ascending: true }), // <<< Comma added here
        supabase // Fetch all residents for the create dialog dropdown
          .from('residents')
          .select('id, profiles(id, full_name)')
          // Correct way to order by nested profile name
          .order('full_name', { ascending: true, foreignTable: 'profiles' }), // <<< Comma added here
        supabase // Fetch potential prescribers (Staff/Admin) for dropdown
          .from('profiles')
          .select('id, full_name')
          .in('role', ['ADMIN', 'STAFF'])
          .order('full_name', { ascending: true }), // <<< No comma needed for the last item
      ]);

      // Error Handling for all fetches
      if (medicationsRes.error) throw medicationsRes.error;
      if (residentsRes.error) throw residentsRes.error;
      if (prescribersRes.error) throw prescribersRes.error;

      setMedications(medicationsRes.data || []);
      
      // Map resident data to match the expected type
      const mappedResidents = (residentsRes.data || []).map(res => ({
        ...res,
        // Take the first profile object, as select() returns an array
        profiles: res.profiles && res.profiles.length > 0 ? res.profiles[0] : null, 
      }));
      setAllResidents(mappedResidents);
      
      setPotentialPrescribers(prescribersRes.data || []);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      const errorMessage = `Failed to load data: ${err.message}`;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for Log Dose Dialog
  const handleOpenLogDoseDialog = (med: MedicationWithDetails) => {
    setLogMedicationInfo({
      medicationId: med.id,
      residentId: med.resident_id,
      medicationName: med.name,
      residentName: med.residents?.profiles?.full_name || 'N/A',
    });
    setIsLogDialogOpen(true);
  };

  const handleCloseLogDoseDialog = () => {
    setIsLogDialogOpen(false);
    setLogMedicationInfo({ medicationId: null, residentId: null }); // Clear info
  };

  const handleLogDoseSuccess = () => {
    handleCloseLogDoseDialog();
    // We don't necessarily need to re-fetch the medications list here
    // but might refresh a history view later
  };

  // Placeholder handler for View History
  const handleViewHistory = (medicationId: string) => {
    toast(`View History clicked for Med ID: ${medicationId}`);
  };

  // Handlers for Create Medication Dialog
  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
  };

  const handleMedicationCreated = () => {
    handleCloseCreateDialog();
    fetchData(); // Re-fetch medications list after adding a new one
  };


  const columns: GridColDef[] = [
    {
      field: 'resident_name',
      headerName: 'Resident',
      width: 180,
      valueGetter: (params: GridValueGetterParams) => 
        params.row.residents?.profiles?.full_name || 'N/A',
    },
    {
      field: 'resident_room',
      headerName: 'Room',
      width: 80,
      valueGetter: (params: GridValueGetterParams) => 
        params.row.residents?.room_number || 'N/A',
    },
    { field: 'name', headerName: 'Medication', width: 180 },
    { field: 'dosage', headerName: 'Dosage', width: 100 },
    { field: 'frequency', headerName: 'Frequency', width: 150 },
    {
      field: 'prescriber_name',
      headerName: 'Prescriber',
      width: 150,
      valueGetter: (params: GridValueGetterParams) => 
        params.row.prescriber?.full_name || 'N/A',
    },
    {
      field: 'start_date',
      headerName: 'Start Date',
      width: 120,
      type: 'date',
      valueGetter: (params: GridValueGetterParams) => new Date(params.value),
      renderCell: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'end_date',
      headerName: 'End Date',
      width: 120,
      type: 'date',
      valueGetter: (params: GridValueGetterParams) => params.value ? new Date(params.value) : null,
      renderCell: (params) => params.value ? format(params.value, 'MM/dd/yyyy') : <Chip label="Active" size="small" color="success"/>,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 120,
      cellClassName: 'actions',
      getActions: ({ id, row }) => [
        <GridActionsCellItem
          key="log"
          icon={<AddTaskIcon />}
          label="Log Dose"
          onClick={() => handleOpenLogDoseDialog(row as MedicationWithDetails)}
          color="primary"
        />,
        <GridActionsCellItem
          key="history"
          icon={<HistoryIcon />}
          label="View History"
          onClick={() => handleViewHistory(id as string)}
          color="inherit"
        />,
      ],
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading medications...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, height: '80vh', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Medication Administration
        </Typography>
        <Button 
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleOpenCreateDialog}
        >
          Add Medication
        </Button>
      </Box>
      {/* Add filters or date pickers here later? */}
      <Box sx={{ height: 'calc(100% - 60px - 32px)', width: '100%' }}> // Adjusted height for button
         <DataGrid
           rows={medications}
           columns={columns}
           loading={loading}
           initialState={{
             pagination: {
               paginationModel: { page: 0, pageSize: 10 },
             },
             // Maybe default sort by resident?
             sorting: {
               sortModel: [{ field: 'resident_name', sort: 'asc' }],
             },
           }}
           pageSizeOptions={[5, 10, 20]}
           checkboxSelection={false}
           disableRowSelectionOnClick
         />
      </Box>

      {/* Render the Log Dose Dialog */}
      <LogMedicationDoseDialog 
        open={isLogDialogOpen}
        onClose={handleCloseLogDoseDialog}
        onSuccess={handleLogDoseSuccess}
        medicationId={logMedicationInfo.medicationId}
        residentId={logMedicationInfo.residentId}
        medicationName={logMedicationInfo.medicationName}
        residentName={logMedicationInfo.residentName}
      />

      {/* Render the Create Medication Dialog */}
       <CreateMedicationDialog
         open={isCreateDialogOpen}
         onClose={handleCloseCreateDialog}
         onSuccess={handleMedicationCreated}
         residents={allResidents}
         prescribers={potentialPrescribers}
       />

      {/* TODO: Add Dialog/Component for View History */}

    </Paper>
  );
} 