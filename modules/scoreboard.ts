import { ctfdClient } from './challenges';


type TeamData = {
    name: string,
    rank: number,
    href: string,
    points: number,

    prevRank: number,
    prevPoints: number,
}
export const scoreboard: { [name: string]: TeamData } = {};
export let lastUpdated: Date;

export async function fetchAndUpdateScoreboard(resetDiffs: boolean = false) {
    console.log('[SCORE] Re-fetching eCTF scoreboard');

    const entries = await ctfdClient.getScoreboard();
    lastUpdated = new Date();

    for (const { pos, name, score, account_url } of entries) {
        const absoluteHref = `https://ectf.ctfd.io/${account_url}`;

        scoreboard[name] = {
            name,
            rank: pos,
            href: absoluteHref,
            points: score,
            prevRank: resetDiffs ? pos : (scoreboard[name]?.prevRank ?? pos),
            prevPoints: resetDiffs ? score : (scoreboard[name]?.prevPoints ?? 0)
        }
    }
}
