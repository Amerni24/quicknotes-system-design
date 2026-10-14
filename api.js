"use strict";

// ---------- Configuration ----------
const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

// ---------- Page elements ----------
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const form = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");
const notesList = document.getElementById("notes-list");

// ---------- Reusable request helper ----------
// Calls fetch, checks response.ok and throws on errors so that every caller
// can handle failures with one try / catch.
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error("Request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }

  // Some responses may have an empty body, so read text first and parse only if present.
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data };
}

// ---------- UI helpers ----------
// type is one of: "info", "loading", "success", "error"
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = "status " + type;
}

// Disables the buttons while a request is running to prevent double clicks.
function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
}

function friendlyError(error) {
  if (error.status) {
    return "Sorry, the server could not complete that request (status " + error.status + "). Please try again.";
  }
  return "Could not reach the server. Check your internet connection and try again.";
}

function showEmptyState() {
  const li = document.createElement("li");
  li.className = "empty-state";
  li.textContent = "No notes to show.";
  notesList.appendChild(li);
}

function removeEmptyState() {
  const empty = notesList.querySelector(".empty-state");
  if (empty) empty.remove();
}

// User text is always inserted with textContent, never innerHTML.
function createNoteItem(note) {
  const li = document.createElement("li");
  li.className = "note";

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body || "(no body)";

  li.append(title, body);
  return li;
}

function renderNotes(notes) {
  notesList.replaceChildren();
  if (notes.length === 0) {
    showEmptyState();
    return;
  }
  notes.forEach(function (note) {
    notesList.appendChild(createNoteItem(note));
  });
}

// ---------- Validation ----------
function validateTitle(title) {
  if (title.length === 0) return "Please enter a title.";
  if (title.length > MAX_TITLE_LENGTH) {
    return "The title is too long (" + title.length + " characters). The maximum is " + MAX_TITLE_LENGTH + ".";
  }
  return null;
}

// ---------- GET: load 10 notes ----------
async function loadNotes() {
  setBusy(true);
  setStatus("Loading notes...", "loading");
  try {
    const result = await request(API_URL + "?_limit=10");
    const notes = Array.isArray(result.data) ? result.data : [];
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus("The server returned no notes.", "info");
    } else {
      setStatus("Loaded " + notes.length + " notes from the server.", "success");
    }
  } catch (error) {
    console.error(error);
    setStatus(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

// ---------- POST: create a note ----------
async function createNote(title, body) {
  setBusy(true);
  setStatus("Saving note...", "loading");
  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ title: title, body: body, userId: 1 })
    });
    const note = result.data;
    removeEmptyState();
    notesList.prepend(createNoteItem(note));
    setStatus("Note created (status " + result.status + ", id " + note.id + ").", "success");
    form.reset();
  } catch (error) {
    console.error(error);
    setStatus(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

// ---------- Events ----------
loadBtn.addEventListener("click", loadNotes);

form.addEventListener("submit", function (event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const problem = validateTitle(title);
  if (problem) {
    setStatus(problem, "error");
    titleInput.focus();
    return;
  }
  createNote(title, body);
});

setStatus('Click "Load notes" to get started.', "info");
