import { ctfd } from './challenges';


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

    try {
        const entries = await ctfd.scoreboard.get();
        const remaining = new Set(Object.keys(scoreboard));
        lastUpdated = new Date();

        for (const { pos, name, score, account_url } of entries) {
            const absoluteUrl = new URL(account_url, 'https://ectf.ctfd.io/');

            scoreboard[name] = {
                name,
                rank: pos,
                href: absoluteUrl.href,
                points: score,
                prevRank: resetDiffs ? pos : (scoreboard[name]?.prevRank ?? pos),
                prevPoints: resetDiffs ? score : (scoreboard[name]?.prevPoints ?? 0)
            }
            remaining.delete(name);
        }

        // Delete teams that have been removed from the scoreboard
        for (const team of remaining) {
            console.log(`[SCORE] Team ${team} removed from scoreboard!`);
            delete scoreboard[team];
        }
    } catch (e) {
        console.error('Fetching CTFd scoreboard failed:', e);
    }
}
