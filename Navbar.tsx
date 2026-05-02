"use client";

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Badge,
  Tooltip,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import StarIcon from "@mui/icons-material/Star";
import RefreshIcon from "@mui/icons-material/Refresh";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  unreadCount?: number;
  onRefresh?: () => void;
}

export default function Navbar({ unreadCount = 0, onRefresh }: NavbarProps) {
  const pathname = usePathname();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: "rgba(10, 14, 26, 0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(92, 124, 250, 0.2)",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 3 }}>
          <NotificationsIcon sx={{ color: "#5c7cfa", fontSize: 28 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              background: "linear-gradient(135deg, #5c7cfa, #f783ac)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.5px",
            }}
          >
            CampusNotify
          </Typography>
        </Box>

        {/* Nav Links */}
        <Button
          component={Link}
          href="/"
          startIcon={<NotificationsIcon />}
          variant={pathname === "/" ? "contained" : "text"}
          sx={{ mr: 1 }}
        >
          All Notifications
        </Button>
        <Button
          component={Link}
          href="/priority"
          startIcon={<StarIcon />}
          variant={pathname === "/priority" ? "contained" : "text"}
          color={pathname === "/priority" ? "primary" : "inherit"}
        >
          Priority Inbox
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <Typography
            variant="caption"
            sx={{
              background: "rgba(92,124,250,0.15)",
              border: "1px solid rgba(92,124,250,0.4)",
              borderRadius: "20px",
              px: 1.5,
              py: 0.5,
              color: "#5c7cfa",
              fontWeight: 600,
            }}
          >
            {unreadCount} unread
          </Typography>
        )}

        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh} sx={{ color: "text.secondary" }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
