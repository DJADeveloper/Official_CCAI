'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
} from '@mui/material';
import {
  People,
  Add,
  Warning,
  Event,
  TrendingUp,
  CalendarToday,
  AccessTime,
  Logout,
} from '@mui/icons-material';
import { supabase } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import CreateResidentDialog from '@/components/dialogs/CreateResidentDialog';
import CreateStaffDialog from '@/components/dialogs/CreateStaffDialog';
import CreateFamilyDialog from '@/components/dialogs/CreateFamilyDialog';
import CreateIncidentDialog from '@/components/dialogs/CreateIncidentDialog';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast';

// Access environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Define types (temporarily using 'any')
// import { Database } from '@/lib/supabase/database.types'; // Keep commented out for now
type Profile = any; // Database['public']['Tables']['profiles']['Row'];
type ResidentWithProfile = {
  id: string; // Resident table PK
  created_at: string;
  profile_id: string; // FK to profiles
  room_number: string | null;
  emergency_contact: string | null;
  medical_conditions: string[] | null;
  care_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  profiles: { // Nested profile data
    id: string; // Profile table PK (same as profile_id)
    full_name: string | null;
    email: string | null;
    // Add other profile fields if needed
  } | null;
};
type Incident = any; // Database['public']['Tables']['incidents']['Row'] & { reported_by_profile?: Profile | null, resident_profile?: Profile | null };
type Event = any; // Database['public']['Tables']['events']['Row'] & { organizer_profile?: Profile | null };
type StaffOrAdmin = Profile; // Profiles with role STAFF or ADMIN

// Supabase client specific to this component
// REMOVE this redundant declaration
// const supabase = createClientComponentClient<Database>(); // Use generic later
// const supabase = createClientComponentClient();

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [residents, setResidents] = useState<ResidentWithProfile[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [trendsData, setTrendsData] = useState([
    { name: 'Jan', incidents: 4, events: 12 },
    { name: 'Feb', incidents: 3, events: 15 },
    { name: 'Mar', incidents: 5, events: 10 },
    { name: 'Apr', incidents: 2, events: 18 },
    { name: 'May', incidents: 4, events: 14 },
    { name: 'Jun', incidents: 3, events: 16 },
  ]);

  // State for controlling the dialog
  const [isCreateResidentDialogOpen, setIsCreateResidentDialogOpen] = useState(false);
  const [isCreateStaffDialogOpen, setIsCreateStaffDialogOpen] = useState(false);
  const [isCreateFamilyDialogOpen, setIsCreateFamilyDialogOpen] = useState(false);
  const [isCreateIncidentDialogOpen, setIsCreateIncidentDialogOpen] = useState(false);

  // State for dialog props data
  const [allResidentsForSelection, setAllResidentsForSelection] = useState<ResidentWithProfile[]>([]);
  const [potentialAssignees, setPotentialAssignees] = useState<StaffOrAdmin[]>([]);

  useEffect(() => {
    async function checkSessionAndFetchData() {
      setIsLoading(true);
      setError(null);
      try {
        // Direct session check using Supabase
        const { data, error: sessionCheckError } = await supabase.auth.getSession();
        
        // Update debug info
        setDebugInfo((prev: any) => ({
          ...prev,
          sessionCheck: { 
            hasSession: !!data.session,
            error: sessionCheckError?.message,
          },
          authUser: data.session?.user || null,
          timestamp: new Date().toISOString(),
        }));

        if (sessionCheckError) {
          console.error('Session check error:', sessionCheckError);
          setError('Failed to verify authentication session.');
          setIsLoading(false);
          return;
        }

        if (!data.session) {
          console.log('No active session found, redirecting to login');
          router.push('/login');
          return;
        }
        
        // Set user from session data
        setUser(data.session.user);
        
        // Fetch profile data
        if (data.session?.user?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single();
            
          if (profileError) {
            console.error('Error fetching profile:', profileError);
            setError('Error loading user profile');
          } else {
            setProfile(profileData);
            // Fetch dashboard data only after confirming profile
            await fetchData(profileData); // Pass profile to fetchData if needed for permissions
          }
        } else {
           setError('Session found but user ID is missing.');
           setIsLoading(false);
           router.push('/login');
           return;
        }
      } catch (err) {
         console.error('Error checking session or fetching initial data:', err);
         setError('Error loading dashboard. Please try logging in again.');
         // Optionally set debug info on error
         setDebugInfo((prev: any) => ({
            ...prev,
            sessionOrFetchError: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
         }));
      } finally {
         setIsLoading(false);
      }
    }
    
    checkSessionAndFetchData();
  }, [router]);

  const fetchData = async (currentProfile: Profile | null) => {
    // Ensure we only fetch if profile is loaded and has a role
    if (!currentProfile?.role) {
        console.log("FetchData skipped: Profile not loaded or missing role.");
        return;
    }

    setIsLoading(true); // Indicate data fetching started
    try {
      // Fetch summary data for dashboard cards (limit 5)
      const [residentsSummaryRes, incidentsSummaryRes, eventsSummaryRes] = await Promise.all([
        supabase
          .from('residents')
          .select(`
            *,
            profiles ( id, full_name, email )
          `)
          .limit(5),
        supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('events').select('*').order('start_time', { ascending: true }).limit(5),
      ]);

      // Set summary data
      if (residentsSummaryRes.data) setResidents(residentsSummaryRes.data);
      if (incidentsSummaryRes.data) setIncidents(incidentsSummaryRes.data);
      if (eventsSummaryRes.data) setEvents(eventsSummaryRes.data);

      // Fetch full lists needed for dialogs (only if user has permission, e.g., ADMIN or STAFF)
      if (currentProfile.role === 'ADMIN' || currentProfile.role === 'STAFF') {
        const [allResidentsRes, assigneesRes] = await Promise.all([
          supabase
            .from('residents')
            .select(`
              *,
              profiles ( id, full_name )
            `), // Select all resident fields + nested profile
          supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('role', ['ADMIN', 'STAFF']) // Fetch only ADMIN and STAFF for assignment
            .order('full_name'),
        ]);

        if (allResidentsRes.data) {
          setAllResidentsForSelection(allResidentsRes.data);
        } else if (allResidentsRes.error) {
          console.error("Error fetching all residents for selection:", allResidentsRes.error);
          toast.error(`Failed to load residents list: ${allResidentsRes.error.message}`);
        }

        if (assigneesRes.data) {
          setPotentialAssignees(assigneesRes.data);
        } else if (assigneesRes.error) {
          console.error("Error fetching potential assignees:", assigneesRes.error);
          toast.error(`Failed to load staff/admin list: ${assigneesRes.error.message}`);
        }
      }

      // Check for errors in summary fetches
      if (residentsSummaryRes.error) console.error('Error fetching residents summary:', residentsSummaryRes.error);
      if (incidentsSummaryRes.error) console.error('Error fetching incidents summary:', incidentsSummaryRes.error);
      if (eventsSummaryRes.error) console.error('Error fetching events summary:', eventsSummaryRes.error);

      // Update debug info if needed
      setDebugInfo((prev: any) => ({
        ...prev,
        dataFetch: {
          residentsSummary: residentsSummaryRes.status,
          incidentsSummary: incidentsSummaryRes.status,
          eventsSummary: eventsSummaryRes.status,
          allResidentsForSelectionCount: allResidentsForSelection.length,
          potentialAssigneesCount: potentialAssignees.length,
        },
        timestamp: new Date().toISOString(),
      }));

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(`Error fetching data: ${error.message}`);
      setDebugInfo((prev: any) => ({
        ...prev,
        fetchError: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
    } finally {
        setIsLoading(false); // Indicate data fetching finished
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
      setDebugInfo((prev: any) => ({
        ...prev,
        logoutError: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
      setError('Failed to sign out.');
    }
  };

  const handleManualReload = () => {
    fetchData(profile);
  };

  // Define dialog open/close handlers
  const handleOpenCreateResidentDialog = () => {
    setIsCreateResidentDialogOpen(true);
  };

  const handleCloseCreateResidentDialog = () => {
    setIsCreateResidentDialogOpen(false);
  };

  const handleResidentCreated = () => {
    toast.success('Resident created! Refreshing data...');
    fetchData(profile);
  };

  // Handlers for Create Staff Dialog
  const handleOpenCreateStaffDialog = () => {
    setIsCreateStaffDialogOpen(true);
  };
  const handleCloseCreateStaffDialog = () => {
    setIsCreateStaffDialogOpen(false);
  };
  const handleStaffCreated = () => {
    toast.success('Staff member created! Refreshing data...');
    fetchData(profile);
  };

  // Handlers for Create Family Dialog
  const handleOpenCreateFamilyDialog = () => {
    setIsCreateFamilyDialogOpen(true);
  };
  const handleCloseCreateFamilyDialog = () => {
    setIsCreateFamilyDialogOpen(false);
  };
  const handleFamilyCreated = () => {
    toast.success('Family member created! Refreshing data...');
    fetchData(profile);
  };

  // Handlers for Create Incident Dialog
  const handleOpenCreateIncidentDialog = () => {
    setIsCreateIncidentDialogOpen(true);
  };
  const handleCloseCreateIncidentDialog = () => {
    setIsCreateIncidentDialogOpen(false);
  };
  const handleIncidentCreated = () => {
    toast.success('Incident reported! Refreshing data...');
    fetchData(profile);
  };

  // If loading, show loading indicator
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ m: 2 }}>Loading dashboard...</Typography>
        
        {debugInfo && (
          <Paper sx={{ mt: 3, p: 2, maxWidth: '80%', overflow: 'auto' }}>
            <Typography variant="h6">Debug Information (Loading):</Typography>
            <pre style={{ overflow: 'auto', maxHeight: '200px' }}>{JSON.stringify(debugInfo, null, 2)}</pre>
          </Paper>
        )}
      </Box>
    );
  }

  // If error, show error message with debugging info
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button variant="contained" onClick={handleLogout}>
            Log Out and Try Again
          </Button>
          <Button variant="outlined" onClick={handleManualReload}>
            Retry Loading Data
          </Button>
        </Box>
        
        {debugInfo && (
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="h6">Debug Information (Error):</Typography>
            <pre style={{ overflow: 'auto', maxHeight: '400px' }}>{JSON.stringify(debugInfo, null, 2)}</pre>
          </Paper>
        )}
      </Box>
    );
  }

  // If no profile but user exists, show loading state
  if (user && !profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Loading user profile... User authenticated but profile not loaded yet.
        </Alert>
        <CircularProgress />
        <Button variant="outlined" onClick={handleManualReload} sx={{ ml: 2 }}>
          Retry
        </Button>
        
        {debugInfo && (
          <Paper sx={{ mt: 3, p: 2 }}>
            <Typography variant="h6">Debug Information (Profile Loading):</Typography>
            <pre style={{ overflow: 'auto', maxHeight: '400px' }}>{JSON.stringify(debugInfo, null, 2)}</pre>
          </Paper>
        )}
      </Box>
    );
  }

  const quickActions = [
    (profile?.role === 'ADMIN' || profile?.role === 'STAFF') && {
      title: 'Create Resident',
      icon: <People />,
      onClick: handleOpenCreateResidentDialog,
    },
    profile?.role === 'ADMIN' && {
      title: 'Create Staff',
      icon: <Add />,
      onClick: handleOpenCreateStaffDialog,
    },
    (profile?.role === 'ADMIN' || profile?.role === 'STAFF') && {
      title: 'Create Family',
      icon: <Add />,
      onClick: handleOpenCreateFamilyDialog,
    },
    (profile?.role === 'ADMIN' || profile?.role === 'STAFF') && {
      title: 'Log Incident',
      icon: <Warning />,
      onClick: handleOpenCreateIncidentDialog,
    },
  ].filter(Boolean);

  // Prepare data for charts (Example: Incidents by severity)
  const incidentSeverityData = incidents.reduce((acc: { [key: string]: number }, incident) => {
    const severity = incident.severity || 'UNKNOWN';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(incidentSeverityData).map(([name, value]) => ({ name, value }));

  // Role check for conditional rendering
  const isAdmin = profile?.role === 'ADMIN';
  const isStaff = profile?.role === 'STAFF';

  return (
    <Box>
      {/* Debug Info */}
      {debugInfo && (
        <Paper sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6">Debug Information:</Typography>
          <pre style={{ overflow: 'auto', maxHeight: '200px' }}>{JSON.stringify(debugInfo, null, 2)}</pre>
          <Button variant="contained" onClick={handleLogout} sx={{ mt: 2 }}>
            Log Out
          </Button>
        </Paper>
      )}

      {/* Alerts Banner */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Welcome back, {profile?.full_name || 'User'}! Here's what's happening today.
      </Alert>

      {/* Quick Actions */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          md: `repeat(${quickActions.length}, 1fr)`
        },
        gap: 3,
        mb: 3
      }}>
        {quickActions.map((action) => (
          action && (
            <Card key={action.title}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <IconButton color="primary" size="large">
                    {action.icon}
                  </IconButton>
                  <Typography variant="h6" component="div">
                    {action.title}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  onClick={action.onClick}
                  fullWidth
                >
                  {action.title}
                </Button>
              </CardActions>
            </Card>
          )
        ))}
      </Box>

      {/* Trends Chart and Recent Activity */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: '2fr 1fr'
        },
        gap: 3,
        mb: 3
      }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Trends
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke="#8884d8"
                  name="Incidents"
                />
                <Line
                  type="monotone"
                  dataKey="events"
                  stroke="#82ca9d"
                  name="Events"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <List>
            {events.map((event) => (
              <ListItem key={event.id}>
                <ListItemIcon>
                  <Event />
                </ListItemIcon>
                <ListItemText
                  primary={event.title}
                  secondary={new Date(event.start_time).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>

      {/* Residents List */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Recent Residents</Typography>
          {(isAdmin || isStaff) && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleOpenCreateResidentDialog}
            >
              Add Resident
            </Button>
          )}
        </Box>
        <List>
          {residents.slice(0, 5).map((resident) => (
            <ListItem key={resident.id}>
              <ListItemIcon>
                <People />
              </ListItemIcon>
              <ListItemText
                primary={resident.profiles?.full_name || `Profile ID: ${resident.profile_id}`}
                secondary={`Room ${resident.room_number || 'N/A'} - Care Level: ${resident.care_level || 'N/A'}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Calendar and Recent Incidents */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: '2fr 1fr'
        },
        gap: 3
      }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Upcoming Events
          </Typography>
          <List>
            {events.map((event) => (
              <ListItem key={event.id}>
                <ListItemIcon>
                  <CalendarToday />
                </ListItemIcon>
                <ListItemText
                  primary={event.title}
                  secondary={
                    <>
                      <Typography component="span" variant="body2">
                        {new Date(event.start_time).toLocaleDateString()}
                      </Typography>
                      {' — '}
                      <Typography component="span" variant="body2">
                        {new Date(event.start_time).toLocaleTimeString()}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Recent Incidents
          </Typography>
          <List>
            {incidents.map((incident) => (
              <ListItem key={incident.id}>
                <ListItemIcon>
                  <Warning color={incident.severity === 'HIGH' ? 'error' : 'warning'} />
                </ListItemIcon>
                <ListItemText
                  primary={incident.title}
                  secondary={`Status: ${incident.status}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Box>

      {/* Add the Dialog Components */}
      <CreateResidentDialog
        open={isCreateResidentDialogOpen}
        onClose={handleCloseCreateResidentDialog}
        onSuccess={handleResidentCreated}
      />
      <CreateFamilyDialog
        open={isCreateFamilyDialogOpen}
        onClose={handleCloseCreateFamilyDialog}
        onSuccess={handleFamilyCreated}
      />
      <CreateStaffDialog
        open={isCreateStaffDialogOpen}
        onClose={handleCloseCreateStaffDialog}
        onSuccess={handleStaffCreated}
      />
      {(isAdmin || isStaff) && (
        <CreateIncidentDialog
          open={isCreateIncidentDialogOpen}
          onClose={handleCloseCreateIncidentDialog}
          onSuccess={handleIncidentCreated}
          residents={allResidentsForSelection}
          assignees={potentialAssignees}
        />
      )}
    </Box>
  );
} 