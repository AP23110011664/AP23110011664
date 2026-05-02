# Notification System Design

## Stage 1

### Problem Statement

The campus notification platform receives a high volume of notifications across three types — **Placement**, **Result**, and **Event**. Users lose track of important notifications because of sheer volume. We need a **Priority Inbox** that always surfaces the top *N* most important *unread* notifications.

---

### Priority Model

Priority is determined by two factors, in order:

| Factor | Rule |
|--------|------|
| **Type Weight** | Placement (3) > Result (2) > Event (1) |
| **Recency** | Newer timestamp wins when weights are equal |

This mirrors real-world importance: a job opportunity outweighs an exam result, which outweighs a social event. Within the same type, the most recent notification is surfaced first.

---

### Algorithm: Fixed-Size Min-Heap

#### Why a heap?

A naïve approach — fetch all notifications, sort by priority, take the first N — costs **O(M log M)** and must re-sort the entire list every time a new notification arrives.

Instead we maintain a **min-heap of size N**:

```
for each notification:
    heappush(heap, notification)
    if len(heap) > N:
        heappop(heap)   # evict the LOWEST priority item
```

The heap's root is always the weakest item in the current top-N. When a new notification arrives:
- If it's stronger than the root → it displaces the root → O(log N)
- If it's weaker → it is immediately evicted → O(log N)

#### Complexity

| Operation | Cost |
|-----------|------|
| Initial load of M notifications | O(M log N) |
| Each new streaming notification | **O(log N)** |
| Final sorted display | O(N log N) |

For M = 10,000 notifications and N = 10, this is ~10× faster than full re-sort and scales effortlessly to millions of notifications.

---

### Handling Streaming / New Notifications

The `PriorityInboxStream` class provides a stateful, incremental interface:

```python
inbox = PriorityInboxStream(n=10)
inbox.push_batch(existing_notifications)   # O(M log N)

# When a new notification arrives (e.g., via WebSocket/polling):
inbox.push(new_notification)               # O(log N)

top_10 = inbox.top()                       # O(N log N) for display
```

- **Deduplication** is handled via a `seen_ids` set — O(1) lookup.
- **No database required** for Stage 1: all state is in-memory.
- For production, the heap state can be persisted to Redis (sorted set) for cross-process sharing and crash recovery.

---

### Data Flow

```
Notification API (GET)
        │
        ▼
  fetch_notifications()
        │  parses JSON → list[Notification]
        ▼
get_top_n_notifications(notifications, n=10)
        │  min-heap maintenance
        ▼
  sorted top-N list (descending priority)
        │
        ▼
  display_top_notifications()  +  JSON output
```

---

### Logging

All operations are instrumented via the project's **Logging Middleware** (`get_logger`). Log lines include:

- API fetch URL, response status, body length
- Number of parsed notifications
- Each heap eviction (DEBUG level)
- Processing time (perf_counter)
- Streaming push results

Standard `console.log` / `print` logging is **not** used anywhere in the pipeline.

---

### Running

```bash
# Default: top 10
python stage1/priority_inbox.py

# Custom N (e.g., top 15)
python stage1/priority_inbox.py 15
```

Set `LOG_LEVEL=DEBUG` for verbose heap eviction logs.

---

### Future Enhancements (Stage 2+)

- Persist read/unread state per user in a lightweight store (Redis / SQLite).
- Replace polling with WebSocket push from the notification service.
- Expose the priority engine as a REST microservice (`GET /priority-inbox?n=10`).
- Add per-user weight customisation (some users may prioritise Events over Results).
