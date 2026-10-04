# Discord Admin Bot

A modular Discord bot built with Discord.js v14 and Node.js. Provides administrator-only slash commands for message management, embed creation, and Roblox follower tracking.

## Commands

| Command | Description |
|--------|-------------|
| `/embed <title> <description> [color] [image] [thumbnail] [footer]` | Send a formatted embed message with optional color, image, thumbnail, and footer. |
| `/reaction <messageid> <emojis>` | Add reactions to a message in the current channel. |
| `/track <roblox_username> <milestone>` | Start tracking a Roblox user's follower count toward a milestone. |
| `/setup` | Open the bot setup dashboard to configure bot appearance and tracker settings. |
| `q. Track stop` | Stop the currently active follower tracker (prefix command). |

All commands require the **Administrator** Discord permission.

## Setup Dashboard

Use `/setup` to open a dashboard with two panels:

### Bot Appearance

Customize the bot's **server-specific** appearance — changes only affect the current server and do not modify the bot's global Discord profile.

- **🖼️ Bot Profile** — Set a server-specific avatar/profile picture from an image URL.
- **🏳️ Bot Banner** — Set a server-specific banner from an image URL.
- **✏️ Bot Bio** — Set a server-specific bio/about me via a text input modal.
- **Reset buttons** — Clear any server-specific avatar, banner, or bio back to the global default.

The bot must have the **Manage Nicknames** permission in the server to modify its own server-specific profile.

### Tracker Settings

- **Tracking Channel** — where tracker embeds are posted.
- **Completion Ping** — a role or user to mention when the milestone is reached.

## Tracker System

The bot tracks a Roblox user's follower count and posts updates in a configured Discord channel:

- Only one tracker can be active per guild at a time (enforced via MongoDB persistent state).
- The tracker checks the Roblox follower count every 60 seconds.
- The tracker survives bot restarts — active trackers are restored from MongoDB and resume 1-minute checks.
- Roblox API rate limits (429) are handled with exponential backoff — the tracker stays active while waiting to retry.
- Follower growth rates (followers/min, followers/hour, followers/day) are calculated from stored follower-count history with timestamps and displayed in the tracking embed. If there is not enough history yet, "Calculating..." is shown.
- When the follower milestone is reached, a completion embed is posted and the configured role/user is pinged. The tracker and its interval are fully stopped.
- The tracker always uses the currently saved tracking channel from `/setup → Tracker Settings`. If the channel is changed, all future updates use the new channel.
- Changing the tracking channel via `/setup` takes effect immediately for the active tracker.
- Use `q. Track stop` to stop tracking — this fully stops the tracker and its interval.

## Setup

1. Create a bot application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy `.env.example` to `.env` and fill in your bot token, client ID, and MongoDB URI.
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
| `DISCORD_GUILD_ID` | No | Guild ID for instant guild-specific command registration (omit for global, which can take up to 1 hour) |
| `MONGO_URI` | Yes | MongoDB connection string for tracker persistence |

## Project Structure

```
src/
  index.js               - Bot entry point
  deploy-commands.js     - Slash command registration script
  config.js              - Environment variable loading and validation
  commands/
    embed.js             - /embed command
    reaction.js          - /reaction command
    track.js             - /track command
    setup.js             - /setup command
  events/
    ready.js             - Bot ready event (registration + tracker restore)
    interactionCreate.js - Slash command + component + modal interaction handler
    messageCreate.js     - Prefix command handler (q. Track stop)
  services/
    tracker-service.js   - Follower checking loop and completion logic
  utils/
    permissions.js       - Administrator permission check
    validate.js          - URL and color validation
    register-commands.js - Shared slash command registration logic
    database.js          - MongoDB connection manager
    tracker-db.js        - Tracker and settings database operations
    roblox.js            - Roblox API utilities
    setup-interactions.js - Setup dashboard button/select/modal handlers (tracker + appearance)
```

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new project on [Railway](https://railway.app) and connect the repository.
3. Add the `DISCORD_TOKEN`, `CLIENT_ID`, `DISCORD_GUILD_ID`, and `MONGO_URI` environment variables in Railway.
4. Set the build command to `npm install` and the start command to `npm start`.
5. Slash commands are registered automatically when the bot starts. You can also run `npm run deploy` manually if needed.
