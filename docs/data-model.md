# QuickNotes Data Model

## Entities

### users
| Column | Type | Key / constraint |
|--------|------|------------------|
| id | BIGINT (auto-increment) | **Primary key** |
| email | VARCHAR(255) | Unique, not null |
| password_hash | VARCHAR(255) | Not null (never store plain passwords) |
| display_name | VARCHAR(100) | Not null |
| created_at | TIMESTAMP | Not null, default now |

### notes
| Column | Type | Key / constraint |
|--------|------|------------------|
| id | BIGINT (auto-increment) | **Primary key** |
| user_id | BIGINT | **Foreign key** to users(id), not null |
| title | VARCHAR(100) | Not null |
| body | TEXT | Optional |
| created_at | TIMESTAMP | Not null, default now |
| updated_at | TIMESTAMP | Not null, default now |

### tags
| Column | Type | Key / constraint |
|--------|------|------------------|
| id | BIGINT (auto-increment) | **Primary key** |
| user_id | BIGINT | **Foreign key** to users(id), not null |
| name | VARCHAR(50) | Not null; unique per user |

### note_tags (join table)
| Column | Type | Key / constraint |
|--------|------|------------------|
| note_id | BIGINT | **Foreign key** to notes(id); part of the composite primary key |
| tag_id | BIGINT | **Foreign key** to tags(id); part of the composite primary key |

Primary key of `note_tags`: (`note_id`, `tag_id`), so the same tag cannot be attached to the same note twice.

## Relationships

- **One-to-many: users to notes.** One user has many notes, but each note belongs to exactly one user. This is the foreign key `notes.user_id`.
- **One-to-many: users to tags.** One user owns many tags; each tag belongs to one user (`tags.user_id`).
- **Many-to-many: notes to tags.** A note can have many tags (shopping, home), and a tag can be on many notes. A relational database cannot store this directly, so the join table `note_tags` holds one row per note-tag pair. Each row is the "many" side of two one-to-many relationships.

```text
users 1 ────< notes >────< note_tags >────< tags >──── 1 users
        (one-to-many)       (many-to-many via join table)
```

## CREATE TABLE statements (PostgreSQL)

```sql
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notes (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(100) NOT NULL,
  body       TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
  id      BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    VARCHAR(50) NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  BIGINT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
```

## Example queries

**1. List a user's 20 newest notes (powers `GET /notes`):**

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 7
ORDER BY created_at DESC
LIMIT 20;
```

**2. Notes with a given tag, using a JOIN (powers `GET /notes?tag=shopping`):**

```sql
SELECT n.id, n.title, n.created_at
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 7 AND t.name = 'shopping'
ORDER BY n.created_at DESC;
```

**3. How many notes each tag has (JOIN with GROUP BY):**

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 7
GROUP BY t.name
ORDER BY note_count DESC;
```

**4. Rename a note (powers `PUT /notes/{id}`):**

```sql
UPDATE notes
SET title = 'Buy oat milk', updated_at = NOW()
WHERE id = 42 AND user_id = 7;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag ON note_tags (tag_id);
```

- `idx_notes_user_created`: the most common request is "this user's newest notes". Without the index the database would scan all notes (millions of rows at scale); with it, it jumps straight to the user's rows already sorted by date.
- `idx_note_tags_tag`: the primary key already covers lookups by note; this index speeds up "all notes with this tag".

## SQL or NoSQL?

I chose **SQL (PostgreSQL)**. QuickNotes data is clearly structured and relational: users own notes, and notes and tags have a many-to-many relationship that needs JOINs. Foreign keys and constraints protect correctness (no note without an owner, no duplicate tags), and transactions keep multi-step changes such as creating a note and attaching its tags consistent. The load estimate (about 10 writes per second and 180 GB per year at 1 million users) fits comfortably in one primary database with read replicas, so we do not need NoSQL's easy horizontal scaling. NoSQL would be worth revisiting only if the data became unstructured or grew far beyond what one primary can handle.
