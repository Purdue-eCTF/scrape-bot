# scrape-bot
 Scrapes the eCTF scoreboard for rank changes.

https://discord.com/oauth2/authorize?client_id=1199441161077674105&scope=bot+applications.commands&permissions=8

### Running locally
Create a file called `auth.ts` that exports your Discord token and notification channel ID:
```ts
// bot.ts
export const token = 'very-real-discord-token';
export const notifyChannelId = '...';
```
Install dependencies with `npm install` and run `npm start` to start the bot.
