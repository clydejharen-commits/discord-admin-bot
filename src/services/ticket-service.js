import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getTicketSettings,
  getTicketButtons,
  createTicketRecord,
} from '../utils/ticket-db.js';
import {
  TICKET_TYPES,
  TICKET_TYPE_EMOJIS,
  buildChannelName,
} from '../utils/ticket-types.js';

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

export function buildTicketPermissionOverwrites(guild, creatorId, staffRoleId) {
  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: creatorId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  return overwrites;
}

export function buildFullChatPermissionOverwrites(guild, creatorId, staffRoleId) {
  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: creatorId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  return overwrites;
}

// ---------------------------------------------------------------------------
// Ticket creation
// ---------------------------------------------------------------------------

export async function createTicketChannel(guild, creator, ticketType, extraData = {}) {
  const settings = await getTicketSettings(guild.id);
  const categoryId = settings?.ticketCategoryId;

  if (!categoryId) {
    return { error: 'No ticket category is configured. An admin must set it up via `/setup` → Ticket Settings.' };
  }

  const category = await guild.channels.fetch(categoryId).catch(() => null);
  if (!category) {
    return { error: 'The configured ticket category no longer exists. An admin must reconfigure it via `/setup`.' };
  }

  const staffRoleId = settings?.ticketStaffRoleId || null;
  const channelName = buildChannelName(ticketType, creator.username);
  const overwrites = buildTicketPermissionOverwrites(guild, creator.id, staffRoleId);

  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: overwrites,
    });
  } catch (error) {
    console.error('Ticket: failed to create channel:', error.message);
    return { error: 'Failed to create the ticket channel. The bot may lack the required permissions.' };
  }

  const now = Date.now();
  const record = {
    guildId: guild.id,
    channelId: channel.id,
    creatorId: creator.id,
    ticketType,
    status: 'open',
    supportReason: extraData.supportReason || null,
    robloxUsername: extraData.robloxUsername || null,
    giveawayProofStatus: extraData.giveawayProofStatus || null,
    giveawayProofUrl: extraData.giveawayProofUrl || null,
    createdAt: now,
    updatedAt: now,
  };

  await createTicketRecord(record);

  return { channel, record };
}

// ---------------------------------------------------------------------------
// Panel management
// ---------------------------------------------------------------------------

export async function buildTicketPanelComponents(guildId) {
  const buttons = await getTicketButtons(guildId);

  if (buttons.length === 0) {
    return null;
  }

  const options = buttons.map((btn) => ({
    label: btn.name.slice(0, 100),
    value: `ticket_open_${btn.id}`,
    description: btn.type.slice(0, 100),
    emoji: btn.emoji,
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_panel_select')
      .setPlaceholder('Select a ticket type to open...')
      .addOptions(options)
  );

  return row;
}

export async function sendTicketPanel(channel, guildId) {
  const components = await buildTicketPanelComponents(guildId);
  if (!components) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎫 Support Tickets')
    .setDescription('Select a ticket type from the dropdown below to open a ticket.')
    .setColor(0x2f3136);

  return channel.send({ embeds: [embed], components: [components] });
}

export async function updateTicketPanelMessage(guild, messageId) {
  if (!messageId) return;

  const settings = await getTicketSettings(guild.id);
  const channelId = settings?.ticketPanelChannelId;
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const components = await buildTicketPanelComponents(guild.id);

  if (!components) {
    await message.edit({ components: [] }).catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎫 Support Tickets')
    .setDescription('Select a ticket type from the dropdown below to open a ticket.')
    .setColor(0x2f3136);

  await message.edit({ embeds: [embed], components: [components] }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Ticket channel greeting
// ---------------------------------------------------------------------------

export async function sendTicketGreeting(channel, creator, ticketType, extraData = {}) {
  const embed = new EmbedBuilder()
    .setTitle(`${TICKET_TYPE_EMOJIS[ticketType] || '🎫'} ${ticketType} Ticket`)
    .setColor(0x2f3136)
    .addFields(
      { name: 'Ticket Creator', value: `<@${creator.id}>`, inline: true },
      { name: 'Type', value: ticketType, inline: true }
    );

  if (ticketType === TICKET_TYPES.SUPPORT && extraData.supportReason) {
    embed.addFields({ name: 'Reason', value: extraData.supportReason.slice(0, 1024) });
  }

  if (
    (ticketType === TICKET_TYPES.INVITE_REWARDS || ticketType === TICKET_TYPES.FOLLOWERS) &&
    extraData.robloxUsername
  ) {
    embed.addFields({ name: 'Roblox Username', value: extraData.robloxUsername });
  }

  if (ticketType === TICKET_TYPES.GIVEAWAY) {
    embed.setDescription(
      'Please send a **photo/image** proving you won the giveaway.\n' +
      'You will be unable to chat until a valid image is received.'
    );
  }

  const closeButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  return channel.send({ content: `<@${creator.id}>`, embeds: [embed], components: [closeButton] });
}

// ---------------------------------------------------------------------------
// Giveaway proof handling
// ---------------------------------------------------------------------------

export function isValidImageAttachment(attachment) {
  if (!attachment) return false;
  const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  const contentType = attachment.contentType;
  if (contentType && validTypes.includes(contentType)) return true;

  const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  return validExts.some((ext) => attachment.name?.toLowerCase().endsWith(ext));
}

export async function unlockTicketForCreator(guild, channel, creatorId, staffRoleId) {
  const overwrites = buildFullChatPermissionOverwrites(guild, creatorId, staffRoleId);
  try {
    await channel.permissionOverwrites.set(overwrites);
    return true;
  } catch (error) {
    console.error('Ticket: failed to unlock channel:', error.message);
    return false;
  }
}
