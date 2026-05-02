"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Skeleton,
  Alert,
  Pagination,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import BusinessIcon from "@mui/icons-material/Business";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EventIcon from "@mui/icons-material/Event";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import Navbar from "@/components/Navbar";
import NotificationCard from "@/components/NotificationCard";
import {
  Notification,
  NotificationType,
  fetchNotifications,
  markAllAsRead,
} from "@/lib/notifications";
import { getLogger } from "@/lib/logger";

const logger = getLogger("page.all-notifications");
const PAGE_SIZE = 20;

export default function AllNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<NotificationType | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    logger.info("Loading all notifications", { page, typeFilter });
    try {
      const data = await fetchNotifications({
        limit: PAGE_SIZE,
        page,
        notification_type: typeFilter || undefined,
      });
      setNotifications(data);
      setTotal(data.length >= PAGE_SIZE ? page * PAGE_SIZE + 1 : page * PAGE_SIZE);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load notifications";
      logger.error("Failed to load notifications", { error: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    markAllAsRead(notifications.map((n) => n.id));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    logger.info("All notifications marked as read");
  };

  const handleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleTypeFilter = (_: React.MouseEvent<HTMLElement>, val: NotificationType | "") => {
    setTypeFilter(val ?? "");
    setPage(1);
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "#0a0e1a" }}>
      <Navbar
        unreadCount={unreadCount}
        onRefresh={loadNotifications}
      />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              background: "linear-gradient(135deg, #e8eaf6, #5c7cfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              mb: 1,
            }}
          >
            All Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Stay updated with the latest campus updates
          </Typography>
        </Box>

        {/* Filters + Actions */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 3,
            p: 2,
            background: "rgba(17,24,39,0.7)",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <ToggleButtonGroup
            value={typeFilter}
            exclusive
            onChange={handleTypeFilter}
            size="small"
            sx={{ "& .MuiToggleButton-root": { px: 1.5, py: 0.5, fontSize: "0.75rem" } }}
          >
            <ToggleButton value="">
              <AllInclusiveIcon fontSize="small" sx={{ mr: 0.5 }} /> All
            </ToggleButton>
            <ToggleButton value="Placement">
              <BusinessIcon fontSize="small" sx={{ mr: 0.5, color: "#51cf66" }} /> Placement
            </ToggleButton>
            <ToggleButton value="Result">
              <AssessmentIcon fontSize="small" sx={{ mr: 0.5, color: "#5c7cfa" }} /> Result
            </ToggleButton>
            <ToggleButton value="Event">
              <EventIcon fontSize="small" sx={{ mr: 0.5, color: "#ffd43b" }} /> Event
            </ToggleButton>
          </ToggleButtonGroup>

          {unreadCount > 0 && (
            <Tooltip title="Mark all visible as read">
              <Button
                startIcon={<DoneAllIcon />}
                size="small"
                variant="outlined"
                onClick={handleMarkAllRead}
                sx={{ fontSize: "0.75rem" }}
              >
                Mark all read
              </Button>
            </Tooltip>
          )}
        </Box>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* List */}
        <Stack spacing={1.5}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  height={76}
                  sx={{ bgcolor: "rgba(255,255,255,0.04)" }}
                />
              ))
            : notifications.length === 0
            ? (
              <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
                <Typography variant="h6">No notifications found</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Try changing the filter or refreshing.
                </Typography>
              </Box>
            )
            : notifications.map((n) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                />
              ))}
        </Stack>

        {/* Pagination */}
        {!loading && notifications.length >= PAGE_SIZE && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <Pagination
              count={Math.ceil(total / PAGE_SIZE)}
              page={page}
              onChange={(_, val) => setPage(val)}
              color="primary"
            />
          </Box>
        )}
      </Container>
    </Box>
  );
}
