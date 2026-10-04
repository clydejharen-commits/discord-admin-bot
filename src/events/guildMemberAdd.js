import { detectUsedInvite, recordInvite } from '../services/invite-service.js';
import { getInviteSettings } from '../utils/invite-db.js';

export const name = 'guildMemberAdd';

export async function execute(member) {
  if (member.user.bot) return;
  const guild = member.guild;

  const inviteInfo = await detectUsedInvite(guild, member);

  if (inviteInfo) {
    await recordInvite(guild, member, inviteInfo);

    const settings = await getInviteSettings(guild.id);
    if (settings?.inviteLogChannelId) {
      const logChannel = guild.channels.cache.get(settings.inviteLogChannelId);
      if (logChannel) {
        try {
          const inviterTag = inviteInfo.inviterId
            ? `<@${inviteInfo.inviterId}>`
            : inviteInfo.vanity
              ? 'Vanity URL'
              : 'Unknown';
          await logChannel.send({
            content: `📥 <@${member.id}> (${member.user.tag}) joined.\nInvited by: ${inviterTag}\nInvite code: \`${inviteInfo.code}\``,
          });
        } catch {
          // ignore log send errors
        }
      }
    }
  }
}
