import { client } from './bot';
import { initTargetsRepo, slack } from './modules/slack';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { fetchAndUpdateChallenges } from './modules/challenges';

// Config
import { DISCORD_TOKEN } from './auth';
import { BOLT_PORT } from './config';


void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

void client.login(DISCORD_TOKEN);
void slack.start(BOLT_PORT);
