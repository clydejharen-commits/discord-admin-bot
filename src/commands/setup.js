import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getSettings } from '../utils/tracker-db.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Open the bot setup dashboard')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const settings = await getSettings();

  const trackingChannel = settings?.trackingChannelId
    ? `<#${settings.trackingChannelId}>`
    : 'Not configured';

  let completionPing = 'Not configured';
  if (settings?.completionPingType && settings?.completionPingId) {
    if (settings.completionPingType === 'role') {
      completionPing = `<@&${settings.completionPingId}>`;
    } else if (settings.completionPingType === 'user') {
      completionPing = `<@${settings.completionPingId}>`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('Bot Setup')
    .addFields(
      { name: 'Tracking Channel', value: trackingChannel, inline: true },
      { name: 'Completion Ping', value: completionPing, inline: true }
    )
    .setColor(0x2f3136);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_tracker_settings')
      .setLabel('Tracker Settings')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Primary)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
