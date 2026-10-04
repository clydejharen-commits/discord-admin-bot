import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  getActiveTracker,
  getAllActiveTrackers,
  clearActiveTracker,
  getSettings,
  addFollowerHistory,
  getFollowerHistory,
  clearFollowerHistory,
  updateTrackerMessageId,
} from '../utils/tracker-db.js';
import { getFollowerCount, RobloxRateLimitError } from '../utils/roblox.js';

const CHECK_INTERVAL = 60 * 1000;
const RATE_LIMIT_PAUSE = 5 * 60 * 1000;

const intervals = new Map();
const rateLimitedUntil = new Map();
const running = new Map();
let client = null;

export function startTrackerLoop(discordClient) {
  client = discordClient;
  console.log('Tracker service initialised.');
}

export function stopTrackerLoop(guildId) {
  const id = intervals.get(guildId);
  if (id) {
    clearInterval(id);
    intervals.delete(guildId);
  }
  rateLimitedUntil.delete(guildId);
  running.delete(guildId);
}

export async function startGuildTracker(guildId) {
  if (intervals.has(guildId)) return;
  running.set(guildId, false);
  const id = setInterval(() => {
    runGuildCheck(guildId).catch((err) => {
      console.error(`Tracker [${guildId}]: interval error:`, err.message);
    });
  }, CHECK_INTERVAL);
  intervals.set(guildId, id);
  console.log(`Tracker loop started for guild ${guildId}.`);
  runGuildCheck(guildId).catch((err) => {
    console.error(`Tracker [${guildId}]: initial check error:`, err.message);
  });
}

async function runGuildCheck(guildId) {
  if (running.get(guildId)) return;
  if (Date.now() < (rateLimitedUntil.get(guildId) || 0)) {
    console.log(`Tracker [${guildId}]: skipping due to rate-limit pause.`);
    return;
  }

  let tracker;
  try {
    tracker = await getActiveTracker(guildId);
  } catch (error) {
    console.error(`Tracker [${guildId}]: DB read error:`, error.message);
    return;
  }

  if (!tracker) {
    stopTrackerLoop(guildId);
    return;
  }

  running.set(guildId, true);
  try {
    await processGuildCheck(tracker);
  } catch (error) {
    console.error(`Tracker [${guildId}]: check failed:`, error.message);
  } finally {
    running.set(guildId, false);
  }
}

async function processGuildCheck(tracker) {
  const guildId = tracker.guildId;

  let followers;
  try {
    followers = await getFollowerCount(tracker.robloxId);
  } catch (error) {
    if (error instanceof RobloxRateLimitError) {
      const pause = error.retryAfterMs
        ? Math.min(error.retryAfterMs + 5_000, RATE_LIMIT_PAUSE)
        : RATE_LIMIT_PAUSE;
      rateLimitedUntil.set(guildId, Date.now() + pause);
      console.warn(
        `Tracker [${guildId}]: Roblox rate limited. Pausing ${Math.round(pause / 1000)}s. Tracker stays active.`
      );
      return;
    }
    console.error(`Tracker [${guildId}]: Roblox API error:`, error.message);
    return;
  }

  await addFollowerHistory(guildId, followers);

  if (followers >= tracker.milestone) {
    await completeTracker(tracker, followers);
    return;
  }

  await sendTrackerUpdate(tracker, followers);
}

function calculateGrowthRate(history, windowMs) {
  if (history.length < 2) return null;
  const now = Date.now();
  const cutoff = now - windowMs;
  let oldest = null;
  for (let i = 0; i < history.length; i++) {
    if (history[i].t <= cutoff) {
      oldest = history[i];
    } else {
      break;
    }
  }
  const latest = history[history.length - 1];
  if (!oldest) oldest = history[0];
  const elapsed = latest.t - oldest.t;
  if (elapsed < 1000) return null;
  const diff = latest.c - oldest.c;
  if (diff === 0) return 0;
  return Math.round((diff / elapsed) * windowMs);
}

function formatGrowth(value) {
  if (value === null) return 'Calculating...';
  if (value === 0) return '+0';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString()}`;
}

async function resolveTrackingChannel(guildId) {
  const settings = await getSettings(guildId);
  const channelId = settings?.trackingChannelId;
  if (!channelId) {
    console.warn(`Tracker [${guildId}]: no tracking channel configured.`);
    return null;
  }

  let guild = null;
  if (guildId) {
    guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  }

  if (!guild) {
    console.error(`Tracker [${guildId}]: could not resolve guild.`);
    return null;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error(`Tracker [${guildId}]: tracking channel ${channelId} does not exist.`);
    return null;
  }

  if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) {
    console.error(`Tracker [${guildId}]: bot lacks Send Messages permission.`);
    return null;
  }

  if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.EmbedLinks)) {
    console.error(`Tracker [${guildId}]: bot lacks Embed Links permission.`);
    return null;
  }

  return channel;
}

function buildTrackerEmbed(tracker, followers, history) {
  const perMin = calculateGrowthRate(history, 60 * 1000);
  const perHour = calculateGrowthRate(history, 60 * 60 * 1000);
  const perDay = calculateGrowthRate(history, 24 * 60 * 60 * 1000);

  return new EmbedBuilder()
    .setTitle('Followers Tracker')
    .addFields(
      { name: 'Roblox User', value: tracker.robloxName, inline: true },
      { name: 'Followers', value: `👥 ${followers.toLocaleString()} / ${tracker.milestone.toLocaleString()}`, inline: true },
      { name: 'Status', value: '🟢 Tracking', inline: true },
      { name: '📈 +/min', value: formatGrowth(perMin), inline: true },
      { name: '📊 +/hour', value: formatGrowth(perHour), inline: true },
      { name: '📅 +/day', value: formatGrowth(perDay), inline: true }
    )
    .setColor(0x00bfff);
}

async function sendTrackerUpdate(tracker, followers) {
  const channel = await resolveTrackingChannel(tracker.guildId);
  if (!channel) return;

  const history = await getFollowerHistory(tracker.guildId);
  const embed = buildTrackerEmbed(tracker, followers, history);

  if (tracker.messageId) {
    const message = await channel.messages.fetch(tracker.messageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [embed] }).catch((err) => {
        console.error(`Tracker [${tracker.guildId}]: failed to edit message:`, err.message);
      });
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] }).catch((err) => {
    console.error(`Tracker [${tracker.guildId}]: failed to send update:`, err.message);
  });
  if (sent) {
    await updateTrackerMessageId(tracker.guildId, sent.id);
  }
}

async function completeTracker(tracker, finalFollowers) {
  const channel = await resolveTrackingChannel(tracker.guildId);
  const settings = await getSettings(tracker.guildId);
  const history = await getFollowerHistory(tracker.guildId);

  const embed = new EmbedBuilder()
    .setTitle('Followers Tracker')
    .setDescription('🎉 Milestone Reached!')
    .addFields(
      { name: 'Roblox User', value: tracker.robloxName, inline: true },
      { name: 'Followers', value: finalFollowers.toLocaleString(), inline: true },
      { name: 'Target', value: tracker.milestone.toLocaleString(), inline: true },
      { name: '📈 +/min', value: formatGrowth(calculateGrowthRate(history, 60 * 1000)), inline: true },
      { name: '📊 +/hour', value: formatGrowth(calculateGrowthRate(history, 60 * 60 * 1000)), inline: true },
      { name: '📅 +/day', value: formatGrowth(calculateGrowthRate(history, 24 * 60 * 60 * 1000)), inline: true },
      { name: 'Status', value: '✅ Completed', inline: true }
    )
    .setColor(0x00ff00);

  let content = '';
  if (settings?.completionPingType && settings?.completionPingId) {
    if (settings.completionPingType === 'role') {
      content = `<@&${settings.completionPingId}>`;
    } else if (settings.completionPingType === 'user') {
      content = `<@${settings.completionPingId}>`;
    }
  }

  if (channel) {
    if (tracker.messageId) {
      const oldMessage = await channel.messages.fetch(tracker.messageId).catch(() => null);
      if (oldMessage) {
        await oldMessage.delete().catch(() => {});
      }
    }
    await channel.send({ content: content || undefined, embeds: [embed] }).catch((err) => {
      console.error(`Tracker [${tracker.guildId}]: completion send failed:`, err.message);
    });
  }

  await clearActiveTracker(tracker.guildId);
  stopTrackerLoop(tracker.guildId);
  await clearFollowerHistory(tracker.guildId);
  console.log(`Tracker [${tracker.guildId}]: completed — ${tracker.robloxName} reached ${finalFollowers}.`);
}

export async function stopTracker(guildId) {
  await clearActiveTracker(guildId);
  stopTrackerLoop(guildId);
  await clearFollowerHistory(guildId);
}

export async function restoreTrackers(discordClient) {
  client = discordClient;
  let trackers = [];
  try {
    trackers = await getAllActiveTrackers();
  } catch (error) {
    console.error('Failed to restore trackers from database:', error.message);
  }

  if (trackers.length === 0) {
    console.log('No active trackers to restore.');
    return;
  }

  for (const tracker of trackers) {
    console.log(`Restored tracker: ${tracker.robloxName} (target: ${tracker.milestone.toLocaleString()}, guild: ${tracker.guildId}).`);
    await startGuildTracker(tracker.guildId);
  }
}
