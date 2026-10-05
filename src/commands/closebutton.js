import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getCloseReasons, setCloseReasons } from '../utils/ticket-db.js';

export const data = new SlashCommandBuilder()
  .setName('closebutton')
  .setDescription('Configure the close reasons shown when closing a ticket')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add a close reason')
      .addStringOption((option) =>
        option
          .setName('label')
          .setDescription('Display label for the close reason')
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption((option) =>
        option
          .setName('emoji')
          .setDescription('Optional emoji for the close reason')
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a close reason by its label')
      .addStringOption((option) =>
        option
          .setName('label')
          .setDescription('Exact label of the close reason to remove')
          .setRequired(true)
          .setMaxLength(100)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List all configured close reasons')
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset')
      .setDescription('Reset close reasons to the default set')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const DEFAULT_CLOSE_REASONS = [
  { label: 'Resolved', emoji: '✅' },
  { label: 'Completed', emoji: '🎉' },
  { label: 'Invalid Request', emoji: '⚠️' },
  { label: 'No Response', emoji: '🔇' },
  { label: 'Other', emoji: '📋' },
];

export async function execute(interaction) {
  if (!isAdmin(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. Administrator permission is required.',
      ephemeral: true,
    });
  }

  const guildId = interaction.guild.id;
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const label = interaction.options.getString('label').trim();
    const emoji = interaction.options.getString('emoji')?.trim() || null;

    const reasons = await getCloseReasons(guildId);

    if (reasons.some((r) => r.label.toLowerCase() === label.toLowerCase())) {
      return interaction.reply({
        content: `❌ A close reason named "${label}" already exists.`,
        ephemeral: true,
      });
    }

    if (reasons.length >= 25) {
      return interaction.reply({
        content: '❌ You can have a maximum of 25 close reasons. Remove one before adding more.',
        ephemeral: true,
      });
    }

    if (emoji) {
      const isCustomEmoji = /^<a?:[a-zA-Z0-9_]+:\d+>$/;
      const isUnicodeEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
      if (!isCustomEmoji.test(emoji) && !isUnicodeEmoji.test(emoji)) {
        return interaction.reply({
          content: '❌ That does not appear to be a valid emoji.',
          ephemeral: true,
        });
      }
    }

    reasons.push({ label, emoji, id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });
    await setCloseReasons(guildId, reasons);

    return interaction.reply({
      content: `✅ Added close reason **${emoji ? emoji + ' ' : ''}${label}**.`,
      ephemeral: true,
    });
  }

  if (sub === 'remove') {
    const label = interaction.options.getString('label').trim();
    const reasons = await getCloseReasons(guildId);
    const filtered = reasons.filter(
      (r) => r.label.toLowerCase() !== label.toLowerCase()
    );

    if (filtered.length === reasons.length) {
      return interaction.reply({
        content: `❌ No close reason named "${label}" was found.`,
        ephemeral: true,
      });
    }

    await setCloseReasons(guildId, filtered);

    return interaction.reply({
      content: `✅ Removed close reason **${label}**.`,
      ephemeral: true,
    });
  }

  if (sub === 'list') {
    const reasons = await getCloseReasons(guildId);
    if (reasons.length === 0) {
      return interaction.reply({
        content: 'There are no close reasons configured. Use `/closebutton add` to add one, or `/closebutton reset` for defaults.',
        ephemeral: true,
      });
    }

    const list = reasons
      .map((r, i) => `${i + 1}. ${r.emoji ? r.emoji + ' ' : ''}${r.label}`)
      .join('\n');

    return interaction.reply({
      content: `**Configured close reasons:**\n${list}`,
      ephemeral: true,
    });
  }

  if (sub === 'reset') {
    await setCloseReasons(guildId, DEFAULT_CLOSE_REASONS);
    return interaction.reply({
      content: `✅ Close reasons reset to defaults: ${DEFAULT_CLOSE_REASONS.map((r) => `${r.emoji} ${r.label}`).join(', ')}.`,
      ephemeral: true,
    });
  }
}
