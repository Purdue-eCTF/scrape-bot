import { client } from './bot';
import { server } from './modules/status';
import { initTargetsRepo, slack } from './modules/slack';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { fetchAndUpdateChallenges } from './modules/challenges';

// Config
import { DISCORD_TOKEN } from './auth';
import { BOLT_PORT, EXPRESS_PORT } from './config';


void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

// Start discord bot, slack bot, and status server.
void client.login(DISCORD_TOKEN);
void slack.start(BOLT_PORT);

server.listen(EXPRESS_PORT, () => {
    console.log(`[BUILD] Started express server on port ${EXPRESS_PORT}`);
});
