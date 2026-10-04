import { getDb } from './database.js';

const TRACKER_DOC_ID = 'active_tracker';
const HISTORY_MAX_POINTS = 1500;

export async function getActiveTracker(guildId) {
  const db = getDb();
  if (!guildId) return null;
  return db.collection('trackers').findOne({ guildId, active: true });
}

export async function getAllActiveTrackers() {
  const db = getDb();
  return db.collection('trackers').find({ active: true }).toArray();
}

export async function saveActiveTracker(tracker) {
  const db = getDb();
  const docId = `${TRACKER_DOC_ID}_${tracker.guildId}`;
  await db.collection('trackers').updateOne(
    { _id: docId },
    { $set: { _id: docId, ...tracker, active: true } },
    { upsert: true }
  );
}

export async function updateTrackerMessageId(guildId, messageId) {
  const db = getDb();
  const docId = `${TRACKER_DOC_ID}_${guildId}`;
  await db.collection('trackers').updateOne(
    { _id: docId },
    { $set: { messageId } }
  );
}

export async function clearActiveTracker(guildId) {
  const db = getDb();
  if (guildId) {
    await db.collection('trackers').updateOne(
      { guildId, active: true },
      { $set: { active: false, stoppedAt: Date.now() } }
    );
  }
}

export async function addFollowerHistory(guildId, count) {
  const db = getDb();
  const docId = `follower_history_${guildId}`;
  const point = { t: Date.now(), c: count };
  await db.collection('tracker_history').updateOne(
    { _id: docId },
    {
      $push: { points: { $each: [point], $slice: -HISTORY_MAX_POINTS } },
      $setOnInsert: { _id: docId, guildId },
    },
    { upsert: true }
  );
}

export async function getFollowerHistory(guildId) {
  const db = getDb();
  const docId = `follower_history_${guildId}`;
  const doc = await db.collection('tracker_history').findOne({ _id: docId });
  return doc?.points || [];
}

export async function clearFollowerHistory(guildId) {
  const db = getDb();
  const docId = `follower_history_${guildId}`;
  await db.collection('tracker_history').deleteOne({ _id: docId });
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
