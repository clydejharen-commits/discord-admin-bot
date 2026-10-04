import { removeInviteFromCache, updateInviteInCache } from '../services/invite-service.js';

export const name = 'inviteDelete';

export async function execute(invite) {
  if (!invite.guild) return;

  await removeInviteFromCache(invite.guild.id, invite.code);

  try {
    const newInvites = await invite.guild.invites.fetch();
    for (const inv of newInvites.values()) {
      await updateInviteInCache(invite.guild.id, inv);
    }
  } catch {
    // ignore fetch errors
  }
}
