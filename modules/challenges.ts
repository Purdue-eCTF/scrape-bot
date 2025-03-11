import { CTFdClient, ChallengeData } from '@b01lers/ctfd-api';
import { CTFD_EMAIL, CTFD_PASSWORD } from '../auth';


export const ctfdClient = new CTFdClient({
    url: 'https://ectf.ctfd.io/',
    username: CTFD_EMAIL,
    password: CTFD_PASSWORD,
})

export let challenges: ChallengeData[] = [];

export async function fetchAndUpdateChallenges() {
    console.log('[CHALL] Re-fetching eCTF challenges');

    challenges = await ctfdClient.getChallenges();
}

const CHALLENGE_FORMATS = [
    {
        name: "Expired Subscription",
        prefix: "expired_",
    },
    {
        name: "Pirated Subscription",
        prefix: "pirate_",
    },
    {
        name: "No Subscription",
        prefix: "nosub_",
    },
    {
        name: "Recording Playback",
        prefix: "recording_"
    },
    {
        name: "Pesky Neighbor",
        prefix: "neighbor_",
    }
];

export function wrapFlagForChallenge(challengeName: string, flag: string) {
    if (flag.includes("ectf{"))
        return flag;

    const challenge = CHALLENGE_FORMATS.find(chall => challengeName.includes(chall.name));
    if (!challenge)
        return flag;

    return `ectf{${challenge.prefix}${flag}}`;
}

