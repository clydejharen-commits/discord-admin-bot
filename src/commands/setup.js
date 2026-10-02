import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';

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

  const embed = new EmbedBuilder()
    .setTitle('Bot Setup')
    .setDescription('Manage and configure your bot\'s features using the options below.')
    .setColor(0x2f3136);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_appearance')
      .setLabel('Bot Appearance')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('setup_tracker_settings')
      .setLabel('Tracker Settings')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_mod_settings')
      .setLabel('Mod Settings')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
