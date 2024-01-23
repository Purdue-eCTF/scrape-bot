type TeamData = {
    rank: number,
    href: string,
    achievements: number,
    points: number,
}
const scoreboard: {[name: string]: TeamData} = {};
const top5: string[] = [];


async function fetchAndUpdateScoreboard() {
    const raw = await (await fetch('https://sb.ectf.mitre.org/game/summary')).text();

    const tables = raw.matchAll(/<tbody class='.*?' id='.*?'>([^]+?)<\/tbody>/g);
    for (const [, raw] of tables) {
        const teams = raw.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td class='break-word'>\s*<a href="(.+?)">(\w+)<\/a>\s*<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>[^]+?<\/td>\s*<\/tr>/g);

        for (const [, rank, href, name, achievements, points] of teams) {
            console.log(rank, href, name, achievements, points);

            scoreboard[name] = {
                rank: Number(rank),
                href: `https://sb.ectf.mitre.org${href}`,
                achievements: Number(achievements),
                points: Number(points)
            }
        }
    }
}
