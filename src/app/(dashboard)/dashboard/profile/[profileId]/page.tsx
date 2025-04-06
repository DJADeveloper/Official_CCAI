'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Typography,
  Chip,
  Alert,
  Button,
  Paper,
  Stack,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  LinearProgress,
  Input
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import EmailIcon from '@mui/icons-material/Email';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import BedIcon from '@mui/icons-material/Bed';
import ContactEmergencyIcon from '@mui/icons-material/ContactEmergency';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import StarIcon from '@mui/icons-material/Star';
import WorkIcon from '@mui/icons-material/Work';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import FolderIcon from '@mui/icons-material/Folder';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import HistoryIcon from '@mui/icons-material/History';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import FileUpload from '@/components/FileUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';

// --- Types ---
type Profile = {
  id: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
  role: 'ADMIN' | 'STAFF' | 'FAMILY' | 'RESIDENT' | null;
  avatar_url: string | null;
};
type ResidentDetails = {
  room_number: string | null;
  emergency_contact: string | null;
  medical_conditions: string[] | null;
  care_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
};
type StaffDetails = {
  department: string | null;
  position: string | null;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | null;
};
type Incident = any; // Placeholder for Incident type
type Medication = any; // Placeholder for Medication type

// Define a custom type for Supabase file objects
type FileObject = {
  id: string | null; // id might be null depending on storage setup
  name: string;
  created_at?: string;
  metadata?: {
    size?: number;
    // other metadata fields if needed
  };
};

// Update combined ProfileData type to use FileObject
type ProfileData = Profile & {
  details: ResidentDetails | StaffDetails | null;
  incidents?: Incident[];
  medications?: Medication[];
  assignedIncidents?: Incident[];
  files?: FileObject[]; // Use FileObject array
};

// --- Tab Panel Component ---
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `profile-tab-${index}`,
    'aria-controls': `profile-tabpanel-${index}`,
  };
}

// --- Main Component ---
export default function UserProfilePage() {
  const params = useParams();
  const profileId = params?.profileId as string;

  // Use the combined ProfileData type for state
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabIndex, setTabIndex] = useState(0); // State for active tab

  // Function to specifically refresh the file list
  const refreshFileList = async () => {
    if (!profileId || !profileData) return; // Need profileId and existing data

    try {
      const { data: resFiles, error: filesError } = await supabase.storage
        .from('resident-files')
        .list(profileId, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });

      if (filesError) {
        console.warn(`Could not refresh file list: ${filesError.message}`);
        toast.error('Could not refresh file list.');
        return;
      }

      // Update only the files part of the state
      setProfileData(prevData => prevData ? { ...prevData, files: (resFiles as FileObject[]) || [] } : null);

    } catch (err) {
      console.error("Error refreshing file list:", err);
      toast.error('Error refreshing file list.');
    }
  };

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!profileId) {
        setError('Profile ID not found in URL.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch base profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single();

        if (profileError) throw profileError;
        if (!profile) throw new Error('Profile not found.');

        let details = null;
        let incidents: Incident[] | undefined = undefined;
        let medications: Medication[] | undefined = undefined;
        let assignedIncidents: Incident[] | undefined = undefined;
        let files: FileObject[] | undefined = undefined;

        // Fetch role-specific details and related data
        if (profile.role === 'RESIDENT') {
          const profilePk = profile.id;
          // Fetch details, incidents, medications, AND files
          const [{ data: resDetails, error: detailsError },
                 { data: resIncidents, error: incidentsError },
                 { data: resMeds, error: medsError },
                 { data: resFiles, error: filesError }] = await Promise.all([ // Destructure file results
            supabase.from('residents').select('*').eq('profile_id', profilePk).single(),
            supabase.from('incidents').select('id, created_at, title, severity, status').eq('resident_id', profilePk).order('created_at', { ascending: false }).limit(10),
            supabase.from('medications').select('id, name, dosage, frequency, start_date, end_date').eq('resident_id', profilePk).order('name').limit(10),
            supabase.storage.from('resident-files').list(profilePk, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } }) // Fetch files
          ]);

          if (detailsError) console.warn(`Could not load resident details: ${detailsError.message}`);
          else details = resDetails;
          if (incidentsError) console.warn(`Could not load incidents: ${incidentsError.message}`);
          else incidents = resIncidents || [];
          if (medsError) console.warn(`Could not load medications: ${medsError.message}`);
          else medications = resMeds || [];
          if (filesError) console.warn(`Could not list files: ${filesError.message}`); // Handle file error
          else files = (resFiles as FileObject[]) || []; // Assign fetched files

        } else if (profile.role === 'STAFF' || profile.role === 'ADMIN') {
          const [{ data: staffDetails, error: detailsError }, {data: staffIncidents, error: incidentsError}] = await Promise.all([
            supabase.from('staff').select('*').eq('profile_id', profileId).single(),
            // Corrected query for assigned incidents
            supabase
              .from('incidents')
              .select('id, created_at, title, severity, status, residents!inner(profiles!inner(full_name))')
              .eq('assigned_to', profileId)
              .order('created_at', { ascending: false })
              .limit(10)
          ]);
          if (detailsError) console.warn(`Could not load staff details: ${detailsError.message}`);
          else details = staffDetails;
          if (incidentsError) console.warn(`Could not load assigned incidents: ${incidentsError.message}`);
          else assignedIncidents = staffIncidents || [];
        }
        // Add FAMILY details fetch if needed

        // Store all fetched data in the state, including files
        setProfileData({ ...profile, details, incidents, medications, assignedIncidents, files });

      } catch (err: any) {
        console.error("Error fetching profile data:", err);
        setError(`Failed to load profile: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [profileId]);

  // Handler for changing tabs
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  // Function to handle file download
  const handleDownload = async (fileName: string) => {
    if (!profileData) return;
    const filePath = `${profileData.id}/${fileName}`; // Construct file path
    try {
      const { data, error } = await supabase.storage
        .from('resident-files')
        .createSignedUrl(filePath, 60); // Signed URL valid for 60 seconds

      if (error) throw error;
      if (data?.signedUrl) {
        // Open the URL in a new tab to trigger download/view
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      console.error("Error creating signed URL:", error);
      toast.error(`Failed to download file: ${error.message}`);
    }
  };

  // Loading and Error states
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  if (error || !profileData) {
    return <Container sx={{ py: 4 }}><Alert severity="error">{error || 'Profile data could not be loaded.'}</Alert></Container>;
  }

  // Destructure all data from profileData state, including files
  const { role, full_name, email, created_at, avatar_url, details, incidents, medications, assignedIncidents, files } = profileData;

  // --- Define Tabs ---
  let tabsConfig: { label: string; icon: React.ReactElement }[] = [];
  if (role === 'RESIDENT') {
    tabsConfig = [
      { label: 'Overview', icon: <PersonIcon /> },
      { label: 'Medical', icon: <MedicalInformationIcon /> },
      { label: 'Incidents', icon: <AssignmentIcon /> },
      { label: 'Activities', icon: <DirectionsRunIcon /> },
      { label: 'Files', icon: <FolderIcon /> },
    ];
  } else if (role === 'STAFF' || role === 'ADMIN') {
    tabsConfig = [
      { label: 'Overview', icon: <PersonIcon /> },
      { label: 'Assignments', icon: <AssignmentIcon /> },
      { label: 'Activity Log', icon: <HistoryIcon /> },
    ];
  } else if (role === 'FAMILY') {
     tabsConfig = [
      { label: 'Overview', icon: <PersonIcon /> },
      { label: 'Connections', icon: <FamilyRestroomIcon /> },
      { label: 'Updates', icon: <AnnouncementIcon /> },
    ];
  } else {
     tabsConfig = [{ label: 'Overview', icon: <PersonIcon /> }];
  }

  // --- Helper Components ---
  const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      {icon}
      <Typography variant="body2" color="text.secondary">{label}:</Typography>
      <Typography variant="body2" fontWeight={500}>{value || 'N/A'}</Typography>
    </Stack>
  );

  return (
    <Box>
      {/* --- Header Section --- */}
      <Paper
        elevation={0}
        sx={{ height: 200, bgcolor: 'grey.200', mb: -8, borderRadius: 2 }}
      />
      <Container maxWidth="lg" sx={{ mt: 0 }}>
        <Grid container spacing={3} sx={{ alignItems: 'flex-end' }}>
           <Grid item xs={12} md={3} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Avatar
              src={avatar_url || undefined}
              sx={{ width: 120, height: 120, border: '4px solid', borderColor: 'background.paper', mx: 'auto' }}
            >
              {full_name ? full_name[0]?.toUpperCase() : 'P'}
            </Avatar>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h4" gutterBottom sx={{ mt: { xs: 2, md: 0 } }}>
              {full_name || 'Unnamed User'}
            </Typography>
            <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2"><PersonIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 0.5 }}/> {role || 'Unknown Role'}</Typography>
              <Typography variant="body2"><EventIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 0.5 }}/> Joined {format(new Date(created_at), 'MMMM d, yyyy')}</Typography>
            </Stack>
          </Grid>
        </Grid>

        {/* --- Tabs Section --- */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 4 }}>
          <Tabs value={tabIndex} onChange={handleTabChange} aria-label="profile tabs">
            {tabsConfig.map((tab, index) => (
              <Tab
                 key={tab.label}
                 label={tab.label}
                 icon={tab.icon}
                 iconPosition="start"
                 {...a11yProps(index)}
                 sx={{ minHeight: 48 }}
              />
            ))}
           </Tabs>
        </Box>

        {/* --- Tab Panels --- */}
        {/* Overview Panel (Index 0) */}
        <TabPanel value={tabIndex} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}> {/* Main Info */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Basic Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <DetailItem icon={<EmailIcon fontSize='inherit'/>} label="Email" value={email} />
                  
                  {/* Role Specific Overview Details */}
                  {role === 'RESIDENT' && details && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="h6" gutterBottom>Resident Details</Typography>
                      <DetailItem icon={<BedIcon fontSize='inherit'/>} label="Room Number" value={(details as ResidentDetails).room_number} />
                      <DetailItem icon={<ContactEmergencyIcon fontSize='inherit'/>} label="Emergency Contact" value={(details as ResidentDetails).emergency_contact} />
                      <DetailItem icon={<StarIcon fontSize='inherit'/>} label="Care Level" value={(details as ResidentDetails).care_level} />
                    </>
                  )}
                  {(role === 'STAFF' || role === 'ADMIN') && details && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="h6" gutterBottom>Staff Details</Typography>
                      <DetailItem icon={<WorkIcon fontSize='inherit'/>} label="Department" value={(details as StaffDetails).department} />
                      <DetailItem icon={<WorkIcon fontSize='inherit'/>} label="Position" value={(details as StaffDetails).position} />
                      <DetailItem icon={<AccessTimeIcon fontSize='inherit'/>} label="Shift" value={(details as StaffDetails).shift} />
                    </>
                  )}
                  {/* Add Family Overview Details later */}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}> {/* Connections/Side Info */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Connections</Typography>
                  <Divider sx={{ mb: 2 }}/>
                  <Typography color="text.secondary">Connections details coming soon.</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* --- Resident Specific Panels --- */}
        {role === 'RESIDENT' && (
          <>
            <TabPanel value={tabIndex} index={1}> {/* Medical Tab */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Medical Information</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Conditions:</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {(details as ResidentDetails)?.medical_conditions?.join(', ') || 'None listed'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" gutterBottom>Medications:</Typography>
                  {medications && medications.length > 0 ? (
                    <List dense>
                      {medications.map(med => (
                        <ListItem key={med.id} disableGutters>
                          <ListItemText 
                             primary={`${med.name} (${med.dosage})`} 
                             secondary={`${med.frequency} | Started: ${format(new Date(med.start_date), 'P')}${med.end_date ? ' | Ended: ' + format(new Date(med.end_date), 'P') : ' (Active)'}`}
                           />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary" sx={{ mb: 2 }}>No medications listed.</Typography>
                  )}
                  {/* Add Care Plan details later */}
                </CardContent>
              </Card>
            </TabPanel>
            <TabPanel value={tabIndex} index={2}> {/* Incidents Tab */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Recent Incidents</Typography>
                  <Divider sx={{ mb: 2 }} />
                  {incidents && incidents.length > 0 ? (
                    <List dense>
                      {incidents.map(inc => (
                        <ListItem key={inc.id} disableGutters>
                          <ListItemText 
                            primary={`${inc.title} (${inc.severity})`} 
                            secondary={`Reported: ${format(new Date(inc.created_at), 'Pp')} | Status: ${inc.status}`}
                          />
                          {/* TODO: Add link to incident detail page? */}
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">No incidents reported for this resident.</Typography>
                  )}
                </CardContent>
              </Card>
            </TabPanel>
            <TabPanel value={tabIndex} index={3}> {/* Activities Tab */}
              <Typography>Activities panel coming soon.</Typography>
            </TabPanel>
            <TabPanel value={tabIndex} index={4}> {/* Files Tab */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Resident Files</Typography>
                  <Divider sx={{ mb: 2 }} />

                  <FileUpload residentId={profileId} bucketName="resident-files" onUploadSuccess={() => {
                    // Implement refresh logic here
                  }} />

                  <Typography variant="subtitle1" gutterBottom>Uploaded Files:</Typography>
                  {files && files.length > 0 ? (
                    <List dense>
                      {files.map((file) => (
                        <ListItem
                          key={file.id || file.name} // Use id if available, fallback to name
                          secondaryAction={
                            <IconButton edge="end" aria-label="download" onClick={() => handleDownload(file.name)}>
                              <DownloadIcon />
                            </IconButton>
                          }
                          disablePadding
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                             <FolderIcon fontSize='small' />
                          </ListItemIcon>
                          <ListItemText
                            primary={file.name}
                            secondary={`Size: ${file.metadata?.size ? (file.metadata.size / 1024).toFixed(1) + ' KB' : 'N/A'} | Uploaded: ${file.created_at ? format(new Date(file.created_at), 'P') : 'N/A'}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">No files uploaded for this resident.</Typography>
                  )}
                </CardContent>
              </Card>
            </TabPanel>
          </>
        )}

        {/* --- Staff/Admin Specific Panels --- */}
        {(role === 'STAFF' || role === 'ADMIN') && (
          <>
            <TabPanel value={tabIndex} index={1}> {/* Assignments Tab */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Assigned Incidents</Typography>
                  <Divider sx={{ mb: 2 }} />
                  {assignedIncidents && assignedIncidents.length > 0 ? (
                    <List dense>
                      {assignedIncidents.map(inc => (
                        <ListItem key={inc.id} disableGutters>
                          <ListItemText 
                            primary={`${inc.title} (Severity: ${inc.severity})`}
                            // Adjust secondary based on fetched data - need resident name from join
                            secondary={`Resident: ${inc.residents?.profiles?.full_name || 'N/A'} | Reported: ${format(new Date(inc.created_at), 'Pp')} | Status: ${inc.status}`}
                          />
                          {/* TODO: Add link to incident detail page? */}
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">No incidents currently assigned.</Typography>
                  )}
                  {/* Add Assigned Tasks later */}
                </CardContent>
              </Card>
            </TabPanel>
            <TabPanel value={tabIndex} index={2}> {/* Activity Log Tab */}
              <Typography>Activity Log panel coming soon.</Typography>
            </TabPanel>
          </>
        )}

        {/* --- Family Specific Panels --- */}
        {/* Add FAMILY Panels here later */}

      </Container>
    </Box>
  );
}