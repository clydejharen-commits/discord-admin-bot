import { PermissionFlagsBits } from 'discord.js';

export function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}
