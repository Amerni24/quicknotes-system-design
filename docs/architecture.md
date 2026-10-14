# QuickNotes Architecture

## Requirements

### Functional requirements
- Users can register and log in.
- Users can create, read, update and delete their own notes.
- Users can organise notes with tags and filter by tag.
- Notes created on one device appear on all of the user's devices.
- Background jobs send welcome emails and create note exports.

### Non-functional requirements
- **Scale:** support 1,000,000 registered users.
- **Low latency:** `GET /notes` under 200 ms for 95% of requests.
- **Availability:** about 99.9% uptime, with no single point of failure.
- **Durability:** a saved note is never lost.
- **Security:** HTTPS everywhere, hashed passwords, users see only their own notes.
- **Consistency:** a note list that is a second or two out of date is acceptable (eventual consistency).

## Load estimate for 1 million users

Assumptions: 1,000,000 registered users; 20% active daily (200,000 DAU); each active user creates 5 notes and loads their notes 20 times per day; an average note is about 500 bytes; 1 day is about 100,000 seconds; peak traffic is 5x the average.

```text
Writes:   200,000 x 5      = 1,000,000 per day  ->  1,000,000 / 100,000 = 10 writes/s   (peak about 50/s)
Reads:    200,000 x 20     = 4,000,000 per day  ->  4,000,000 / 100,000 = 40 reads/s    (peak about 200/s)
Storage:  1,000,000 x 500 B = 500 MB per day    ->  500 MB x 365       = about 180 GB per year
```

**Conclusion:** the system is **read-heavy** (4 reads per write), so caching and read replicas pay off. About 200 requests per second at peak is manageable for a few ordinary servers, and 180 GB per year fits in one well-configured database. We do not need sharding or microservices yet.

## Architecture diagram

```text
                         ┌─────────┐
          ┌─────────────>│   DNS   │  (quicknotes.com -> IP addresses)
          │              └─────────┘
 ┌────────┴──────┐  static files  ┌──────────────────────┐
 │ Browser /     │ ─────────────> │ CDN (HTML, CSS, JS)  │
 │ mobile client │                └──────────────────────┘
 └────────┬──────┘
          │ API calls (HTTPS, JSON)
          v
   ┌───────────────┐
   │ Load balancer │
   └──────┬────────┘
     ┌────┴─────┬──────────┐
     v          v          v
 ┌───────┐  ┌───────┐  ┌───────┐        ┌──────────────┐
 │ App 1 │  │ App 2 │  │ App 3 │ ─────> │ Cache (Redis)│
 └───┬───┘  └───┬───┘  └───┬───┘        └──────────────┘
     │ writes   │ reads    │ jobs
     v          v          v
 ┌─────────┐ ┌──────────┐ ┌───────┐   ┌────────┐
 │ Primary │>│ Read     │ │ Queue │──>│ Worker │ (emails, exports)
 │   DB    │ │ replica  │ └───────┘   └────────┘
 └─────────┘ └──────────┘

Load: 1M users | 10 writes/s (50 peak) | 40 reads/s (200 peak) | about 180 GB/year
```

## What each component does

- **Client (browser / mobile app):** shows the notes and talks to the API over HTTPS.
- **DNS:** turns quicknotes.com into the IP addresses of the CDN and load balancer so users can find the service.
- **CDN:** serves the HTML, CSS and JavaScript from an edge server near the user, cutting latency (for example for users in Nairobi) and taking load off our servers.
- **Load balancer:** spreads API requests across the app servers and stops sending traffic to any server that fails its health check.
- **App servers (2 or more, stateless):** run the API logic, and because they keep no user data in memory, we can add or remove servers freely to handle more load.
- **Cache (Redis):** keeps each user's note list in memory so most reads are answered in about 1 ms without touching the database.
- **Primary database:** holds the one true copy of the data and is the only component that accepts writes.
- **Read replica:** copies the primary and answers read queries, taking read load off the primary and serving as a failover candidate.
- **Message queue:** holds slow jobs so the app can reply to the user immediately, and absorbs bursts instead of being overloaded.
- **Worker:** takes jobs from the queue and does the slow work (welcome emails, exports) in the background.

## Request flows

### GET /notes (read)

1. The client sends `GET /notes` with its token to the load balancer.
2. The load balancer picks the least busy healthy app server (about 1 ms).
3. The app server verifies the token and identifies the user (1-2 ms).
4. It looks for `notes:user:1` in Redis.
5. **Cache hit:** the notes come back in about 1 ms and the server responds `200 OK` (under 10 ms in total).
6. **Cache miss:** the server queries a read replica (about 5-20 ms with the index), stores the result in Redis with a TTL (for example 5 minutes), and responds `200 OK`. The next request will be a hit.

### POST /notes (write)

1. The client sends `POST /notes` with the note JSON to the load balancer.
2. The load balancer forwards it to any healthy app server.
3. The app server verifies the token and validates the data (title required, maximum 100 characters). Invalid data gets `400 Bad Request`.
4. It writes the note to the **primary** database (about 5-10 ms), because only the primary accepts writes.
5. It deletes `notes:user:1` from Redis so that stale notes are never served.
6. It responds `201 Created` with the new note.
7. Within a few milliseconds the primary copies the new row to the read replica.
8. If a background job is needed (for example an export), the server adds it to the queue and a worker processes it later.

## Trade-offs

1. **Speed versus freshness.** Caching and read replicas make reads very fast, but data can be briefly stale (cache TTL and replication lag). For notes, a list that is one second old is acceptable, so this is a good choice; for a bank balance it would not be. We reduce staleness by deleting the user's cache entry on every write.
2. **Simplicity versus scalability.** One server would be much easier to build and run, but cannot survive failures or growth. We add a load balancer, cache, replica and queue, accepting more complexity, but we stop there: no sharding and no microservices, because 200 requests per second at peak does not need them. We keep a well-organised monolith.
3. **Cost versus reliability.** Extra app servers, replicas and regions improve uptime but cost more money. We choose 3 app servers and one replica as a balance, and can add more as traffic grows.

## Avoiding single points of failure

| Component | Risk | How we avoid the single point of failure |
|-----------|------|------------------------------------------|
| App servers | One crashes | Several identical, stateless servers; the load balancer's health checks route around a failed one and in-progress requests are retried on a healthy server |
| Load balancer | It fails | Use a managed or redundant pair of load balancers (for example a cloud load balancer) |
| Database primary | It fails | Replicas hold copies; a replica can be promoted to primary (failover); regular backups |
| Cache | It fails | The app falls back to the database (slower, but still working); Redis can run with a standby |
| Queue | It fails | Use a managed, replicated queue; unfinished jobs are retried |
| Static files | Origin down | The CDN keeps copies at many edge servers |

Rate limiting, timeouts, retries with back-off and graceful degradation (reading and writing notes still work even if exports or search are down) protect the system from overload and partial failure. Monitoring (logs, metrics such as latency, error rate and cache hit rate, and alerts) lets engineers react quickly.
