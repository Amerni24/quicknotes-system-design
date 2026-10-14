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

  // DELETE may return an empty body, so read text first and parse only if present.
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

// Disables every button while a request is running to prevent double clicks.
function setBusy(isBusy) {
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
  document.querySelectorAll(".delete-btn").forEach(function (btn) {
    btn.disabled = isBusy;
  });
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

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", function () {
    deleteNote(note, li);
  });

  li.append(title, body, deleteBtn);
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
    // local: true marks a note that only exists in this page (see deleteNote).
    const note = Object.assign({}, result.data, { local: true });
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

// ---------- DELETE: remove a note ----------
// JSONPlaceholder is a fake API: it accepts POST requests but does NOT store
// the new note, so a note we "created" (always id 101) does not exist on the
// server. Deleting it may therefore return 404 even though nothing went wrong.
// Approach: we still send the DELETE request for every note, but if a note we
// created in this page gets a 404, we treat that as success because the goal
// (the note is gone) is already true. Any other error keeps the note in the
// list and shows an error message. We remove the exact list item (not by id),
// because every created note receives the same id 101.
async function deleteNote(note, li) {
  setBusy(true);
  setStatus("Deleting note...", "loading");
  try {
    let message;
    try {
      const result = await request(API_URL + "/" + note.id, { method: "DELETE" });
      message = "Note deleted (status " + result.status + ").";
    } catch (error) {
      if (note.local && error.status === 404) {
        message = "Note removed. It only existed in this page, so the practice server had nothing to delete.";
      } else {
        throw error;
      }
    }
    li.remove();
    if (notesList.children.length === 0) showEmptyState();
    setStatus(message, "success");
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
