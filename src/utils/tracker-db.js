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
