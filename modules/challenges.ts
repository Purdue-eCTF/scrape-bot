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

    const challenge = CHALLENGE_FORMATS.find((c) => challengeName.includes(c.name));
    if (!challenge)
        return flag;

    return `ectf{${challenge.prefix}${flag}}`;
}

export async function trySubmitFlag(flag: string, team: string) {
    const prefix = flag.match(/ectf\{(\w+?_).+}/)?.[1];
    if (!prefix)
        return `Found potential flag: \`${flag}\` [missing prefix]`

    const scenario = CHALLENGE_FORMATS.find((c) => c.prefix === prefix)?.name;
    if (!scenario)
        return `Found potential flag: \`${flag}\` [missing scenario]`

    const chall = challenges.find((c) => c.name.toLowerCase() === `${scenario} - ${team}`.toLowerCase());
    if (!chall)
        return `Found potential flag: \`${flag}\` [challenge not found]`

    const data = await ctfdClient.submitFlag(chall.id, flag);
    return `Found potential flag: \`${flag}\` [submitted w/ status \`${data.status}\`]`
}
