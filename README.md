# Discord Admin Bot

A modular Discord bot built with Discord.js v14 and Node.js. Provides administrator-only slash commands for message management and embed creation.

## Commands

| Command | Description |
|--------|-------------|
| `/purge <amount> [message_id]` | Delete a number of recent messages. Optionally exclude a specific message by ID. |
| `/embed <title> <description> [color] [image] [thumbnail] [footer]` | Send a formatted embed message with optional color, image, thumbnail, and footer. |

Both commands require the **Administrator** Discord permission.

## Setup

1. Create a bot application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy `.env.example` to `.env` and fill in your bot token and client ID.
3. Invite the bot to your server with the `applications.commands` and `bot` scopes.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Register slash commands:
   ```bash
   npm run deploy
   ```
6. Start the bot:
   ```bash
   npm start
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `CLIENT_ID` | Yes | Application/Bot client ID |
| `GUILD_ID` | No | Guild ID for dev command registration (omit for global) |

## Project Structure

```
src/
  index.js              - Bot entry point
  deploy-commands.js    - Slash command registration script
  config.js             - Environment variable loading and validation
  commands/
    purge.js            - /purge command
    embed.js            - /embed command
  events/
    ready.js            - Bot ready event
    interactionCreate.js - Slash command interaction handler
  utils/
    permissions.js      - Administrator permission check
    validate.js         - URL and color validation
```

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new project on [Railway](https://railway.app) and connect the repository.
3. Add the `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` environment variables in Railway.
4. Set the build command to `npm install` and the start command to `npm start`.
5. Run `npm run deploy` once after the bot starts (or locally) to register slash commands.
