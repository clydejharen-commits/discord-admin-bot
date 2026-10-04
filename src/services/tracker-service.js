import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  getActiveTracker,
  clearActiveTracker,
  getSettings,
} from '../utils/tracker-db.js';
import { getFollowerCount, RobloxRateLimitError } from '../utils/roblox.js';

const CHECK_INTERVAL = 60 * 1000;
const RATE_LIMIT_PAUSE = 5 * 60 * 1000;

let intervalId = null;
let client = null;
let completing = false;
let rateLimitedUntil = 0;
let lastFollowerCount = null;

export function startTrackerLoop(discordClient) {
  client = discordClient;
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(checkTracker, CHECK_INTERVAL);
  console.log('Tracker checking loop started.');
}

export async function checkTracker() {
  if (!client || completing) return;
  if (Date.now() < rateLimitedUntil) {
    console.log('Tracker check: skipping due to active rate-limit pause.');
    return;
  }

  let tracker;
  try {
    tracker = await getActiveTracker();
  } catch (error) {
    console.error('Tracker check: failed to read from database:', error.message);
    return;
  }

  if (!tracker) return;

  let followers;
  try {
    followers = await getFollowerCount(tracker.robloxId);
  } catch (error) {
    if (error instanceof RobloxRateLimitError) {
      const pause = error.retryAfterMs
        ? Math.min(error.retryAfterMs + 5_000, RATE_LIMIT_PAUSE)
        : RATE_LIMIT_PAUSE;
      rateLimitedUntil = Date.now() + pause;
      console.warn(
        `Tracker check: Roblox API rate limited. Pausing checks for ${Math.round(pause / 1000)}s. Tracker remains active.`
      );
      return;
    }
    console.error('Tracker check: Roblox API error:', error.message);
    return;
  }

  lastFollowerCount = followers;

  if (followers >= tracker.milestone) {
    completing = true;
    try {
      await completeTracker(tracker, followers);
    } catch (error) {
      console.error('Tracker check: failed to complete tracker:', error.message);
    } finally {
      completing = false;
    }
  }
}

async function resolveTrackingChannel(guildId) {
  const settings = await getSettings(guildId);
  const channelId = settings?.trackingChannelId;
  if (!channelId) {
    console.warn('Tracker: no tracking channel configured.');
    return null;
  }

  let guild = null;
  if (guildId) {
    guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  } else if (client.guilds.cache.size > 0) {
    guild = client.guilds.cache.first();
  }

  if (!guild) {
    console.error('Tracker: could not resolve guild from client.');
    return null;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error('Tracker: configured tracking channel does not exist.');
    return null;
  }

  if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.SendMessages)) {
    console.error('Tracker: bot lacks Send Messages permission in tracking channel.');
    return null;
  }

  if (!channel.permissionsFor(client.user)?.has(PermissionFlagsBits.EmbedLinks)) {
    console.error('Tracker: bot lacks Embed Links permission in tracking channel.');
    return null;
  }

  return channel;
}

async function completeTracker(tracker, finalFollowers) {
  const channel = await resolveTrackingChannel(tracker.guildId);
  if (!channel) {
    await clearActiveTracker(tracker.guildId);
    return;
  }

  const settings = await getSettings(tracker.guildId);

  const embed = new EmbedBuilder()
    .setTitle('Followers Tracker')
    .setDescription('🎉 Milestone Reached!')
    .addFields(
      { name: 'Roblox User', value: tracker.robloxName, inline: true },
      { name: 'Followers', value: finalFollowers.toLocaleString(), inline: true },
      { name: 'Target', value: tracker.milestone.toLocaleString(), inline: true },
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

  await channel.send({ content: content || undefined, embeds: [embed] }).catch((err) => {
    console.error('Tracker completion: failed to send message:', err.message);
  });
  await clearActiveTracker(tracker.guildId);
  console.log(`Tracker completed: ${tracker.robloxName} reached ${finalFollowers} followers.`);
}

export async function restoreTracker(discordClient) {
  client = discordClient;
  let tracker;
  try {
    tracker = await getActiveTracker();
  } catch (error) {
    console.error('Failed to restore tracker from database:', error.message);
    return;
  }

  if (tracker) {
    console.log(`Restored active tracker: ${tracker.robloxName} (target: ${tracker.milestone}).`);
  }
  startTrackerLoop(discordClient);
}
