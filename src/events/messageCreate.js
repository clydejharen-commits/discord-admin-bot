import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getActiveTracker, clearActiveTracker } from '../utils/tracker-db.js';
import { getInviteStats, getInviteSettings, resetAllInvites } from '../utils/invite-db.js';
import { buildInvitedListEmbed, buildInvitedListComponents, storeInviter } from '../utils/invite-interactions.js';

export const name = 'messageCreate';

export async function execute(message) {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // ---- q. track stop (existing) ----
  if (lower.startsWith('q. track stop')) {
    if (!isAdmin(message.member)) {
      return message.reply({
        content: 'You do not have permission to use this command. Administrator permission is required.',
      });
    }

    const tracker = await getActiveTracker();
    if (!tracker) {
      return message.reply({ content: 'There is no active tracker to stop.' });
    }

    await clearActiveTracker();
    return message.reply({
      content: `Stopped tracking **${tracker.robloxName}** (target was ${tracker.milestone.toLocaleString()}).`,
    });
  }

  // ---- q. invites / q. inv / q. i <user> ----
  if (lower.startsWith('q. invites') || lower.startsWith('q. inv ') || lower.startsWith('q. inv\t') || lower === 'q. inv' ||
      lower.startsWith('q. i ') || lower.startsWith('q. i\t') || lower === 'q. i') {
    await handleInvitesCommand(message);
    return;
  }

  // ---- q. reset invites <user> ----
  if (lower.startsWith('q. reset invites')) {
    await handleResetInvitesCommand(message);
    return;
  }
}

// ---------------------------------------------------------------------------
// q. Invites <user>
// ---------------------------------------------------------------------------

async function handleInvitesCommand(message) {
  const args = parseArgs(message.content, ['q. invites', 'q. inv', 'q. i']);
  const target = await resolveTarget(message, args);

  if (!target) {
    return message.reply({
      content: 'Could not find that user. Please provide a valid mention, user ID, or username.',
    });
  }

  const stats = await getInviteStats(message.guild.id, target.id);

  let verifiedCount = 0;
  const settings = await getInviteSettings(message.guild.id);
  if (settings?.verifiedRoleId) {
    for (const m of stats.invitedMembers) {
      if (m.status === 'active' || m.status === 'rejoined') {
        const member = await message.guild.members.fetch(m.userId).catch(() => null);
        if (member && member.roles.cache.has(settings.verifiedRoleId)) {
          verifiedCount++;
        }
      }
    }
  }

  const activeDisplay = settings?.verifiedRoleId
    ? `${stats.active} (includes ${verifiedCount} verified)`
    : `${stats.active}`;

  const embed = new EmbedBuilder()
    .setTitle('🔗 Invite Stats')
    .setColor(0x2f3136)
    .addFields(
      { name: 'User', value: `<@${target.id}> (${target.tag})`, inline: false },
      { name: 'Active', value: `${activeDisplay}`, inline: true },
      { name: 'Left', value: `${stats.left}`, inline: true },
      { name: 'Rejoins', value: `${stats.rejoins}`, inline: true },
      { name: 'Fake Invites', value: `${stats.fake}`, inline: true },
      { name: 'Total Invites', value: `${stats.totalInvites}`, inline: true }
    );

  if (stats.invitedMembers.length > 0) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`invite_list_show_${target.id}`)
        .setLabel('Invited')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary)
    );
    const sent = await message.reply({ embeds: [embed], components: [row] });
    storeInviter(sent.id, target.id);
  } else {
    await message.reply({ embeds: [embed] });
  }
}

// ---------------------------------------------------------------------------
// q. Reset Invites <user>
// ---------------------------------------------------------------------------

async function handleResetInvitesCommand(message) {
  const args = parseArgs(message.content, ['q. reset invites']);
  const target = await resolveTarget(message, args);

  if (!target) {
    return message.reply({
      content: 'Could not find that user. Please provide a valid mention, user ID, or username.',
    });
  }

  const settings = await getInviteSettings(message.guild.id);
  if (!settings?.inviteStaffRoleId) {
    return message.reply({
      content: '❌ Invite Staff role is not configured. An administrator must set it up via `/setup` → 🔗 Invite Settings.',
    });
  }

  const hasStaffRole = message.member.roles.cache.has(settings.inviteStaffRoleId);
  if (!hasStaffRole && !isAdmin(message.member)) {
    return message.reply({
      content: '❌ You don\'t have permission to use this command.',
    });
  }

  await resetAllInvites(message.guild.id, target.id);

  return message.reply({
    content: `✅ All invite data for <@${target.id}> (${target.tag}) has been reset.`,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(content, prefixes) {
  const lower = content.toLowerCase();
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      return content.slice(prefix.length).trim();
    }
  }
  return '';
}

async function resolveTarget(message, args) {
  if (!args) return message.author;

  // Mention: <@123> or <@!123>
  const mentionMatch = args.match(/^<@!?(\d+)>/);
  if (mentionMatch) {
    const userId = mentionMatch[1];
    return await message.client.users.fetch(userId).catch(() => null);
  }

  // Raw ID
  if (/^\d{17,19}$/.test(args)) {
    return await message.client.users.fetch(args).catch(() => null);
  }

  // Username lookup
  const query = args.toLowerCase();
  const members = await message.guild.members.fetch({ limit: 100 }).catch(() => null);
  if (members) {
    const member = members.find((m) => {
      return (
        m.user.username.toLowerCase() === query ||
        m.user.tag.toLowerCase() === query ||
        m.displayName?.toLowerCase() === query ||
        m.nickname?.toLowerCase() === query
      );
    });
    if (member) return member.user;
  }

  return null;
}
