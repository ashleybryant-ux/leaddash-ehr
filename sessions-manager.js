"use strict";

const crypto = require("crypto");
const sessions = new Map();

function createSession(data, ttlMs = 1000 * 60 * 60 * 2) {
  const sid = crypto.randomUUID();
  sessions.set(sid, { data, expiresAt: Date.now() + ttlMs });
  setTimeout(() => sessions.delete(sid), ttlMs).unref?.();
  return sid;
}

function getSession(sid) {
  const entry = sessions.get(sid);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    sessions.delete(sid);
    return null;
  }

  return entry.data;
}

function consumeSession(sid) {
  const data = getSession(sid);
  if (data) sessions.delete(sid);
  return data;
}

module.exports = { createSession, getSession, consumeSession };
