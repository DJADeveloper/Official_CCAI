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
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn'; // Example icon
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import BedIcon from '@mui/icons-material/Bed'; // For Room Number
import ContactEmergencyIcon from '@mui/icons-material/ContactEmergency'; // For Emergency Contact
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation'; // For Conditions
import StarIcon from '@mui/icons-material/Star'; // For Care Level
import WorkIcon from '@mui/icons-material/Work'; // For Position/Department
import AccessTimeIcon from '@mui/icons-material/AccessTime'; // For Shift
import { format } from 'date-fns';

// Define types (consider consolidating types)
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

export default function UserProfilePage() {
  const params = useParams();
  const profileId = params?.profileId as string; // Get profileId from URL

  const [profile, setProfile] = useState<Profile | null>(null);
  const [details, setDetails] = useState<ResidentDetails | StaffDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single();

        if (profileError) throw profileError;
        if (!profileData) throw new Error('Profile not found.');
        
        setProfile(profileData);

        // Fetch role-specific details
        let detailsData = null;
        let detailsError = null;

        if (profileData.role === 'RESIDENT') {
          const { data, error } = await supabase
            .from('residents')
            .select('*')
            .eq('profile_id', profileId)
            .single();
          detailsData = data;
          detailsError = error;
        } else if (profileData.role === 'STAFF' || profileData.role === 'ADMIN') {
          const { data, error } = await supabase
            .from('staff') // Assuming staff details are in 'staff' table
            .select('*')
            .eq('profile_id', profileId)
            .single();
          detailsData = data;
          detailsError = error;
        }
        // Add FAMILY details fetch if needed

        if (detailsError) {
          // Log error but don't necessarily block page load if details are missing
          console.warn(`Could not load details for ${profileData.role}: ${detailsError.message}`);
        }
        setDetails(detailsData);

      } catch (err: any) {
        console.error("Error fetching profile data:", err);
        setError(`Failed to load profile: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [profileId]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error || !profile) {
    return <Container sx={{ py: 4 }}><Alert severity="error">{error || 'Profile data could not be loaded.'}</Alert></Container>;
  }

  // Helper to display detail items
  const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      {icon}
      <Typography variant="body2" color="text.secondary">{label}:</Typography>
      <Typography variant="body2" fontWeight={500}>{value || 'N/A'}</Typography>
    </Stack>
  );

  return (
    <Box>
      {/* Header Section - Mimicking the mockup style */}
      <Paper 
        elevation={0} 
        sx={{
          height: 200, 
          bgcolor: 'grey.200', // Placeholder background 
          mb: -8, // Overlap avatar onto banner
          borderRadius: 2, 
          // Add background image later if desired
        }}
      />

      <Container maxWidth="lg">
        <Grid container spacing={3} sx={{ alignItems: 'flex-end' }}>
          <Grid item xs={12} md={3} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Avatar
              src={profile.avatar_url || undefined} // Use avatar_url if available
              sx={{
                width: 120,
                height: 120,
                border: '4px solid', 
                borderColor: 'background.paper', 
                mx: 'auto', // Center avatar
              }}
            >
              {profile.full_name ? profile.full_name[0]?.toUpperCase() : 'P'}
            </Avatar>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h4" gutterBottom sx={{ mt: { xs: 2, md: 0 } }}>
              {profile.full_name || 'Unnamed User'}
            </Typography>
            <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2"><PersonIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 0.5 }}/> {profile.role || 'Unknown Role'}</Typography>
              {/* Add other brief details like location/department if applicable */}
              <Typography variant="body2"><EventIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 0.5 }}/> Joined {format(new Date(profile.created_at), 'MMMM d, yyyy')}</Typography>
            </Stack>
          </Grid>
          {/* Optional: Add action buttons here like Edit Profile */}
        </Grid>

        {/* Content Section */}
        <Grid container spacing={3} sx={{ mt: 3 }}>
          {/* Left Column / Main Info */}
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <Divider sx={{ mb: 2 }} />
                <DetailItem icon={<EmailIcon fontSize='inherit'/>} label="Email" value={profile.email} />
                {/* Add Phone if available */}
                
                {/* Role Specific Details */} 
                {profile.role === 'RESIDENT' && details && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>Resident Details</Typography>
                    <DetailItem icon={<BedIcon fontSize='inherit'/>} label="Room Number" value={(details as ResidentDetails).room_number} />
                    <DetailItem icon={<ContactEmergencyIcon fontSize='inherit'/>} label="Emergency Contact" value={(details as ResidentDetails).emergency_contact} />
                    <DetailItem icon={<StarIcon fontSize='inherit'/>} label="Care Level" value={(details as ResidentDetails).care_level} />
                    <DetailItem icon={<MedicalInformationIcon fontSize='inherit'/>} label="Medical Conditions" value={(details as ResidentDetails).medical_conditions?.join(', ') || 'None'} />
                  </>
                )}
                
                {(profile.role === 'STAFF' || profile.role === 'ADMIN') && details && (
                   <>
                     <Divider sx={{ my: 2 }} />
                     <Typography variant="h6" gutterBottom>Staff Details</Typography>
                     <DetailItem icon={<WorkIcon fontSize='inherit'/>} label="Department" value={(details as StaffDetails).department} />
                     <DetailItem icon={<WorkIcon fontSize='inherit'/>} label="Position" value={(details as StaffDetails).position} />
                     <DetailItem icon={<AccessTimeIcon fontSize='inherit'/>} label="Shift" value={(details as StaffDetails).shift} />
                   </>
                 )}

              </CardContent>
            </Card>
            {/* Add other cards/sections here (e.g., Assigned Tasks, Medication Log, Incidents) */}
          </Grid>

          {/* Right Column / Connections (Placeholder) */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Connections</Typography>
                <Divider sx={{ mb: 2 }}/>
                {/* Placeholder - Fetch and display related family members or staff */}
                <Typography color="text.secondary">Connections details coming soon.</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
} 