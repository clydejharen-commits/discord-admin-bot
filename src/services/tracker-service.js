import { EmbedBuilder } from 'discord.js';
import { getActiveTracker, clearActiveTracker, getSettings } from '../utils/tracker-db.js';
import { getFollowerCount } from '../utils/roblox.js';

const CHECK_INTERVAL = 60 * 1000;

let intervalId = null;
let client = null;
let completing = false;

export function startTrackerLoop(discordClient) {
  client = discordClient;
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(checkTracker, CHECK_INTERVAL);
  console.log('Tracker checking loop started.');
}

export async function checkTracker() {
  if (!client || completing) return;

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
    console.error('Tracker check: Roblox API error:', error.message);
    return;
  }

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

async function completeTracker(tracker, finalFollowers) {
  const settings = await getSettings();
  const channelId = settings?.trackingChannelId;
  if (!channelId) {
    console.warn('Tracker completion: no tracking channel configured.');
    await clearActiveTracker();
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error('Tracker completion: could not fetch tracking channel.');
    await clearActiveTracker();
    return;
  }

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
  if (settings.completionPingType && settings.completionPingId) {
    if (settings.completionPingType === 'role') {
      content = `<@&${settings.completionPingId}>`;
    } else if (settings.completionPingType === 'user') {
      content = `<@${settings.completionPingId}>`;
    }
  }

  await channel.send({ content: content || undefined, embeds: [embed] });
  await clearActiveTracker();
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
