"use strict";

// ---------- Configuration ----------
const API_URL = "https://jsonplaceholder.typicode.com/posts";

// ---------- Page elements ----------
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
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

// Disables the button while a request is running to prevent double clicks.
function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
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

// ---------- Events ----------
loadBtn.addEventListener("click", loadNotes);

setStatus('Click "Load notes" to get started.', "info");
