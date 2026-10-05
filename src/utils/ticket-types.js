export const TICKET_TYPES = {
  GIVEAWAY: 'Giveaway',
  SUPPORT: 'Support',
  INVITE_REWARDS: 'Invite Rewards',
  FOLLOWERS: 'Followers',
};

export const TICKET_TYPE_EMOJIS = {
  Giveaway: '🎁',
  Support: '🛠️',
  'Invite Rewards': '👥',
  Followers: '👤',
};

export const VALID_TYPES = Object.values(TICKET_TYPES);

export function getChannelPrefix(ticketType) {
  switch (ticketType) {
    case TICKET_TYPES.GIVEAWAY:
      return 'giveaway';
    case TICKET_TYPES.SUPPORT:
      return 'support';
    case TICKET_TYPES.INVITE_REWARDS:
      return 'invite';
    case TICKET_TYPES.FOLLOWERS:
      return 'followers';
    default:
      return 'ticket';
  }
}

export function sanitizeUsername(username) {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'user';
}

export function buildChannelName(ticketType, username) {
  const prefix = getChannelPrefix(ticketType);
  const cleanName = sanitizeUsername(username);
  return `${prefix}-${cleanName}`;
}

export function isValidType(type) {
  return VALID_TYPES.includes(type);
}

export function generateButtonId() {
  return `btn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
