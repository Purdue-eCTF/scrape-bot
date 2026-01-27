import { client } from './bot';
import { initZulipClient } from './modules/zulip';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { fetchAndUpdateChallenges } from './modules/challenges';


void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

// Start discord bot, zulip bot, and status server.
void client.login(process.env.DISCORD_TOKEN);
void initZulipClient();
