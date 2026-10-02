import { PermissionFlagsBits } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getActiveTracker, clearActiveTracker } from '../utils/tracker-db.js';

const PREFIX = 'q.';
const STOP_COMMAND = 'q. track stop';

export const name = 'messageCreate';

export async function execute(message) {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  if (!content.toLowerCase().startsWith(STOP_COMMAND)) return;

  if (!isAdmin(message.member)) {
    return message.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
    });
  }

  const tracker = await getActiveTracker();
  if (!tracker) {
    return message.reply({
      content: 'There is no active tracker to stop.',
    });
  }

  await clearActiveTracker();

  return message.reply({
    content: `Stopped tracking **${tracker.robloxName}** (target was ${tracker.milestone.toLocaleString()}).`,
  });
}
