import { CTFdClient, Challenge } from '@b01lers/ctfd-api';


export const ctfd = new CTFdClient({
    url: 'https://ectf.ctfd.io/',
    username: process.env.CTFD_EMAIL!,
    password: process.env.CTFD_PASSWORD!,
})

export let challenges: Challenge[] = [];

export async function fetchAndUpdateChallenges() {
    console.log('[CHALL] Re-fetching eCTF challenges');

    try {
        challenges = await ctfd.challenges.get();
    } catch (e) {
        console.error('Fetching CTFd challenges failed:', e);
    }
}

const CHALLENGE_FORMATS = [
    { name: "Steal Design", prefix: "steal_" },
    { name: "Read Update", prefix: "update_" },
    { name: "Read Design", prefix: "design_" },
    { name: "Compromise Machine", prefix: "compromise_" },
    { name: "Backdoored Design", prefix: "backdoor_" }
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

    const data = await ctfd.challenges.submitFlag(chall.id, flag);
    return `Found potential flag: \`${flag}\` [submitted w/ status \`${data.status}\`]`
}
