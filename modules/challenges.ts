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

export const CHALLENGE_FORMATS = [
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
