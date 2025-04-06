'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Input,
  Alert,
  CircularProgress,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface FileUploadProps {
  residentId: string;
  bucketName: string;
  onUploadSuccess: () => void;
}

export default function FileUpload({ residentId, bucketName, onUploadSuccess }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setError(null);
    } else {
      setSelectedFile(null);
    }
    event.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }
    if (!residentId) {
      setError('Resident ID is missing.');
      return;
    }

    setUploading(true);
    setError(null);
    const filePath = `${residentId}/${selectedFile.name}`;
    console.log('Auth state before upload:', await supabase.auth.getSession());
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      toast.success(`File "${selectedFile.name}" uploaded successfully!`);
      setSelectedFile(null);
      onUploadSuccess();

    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(`Upload failed: ${err.message}`);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ mb: 3, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Upload New File
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadFileIcon />}
          disabled={uploading}
        >
          Choose File
          <Input
            type="file"
            onChange={handleFileChange}
            sx={{ display: 'none' }}
            disabled={uploading}
          />
        </Button>

        {selectedFile && (
          <Typography variant="body2" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </Typography>
        )}

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
        >
          {uploading ? <CircularProgress size={24} /> : 'Upload'}
        </Button>
      </Box>

      {uploading && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  );
} 