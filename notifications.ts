import { getLogger } from "./logger";

const logger = getLogger("notifications");

export type NotificationType = "Placement" | "Result" | "Event";

export interface RawNotification {
  ID: string;
  Type: NotificationType;
  Message: string;
  Timestamp: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: string;
  tsEpoch: number;
  weight: number;
  isRead: boolean;
}

export const TYPE_WEIGHT: Record<NotificationType, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

const API_BASE = "http://20.207.122.201/evaluation-service/notifications";

// ---------------------------------------------------------------------------
// Read state persisted to localStorage
// ---------------------------------------------------------------------------
const READ_KEY = "campus_read_ids";

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    logger.warn("Could not persist read IDs to localStorage");
  }
}

export function markAsRead(id: string): void {
  const ids = loadReadIds();
  ids.add(id);
  saveReadIds(ids);
  logger.info("Marked notification as read", { id });
}

export function markAllAsRead(ids: string[]): void {
  const readIds = loadReadIds();
  ids.forEach((id) => readIds.add(id));
  saveReadIds(readIds);
  logger.info("Marked all notifications as read", { count: ids.length });
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

function parseEpoch(ts: string): number {
  try {
    return new Date(ts.replace(" ", "T")).getTime();
  } catch {
    logger.warn("Could not parse timestamp", { ts });
    return 0;
  }
}

function rawToNotification(
  raw: RawNotification,
  readIds: Set<string>
): Notification {
  return {
    id: raw.ID,
    type: raw.Type,
    message: raw.Message,
    timestamp: raw.Timestamp,
    tsEpoch: parseEpoch(raw.Timestamp),
    weight: TYPE_WEIGHT[raw.Type] ?? 0,
    isRead: readIds.has(raw.ID),
  };
}

export interface FetchOptions {
  limit?: number;
  page?: number;
  notification_type?: NotificationType | "";
}

export async function fetchNotifications(
  opts: FetchOptions = {}
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.page) params.set("page", String(opts.page));
  if (opts.notification_type)
    params.set("notification_type", opts.notification_type);

  const url = `${API_BASE}${params.toString() ? "?" + params.toString() : ""}`;
  logger.info("Fetching notifications", { url });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    logger.error("API error fetching notifications", {
      status: res.status,
      statusText: res.statusText,
    });
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { notifications: RawNotification[] };
  const readIds = loadReadIds();
  const notifications = (data.notifications ?? []).map((r) =>
    rawToNotification(r, readIds)
  );

  logger.info("Fetched notifications successfully", {
    count: notifications.length,
  });
  return notifications;
}

// ---------------------------------------------------------------------------
// Priority Inbox — min-heap top-N
// ---------------------------------------------------------------------------

function compareNotifications(a: Notification, b: Notification): number {
  if (a.weight !== b.weight) return a.weight - b.weight; // min-heap: lower first
  return a.tsEpoch - b.tsEpoch;
}

export function getTopN(notifications: Notification[], n: number): Notification[] {
  logger.info("Computing priority top-N", {
    total: notifications.length,
    n,
  });

  const heap: Notification[] = [];

  const heapPush = (item: Notification) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (compareNotifications(heap[parent], heap[i]) <= 0) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };

  const heapPop = (): Notification => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < heap.length && compareNotifications(heap[l], heap[smallest]) < 0)
          smallest = l;
        if (r < heap.length && compareNotifications(heap[r], heap[smallest]) < 0)
          smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return top;
  };

  for (const notif of notifications) {
    heapPush(notif);
    if (heap.length > n) heapPop();
  }

  const result = [...heap].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.tsEpoch - a.tsEpoch;
  });

  logger.info("Priority top-N computed", { selected: result.length });
  return result;
}
