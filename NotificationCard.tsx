"use client";

import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EventIcon from "@mui/icons-material/Event";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { Notification, NotificationType, markAsRead } from "@/lib/notifications";

const TYPE_CONFIG: Record<
  NotificationType,
  { color: string; bgColor: string; icon: React.ReactNode; label: string }
> = {
  Placement: {
    color: "#51cf66",
    bgColor: "rgba(81, 207, 102, 0.12)",
    icon: <BusinessIcon fontSize="small" />,
    label: "Placement",
  },
  Result: {
    color: "#5c7cfa",
    bgColor: "rgba(92, 124, 250, 0.12)",
    icon: <AssessmentIcon fontSize="small" />,
    label: "Result",
  },
  Event: {
    color: "#ffd43b",
    bgColor: "rgba(255, 212, 59, 0.12)",
    icon: <EventIcon fontSize="small" />,
    label: "Event",
  },
};

interface NotificationCardProps {
  notification: Notification;
  rank?: number;
  onRead?: (id: string) => void;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts.replace(" ", "T"));
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function NotificationCard({
  notification,
  rank,
  onRead,
}: NotificationCardProps) {
  const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.Event;

  const handleMarkRead = () => {
    markAsRead(notification.id);
    onRead?.(notification.id);
  };

  return (
    <Card
      sx={{
        position: "relative",
        background: notification.isRead
          ? "rgba(17, 24, 39, 0.5)"
          : "rgba(17, 24, 39, 0.95)",
        border: notification.isRead
          ? "1px solid rgba(255,255,255,0.04)"
          : `1px solid ${cfg.color}30`,
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: `${cfg.color}60`,
          transform: "translateY(-1px)",
          boxShadow: `0 4px 20px ${cfg.color}15`,
        },
        opacity: notification.isRead ? 0.65 : 1,
      }}
    >
      {/* Unread indicator */}
      {!notification.isRead && (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: cfg.color,
            borderRadius: "12px 0 0 12px",
          }}
        />
      )}

      <CardContent sx={{ pl: notification.isRead ? 2 : 2.5, pr: 1.5, py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          {/* Rank badge */}
          {rank !== undefined && (
            <Box
              sx={{
                minWidth: 32,
                height: 32,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${cfg.color}33, ${cfg.color}11)`,
                border: `1px solid ${cfg.color}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mt: 0.25,
              }}
            >
              <Typography
                sx={{ fontSize: "0.7rem", fontWeight: 700, color: cfg.color }}
              >
                #{rank}
              </Typography>
            </Box>
          )}

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
              <Chip
                icon={cfg.icon as React.ReactElement}
                label={cfg.label}
                size="small"
                sx={{
                  background: cfg.bgColor,
                  color: cfg.color,
                  border: `1px solid ${cfg.color}33`,
                  "& .MuiChip-icon": { color: cfg.color },
                  height: 22,
                  fontSize: "0.7rem",
                }}
              />
              {!notification.isRead && (
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: cfg.color,
                    boxShadow: `0 0 6px ${cfg.color}`,
                  }}
                />
              )}
            </Box>

            <Typography
              variant="body2"
              sx={{
                fontWeight: notification.isRead ? 400 : 600,
                color: notification.isRead ? "text.secondary" : "text.primary",
                wordBreak: "break-word",
                mb: 0.5,
                fontSize: "0.875rem",
              }}
            >
              {notification.message}
            </Typography>

            <Typography
              variant="caption"
              sx={{ color: "text.disabled", fontSize: "0.7rem" }}
            >
              {formatTimestamp(notification.timestamp)}
            </Typography>
          </Box>

          {/* Actions */}
          {!notification.isRead && (
            <Tooltip title="Mark as read">
              <IconButton
                size="small"
                onClick={handleMarkRead}
                sx={{ color: "text.disabled", "&:hover": { color: cfg.color } }}
              >
                <MarkEmailReadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
