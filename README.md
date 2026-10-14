# QuickNotes System Design

QuickNotes is moving from a browser-only notes app to an online service for 1 million users. This repository has two halves: a small **API client** that proves the front end can talk to an API (using the JSONPlaceholder practice API), and **design documents** the backend team can build from.

## What is in this repository

| File | Purpose |
|------|---------|
| `index.html` | The page: Load button, status message, create form and notes list |
| `api.js` | The API client: `request()` helper plus GET, POST and DELETE |
| `style.css` | Basic styling, with distinct success and error messages |
| `docs/api-design.md` | The real QuickNotes REST API: endpoints, examples, error codes |
| `docs/data-model.md` | Tables, relationships, SQL, indexes and the SQL vs NoSQL decision |
| `docs/architecture.md` | Requirements, load estimate, diagram, request flows, trade-offs |

## How to run the API client

1. Download or clone this repository.
2. Open `index.html` in a web browser (double-click it). You need an internet connection because it calls `https://jsonplaceholder.typicode.com/posts`.
3. Optional: run a local server instead, from the project folder: `python -m http.server 8000`, then open `http://localhost:8000`.

What you can do:

- Click **Load notes** to fetch 10 notes (GET). You will see "Loading notes...", then "Loaded 10 notes from the server."
- Fill in the form and click **Add note** (POST). The title is required and limited to 100 characters.
- Click **Delete** on a note (DELETE) to remove it.

Note: JSONPlaceholder does not really save changes, so created notes disappear when you reload, and the approach to deleting them is explained in a comment in `api.js`.

## Design documents

- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)

## What I learned

- **Estimating before designing.** Rough numbers (about 10 writes and 40 reads per second, 180 GB per year) show whether we need 1 server or 1,000, and that the system is read-heavy, which is why caching and read replicas help.
- **Handling every state of a request.** Calling an API is not just `fetch`: a good client shows loading, success, error and empty states, checks `response.ok`, validates input, disables buttons during requests and uses `textContent` to stay safe.
- **Designing a clean REST API and data model.** Nouns in URLs, the right status codes, a consistent error body, and a join table to model the many-to-many relationship between notes and tags.
- **Every design choice is a trade-off.** Caches are fast but can be stale, more components scale further but are harder to run, and removing single points of failure costs money.
