import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getActiveTracker, saveActiveTracker, getSettings } from '../utils/tracker-db.js';
import { resolveUserId, getFollowerCount } from '../utils/roblox.js';
import { startTrackerLoop } from '../services/tracker-service.js';

export const data = new SlashCommandBuilder()
  .setName('track')
  .setDescription('Start tracking a Roblox user\'s follower count')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName('roblox_username')
      .setDescription('The Roblox username to track')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('milestone')
      .setDescription('The follower milestone to track toward')
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const username = interaction.options.getString('roblox_username');
  const milestone = interaction.options.getInteger('milestone');

  await interaction.deferReply({ ephemeral: true });

  const existing = await getActiveTracker();
  if (existing) {
    return interaction.editReply({
      content: `A tracker is already active for **${existing.robloxName}** (target: ${existing.milestone.toLocaleString()}). Stop it first with \`q. Track stop\`.`,
    });
  }

  let resolved;
  try {
    resolved = await resolveUserId(username);
  } catch (error) {
    console.error('Track command: Roblox API error:', error.message);
    return interaction.editReply({
      content: 'Failed to resolve the Roblox username. The Roblox API may be unavailable. Please try again.',
    });
  }

  if (!resolved) {
    return interaction.editReply({
      content: `Could not find a Roblox user named \`${username}\`. Please check the username and try again.`,
    });
  }

  let currentFollowers;
  try {
    currentFollowers = await getFollowerCount(resolved.id);
  } catch (error) {
    console.error('Track command: failed to get follower count:', error.message);
    return interaction.editReply({
      content: 'Failed to fetch the current follower count from Roblox. Please try again.',
    });
  }

  await saveActiveTracker({
    robloxName: resolved.name,
    robloxId: resolved.id,
    milestone,
    startedAt: Date.now(),
  });

  const embed = new EmbedBuilder()
    .setTitle('Followers Tracker')
    .addFields(
      { name: 'Roblox User', value: resolved.name, inline: true },
      { name: 'Current Followers', value: currentFollowers.toLocaleString(), inline: true },
      { name: 'Target', value: milestone.toLocaleString(), inline: true },
      { name: 'Progress', value: `${currentFollowers.toLocaleString()} / ${milestone.toLocaleString()}`, inline: true },
      { name: 'Status', value: '🟢 Tracking', inline: true }
    )
    .setColor(0x00bfff);

  const settings = await getSettings();
  const channelId = settings?.trackingChannelId;
  if (channelId) {
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  }

  startTrackerLoop(interaction.client);

  return interaction.editReply({
    content: `Started tracking **${resolved.name}**'s followers. Target: ${milestone.toLocaleString()}. Current: ${currentFollowers.toLocaleString()}.`,
  });
}
