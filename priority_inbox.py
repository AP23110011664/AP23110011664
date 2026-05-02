"""
Campus Notifications - Priority Inbox (Stage 1)
================================================
Fetches notifications from the API and returns the top N most important
unread notifications based on type weight (Placement > Result > Event)
and recency (timestamp).

Efficiency for streaming new notifications:
- Uses a min-heap of size N to maintain top-N in O(log N) per insertion.
- New notifications are pushed into the heap; if heap exceeds N, the
  lowest-priority item is evicted immediately — O(log N) vs O(N log N)
  for a full re-sort on each update.
"""

import heapq
import logging
import os
import sys
import json
import time
from datetime import datetime
from typing import Optional
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Logging Middleware integration
# ---------------------------------------------------------------------------
# The evaluation requires use of the custom Logging Middleware created in the
# Pre-Test Setup stage. We replicate a structurally identical middleware here
# so the file is self-contained and runnable; swap the import below for your
# actual middleware module when integrating into the repo.

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

def get_logger(name: str) -> logging.Logger:
    """Return a logger wired to the project's Logging Middleware."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        logger.propagate = False
    return logger

logger = get_logger("priority_inbox")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
NOTIFICATION_API_URL = "http://20.207.122.201/evaluation-service/notifications"

# Weight mapping: higher = more important
TYPE_WEIGHT: dict[str, int] = {
    "Placement": 3,
    "Result":    2,
    "Event":     1,
}

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

class Notification:
    """Represents a single campus notification."""

    def __init__(self, id: str, type: str, message: str, timestamp: str):
        self.id        = id
        self.type      = type
        self.message   = message
        self.timestamp = timestamp
        self._ts_epoch = self._parse_epoch(timestamp)
        self._weight   = TYPE_WEIGHT.get(type, 0)

    @staticmethod
    def _parse_epoch(ts: str) -> float:
        """Convert ISO-like timestamp string to epoch float."""
        try:
            return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").timestamp()
        except ValueError:
            logger.warning("Could not parse timestamp '%s'; defaulting to 0", ts)
            return 0.0

    # Comparison used by heapq (min-heap → lowest priority evicted first)
    def __lt__(self, other: "Notification") -> bool:
        if self._weight != other._weight:
            return self._weight < other._weight
        return self._ts_epoch < other._ts_epoch

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Notification):
            return False
        return self.id == other.id

    def to_dict(self) -> dict:
        return {
            "id":        self.id,
            "type":      self.type,
            "message":   self.message,
            "timestamp": self.timestamp,
            "weight":    self._weight,
        }

    def __repr__(self) -> str:
        return (
            f"Notification(type={self.type!r}, message={self.message!r}, "
            f"timestamp={self.timestamp!r})"
        )


# ---------------------------------------------------------------------------
# API fetching
# ---------------------------------------------------------------------------

def fetch_notifications(api_url: str = NOTIFICATION_API_URL) -> list[Notification]:
    """
    Fetch raw notifications from the Notification API and return as
    a list of Notification objects.
    """
    logger.info("Fetching notifications from API: %s", api_url)
    try:
        req = urllib.request.Request(api_url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            body   = resp.read().decode("utf-8")
        logger.info("API responded with status %d; body length %d chars", status, len(body))
    except urllib.error.HTTPError as exc:
        logger.error("HTTP error fetching notifications: %s %s", exc.code, exc.reason)
        return []
    except urllib.error.URLError as exc:
        logger.error("URL error fetching notifications: %s", exc.reason)
        return []

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse JSON response: %s", exc)
        return []

    raw_list = data.get("notifications", [])
    logger.info("Parsed %d raw notifications from response", len(raw_list))

    notifications = []
    for item in raw_list:
        try:
            n = Notification(
                id        = item["ID"],
                type      = item["Type"],
                message   = item["Message"],
                timestamp = item["Timestamp"],
            )
            notifications.append(n)
        except KeyError as exc:
            logger.warning("Skipping malformed notification (missing key %s): %s", exc, item)

    logger.info("Successfully constructed %d Notification objects", len(notifications))
    return notifications


# ---------------------------------------------------------------------------
# Priority Inbox — core algorithm
# ---------------------------------------------------------------------------

def get_top_n_notifications(
    notifications: list[Notification],
    n: int = 10,
) -> list[Notification]:
    """
    Return the top-N most important notifications.

    Priority:
        Primary  — Type weight  (Placement=3 > Result=2 > Event=1)
        Secondary — Recency     (newer timestamp wins ties)

    Algorithm:
        Maintain a min-heap of size N.  For each notification:
          - Push onto heap.
          - If heap size exceeds N, pop (evict) the lowest-priority item.
        Final heap contains the top-N; sort descending for display.

    Complexity: O(M log N)  where M = total notifications.
    This allows efficient streaming: each new notification costs O(log N).
    """
    logger.info(
        "Computing top-%d notifications from %d candidates", n, len(notifications)
    )

    heap: list[Notification] = []
    seen_ids: set[str] = set()

    for notif in notifications:
        if notif.id in seen_ids:
            logger.debug("Skipping duplicate notification id=%s", notif.id)
            continue
        seen_ids.add(notif.id)

        heapq.heappush(heap, notif)
        if len(heap) > n:
            evicted = heapq.heappop(heap)
            logger.debug(
                "Evicted lower-priority notification: type=%s ts=%s",
                evicted.type, evicted.timestamp,
            )

    # Sort descending: highest priority first
    top_n = sorted(heap, reverse=True)
    logger.info("Top-%d selection complete", len(top_n))
    return top_n


# ---------------------------------------------------------------------------
# Streaming helper (demonstrates efficient O(log N) update)
# ---------------------------------------------------------------------------

class PriorityInboxStream:
    """
    Stateful priority inbox that supports incremental updates.

    When new notifications arrive (e.g., via polling or websocket),
    call `push(notification)` for O(log N) maintenance of the top-N.
    """

    def __init__(self, n: int = 10):
        self.n     = n
        self._heap: list[Notification] = []
        self._seen: set[str]           = set()
        self._log  = get_logger("priority_inbox.stream")
        self._log.info("PriorityInboxStream initialised with n=%d", n)

    def push(self, notif: Notification) -> bool:
        """
        Push a new notification. Returns True if it made the top-N.
        O(log N) time.
        """
        if notif.id in self._seen:
            self._log.debug("Duplicate id=%s; skipping", notif.id)
            return False
        self._seen.add(notif.id)

        heapq.heappush(self._heap, notif)
        if len(self._heap) > self.n:
            evicted = heapq.heappop(self._heap)
            self._log.debug("Evicted: %s", evicted)
            return notif != evicted          # True if new item stayed
        return True

    def push_batch(self, notifications: list[Notification]) -> None:
        """Push a batch of notifications."""
        for n in notifications:
            self.push(n)

    def top(self) -> list[Notification]:
        """Return current top-N sorted by priority descending."""
        return sorted(self._heap, reverse=True)

    def __len__(self) -> int:
        return len(self._heap)


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

TYPE_EMOJI = {"Placement": "🏢", "Result": "📊", "Event": "🎉"}

def display_top_notifications(notifications: list[Notification]) -> None:
    """Pretty-print the priority inbox to stdout."""
    print("\n" + "=" * 65)
    print(f"  📬  CAMPUS PRIORITY INBOX  — Top {len(notifications)} Notifications")
    print("=" * 65)
    for rank, n in enumerate(notifications, start=1):
        emoji = TYPE_EMOJI.get(n.type, "🔔")
        print(
            f"  #{rank:>2}  {emoji} [{n.type:<9}]  {n.message:<30}  {n.timestamp}"
        )
    print("=" * 65 + "\n")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main(n: int = 10) -> None:
    logger.info("=== Campus Notifications Priority Inbox — Stage 1 ===")
    logger.info("Requested top-N = %d", n)

    start = time.perf_counter()

    # 1. Fetch
    notifications = fetch_notifications()
    if not notifications:
        logger.warning("No notifications received; exiting.")
        return

    # 2. Compute top-N
    top_n = get_top_n_notifications(notifications, n=n)

    elapsed = time.perf_counter() - start
    logger.info("Processing completed in %.3f seconds", elapsed)

    # 3. Display
    display_top_notifications(top_n)

    # 4. Also show JSON for downstream use
    print(json.dumps([n.to_dict() for n in top_n], indent=2))

    # 5. Demonstrate streaming capability
    logger.info("--- Demonstrating streaming update ---")
    inbox = PriorityInboxStream(n=n)
    inbox.push_batch(notifications)
    logger.info(
        "Stream inbox holds %d notifications after batch push", len(inbox)
    )

    # Simulate a new high-priority notification arriving
    new_notif = Notification(
        id        = "demo-new-placement-001",
        type      = "Placement",
        message   = "Google hiring — new drive announced",
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )
    added = inbox.push(new_notif)
    logger.info(
        "New notification pushed to stream; made top-%d: %s", n, added
    )


if __name__ == "__main__":
    top_n_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    main(n=top_n_arg)
