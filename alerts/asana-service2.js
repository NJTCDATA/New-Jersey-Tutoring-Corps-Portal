/**
 * asana-service2.js
 * NJTC Portal — Asana Task Loader (Project 2)
 * Fetches task data from data/tasks2.json (populated by GitHub Action)
 */

const NJTCAsana2 = (() => {
  const BASE = '/New-Jersey-Tutoring-Corps-Portal';
  const DATA_URL = `${BASE}/data/tasks2.json`;

  let _tasks = [];

  async function load() {
    try {
      const res = await fetch(DATA_URL + '?v=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      _tasks = Array.isArray(payload) ? payload : (payload.tasks || []);
      console.log(`[NJTC Asana2] Loaded ${_tasks.length} tasks`);
      return _tasks;
    } catch (err) {
      console.warn('[NJTC Asana2] Could not load tasks2.json:', err.message);
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
