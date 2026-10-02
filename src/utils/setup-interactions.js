import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { isAdmin } from '../utils/permissions.js';
import { getSettings, saveSettings } from '../utils/tracker-db.js';

async function getTrackerSettingsEmbed() {
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

  return new EmbedBuilder()
    .setTitle('Tracker Settings')
    .addFields(
      { name: 'Tracking Channel', value: trackingChannel, inline: true },
      { name: 'Completion Ping', value: completionPing, inline: true }
    )
    .setColor(0x2f3136);
}

function getTrackerSettingsComponents() {
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('tracker_select_channel')
      .setPlaceholder('Select a tracking channel')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const pingRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tracker_select_ping')
      .setPlaceholder('Set completion ping (role or user)')
      .addOptions(
        { label: 'Select a Role', value: 'pick_role', emoji: '🏷️' },
        { label: 'Select a User', value: 'pick_user', emoji: '👤' },
        { label: 'Clear Completion Ping', value: 'clear_ping', emoji: '🗑️' }
      )
  );

  const backButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  );

  return [channelRow, pingRow, backButtonRow];
}

function getSetupDashboardEmbed() {
  return new EmbedBuilder()
    .setTitle('Bot Setup')
    .setDescription('Manage and configure your bot\'s features using the options below.')
    .setColor(0x2f3136);
}

function getSetupDashboardComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_tracker_settings')
        .setLabel('Tracker Settings')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

export async function handleSetupInteraction(interaction) {
  if (interaction.isButton()) {
    if (interaction.customId === 'setup_tracker_settings') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const embed = await getTrackerSettingsEmbed();
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    if (interaction.customId === 'setup_back') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }
      await interaction.deferUpdate();
      const embed = getSetupDashboardEmbed();
      const components = getSetupDashboardComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }

    if (interaction.customId === 'tracker_cancel_role' || interaction.customId === 'tracker_cancel_user') {
      await interaction.deferUpdate();
      const embed = await getTrackerSettingsEmbed();
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'tracker_select_ping') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const choice = interaction.values[0];

      if (choice === 'clear_ping') {
        try {
          const existing = await getSettings();
          await saveSettings({
            trackingChannelId: existing?.trackingChannelId,
            completionPingType: null,
            completionPingId: null,
          });
        } catch (error) {
          console.error('Tracker Settings: failed to clear ping:', error.message);
          return interaction.editReply({
            content: 'An error occurred while saving the configuration. Please try again.',
            components: getTrackerSettingsComponents(),
          });
        }
        const embed = await getTrackerSettingsEmbed();
        const components = getTrackerSettingsComponents();
        await interaction.editReply({ embeds: [embed], components });
        return;
      }

      if (choice === 'pick_role') {
        const roleSelectRow = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId('tracker_select_role')
            .setPlaceholder('Select a role to ping')
            .setMinValues(1)
            .setMaxValues(1)
        );
        const cancelButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('tracker_cancel_role')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        const embed = await getTrackerSettingsEmbed();
        await interaction.editReply({ embeds: [embed], components: [roleSelectRow, cancelButtonRow] });
        return;
      }

      if (choice === 'pick_user') {
        const userSelectRow = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId('tracker_select_user')
            .setPlaceholder('Select a user to ping')
            .setMinValues(1)
            .setMaxValues(1)
        );
        const cancelButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('tracker_cancel_user')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        const embed = await getTrackerSettingsEmbed();
        await interaction.editReply({ embeds: [embed], components: [userSelectRow, cancelButtonRow] });
        return;
      }
    }
  }

  if (interaction.isRoleSelectMenu()) {
    if (interaction.customId === 'tracker_select_role') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const roleId = interaction.values[0];

      try {
        const existing = await getSettings();
        await saveSettings({
          trackingChannelId: existing?.trackingChannelId,
          completionPingType: 'role',
          completionPingId: roleId,
        });
      } catch (error) {
        console.error('Tracker Settings: failed to save role ping:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getTrackerSettingsComponents(),
        });
      }

      const embed = await getTrackerSettingsEmbed();
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }

  if (interaction.isUserSelectMenu()) {
    if (interaction.customId === 'tracker_select_user') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const userId = interaction.values[0];

      try {
        const existing = await getSettings();
        await saveSettings({
          trackingChannelId: existing?.trackingChannelId,
          completionPingType: 'user',
          completionPingId: userId,
        });
      } catch (error) {
        console.error('Tracker Settings: failed to save user ping:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getTrackerSettingsComponents(),
        });
      }

      const embed = await getTrackerSettingsEmbed();
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }

  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === 'tracker_select_channel') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to interact with this setup.',
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();
      const channelId = interaction.values[0];

      try {
        const existing = await getSettings();
        await saveSettings({
          trackingChannelId: channelId,
          completionPingType: existing?.completionPingType,
          completionPingId: existing?.completionPingId,
        });
      } catch (error) {
        console.error('Tracker Settings: failed to save channel:', error.message);
        return interaction.editReply({
          content: 'An error occurred while saving the configuration. Please try again.',
          components: getTrackerSettingsComponents(),
        });
      }

      const embed = await getTrackerSettingsEmbed();
      const components = getTrackerSettingsComponents();
      await interaction.editReply({ embeds: [embed], components });
      return;
    }
  }
}
