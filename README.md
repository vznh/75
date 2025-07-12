# kept

Developing should be easy - see `index.ts` for most functionality, `bot.ts` if you want to add more buttons.
Environment variables look like
```.env
DISCORD_TOKEN=[your_value_here]     # Your bot token
SUPABASE_URL=[your_value_here]      # Not needed as of v1
SUPABASE_ANON_KEY=[your_value_here] # Not needed as of v1
MAIN_CHANNEL_ID=[your_value_here]   # Your main channel where the bot's actions are
LOG_CHANNEL_ID=[your_value_here]    # The channel where the bot could output their logs
```

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev
```


This project was created using `bun init` in bun v1.0.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
