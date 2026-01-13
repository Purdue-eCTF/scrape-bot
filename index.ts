import { client } from './bot';
import { server } from './modules/status';
import { initZulipClient } from './modules/zulip';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { fetchAndUpdateChallenges } from './modules/challenges';

// Config
import { BOLT_PORT, EXPRESS_PORT } from './config';


void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

// Start discord bot, slack bot, and status server.
void client.login(process.env.DISCORD_TOKEN);
void initZulipClient();

server.listen(EXPRESS_PORT, () => {
    console.log(`[BUILD] Started express server on port ${EXPRESS_PORT}`);
});
