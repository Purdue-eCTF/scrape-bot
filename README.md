# scrape-bot
Scoreboard scraper and automated attack / CI / testing pipeline for eCTF.

[[invite link](https://discord.com/oauth2/authorize?client_id=1199441161077674105&scope=bot+applications.commands&permissions=8)]

![image](https://github.com/user-attachments/assets/eacbbf89-a373-4d48-b739-a21bb3bcca8c)

The main functionality of this Discord bot is split into a few subdomains:

### Dev phase (build server integration)
During the dev phase, Scrape bot acts as a webhook that propagates build / test failures from our GitHub CI pipeline.
<!-- TODO: more? -->

### Attack phase (~~Slack~~ Zulip integration)
In the attack phase, Scrape bot will listen for new targets in the targets channel, and attempt to download and push the new design to the
configured targets repository. The bot also maintains a forum channel for attack discussion and team-specific logging
(like automated attack output).

![image](https://github.com/user-attachments/assets/38bae886-9ebe-4b59-91fb-43f02cfad21a)

![image](https://github.com/user-attachments/assets/ad702c9f-02bc-4a47-a2e0-f78f586f7289)

It will also queue automated attacks against the new target via the build server and submit any flags it finds. For
eCTF 2025, this included dispatching the pesky neighbor scenario automatically with a common attack:

![image](https://github.com/user-attachments/assets/cc7c8a73-3332-44ca-b63b-4fb06e0f583b)

See `/modules/zulip.ts` for more details on the workflows triggered by a target push to the Slack targets channel.


For eCTF 2026, the bot also maintained a read-only Zulip workspace mirror in Discord for quick access to organizer messages:

![mirror1](https://github.com/user-attachments/assets/dd059cf1-02d9-4803-9e17-aae980672ebb)
![mirror2](https://github.com/user-attachments/assets/e147c9de-a41d-437a-8661-5d716e07ae43)

### Convenience commands
The bot also maintains some convenience commands via [`ctfd-api`](https://www.npmjs.com/package/@b01lers/ctfd-api) like
displaying scoreboard reports, challenge listings, and quick flag submissions.

![misc](https://github.com/user-attachments/assets/61447a80-10d9-4673-bcff-f4b11caee11e)
![misc2](https://github.com/user-attachments/assets/9d28d7bc-e3b6-48ff-acde-0a7b7c819aa2)

### Running locally
First, create a `.env` that exports your Discord token and other required credentials:
```env
DISCORD_TOKEN="very-real-discord-token"

ZULIP_USERNAME="...-bot@ectf.zulipchat.com"
ZULIP_API_KEY="..."
ZULIP_REALM="https://ectf.zulipchat.com"

ECTF_API_TOKEN="..."

TARGETS_REPO_URL="https://username:token@github.com/Purdue-eCTF-2024/2024-Targets"

CTFD_EMAIL="..."
CTFD_PASSWORD="..."

AUTH_SECRET="..."
```
- `DISCORD_TOKEN` — your discord bot auth token.

- `ZULIP_USERNAME` — your Zulip bot email.
- `ZULIP_API_KEY` — your Zulip bot API key.
- `ZULIP_REALM` — the Zulip workspace URL.

- `ECTF_API_TOKEN` — the token required to access the new eCTF API.

- `TARGETS_REPO_URL` — the GitHub URL to the targets repository to push new targets to. **If this is a private repository, make sure to include credentials with push access.**

- `CTFD_EMAIL` — the email of your team on CTFd.
- `CTFD_PASSWORD` — the password of your team on CTFd.

See **Zulip bot setup** for how to configure the required Zulip secrets.

Other configuration options are found in `config.ts` (you likely won't need to change these):
- `SCOREBOARD_NOTIFY_CHANNEL_ID` — the discord channel to send scoreboard reports in.
- `STATUS_CHANNEL_ID` — the discord channel to send build status updates in.
- `STATUS_MESSAGE_ID` — the message to update when the status of a build changes. The ID of this message can't really be obtained until a build status message is sent
  in the first place; leave this field blank at first, then force-send a status message and update the ID accordingly.
- `FAILURE_CHANNEL_ID` — the discord channel to send "build failed" notifications in.
- `ATTACK_NOTIFY_CHANNEL_ID` — the Discord channel to send "new target dropped" notifications in.
- `ATTACK_FORUM_CHANNEL_ID` — the Discord forum channel to create target threads in.

- `SLACK_TARGET_CHANNEL_ID` — the Slack channel to listen for target drops in.

- `BUILD_STATUS_PORT` — the port to subscribe to build status messages on (see above diagram).
- `PROV_STATUS_PORT` — the port to subscribe to board status messages on (see above diagram).

Then, install dependencies with `npm install` and run `npm start` to start the bot.

To run with docker,
```bash
docker compose up -d --build
```

### Zulip bot setup
To set up the Zulip integration, create a new Zulip bot in the **Settings > Bots** page:

![image](https://github.com/user-attachments/assets/6ec31e78-09a6-4575-a64e-a654b7e3a0b0)

![image](https://github.com/user-attachments/assets/b0319bb6-0e57-4d0c-9297-dd31f8633673)

Then, you can obtain the required `.env` values from the `.zuliprc` configuration file in **Manage bot**.

To subscribe the bot to a channel, note that the **Manage bot > channels** interface will currently always throw an
error for bot users. Instead, you can add them from the **Channel settings > subscribers** interface like below:

![image](https://github.com/user-attachments/assets/bc7bdf57-ffc0-4b51-9178-0251e4f0552d)

For future reference, note that there is currently no way to delete a bot (see [GH issue](https://github.com/zulip/zulip/issues/10088));
instead, bots can be *deactivated*, but deactivated bots can still be listed in the bots interface and reserve their
`*-bot@*.zulipchat.com` emails.

Further, when reactivating a bot, you'll also need to regenerate the bot's `ZULIP_API_KEY`
(despite not being mentioned in the [docs](https://zulip.com/help/deactivate-or-reactivate-a-bot)). Otherwise, all
requests to the API will fail with
```js
{
  result: 'error',
  msg: 'Account is deactivated',
  code: 'UNAUTHORIZED'
}
```

### Slack bot setup (2025)
To set up the Slack integration, create a new Slack app in the [Slack API portal](https://api.slack.com/apps).

![image](https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/7e6d3a84-3d5f-46f3-a901-b08943ce64b8)

After creating, you can copy your Slack token and signing secret into `.env`.
Then, add OAuth scopes in `OAuth & Permissions`; you'll need, at minimum, `channels:history`, `chat:write`, and `files:read`.

![image](https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/f9330ce2-c8d3-4b9d-9279-ab2c5b4bb90d)

Finally, enable event subscriptions in `Event Subscriptions` and set the request URL to your `bolt-js` server URL i.e.
```
http://ctf.b01lers.com:8081/slack/events
```
Note that your server should be running at this point to respond to Slack's `challenge` request.

![image](https://github.com/Purdue-eCTF-2024/scrape-bot/assets/60120929/d4409772-7fb0-4d03-8955-a5ac1a28c1b2)
