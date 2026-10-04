import { getDb } from './database.js';

// ---------------------------------------------------------------------------
// Invite guild settings
// ---------------------------------------------------------------------------

export async function getInviteSettings(guildId) {
  const db = getDb();
  return db.collection('invite_settings').findOne({ _id: guildId });
}

export async function saveInviteSettings(guildId, settings) {
  const db = getDb();
  await db.collection('invite_settings').updateOne(
    { _id: guildId },
    { $set: { _id: guildId, ...settings } },
    { upsert: true }
  );
}

export async function updateInviteSettings(guildId, partial) {
  const db = getDb();
  const existing = await getInviteSettings(guildId);
  await db.collection('invite_settings').updateOne(
    { _id: guildId },
    { $set: { _id: guildId, ...existing, ...partial } },
    { upsert: true }
  );
}

// ---------------------------------------------------------------------------
// Invite records — one document per (guildId, inviteCode)
// ---------------------------------------------------------------------------

export async function getInviteRecord(guildId, code) {
  const db = getDb();
  return db.collection('invite_records').findOne({ guildId, code });
}

export async function getInviteRecordByGuildAndCode(guildId, code) {
  return getInviteRecord(guildId, code);
}

export async function upsertInviteRecord(record) {
  const db = getDb();
  await db.collection('invite_records').updateOne(
    { guildId: record.guildId, code: record.code },
    { $set: record },
    { upsert: true }
  );
}

export async function deleteInviteRecord(guildId, code) {
  const db = getDb();
  await db.collection('invite_records').deleteOne({ guildId, code });
}

export async function getInviteRecordsByInviter(guildId, inviterId) {
  const db = getDb();
  return db.collection('invite_records').find({ guildId, inviterId }).toArray();
}

export async function getAllInviteRecords(guildId) {
  const db = getDb();
  return db.collection('invite_records').find({ guildId }).toArray();
}

export async function getInviteRecordByCode(guildId, code) {
  return getInviteRecord(guildId, code);
}

// ---------------------------------------------------------------------------
// Invited members — one document per (guildId, invitedUserId)
// ---------------------------------------------------------------------------

export async function createInvitedMember(record) {
  const db = getDb();
  await db.collection('invited_members').updateOne(
    { guildId: record.guildId, userId: record.userId },
    { $set: record },
    { upsert: true }
  );
}

export async function getInvitedMember(guildId, userId) {
  const db = getDb();
  return db.collection('invited_members').findOne({ guildId, userId });
}

export async function getInvitedMembersByInviter(guildId, inviterId) {
  const db = getDb();
  return db.collection('invited_members').find({ guildId, inviterId }).toArray();
}

export async function updateInvitedMember(guildId, userId, partial) {
  const db = getDb();
  await db.collection('invited_members').updateOne(
    { guildId, userId },
    { $set: partial },
    { upsert: true }
  );
}

export async function deleteInvitedMember(guildId, userId) {
  const db = getDb();
  await db.collection('invited_members').deleteOne({ guildId, userId });
}

// ---------------------------------------------------------------------------
// Manual invites — staff can manually add invites to a user
// ---------------------------------------------------------------------------

export async function addManualInvite(guildId, inviterId, amount = 1) {
  const db = getDb();
  await db.collection('manual_invites').updateOne(
    { guildId, inviterId },
    { $inc: { count: amount } },
    { upsert: true }
  );
}

export async function setManualInvites(guildId, inviterId, count) {
  const db = getDb();
  await db.collection('manual_invites').updateOne(
    { guildId, inviterId },
    { $set: { guildId, inviterId, count } },
    { upsert: true }
  );
}

export async function getManualInvites(guildId, inviterId) {
  const db = getDb();
  const doc = await db.collection('manual_invites').findOne({ guildId, inviterId });
  return doc?.count || 0;
}

export async function resetAllInvites(guildId, inviterId) {
  const db = getDb();
  await db.collection('invite_records').deleteMany({ guildId, inviterId });
  await db.collection('invited_members').deleteMany({ guildId, inviterId });
  await db.collection('manual_invites').deleteMany({ guildId, inviterId });
}

// ---------------------------------------------------------------------------
// Aggregate invite stats for a user
// ---------------------------------------------------------------------------

export async function getInviteStats(guildId, inviterId) {
  const records = await getInviteRecordsByInviter(guildId, inviterId);
  const invitedMembers = await getInvitedMembersByInviter(guildId, inviterId);
  const manualInvites = await getManualInvites(guildId, inviterId);

  let active = 0;
  let left = 0;
  let rejoins = 0;
  let fake = 0;

  for (const member of invitedMembers) {
    const status = member.status || 'active';
    if (status === 'active') {
      active++;
    } else if (status === 'left') {
      left++;
    } else if (status === 'rejoined') {
      rejoins++;
      active++;
    } else if (status === 'fake') {
      fake++;
    }
  }

  const trackedInvites = records.filter((r) => !r.fake).length;
  const totalInvites = trackedInvites + manualInvites;

  return {
    active,
    left,
    rejoins,
    fake,
    totalInvites,
    manualInvites,
    invitedMembers,
  };
}
