import {
  getInviteRecord,
  upsertInviteRecord,
  createInvitedMember,
  getInvitedMember,
  updateInvitedMember,
} from '../utils/invite-db.js';

const inviteCache = new Map();

export function getGuildInviteCache(guildId) {
  if (!inviteCache.has(guildId)) {
    inviteCache.set(guildId, new Map());
  }
  return inviteCache.get(guildId);
}

export async function syncGuildInvites(guild) {
  let invites;
  try {
    invites = await guild.invites.fetch();
  } catch {
    return;
  }
  const cache = getGuildInviteCache(guild.id);
  cache.clear();
  for (const invite of invites.values()) {
    cache.set(invite.code, {
      code: invite.code,
      uses: invite.uses || 0,
      inviterId: invite.inviter?.id || null,
    });
  }
}

export async function detectUsedInvite(guild, member) {
  let newInvites;
  try {
    newInvites = await guild.invites.fetch();
  } catch {
    return null;
  }

  const cache = getGuildInviteCache(guild.id);

  let usedInvite = null;
  for (const invite of newInvites.values()) {
    const cached = cache.get(invite.code);
    const cachedUses = cached?.uses ?? 0;

    if (invite.uses > cachedUses) {
      usedInvite = invite;
      break;
    }

    if (!cached && invite.uses > 0) {
      usedInvite = invite;
      break;
    }
  }

  for (const invite of newInvites.values()) {
    cache.set(invite.code, {
      code: invite.code,
      uses: invite.uses || 0,
      inviterId: invite.inviter?.id || null,
    });
  }

  if (!usedInvite && guild.vanityURLCode) {
    let vanityData;
    try {
      vanityData = await guild.fetchVanityData();
    } catch {
      vanityData = null;
    }
    if (vanityData && vanityData.uses > 0) {
      return {
        code: guild.vanityURLCode,
        inviterId: null,
        vanity: true,
      };
    }
  }

  return usedInvite
    ? { code: usedInvite.code, inviterId: usedInvite.inviter?.id || null, vanity: false }
    : null;
}

export async function recordInvite(guild, member, inviteInfo) {
  const guildId = guild.id;
  const userId = member.id;

  if (inviteInfo?.vanity) {
    return;
  }

  const inviterId = inviteInfo?.inviterId;
  const code = inviteInfo?.code;
  if (!inviterId || !code) return;

  const existingMember = await getInvitedMember(guildId, userId);
  if (existingMember) {
    // Rejoin detection — always enabled
    if (existingMember.inviterId === inviterId) {
      await updateInvitedMember(guildId, userId, { status: 'rejoined' });
    } else {
      await updateInvitedMember(guildId, userId, {
        inviterId,
        code,
        status: 'rejoined',
      });
    }
    return;
  }

  await createInvitedMember({
    guildId,
    userId,
    userTag: member.user.tag,
    inviterId,
    inviterTag: null,
    code,
    status: 'active',
    joinedAt: Date.now(),
  });

  const existing = await getInviteRecord(guildId, code);
  if (existing) {
    await upsertInviteRecord({
      guildId,
      code,
      inviterId,
      uses: (existing.uses || 0) + 1,
      fake: false,
    });
  } else {
    await upsertInviteRecord({
      guildId,
      code,
      inviterId,
      uses: 1,
      fake: false,
    });
  }
}

export async function markMemberLeft(guildId, userId) {
  const member = await getInvitedMember(guildId, userId);
  if (!member) return;

  if (member.status === 'rejoined') {
    await updateInvitedMember(guildId, userId, { status: 'left', leftAt: Date.now() });
  } else if (member.status === 'active') {
    await updateInvitedMember(guildId, userId, { status: 'left', leftAt: Date.now() });
  }
}

export async function markFakeInvite(guildId, userId) {
  await updateInvitedMember(guildId, userId, { status: 'fake' });

  const member = await getInvitedMember(guildId, userId);
  if (member?.code) {
    const record = await getInviteRecord(guildId, member.code);
    if (record) {
      await upsertInviteRecord({
        guildId,
        code: member.code,
        inviterId: record.inviterId,
        uses: record.uses,
        fake: true,
      });
    }
  }
}

export async function removeInviteFromCache(guildId, code) {
  const cache = getGuildInviteCache(guildId);
  cache.delete(code);
}

export async function addInviteToCache(guildId, invite) {
  const cache = getGuildInviteCache(guildId);
  cache.set(invite.code, {
    code: invite.code,
    uses: invite.uses || 0,
    inviterId: invite.inviter?.id || null,
  });
}

export async function updateInviteInCache(guildId, invite) {
  const cache = getGuildInviteCache(guildId);
  cache.set(invite.code, {
    code: invite.code,
    uses: invite.uses || 0,
    inviterId: invite.inviter?.id || null,
  });
}
