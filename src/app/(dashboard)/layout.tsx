// src/app/dashboard/admin/page.js
"use client";

import React, { useState, useContext, useEffect } from "react";
import { ColorModeContext } from "@/app/client-layout"; // Your context for theme toggling
import { supabase } from "@/lib/supabase/client"; // Supabase client
import { useRouter, usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  Tooltip,
  Badge,
  CircularProgress,
  ListSubheader,
  Grid,
  Paper,
  Button,
  Alert,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Event,
  Warning,
  Medication,
  Announcement,
  Assignment,
  Chat,
  Notifications as NotificationsIcon,
  Settings,
  Logout,
  Group,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  MarkEmailRead as MarkReadIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useAuth } from "@/lib/hooks/useAuth";
import toast from "react-hot-toast";
import { RealtimeChannel } from "@supabase/supabase-js";
import EventIcon from '@mui/icons-material/Event';

const drawerWidth = 240;

const menuItems = [
  { text: "Dashboard", icon: <Dashboard />, path: "/dashboard" },
  { text: "Residents", icon: <People />, path: "/dashboard/residents" },
  { text: "Staff", icon: <Group />, path: "/dashboard/staff" },
  { text: "Events", icon: <EventIcon />, path: "/dashboard/events" },
  { text: "Incidents", icon: <Warning />, path: "/dashboard/incidents" },
  { text: "Medications", icon: <Medication />, path: "/dashboard/medications" },
  { text: "Announcements", icon: <Announcement />, path: "/dashboard/announcements" },
  { text: "Care Plans", icon: <Assignment />, path: "/dashboard/care-plans" },
  { text: "Chat", icon: <Chat />, path: "/dashboard/chat" },
  { text: "Settings", icon: <Settings />, path: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notificationsChannelRef = React.useRef<RealtimeChannel | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);

  const fetchUnreadCount = async () => {
    if (!user) return 0;
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) {
        console.error("Error fetching notification count:", error);
        return 0;
      }
      return count || 0;
    } catch (err) {
      console.error("Error in fetchUnreadCount:", err);
      return 0;
    }
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    fetchUnreadCount().then((count) => setUnreadCount(count));
    const channel = supabase
      .channel("public:notifications:user_id=eq." + user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          setUnreadCount((currentCount) => currentCount + 1);
          toast("You have a new notification!", { icon: "🔔" });
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to notifications channel for user:", user.id);
        }
        if (status === "CHANNEL_ERROR") {
          console.error("Notifications channel error:", err);
          toast.error("Could not listen for notifications.");
        }
        if (status === "TIMED_OUT") {
          console.warn("Notifications channel timed out.");
        }
      });
    notificationsChannelRef.current = channel;
    return () => {
      if (notificationsChannelRef.current) {
        supabase
          .removeChannel(notificationsChannelRef.current)
          .then(() => console.log("Unsubscribed from notifications channel."))
          .catch((err) => console.error("Error unsubscribing:", err));
        notificationsChannelRef.current = null;
      }
    };
  }, [user]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileAnchorEl(null);
  };

  const handleNotificationsOpen = async (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      setRecentNotifications(data || []);
      const unreadInPopover = data?.filter((n) => !n.read).map((n) => n.id) || [];
      if (unreadInPopover.length > 0) {
        await supabase.from("notifications").update({ read: true }).in("id", unreadInPopover);
        fetchUnreadCount().then((count) => setUnreadCount(count));
      }
    } catch (error) {
      console.error("Error fetching recent notifications:", error);
      toast.error("Could not load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchorEl(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleMarkAllReadInPopover = async () => {
    if (!user || recentNotifications.length === 0) return;
    const unreadIds = recentNotifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) {
      toast("No unread notifications in this list.");
      return;
    }
    const toastId = toast.loading("Marking as read...");
    try {
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
      setRecentNotifications((prev: any[]) => prev.map((n: any) => ({ ...n, read: true })));
      fetchUnreadCount().then((count) => setUnreadCount(count));
      toast.success("Marked as read.", { id: toastId });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      toast.error("Failed to mark as read.", { id: toastId });
    }
  };

  const drawer = (
    <Box sx={{ bgcolor: "background.paper", height: "100%" }}>
      <Toolbar
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: "bold" }}>
          Care Cloud AI
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ p: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => router.push(item.path)}
              sx={{
                borderRadius: 1,
                "&.Mui-selected": {
                  backgroundColor:
                    theme.palette.mode === "light"
                      ? theme.palette.primary.main + "20"
                      : theme.palette.primary.main + "40",
                  "&:hover": {
                    backgroundColor:
                      theme.palette.mode === "light"
                        ? theme.palette.primary.main + "30"
                        : theme.palette.primary.main + "50",
                  },
                },
              }}
              selected={pathname === item.path}
            >
              <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} sx={{ ".MuiTypography-root": { fontWeight: 500 } }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ mt: "auto" }} />
      <List sx={{ p: 1 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleSignOut} sx={{ borderRadius: 1 }}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const renderNotifications = () => {
    if (loadingNotifications) {
      return (
        <MenuItem disabled>
          <CircularProgress size={20} sx={{ mx: "auto", display: "block" }} />
        </MenuItem>
      );
    }
    if (recentNotifications.length === 0) {
      return <MenuItem disabled>No recent notifications</MenuItem>;
    }
    return recentNotifications.map((notification: any) => {
      let formattedDate = 'Invalid Date';
      try {
        formattedDate = notification.created_at 
          ? new Date(notification.created_at).toLocaleString() 
          : 'No date';
      } catch (e) {
        console.error("Error formatting notification date:", e);
        formattedDate = notification.created_at || 'Invalid Date';
      }

      return (
        <MenuItem
          key={notification.id}
          onClick={() => {
            if (notification.link_to) router.push(notification.link_to);
            handleNotificationsClose();
          }}
          sx={{
            whiteSpace: "normal",
            bgcolor: notification.read ? "transparent" : "action.hover",
          }}
        >
          <ListItemText
            primary={notification.title || notification.message}
            secondary={
              <>
                {notification.title && (
                  <Typography variant="caption" display="block">
                    {notification.message}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {formattedDate}
                </Typography>
              </>
            }
            primaryTypographyProps={{ fontWeight: notification.read ? 400 : 600 }}
          />
        </MenuItem>
      );
    });
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={`Switch to ${theme.palette.mode === "light" ? "dark" : "light"} mode`}>
            <IconButton sx={{ ml: 1 }} onClick={colorMode.toggleColorMode} color="inherit">
              {theme.palette.mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Notifications">
            <IconButton color="inherit" sx={{ ml: 1 }} onClick={handleNotificationsOpen}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={notificationsAnchorEl}
            open={Boolean(notificationsAnchorEl)}
            onClose={handleNotificationsClose}
            MenuListProps={{ "aria-labelledby": "notifications-button" }}
            PaperProps={{
              elevation: 1,
              sx: {
                mt: 1.5,
                maxHeight: 400,
                width: 360,
                overflow: "auto",
              },
            }}
          >
            <ListSubheader sx={{ bgcolor: "background.paper" }}>Recent Notifications</ListSubheader>
            {renderNotifications()}
            <Divider />
            <MenuItem
              onClick={handleMarkAllReadInPopover}
              disabled={recentNotifications.every((n: any) => n.read) || recentNotifications.length === 0}
            >
              <ListItemIcon>
                <MarkReadIcon fontSize="small" />
              </ListItemIcon>
              Mark all as read
            </MenuItem>
            <MenuItem
              onClick={() => {
                router.push("/dashboard/notifications");
                handleNotificationsClose();
              }}
            >
              View all notifications
            </MenuItem>
          </Menu>
          <Tooltip title="Account settings">
            <IconButton onClick={handleProfileMenuOpen} size="small" sx={{ ml: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                {profile?.full_name?.[0] || user?.email?.[0]}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={profileAnchorEl}
            open={Boolean(profileAnchorEl)}
            onClose={handleProfileMenuClose}
            MenuListProps={{ "aria-labelledby": "profile-button" }}
            PaperProps={{
              elevation: 1,
              sx: { mt: 1.5 },
            }}
          >
            <MenuItem
              onClick={() => {
                router.push("/dashboard/profile");
                handleProfileMenuClose();
              }}
            >
              Profile
            </MenuItem>
            <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "none" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: "background.default",
          minHeight: "100vh",
        }}
      >
        <Paper
          elevation={2}
          sx={{ p: 2, mb: 3, backgroundColor: theme.palette.primary.light }}
        >
          <Typography variant="h5" sx={{ color: theme.palette.primary.contrastText }}>
            Dashboard
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.primary.contrastText }}>
            Welcome back, {profile?.full_name || user?.email}
          </Typography>
        </Paper>

        {children}
      </Box>
    </Box>
  );
}
