'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Badge,
  Tooltip,
  Button
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Define type for Notification (adapt if you have proper types)
type Notification = {
  id: string;
  created_at: string;
  user_id: string;
  title: string | null;
  message: string;
  read: boolean;
  link_to: string | null; // Optional link to navigate to
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setNotifications(data || []);
    } catch (err: any) {
      console.error("Error fetching notifications:", err);
      setError(`Failed to load notifications: ${err.message}`);
      toast(`Failed to load notifications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]); // Re-fetch if user changes

  const handleMarkAsRead = async (notificationId: string) => {
    // Optimistically update the UI first for better responsiveness
    setNotifications(prevNotifications => 
      prevNotifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }
      // Success toast is optional, as the UI update is the main feedback
      // toast.success('Notification marked as read.');
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      toast.error(`Failed to mark as read: ${error.message}`);
      // Revert optimistic update on error
      setNotifications(prevNotifications => 
        prevNotifications.map(n => 
          n.id === notificationId ? { ...n, read: false } : n
        )
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    // Find which notifications are currently unread
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) {
      toast('No unread notifications.');
      return;
    }

    const originalNotifications = [...notifications]; // Keep a copy for rollback

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    
    const toastId = toast.loading('Marking all as read...');

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id) // Target current user
        .eq('read', false);      // Only update those that are currently unread

      if (error) {
        throw error;
      }

      toast.success('All notifications marked as read.', { id: toastId });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      toast.error(`Failed to mark all as read: ${error.message}`, { id: toastId });
      // Revert optimistic update on error
      setNotifications(originalNotifications);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (window.confirm('Are you sure you want to delete this notification?')) {
      const originalNotifications = [...notifications];

      // Optimistic UI update: Remove the notification immediately
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      const toastId = toast.loading('Deleting notification...');

      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);

        if (error) {
          throw error;
        }

        toast.success('Notification deleted.', { id: toastId });
      } catch (error: any) {
        console.error("Error deleting notification:", error);
        toast.error(`Failed to delete: ${error.message}`, { id: toastId });
        // Revert optimistic update on error
        setNotifications(originalNotifications);
      }
    }
  };

  // --- Render Logic --- 

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading notifications...</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Paper sx={{ p: 3, maxWidth: '800px', margin: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom component="div">
          Notifications
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          onClick={handleMarkAllAsRead} 
          disabled={notifications.every(n => n.read)}
        >
          Mark All as Read
        </Button>
      </Box>
      
      {notifications.length === 0 ? (
        <Typography color="text.secondary">You have no notifications.</Typography>
      ) : (
        <List disablePadding>
          {notifications.map((notification, index) => (
            <React.Fragment key={notification.id}>
              <ListItem
                alignItems="flex-start"
                secondaryAction={
                  <Box sx={{ display: 'flex', flexDirection:'column', alignItems:'flex-end'}}>
                     <Tooltip title={notification.read ? "Mark as Unread (Not Impl.)" : "Mark as Read"}>
                       <IconButton 
                         edge="end" 
                         aria-label={notification.read ? "mark unread" : "mark read"} 
                         onClick={() => handleMarkAsRead(notification.id)}
                         disabled={notification.read} // Disable if already read
                         size="small"
                         sx={{ mb: 0.5 }}
                       >
                         {notification.read ? <MarkEmailReadIcon fontSize="small" color="disabled"/> : <MarkEmailUnreadIcon fontSize="small" color="primary"/>}
                       </IconButton>
                     </Tooltip>
                     <Tooltip title="Delete Notification">
                       <IconButton 
                         edge="end" 
                         aria-label="delete" 
                         onClick={() => handleDelete(notification.id)}
                         size="small"
                       >
                         <DeleteIcon fontSize="small" />
                       </IconButton>
                     </Tooltip>
                  </Box>
                }
                sx={{ 
                  bgcolor: notification.read ? 'transparent' : 'action.hover',
                  borderRadius: 1,
                  mb: 1,
                  // Add pointer cursor if there's a link
                  cursor: notification.link_to ? 'pointer' : 'default',
                  '&:hover': {
                    bgcolor: notification.link_to ? 'action.selected' : (notification.read ? 'transparent' : 'action.hover')
                  }
                 }}
                 // onClick={() => notification.link_to ? router.push(notification.link_to) : null} // Add navigation later
              >
                <ListItemText
                  primary={notification.title || notification.message} // Show title if available, else message
                  secondary={
                    <React.Fragment>
                      {notification.title && (
                        <Typography
                          sx={{ display: 'block' }}
                          component="span"
                          variant="body2"
                          color="text.primary"
                        >
                          {notification.message}
                        </Typography>
                      )}
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </React.Fragment>
                  }
                />
              </ListItem>
              {index < notifications.length - 1 && <Divider sx={{ my: 1 }}/>}
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
} 