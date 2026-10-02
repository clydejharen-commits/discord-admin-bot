import { getDb } from './database.js';

const TRACKER_DOC_ID = 'active_tracker';

export async function getActiveTracker() {
  const db = getDb();
  return db.collection('trackers').findOne({ _id: TRACKER_DOC_ID });
}

export async function saveActiveTracker(tracker) {
  const db = getDb();
  await db.collection('trackers').updateOne(
    { _id: TRACKER_DOC_ID },
    { $set: { _id: TRACKER_DOC_ID, ...tracker } },
    { upsert: true }
  );
}

export async function clearActiveTracker() {
  const db = getDb();
  await db.collection('trackers').deleteOne({ _id: TRACKER_DOC_ID });
}

export async function getSettings() {
  const db = getDb();
  return db.collection('settings').findOne({ _id: 'bot_settings' });
}

export async function saveSettings(settings) {
  const db = getDb();
  await db.collection('settings').updateOne(
    { _id: 'bot_settings' },
    { $set: { _id: 'bot_settings', ...settings } },
    { upsert: true }
  );
}

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export async function getQuarantineSettings() {
  const db = getDb();
  return db.collection('settings').findOne({ _id: 'quarantine_settings' });
}

export async function saveQuarantineSettings(settings) {
  const db = getDb();
  await db.collection('settings').updateOne(
    { _id: 'quarantine_settings' },
    { $set: { _id: 'quarantine_settings', ...settings } },
    { upsert: true }
  );
}

export async function createQuarantineRecord(record) {
  const db = getDb();
  await db.collection('quarantines').insertOne(record);
}

export async function getActiveQuarantine(guildId, userId) {
  const db = getDb();
  return db.collection('quarantines').findOne({
    guildId,
    userId,
    active: true,
  });
}

export async function deactivateQuarantineRecord(guildId, userId) {
  const db = getDb();
  await db.collection('quarantines').updateOne(
    { guildId, userId, active: true },
    { $set: { active: false, unquarinedAt: Date.now() } }
  );
}
