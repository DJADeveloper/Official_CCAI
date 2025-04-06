'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  Avatar,
  Stack,
  LinearProgress,
  Divider,
  Chip,
  Tooltip,
  useTheme,
  ChipProps
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
  ArrowUpward,
  ArrowDownward,
  ShoppingCart,
  AttachMoney,
  Person,
  MoreVert,
  Medication as MedicationIcon,
  ArrowForward as ViewAllIcon
} from '@mui/icons-material';
import { supabase } from '@/lib/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import CreateResidentDialog from '@/components/dialogs/CreateResidentDialog';
import CreateStaffDialog from '@/components/dialogs/CreateStaffDialog';
import CreateFamilyDialog from '@/components/dialogs/CreateFamilyDialog';
import CreateIncidentDialog from '@/components/dialogs/CreateIncidentDialog';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import WarningIcon from '@mui/icons-material/WarningAmber';
import EventIcon from '@mui/icons-material/Event';
import GroupIcon from '@mui/icons-material/Group';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

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
type Incident = {
  id: string;
  created_at: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  resident_id: string;
  reported_by: string;
  assigned_to: string | null;
  residents: {
    profiles: { full_name: string | null } | null 
  } | null;
};
type Event = {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
};
type StaffOrAdmin = Profile; // Profiles with role STAFF or ADMIN

// Supabase client specific to this component
// REMOVE this redundant declaration
// const supabase = createClientComponentClient<Database>(); // Use generic later
// const supabase = createClientComponentClient();

// --- Helper Component for Summary Widgets ---
interface SummaryWidgetProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string; // Optional color for icon/value
  children?: React.ReactNode; // Allow embedding charts or other content
}

function SummaryWidget({ title, value, icon, color = 'text.primary', children }: SummaryWidgetProps) {
  return (
    <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div" sx={{ color, fontWeight: 600 }}>
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
          {icon}
        </Avatar>
      </Box>
      {children && (
         <Box sx={{ mt: 2, flexGrow: 1 }}>
             {/* Ensure child takes available space */}
             {children}
         </Box>
      )}
    </Paper>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const theme = useTheme();

  // State for dashboard data
  const [residents, setResidents] = useState<ResidentWithProfile[]>([]);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // State for dialogs open/close
  const [isCreateResidentDialogOpen, setIsCreateResidentDialogOpen] = useState(false);
  const [isCreateStaffDialogOpen, setIsCreateStaffDialogOpen] = useState(false);
  const [isCreateFamilyDialogOpen, setIsCreateFamilyDialogOpen] = useState(false);
  const [isCreateIncidentDialogOpen, setIsCreateIncidentDialogOpen] = useState(false);

  // State for dialog props data
  const [allResidentsForDialog, setAllResidentsForDialog] = useState<ResidentWithProfile[]>([]);
  const [potentialAssigneesForDialog, setPotentialAssigneesForDialog] = useState<StaffOrAdmin[]>([]);

  // --- Hooks for Data Processing (MUST BE CALLED BEFORE conditional returns) ---
  const incidentSeverityData = useMemo(() => {
    const counts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };
    incidents.forEach(inc => {
      if (inc.severity) {
        const severityKey = inc.severity as keyof typeof counts;
        if (severityKey in counts) { 
             counts[severityKey]++;
        }
      }
    });
    return [
      { name: 'Low', value: counts.LOW },
      { name: 'Medium', value: counts.MEDIUM },
      { name: 'High', value: counts.HIGH },
    ].filter(item => item.value > 0); 
  }, [incidents]);

  const severityColors = useMemo(() => ({
    LOW: theme.palette.success.main,
    MEDIUM: theme.palette.warning.main,
    HIGH: theme.palette.error.main,
  }), [theme]); // Depend on theme

  // Fetch dashboard data function
  const fetchData = async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const fetches = [
        supabase.from('residents').select('*, profiles (*)', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }).in('role', ['STAFF', 'ADMIN']),
        supabase
          .from('incidents')
          .select('*, residents(profiles(full_name))')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('events').select('id, title, start_time, location').order('start_time').limit(5),
        supabase.from('residents').select('*, profiles(*)'),
        supabase.from('profiles').select('*').in('role', ['STAFF', 'ADMIN']),
      ];

      const [
        residentsRes,
        staffCountRes,
        incidentsRes,
        eventsRes,
        allResidentsRes,
        potentialAssigneesRes,
      ] = await Promise.all(fetches);

      if (residentsRes.error) throw new Error(`Residents Error: ${residentsRes.error.message}`);
      if (staffCountRes.error) throw new Error(`Staff Count Error: ${staffCountRes.error.message}`);
      if (incidentsRes.error) throw new Error(`Incidents Error: ${incidentsRes.error.message}`);
      if (eventsRes.error) throw new Error(`Events Error: ${eventsRes.error.message}`);
      if (allResidentsRes.error) throw new Error(`All Residents Error: ${allResidentsRes.error.message}`);
      if (potentialAssigneesRes.error) throw new Error(`Potential Assignees Error: ${potentialAssigneesRes.error.message}`);

      setResidents((residentsRes.data as ResidentWithProfile[])?.slice(0, 5) || []);
      setStaffCount(staffCountRes.count || 0);
      setIncidents((incidentsRes.data as Incident[]) || []);
      setEvents((eventsRes.data as Event[]) || []);
      setAllResidentsForDialog((allResidentsRes.data as ResidentWithProfile[]) || []);
      setPotentialAssigneesForDialog((potentialAssigneesRes.data as StaffOrAdmin[]) || []);

      setDebugInfo((prev: any) => ({
        ...prev,
        dataFetch: {
          residentsSummary: residentsRes.status,
          staffCount: staffCountRes.status,
          incidentsSummary: incidentsRes.status,
          eventsSummary: eventsRes.status,
          allResidentsForSelectionCount: allResidentsRes.data?.length ?? 0,
          potentialAssigneesCount: potentialAssigneesRes.data?.length ?? 0,
        },
        timestamp: new Date().toISOString(),
      }));

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setDataError(`Error fetching data: ${error.message}`);
      setDebugInfo((prev: any) => ({
        ...prev,
        fetchError: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
    } finally {
      setDataLoading(false);
    }
  };

  // useEffect to fetch data when authentication is complete and profile exists
  useEffect(() => {
    if (!authLoading && profile) {
      fetchData();
    }
  }, [authLoading, profile]);

  // Handlers (logout, dialogs, etc.) - Keep these as they are
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
      setDataError('Failed to sign out.');
    }
  };

  const handleManualReload = () => {
    fetchData();
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
    fetchData();
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
    fetchData();
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
    fetchData();
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
    fetchData();
  };

  // --- Conditional Rendering Logic --- 

  // 1. Handle Auth Loading state
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading user authentication...</Typography>
      </Box>
    );
  }

  // 2. Handle Auth Complete but No User/Profile
  if (!user || !profile) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Authentication failed or user profile not found. Please log in.
        </Alert>
        <Button variant="contained" onClick={() => router.push('/login')}>
          Go to Login
        </Button>
      </Box>
    );
  }

  // 3. Handle Data Loading state (after auth is confirmed)
  if (dataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading dashboard data...</Typography>
      </Box>
    );
  }

  // 4. Handle Data Fetching Error
  if (dataError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {dataError}
        </Alert>
        <Button variant="outlined" onClick={fetchData}>Retry</Button>
      </Box>
    );
  }

  // --- Main Dashboard Render (Auth complete, profile loaded, data loaded) --- 
  
  // Role checks - moved down after conditional returns
  const isAdmin = profile?.role === 'ADMIN';
  const isStaff = profile?.role === 'STAFF';
  
  // Quick Actions - moved down after conditional returns
  const quickActions = [
    (isAdmin || isStaff) && {
      title: 'Create Resident',
      icon: <People />,
      onClick: handleOpenCreateResidentDialog,
    },
    isAdmin && {
      title: 'Create Staff',
      icon: <Add />,
      onClick: handleOpenCreateStaffDialog,
    },
    (isAdmin || isStaff) && {
      title: 'Create Family',
      icon: <Add />,
      onClick: handleOpenCreateFamilyDialog,
    },
    (isAdmin || isStaff) && {
      title: 'Log Incident',
      icon: <Warning />,
      onClick: handleOpenCreateIncidentDialog,
    },
  ].filter(Boolean);

  // Calculate counts for widgets
  const residentCount = residents.length;
  const openIncidentCount = incidents.filter(i => i.status !== 'RESOLVED').length;
  const eventCount = events.length;

  const statsCards = [
    {
      title: 'Daily Visitors',
      value: '1,352',
      change: '+12.5%',
      isPositive: true,
      icon: <Person />,
      color: theme.palette.primary.main
    },
    {
      title: 'Average Daily Sales',
      value: '51,352',
      change: '+12.5%',
      isPositive: true,
      icon: <ShoppingCart />,
      color: theme.palette.success.main
    },
    {
      title: 'Orders This Month',
      value: '1,352',
      change: '-2.2%',
      isPositive: false,
      icon: <TrendingUp />,
      color: theme.palette.warning.main
    },
    {
      title: 'Monthly Earnings',
      value: '$20,360',
      change: '-2.2%',
      isPositive: false,
      icon: <AttachMoney />,
      color: theme.palette.error.main
    },
  ];

  const topSellers = [
    { name: 'Gage Paquette', sales: 13440, amount: '$350K', avatar: '/avatars/1.png' },
    { name: 'Lara Harvey', sales: 10240, amount: '$205K', avatar: '/avatars/2.png' },
    { name: 'Evan Scott', sales: 10240, amount: '$145K', avatar: '/avatars/3.png' },
    { name: 'Benja Johnston', sales: 10240, amount: '$143K', avatar: '/avatars/4.png' },
  ];

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

      {/* Quick Actions Buttons */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
         <Grid item>
           <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreateResidentDialog}>
             Add Resident
           </Button>
         </Grid>
         {isAdmin && (
           <Grid item>
             <Button variant="outlined" startIcon={<Add />} onClick={handleOpenCreateStaffDialog}>
               Add Staff
             </Button>
           </Grid>
         )}
         <Grid item>
            <Button variant="outlined" startIcon={<Add />} onClick={handleOpenCreateFamilyDialog}>
              Add Family Member
            </Button>
         </Grid>
         <Grid item>
           <Button variant="outlined" color="warning" startIcon={<Warning />} onClick={handleOpenCreateIncidentDialog}>
             Log Incident
           </Button>
         </Grid>
         {/* Add Log/View Medications Button */} 
         {(isAdmin || isStaff) && (
            <Grid item>
               <Button 
                 variant="outlined" 
                 color="success" // Or another suitable color
                 startIcon={<MedicationIcon />} 
                 onClick={() => router.push('/dashboard/medications')} 
               >
                 Log/View Meds
               </Button>
           </Grid>
         )}
       </Grid>

      {/* Summary Widgets Grid - Keep this section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Total Residents Widget */}
          <Grid item xs={12} sm={6} md={3}>
            <SummaryWidget
              title="Total Residents"
              value={residents.length} // Use fetched data length
              icon={<PeopleIcon />}
              color={theme.palette.primary.main}
            />
          </Grid>
  
          {/* Active Staff Widget */}
          <Grid item xs={12} sm={6} md={3}>
            <SummaryWidget
              title="Active Staff/Admins"
              value={staffCount} // Use fetched staffCount
              icon={<GroupIcon />}
              color={theme.palette.secondary.main}
            />
          </Grid>
  
          {/* Incidents by Severity Widget with Pie Chart */}
          <Grid item xs={12} sm={6} md={3}>
            <SummaryWidget
              title="Incidents by Severity"
              value={incidents.length} // Use fetched data length
              icon={<WarningIcon />}
              color={theme.palette.warning.main}
            >
              {incidentSeverityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart >
                    <Pie
                      data={incidentSeverityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {incidentSeverityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={severityColors[entry.name.toUpperCase() as keyof typeof severityColors]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        background: theme.palette.background.paper,
                        borderRadius: '4px',
                        border: `1px solid ${theme.palette.divider}`
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                  <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{mt:2}}>
                    No incident data for chart.
                  </Typography>
               )}
            </SummaryWidget>
          </Grid>
  
          {/* Upcoming Events Widget */}
          <Grid item xs={12} sm={6} md={3}>
            <SummaryWidget
               title="Upcoming Events"
               value={events.length}
               icon={<EventIcon />}
               color={theme.palette.info.main}
             >
               {events.length > 0 ? (
                  <List dense disablePadding sx={{maxHeight: 100, overflowY: 'auto'}}> 
                    {events.map(event => {
                      let formattedStartTime = 'Invalid Date';
                      try {
                        formattedStartTime = event.start_time 
                          ? new Date(event.start_time).toLocaleString() 
                          : 'N/A';
                      } catch(e) { formattedStartTime = event.start_time || 'Invalid Date'; }

                      return (
                        <ListItem key={event.id} disableGutters dense>
                          <ListItemText
                            primary={event.title}
                            secondary={`${formattedStartTime} ${event.location ? '@ ' + event.location : ''}`}
                            primaryTypographyProps={{ variant: 'caption', fontWeight: 500, noWrap: true }}
                            secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{display:'block', textAlign:'center', mt: 1}}>
                      No upcoming events.
                  </Typography>
                )}
             </SummaryWidget>
          </Grid>
      </Grid>

      {/* Recent Activity Grids */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Recent Residents List - Refactored */}
        <Grid item xs={12}> 
          <Card elevation={2}> {/* Use Card instead of Paper */} 
            <CardHeader 
              title="Recent Residents"
              action={
                <Button 
                  size="small" 
                  endIcon={<ViewAllIcon />} 
                  onClick={() => router.push('/dashboard/residents')}
                >
                  View All
                </Button>
              }
              sx={{ pb: 0 }} // Remove bottom padding from header
            />
            <CardContent sx={{ pt: 1 }}> {/* Reduce top padding */} 
              {residents.length === 0 ? (
                 <Typography color="text.secondary">No residents found.</Typography>
               ) : (
                  <List dense disablePadding>
                    {residents.slice(0, 5).map((resident) => {
                       const name = resident.profiles?.full_name;
                       const email = resident.profiles?.email;
                       const profileId = resident.profiles?.id;
                       return (
                        <ListItem 
                          key={resident.id} 
                          disablePadding 
                          button // Make item act like a button
                          component={Link} // Use Link component for navigation
                          href={`/dashboard/profile/${profileId}`} // Link destination
                          sx={{ 
                            borderRadius: 1, // Optional: round corners
                            '&:hover': { bgcolor: 'action.hover' } // Hover effect
                          }} 
                        >
                          <ListItemAvatar sx={{ pl: 1 }}> {/* Add padding */} 
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                               {name ? name[0]?.toUpperCase() : '-'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={name || `Profile ID: ${resident.profile_id}`}
                            secondary={`Room ${resident.room_number || 'N/A'}`}
                            primaryTypographyProps={{ fontWeight: 500, variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                          <Chip 
                            label={resident.care_level || 'N/A'} 
                            size="small" 
                            variant="outlined" 
                            sx={{ mr: 1 }} // Add margin
                            color={resident.care_level === 'HIGH' ? 'error' : resident.care_level === 'MEDIUM' ? 'warning' : 'success'}
                          />
                        </ListItem>
                       );
                     })}
                  </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Events and Incidents Grids */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
         {/* Upcoming Events Full List */}
         <Grid item xs={12} md={6}>
           <Paper sx={{ p: 2 }}>
             <Typography variant="h6" gutterBottom>Upcoming Events</Typography>
             {events.length > 0 ? (
                  <List dense disablePadding sx={{maxHeight: 300, overflowY: 'auto'}}>
                    {events.map(event => {
                       let formattedStartTime = 'Invalid Date';
                       try {
                         formattedStartTime = event.start_time
                           ? new Date(event.start_time).toLocaleString()
                           : 'N/A';
                       } catch(e) { formattedStartTime = event.start_time || 'Invalid Date'; }

                      return (
                        <ListItem key={event.id} disableGutters dense>
                          <ListItemText
                            primary={event.title}
                            secondary={`${formattedStartTime} ${event.location ? '@ ' + event.location : ''}`}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                            secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{display:'block', textAlign:'center', mt: 1}}>
                      No upcoming events.
                  </Typography>
                )}
           </Paper>
         </Grid>
         {/* Recent Incidents - Corrected Structure */}
         <Grid item xs={12} md={6}>
           <Paper sx={{ p: 2 }}>
             <Typography variant="h6" gutterBottom>Recent Incidents</Typography>
             {incidents.length > 0 ? (
                <List dense disablePadding sx={{maxHeight: 300, overflowY: 'auto'}}>
                  {incidents.map((incident) => {
                    let formattedIncidentTime = 'Invalid Date';
                    try {
                      formattedIncidentTime = incident.created_at
                        ? new Date(incident.created_at).toLocaleString()
                        : 'N/A';
                    } catch(e) { formattedIncidentTime = incident.created_at || 'Invalid Date'; }

                    return (
                      <ListItem
                        key={incident.id}
                        disableGutters
                        divider
                        sx={{ alignItems: 'flex-start' }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                          <Tooltip title={`Severity: ${incident.severity}`}>
                            <WarningIcon fontSize="small" color={incident.severity === 'HIGH' ? 'error' : incident.severity === 'MEDIUM' ? 'warning' : 'inherit'} />
                          </Tooltip>
                        </ListItemIcon>
                        <ListItemText
                          primary={incident.title}
                          secondary={`For: ${incident.residents?.profiles?.full_name || 'Unknown Resident'} - ${formattedIncidentTime}`}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                          secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                        />
                        <Chip
                          label={incident.status}
                          size="small"
                          color={incident.status === 'OPEN' ? 'primary' : incident.status === 'RESOLVED' ? 'success' : 'default'}
                          sx={{ ml: 1, mt: 0.5 }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{display:'block', textAlign:'center', mt: 1}}>
                    No recent incidents.
                </Typography>
              )}
           </Paper>
         </Grid>
      </Grid>

      {/* Dialog Components - Keep this section */}
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
          residents={allResidentsForDialog}
          assignees={potentialAssigneesForDialog}
        />
      )}
    </Box>
  );
}