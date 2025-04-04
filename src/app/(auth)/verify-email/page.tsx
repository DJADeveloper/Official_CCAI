'use client';

import { Box, Typography, Paper, Button } from '@mui/material';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          mx: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Check Your Email
        </Typography>

        <Typography variant="body1" paragraph>
          We've sent you an email with a link to verify your account. Please check your inbox and click the verification link to continue.
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          If you don't see the email, please check your spam folder.
        </Typography>

        <Button
          component={Link}
          href="/login"
          variant="contained"
          sx={{ mt: 2 }}
        >
          Return to Login
        </Button>
      </Paper>
    </Box>
  );
} 