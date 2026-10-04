import { addInviteToCache } from '../services/invite-service.js';

export const name = 'inviteCreate';

export async function execute(invite) {
  if (!invite.guild) return;
  await addInviteToCache(invite.guild.id, invite);
}
