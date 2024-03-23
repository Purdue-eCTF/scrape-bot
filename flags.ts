export function generateScript(team: string, flag: string, chall: number, delay?: number) {
    return `let TEAM = '${team.replaceAll('\'', '\\\'')}';
let FLAG = '${flag.replaceAll('\'', '\\\'')}';
let CHALL = ${chall};
let DELAY_MS = ${delay ?? 1000};


async function trySubmit() {
    const raw = await (await fetch('https://sb.ectf.mitre.org/game', {
        headers: {'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'}
    })).text();
    const teams = [...raw.matchAll(/<tr style=''>\\n<td class='text-center break-word'><a style="color:inherit;" href="\\/teams\\/(\\d+)\\/summary">(\\w+)<\\/a><\\/td>/g)];

    const res = teams.find(([, _, name]) => name === TEAM);
    if (!res) {
        console.log(\`\${TEAM} not found! Trying again in \${DELAY_MS} ms. Found teams:\\n\${teams.map(([, id, name]) => \`- \${name} (id \${id})\`).join('\\n')}\`);
        return setTimeout(trySubmit, DELAY_MS);
    }

    const [, id, _] = res;

    const submitRaw = await (await fetch(\`https://sb.ectf.mitre.org/game/teams/\${id}/challenges/\${CHALL}\`)).text();
    if (submitRaw.includes('Flag accepted!')) {
        return console.log(\`Flag \${id} already submitted for \${TEAM}!\`)
    }

    const data = new FormData();

    const matches = submitRaw.matchAll(/<input.+?name="(.+?)".+?value="(.+?)"/g);
    for (const [, name, value] of matches) {
        data.set(name, value);
    }
    data.set('challenge[submitted_flag]', FLAG);

    const flagRaw = await (await fetch(\`https://sb.ectf.mitre.org/game/teams/\${id}/challenges/\${CHALL}\`, {
        method: 'POST',
        body: data
    })).text();

    if (flagRaw.includes('alert-danger'))
        return console.log('Flag incorrect!');

    console.log('Flag submitted!');
}

void trySubmit();
`
}
