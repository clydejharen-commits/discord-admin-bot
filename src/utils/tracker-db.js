import { getDb } from './database.js';

const TRACKER_DOC_ID = 'active_tracker';

export async function getActiveTracker(guildId) {
  const db = getDb();
  const filter = guildId ? { guildId, active: true } : { _id: TRACKER_DOC_ID };
  return db.collection('trackers').findOne(filter);
}

export async function saveActiveTracker(tracker) {
  const db = getDb();
  const docId = tracker.guildId
    ? `${TRACKER_DOC_ID}_${tracker.guildId}`
    : TRACKER_DOC_ID;
  await db.collection('trackers').updateOne(
    { _id: docId },
    { $set: { _id: docId, ...tracker, active: true } },
    { upsert: true }
  );
}

export async function clearActiveTracker(guildId) {
  const db = getDb();
  if (guildId) {
    await db.collection('trackers').updateOne(
      { guildId, active: true },
      { $set: { active: false, stoppedAt: Date.now() } }
    );
  } else {
    await db.collection('trackers').deleteOne({ _id: TRACKER_DOC_ID });
  }
}

export async function getSettings(guildId) {
  const db = getDb();
  const docId = guildId ? `bot_settings_${guildId}` : 'bot_settings';
  return db.collection('settings').findOne({ _id: docId });
}

export async function saveSettings(settings, guildId) {
  const db = getDb();
  const docId = guildId ? `bot_settings_${guildId}` : 'bot_settings';
  const existing = await getSettings(guildId);
  await db.collection('settings').updateOne(
    { _id: docId },
    { $set: { _id: docId, ...existing, ...settings } },
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
