export const name = 'ready';
export const once = true;

export function execute(client) {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Bot is online and ready in ${client.guilds.cache.size} guild(s).`);
}
