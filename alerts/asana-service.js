/**
 * asana-service.js
 * NJTC Portal — Asana Task Loader
 * Fetches task data from data/tasks.json (populated by GitHub Action)
 */

const NJTCAsana = (() => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';
  const DATA_URL = `${BASE}/data/tasks.json`;

  let _tasks = [];

  async function load() {
    try {
      const res = await fetch(DATA_URL + '?v=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      // Support both bare array and { tasks: [...] } envelope
      _tasks = Array.isArray(payload) ? payload : (payload.tasks || []);
      console.log(`[NJTC Asana] Loaded ${_tasks.length} tasks`);
      return _tasks;
    } catch (err) {
      console.warn('[NJTC Asana] Could not load tasks.json:', err.message);
      _tasks = [];
      return [];
    }
  }

  function getTasks() {
    return _tasks;
  }

  function getUpcoming(days = 7) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return _tasks.filter(t => {
      if (!t.due_on || t.completed) return false;
      const due = new Date(t.due_on);
      return due >= now && due <= cutoff;
    });
  }

  function getOverdue() {
    const now = new Date();
    return _tasks.filter(t => {
      if (!t.due_on || t.completed) return false;
      return new Date(t.due_on) < now;
    });
  }

  return { load, getTasks, getUpcoming, getOverdue };
})();
