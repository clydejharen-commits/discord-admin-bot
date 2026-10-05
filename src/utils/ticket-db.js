import { getDb } from './database.js';

// ---------------------------------------------------------------------------
// Ticket Settings (per guild)
// ---------------------------------------------------------------------------

export async function getTicketSettings(guildId) {
  const db = getDb();
  const docId = `ticket_settings_${guildId}`;
  return db.collection('ticket_settings').findOne({ _id: docId });
}

export async function saveTicketSettings(guildId, settings) {
  const db = getDb();
  const docId = `ticket_settings_${guildId}`;
  const existing = await getTicketSettings(guildId);
  await db.collection('ticket_settings').updateOne(
    { _id: docId },
    { $set: { _id: docId, guildId, ...existing, ...settings } },
    { upsert: true }
  );
}

export async function getTicketCategory(guildId) {
  const settings = await getTicketSettings(guildId);
  return settings?.ticketCategoryId || null;
}

export async function getTicketStaffRole(guildId) {
  const settings = await getTicketSettings(guildId);
  return settings?.ticketStaffRoleId || null;
}

export async function getMainPanelMessageId(guildId) {
  const settings = await getTicketSettings(guildId);
  return settings?.mainPanelMessageId || null;
}

// ---------------------------------------------------------------------------
// Ticket Buttons (the options shown on the ticket panel dropdown)
// ---------------------------------------------------------------------------

export async function getTicketButtons(guildId) {
  const settings = await getTicketSettings(guildId);
  return settings?.ticketButtons || [];
}

export async function addTicketButton(guildId, button) {
  const db = getDb();
  const docId = `ticket_settings_${guildId}`;
  await db.collection('ticket_settings').updateOne(
    { _id: docId, guildId },
    { $push: { ticketButtons: button } },
    { upsert: true }
  );
}

export async function deleteTicketButton(guildId, buttonId) {
  const db = getDb();
  const docId = `ticket_settings_${guildId}`;
  await db.collection('ticket_settings').updateOne(
    { _id: docId, guildId },
    { $pull: { ticketButtons: { id: buttonId } } }
  );
}

// ---------------------------------------------------------------------------
// Ticket Records (individual tickets)
// ---------------------------------------------------------------------------

export async function createTicketRecord(record) {
  const db = getDb();
  await db.collection('tickets').insertOne(record);
}

export async function getTicket(guildId, userId, ticketType) {
  const db = getDb();
  return db.collection('tickets').findOne({
    guildId,
    userId,
    ticketType,
  });
}

export async function getTicketByChannel(guildId, channelId) {
  const db = getDb();
  return db.collection('tickets').findOne({
    guildId,
    channelId,
  });
}

export async function updateTicket(guildId, channelId, updates) {
  const db = getDb();
  await db.collection('tickets').updateOne(
    { guildId, channelId },
    { $set: updates }
  );
}

export async function deleteTicketRecord(guildId, channelId) {
  const db = getDb();
  await db.collection('tickets').deleteOne({
    guildId,
    channelId,
  });
}
