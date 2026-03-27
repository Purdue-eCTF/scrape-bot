import { client } from './bot';
import { initZulipClient } from './modules/zulip';
import { fetchAndUpdateScoreboard } from './modules/scoreboard';
import { fetchAndUpdateChallenges } from './modules/challenges';
import { initBoardStatusSubscription } from './modules/boardStatus';
import { initBuildStatusSubscription } from './modules/buildStatus';
import { initBuildElfSubscription } from './modules/buildElfSub';
import { initFlagProxy } from './modules/flagProxy';
import { initTargetsRepo } from './util/files';
import { initAttackPub } from './modules/attackPub';


void initTargetsRepo();

void fetchAndUpdateScoreboard(true);
setInterval(fetchAndUpdateScoreboard, 1000 * 60);

void fetchAndUpdateChallenges();
setInterval(fetchAndUpdateChallenges, 1000 * 60);

// Start discord, zulip bots and initialize zeromq connections
void client.login(process.env.DISCORD_TOKEN);
void initZulipClient();

void initBoardStatusSubscription();
void initBuildStatusSubscription();
void initBuildElfSubscription();
void initFlagProxy();
void initAttackPub();
