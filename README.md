# scrape-bot
 Scrapes the eCTF scoreboard for rank changes.

https://discord.com/oauth2/authorize?client_id=1199441161077674105&scope=bot+applications.commands&permissions=8

### Running locally
Create a file called `auth.ts` that exports your Discord token, express server port, and channel / message IDs:
```ts
// auth.ts
export const token = 'very-real-discord-token';
export const notifyChannelId = '...';

export const statusChannelId = '...';
export const statusMessageId = '...';

export const port = 8080;
```
For build status integration, the ID of the build message can't really be obtained until a build status message is sent
in the first place. In such a case, leave the ID field blank, then force-send a status message and update the ID
accordingly.

Install dependencies with `npm install` and run `npm start` to start the bot.
