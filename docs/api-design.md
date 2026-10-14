# QuickNotes API Design

This is the **real** API the backend team should build (not JSONPlaceholder). It follows REST: resources are nouns in the URL (`/notes`, `/tags`), the HTTP method says the action, and responses use JSON and standard status codes.

## Conventions

- Base URL: `https://api.quicknotes.com/v1`
- Format: JSON requests and responses (`Content-Type: application/json`)
- Authentication: after login, send `Authorization: Bearer <token>` on every request except register and login. The server is stateless, so any app server can verify the token.
- Users can only see and change their own notes.
- Lists are paginated with `?page=1&limit=20` (default 20, maximum 100).

## Endpoints

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | POST | `/auth/register` | Create a new user account | 201 Created |
| 2 | POST | `/auth/login` | Log in and receive an access token | 200 OK |
| 3 | GET | `/notes` | List the current user's notes (newest first; optional `?tag=work`, `?page`, `?limit`) | 200 OK |
| 4 | POST | `/notes` | Create a new note | 201 Created |
| 5 | GET | `/notes/{id}` | Get one note | 200 OK |
| 6 | PUT | `/notes/{id}` | Replace a note's title, body and tags | 200 OK |
| 7 | DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| 8 | GET | `/tags` | List the current user's tags | 200 OK |
| 9 | POST | `/notes/{id}/tags` | Attach a tag to a note | 201 Created |
| 10 | DELETE | `/notes/{id}/tags/{tagId}` | Remove a tag from a note | 204 No Content |

## Example: create a note

`POST /notes`

Request body:

```json
{
  "title": "Buy milk",
  "body": "Two litres, full cream",
  "tags": ["shopping", "home"]
}
```

Response: `201 Created`, with a `Location: /v1/notes/42` header.

```json
{
  "id": 42,
  "title": "Buy milk",
  "body": "Two litres, full cream",
  "tags": ["shopping", "home"],
  "userId": 7,
  "createdAt": "2026-10-13T08:30:00Z",
  "updatedAt": "2026-10-13T08:30:00Z"
}
```

## Example: list notes

`GET /notes?page=1&limit=2`

Response: `200 OK`

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy milk",
      "body": "Two litres, full cream",
      "tags": ["shopping", "home"],
      "createdAt": "2026-10-13T08:30:00Z"
    },
    {
      "id": 41,
      "title": "Call the bank",
      "body": "",
      "tags": [],
      "createdAt": "2026-10-12T15:10:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 57
}
```

## Error status codes

| Status | Meaning | When it happens |
|--------|---------|-----------------|
| 400 Bad Request | Invalid input | Missing title, title longer than 100 characters, malformed JSON |
| 401 Unauthorized | Not logged in | Token missing, expired or invalid; wrong password at login |
| 403 Forbidden | Logged in but not allowed | Trying to read, change or delete another user's note |
| 404 Not Found | Resource does not exist | Note or tag id not found |
| 409 Conflict | Clashes with existing data | Registering an email that is already used |
| 429 Too Many Requests | Rate limit exceeded | More than 100 requests per minute from one user or IP |
| 500 Internal Server Error | Server bug or failure | Unexpected error; details are logged, not shown to the user |

All errors use one consistent body. Example for `400 Bad Request`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be at most 100 characters.",
    "details": [
      { "field": "title", "problem": "must be between 1 and 100 characters" }
    ]
  }
}
```

Example for `404 Not Found`:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Note 999 was not found."
  }
}
```
