type TeamData = {
    name: string,
    rank: number,
    href: string,
    achievements: number,
    points: number,

    prevRank: number,
    prevAchievements: number,
    prevPoints: number,
}
export const scoreboard: {[name: string]: TeamData} = {};
export let lastUpdated: Date;
export let top5: string[] = [];


export async function fetchAndUpdateScoreboard(resetDiffs: boolean = false) {
    console.log('[SCORE] Re-fetching eCTF scoreboard');
    const raw = await (await fetch('https://sb.ectf.mitre.org/game/summary')).text();

    const tables = raw.matchAll(/<tbody class='.*?' id='.*?'>([^]+?)<\/tbody>/g);
    let isTop = true; // TODO: hacky?

    lastUpdated = new Date();
    top5 = [];

    for (const [, raw] of tables) {
        const teams = raw.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td class='break-word'>\s*<a href="(.+?)">(\w+)<\/a>\s*<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>[^]+?<\/td>\s*<\/tr>/g);

        for (const [, rank, href, name, achievements, points] of teams) {
            const absoluteHref = `https://sb.ectf.mitre.org${href}`;

            scoreboard[name] = {
                name,
                rank: Number(rank),
                href: absoluteHref,
                achievements: Number(achievements),
                points: Number(points),

                prevRank: resetDiffs ? Number(rank) : scoreboard[name].prevRank,
                prevAchievements: resetDiffs ? Number(achievements) : scoreboard[name].prevAchievements,
                prevPoints: resetDiffs ? Number(points) : scoreboard[name].prevPoints
            }
            if (isTop) top5.push(name);
        }

        isTop = false;
    }
}
