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
export const failureChannelId = '...';

export const port = 8080;
```
For build status integration, the ID of the build message can't really be obtained until a build status message is sent
in the first place. In such a case, leave the ID field blank, then force-send a status message and update the ID
accordingly.

Install dependencies with `npm install` and run `npm start` to start the bot.

To run with docker,
```bash
docker-compose up -d --build
```

### Scoreboard
This bot periodically scrapes the eCTF scoreboard for updates, sending a report of changes each day. Alternatively, run
`/report` to get a preliminary report of the day so far.

<p align="center">
    <img width="400" src="https://gist.github.com/assets/60120929/a60a96eb-bb4c-4b87-9ea1-78bdaee75a1f"> <img width="400" src="https://gist.github.com/assets/60120929/541e6bb6-a2e3-439f-9b41-59d1fc8307a3">
</p>

### Build server
This bot also integrates with the `nix-shell` [build server](https://github.com/Purdue-eCTF-2024/build-server) for automated
build status alerting during the dev phase.

<img width="450" src="https://gist.github.com/assets/60120929/24fcbcc5-56ef-4031-8b28-aa9e38e226cc">
<img width="450" src="https://gist.github.com/assets/60120929/3d080e03-cef9-4138-9f9f-c81d96d0c6fc">

### Flag submission userscript
In case a Tufts situation occurs again, this bot contains a generator for a script to automatically scrape the flag
submission page and submit a flag as soon as it becomes possible.

<p align="center">
    <img width="700" src="https://gist.github.com/assets/60120929/602c2399-aeba-4943-8e26-ffa7ce251ccf">
</p>

