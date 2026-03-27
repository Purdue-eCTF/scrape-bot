import { Publisher } from 'zeromq';
import { ATTACK_PUSH_PORT } from '../config';


let attackPub: Publisher;

export async function initAttackPub() {
    attackPub = new Publisher();
    await attackPub.bind(`tcp://0.0.0.0:${ATTACK_PUSH_PORT}`);

    // TODO: attack server log subscriber ...
}

export async function publishAttackRequest(team: string, type: 'new' | 'manual' | 'sus') {
    // const path = `/home/ubuntu/scrape-bot/temp/${team}`;
    await attackPub.send([type, team]);
}
