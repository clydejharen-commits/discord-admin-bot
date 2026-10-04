import { markMemberLeft } from '../services/invite-service.js';
import { getInviteSettings } from '../utils/invite-db.js';

export const name = 'guildMemberRemove';

export async function execute(member) {
  if (member.user.bot) return;
  const guild = member.guild;

  await markMemberLeft(guild.id, member.id);

  const settings = await getInviteSettings(guild.id);
  if (settings?.inviteLogChannelId) {
    const logChannel = guild.channels.cache.get(settings.inviteLogChannelId);
    if (logChannel) {
      try {
        await logChannel.send({
          content: `📤 <@${member.id}> (${member.user.tag}) left the server.`,
        });
      } catch {
        // ignore log send errors
      }
    }
  }
}
