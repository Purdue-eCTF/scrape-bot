# scrape-bot
Scrapes the eCTF scoreboard for rank changes.

https://discord.com/oauth2/authorize?client_id=1199441161077674105&scope=bot+applications.commands&permissions=8

### Running locally
Create a file called `auth.ts` that exports your Discord token, Slack bot info, express / bolt.js server ports, and channel / message IDs:
```ts
// auth.ts
export const DISCORD_TOKEN = 'very-real-discord-token';
export const SCOREBOARD_NOTIFY_CHANNEL_ID = '...';

export const STATUS_CHANNEL_ID = '...';
export const STATUS_MESSAGE_ID = '...';
export const FAILURE_CHANNEL_ID = '...';

export const SLACK_TOKEN = 'xoxp-very-real-slack-token';
export const SLACK_SIGNING_SECRET = '...';

export const ATTACK_CHANNEL_ID = 'C06D0SZDF5K';
export const ATTACK_NOTIFY_CHANNEL_ID = '...';

export const TARGETS_REPO_URL = 'https://username:token@github.com/Purdue-eCTF-2024/2024-Targets';

export const EXPRESS_PORT = 8080;
export const BOLT_PORT = 8081;
```
- `DISCORD_TOKEN` — the discord bot auth token.
- `SCOREBOARD_NOTIFY_CHANNEL_ID` — the discord channel to send scoreboard reports in.

- `STATUS_CHANNEL_ID` — the discord channel to send build status updates in.
- `STATUS_MESSAGE_ID` — the message to update when the status of a build changes. The ID of this message can't really be obtained until a build status message is sent
in the first place; leave this field blank at first, then force-send a status message and update the ID accordingly.
- `FAILURE_CHANNEL_ID` — the discord channel to send "build failed" notifications in.

- `SLACK_TOKEN` — the Slack auth token.
- `SLACK_SIGNING_SECRET` — the Slack signing secret.

- `ATTACK_CHANNEL_ID` — the Slack channel to listen for target drops in.
- `ATTACK_NOTIFY_CHANNEL_ID` — the Discord channel to send "new target dropped" notifications in.

- `TARGETS_REPO_URL` — the GitHub URL to the targets repository to push new targets to. **If this is a private repository, make sure to include credentials with push access.**

- `EXPRESS_PORT` — the port to run the build-integration express server on.
- `BOLT_PORT` — the port to run the Slack bot on.

See the **Slack autodownload** section for more on how to configure the required Slack secrets.

Then, install dependencies with `npm install` and run `npm start` to start the bot.

To run with docker,
```bash
docker-compose up -d --build
```

### Slack autodownload
> `/modules/slack.ts`

To set up the Slack integration, create a new Slack app in the [Slack API portal](https://api.slack.com/apps).

![image](https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/7e6d3a84-3d5f-46f3-a901-b08943ce64b8)

After creating, you can copy your Slack token and signing secret into `auth.ts`.
Then, add OAuth scopes in `OAuth & Permissions`; you'll likely need, at minimum, `channels:history`, `chat:write`, and `files:read`.

![image](https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/f9330ce2-c8d3-4b9d-9279-ab2c5b4bb90d)

Finally, enable event subscriptions in `Event Subscriptions` and set the request URL to your `bolt-js` server URL i.e.
```
http://ctf.b01lers.com:8081/slack/events
```
Note that your server should be running at this point to respond to Slack's `challenge` request.

![image](https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/d4409772-7fb0-4d03-8955-a5ac1a28c1b2)

### Scoreboard
> `/modules/scoreboard.ts`

This bot periodically scrapes the eCTF scoreboard for updates, sending a report of changes each day. Alternatively, run
`/report` to get a report of the day so far.

<p align="center">
    <img width="400" src="https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/d7c1ad2a-a4fb-428e-a284-9faf25c8a48a"> <img width="400" src="https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/2a2509c3-9295-43f4-bbad-406dad166d6b">
</p>

### Build server
> `/modules/status.ts`

This bot also integrates with the `nix-shell` [build server](https://github.com/Purdue-eCTF-2024/build-server) for automated
build status alerting during the dev phase.

<img width="450" src="https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/3bf83b07-fc5e-4dc1-8a82-835da687e165">
<img width="450" src="https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/fa155833-c128-4e34-aef2-2ffb1f5db19f">

Make sure the build server is configured to send POST requests to this bot's exposed express endpoint properly.

### Flag submission userscript
> `/modules/flags.ts`

In case a Tufts situation occurs again, this bot contains a generator for a userscript to automatically scrape the flag
submission page and submit a flag as soon as possible.

<p align="center">
    <img width="700" src="https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/a86818d0-9031-438f-86ff-02bfde9bb216">
</p>
