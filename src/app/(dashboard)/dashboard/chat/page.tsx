'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Divider,
  Grid,
  Avatar,
  Stack,
  TextField,
  IconButton,
  Badge,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Define type for Profile (adapt if needed)
type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
};

// Define type for Chat Message
type ChatMessage = {
  id: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  sender?: Pick<Profile, 'full_name' | 'avatar_url'>;
};

export default function ChatPage() {
  const { user, profile: currentUserProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedChatPartner, setSelectedChatPartner] = useState<Profile | null>(null);

  // State for messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch potential chat partners (active profiles excluding self)
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) return;

      setLoadingProfiles(true);
      setProfilesError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url')
          .in('role', ['ADMIN', 'STAFF', 'FAMILY'])
          .neq('id', user.id)
          .order('full_name', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }
        setProfiles(data || []);
      } catch (err: any) {
        console.error("Error fetching profiles:", err);
        setProfilesError(`Failed to load users: ${err.message}`);
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, [user]);

  // Fetch messages for the selected conversation
  const fetchMessages = async (partnerId: string) => {
    if (!user) return;

    setLoadingMessages(true);
    setMessagesError(null);
    setMessages([]);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles!sender_id(full_name, avatar_url)')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }
      setMessages(data || []);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setMessagesError(`Failed to load messages: ${err.message}`);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectChat = (profile: Profile) => {
    setSelectedChatPartner(profile);
    // Clear previous subscription before fetching new messages
    supabase.removeAllChannels(); 
    fetchMessages(profile.id);
  };

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user || !selectedChatPartner) {
      return; // Don't subscribe if no user or partner selected
    }

    // Handler for new messages
    const handleNewMessage = (payload: any) => {
      console.log('Realtime message received:', payload);
      // TODO: Add proper type check for payload.new
      const newMessage = payload.new as ChatMessage;

      // Ensure the message is relevant to the current chat
      const isRelevant = 
        (newMessage.sender_id === user.id && newMessage.receiver_id === selectedChatPartner.id) ||
        (newMessage.sender_id === selectedChatPartner.id && newMessage.receiver_id === user.id);

      if (isRelevant) {
        // Add sender info if missing (it might not be joined in the payload)
        // This is a simple approach; ideally, fetch sender profile if needed
        if (!newMessage.sender) {
          if (newMessage.sender_id === user.id) {
            newMessage.sender = { full_name: currentUserProfile?.full_name, avatar_url: currentUserProfile?.avatar_url };
          } else if (newMessage.sender_id === selectedChatPartner.id) {
            newMessage.sender = { full_name: selectedChatPartner.full_name, avatar_url: selectedChatPartner.avatar_url };
          }
        }
        
        setMessages((currentMessages) => [...currentMessages, newMessage]);
        // Consider marking message as read if window is active?
      }
    };

    // Set up the subscription
    const channelName = `chat-${[user.id, selectedChatPartner.id].sort().join('-')}`; // Consistent channel name
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages' 
          // No server-side filter - we filter in handleNewMessage
        },
        handleNewMessage
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to chat messages between ${user.id} and ${selectedChatPartner.id}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription error:', err);
          toast.error('Chat connection error. Please refresh.');
        }
      });

    // Cleanup function to remove subscription
    return () => {
      // console.log(`Unsubscribing from chat messages: ${channel.channelId}`);
      console.log(`Unsubscribing from chat channel: ${channel.state}`); // Log state instead
      supabase.removeChannel(channel);
    };

  }, [user, selectedChatPartner, currentUserProfile]); // Re-subscribe if user or partner changes

  // Function to send a message
  const handleSendMessage = async () => {
    if (!user || !selectedChatPartner || !newMessage.trim() || isSending) {
      return; // Don't send empty messages or if already sending or no user/partner
    }

    setIsSending(true);
    const contentToSend = newMessage.trim();
    setNewMessage(''); // Clear input immediately

    try {
      const { error } = await supabase.from('chat_messages').insert({
        sender_id: user.id,
        receiver_id: selectedChatPartner.id,
        content: contentToSend,
        // 'read' defaults to false in the DB
      });

      if (error) {
        throw error;
      }
      // We will rely on the real-time listener (added next) to update the messages array.
      // For now, just scroll to bottom after a slight delay to allow potential real-time update
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error(`Failed to send message: ${err.message}`);
      setNewMessage(contentToSend); // Restore message input on error
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Paper sx={{ display: 'flex', height: 'calc(100vh - 64px - 48px)', overflow: 'hidden' }}>
      {/* Left Column: User List */}
      <Box sx={{ width: 300, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto' }}>
        <Typography variant="h6" sx={{ p: 2 }}>Contacts</Typography>
        <Divider />
        {loadingProfiles && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        )}
        {profilesError && <Alert severity="error" sx={{ m: 1 }}>{profilesError}</Alert>}
        {!loadingProfiles && !profilesError && (
          <List disablePadding>
            {profiles.map((profile) => (
              <ListItem 
                key={profile.id} 
                disablePadding
                sx={{ bgcolor: selectedChatPartner?.id === profile.id ? 'action.selected' : 'inherit' }}
              >
                <ListItemButton onClick={() => handleSelectChat(profile)}>
                  <ListItemAvatar>
                    <Avatar 
                      src={profile.avatar_url || undefined}
                      sx={{ width: 32, height: 32 }}
                    >
                      {profile.full_name ? profile.full_name[0]?.toUpperCase() : '?'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Link href={`/dashboard/profile/${profile.id}`} passHref style={{ textDecoration: 'none' }}>
                        <Typography 
                          component="a" 
                          variant="body2" 
                          sx={{ 
                            color: 'text.primary', 
                            fontWeight: 500,
                            '&:hover': { textDecoration: 'underline' } 
                          }}
                        >
                          {profile.full_name || 'Unknown User'}
                        </Typography>
                      </Link>
                    }
                    secondary={profile.role || 'Unknown Role'}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {profiles.length === 0 && (
              <ListItem>
                <ListItemText secondary="No contacts found." />
              </ListItem>
            )}
          </List>
        )}
      </Box>

      {/* Right Column: Chat Area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedChatPartner ? (
          <>
            {/* Chat Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">{selectedChatPartner.full_name || 'Chat'}</Typography>
            </Box>
            
            {/* Message Display Area */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
              {loadingMessages && <CircularProgress sx={{ display: 'block', margin: 'auto' }}/>}
              {messagesError && <Alert severity="error">{messagesError}</Alert>}
              {!loadingMessages && !messagesError && messages.length === 0 && (
                  <Typography color="text.secondary" textAlign="center">No messages yet. Start the conversation!</Typography>
              )}
              {!loadingMessages && !messagesError && messages.map((msg) => {
                  const isSender = msg.sender_id === user?.id;
                  return (
                    <Box 
                      key={msg.id} 
                      sx={{ 
                        display: 'flex', 
                        justifyContent: isSender ? 'flex-end' : 'flex-start', 
                        mb: 1 
                      }}
                    >
                      <Paper 
                        elevation={1} 
                        sx={{ 
                          p: 1.5, 
                          bgcolor: isSender ? 'primary.main' : 'background.paper', 
                          color: isSender ? 'primary.contrastText' : 'text.primary', 
                          maxWidth: '70%', 
                          borderRadius: isSender ? '15px 15px 0 15px' : '15px 15px 15px 0'
                        }}
                      >
                        <Typography variant="body1">{msg.content}</Typography>
                        <Typography 
                          variant="caption" 
                          display="block" 
                          sx={{ 
                            mt: 0.5, 
                            textAlign: isSender ? 'right' : 'left', 
                            color: isSender ? 'rgba(255,255,255,0.7)' : 'text.secondary'
                          }}
                        >
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </Typography>
                      </Paper>
                    </Box>
                  );
              })}
              {/* Empty div to scroll to */}
              <div ref={messagesEndRef} />
            </Box>

            {/* Message Input Area */}
            <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TextField 
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isSending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <IconButton 
                  color="primary" 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim() || isSending}
                  sx={{ ml: 1 }}
                >
                  {isSending ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>
              </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">Select a contact to start chatting</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
} 