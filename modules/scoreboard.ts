import { CTFD_API_KEY } from '../auth';


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
export let top5: string[] = [];

type CtfdResponse = {
    success: true,
    data: CtfdScoreboardData[],
}

type CtfdScoreboardData = {
    pos: number,
    account_id: number,
    account_url: string,
    account_type: "user",
    oauth_id: null,
    name: string,
    score: number,
    bracket_id: null,
    bracket_name: null
}

export async function fetchAndUpdateScoreboard(resetDiffs: boolean = false) {
    console.log('[SCORE] Re-fetching eCTF scoreboard');

    const res = await (await fetch('https://ectf.ctfd.io/api/v1/scoreboard', {
        headers: { 'Authorization': CTFD_API_KEY }
    })).json() as CtfdResponse;

    lastUpdated = new Date();

    for (const { pos, name, score, account_url } of res.data) {
        const absoluteHref = `https://ectf.ctfd.io/${account_url}`;

        scoreboard[name] = {
            name,
            rank: pos,
            href: absoluteHref,
            points: score,
            prevRank: resetDiffs ? pos : scoreboard[name].prevRank,
            prevPoints: resetDiffs ? score : scoreboard[name].prevPoints
        }

        if (pos <= 5) top5[pos - 1] = name;
    }
}
