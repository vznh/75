# kept
Me and my friends want to do 75 hard, but it's pretty ambiguous on how we submit stuff. Built in less than 12 hours, keeps us accountable & logs in an organized format.

Roadmap is looking pretty short (because it's just gonna last us 75 days), just adding who hasn't done it yet, adding slash commands to find certain days, etc..  

Developing should be easy - see `index.ts` for most functionality, `bot.ts` if you want to add more buttons.
Environment variables look like
```.env
DISCORD_TOKEN=[your_value_here]     # Your bot token
SUPABASE_URL=[your_value_here]      # Not needed as of v1
SUPABASE_ANON_KEY=[your_value_here] # Not needed as of v1
MAIN_CHANNEL_ID=[your_value_here]   # Your main channel where the bot's actions are
LOG_CHANNEL_ID=[your_value_here]    # The channel where the bot could output their logs
```
Want to install **kept** in your own repository? Click [here](https://discord.com/oauth2/authorize?client_id=1393141688972607589&permissions=0&integration_type=0&scope=bot+applications.commands).
To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev
```
