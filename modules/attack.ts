import { createConnection } from 'node:net';
import { AUTH_SECRET } from '../auth';

// Utils
import { trySubmitFlag } from './challenges';
import { truncate } from '../util/strings';


export async function runAttacksOnLocalTarget(team: string): Promise<[string, string[]]> {
    const attackSocket = createConnection({
        host: 'host.docker.internal',
        port: 8888
    }, () => {
        attackSocket.write(`${AUTH_SECRET}|attack-target`);
        attackSocket.once('data', () => {
            attackSocket.write(`${team}`);
        });
    });

    return new Promise((res, rej) => {
        const alerts: string[] = [];
        let logs = '';
        let lineBuf = '';

        attackSocket.on('data', async (d) => {
            const [curr, ...lines] = d.toString().split('\n');
            lineBuf += curr;

            for (const line of lines) {
                // Flush the current line
                logs += lineBuf + '\n';

                if (lineBuf.startsWith('%*&'))
                    return res([logs, alerts]);

                const flag = lineBuf.match(/ectf\{.+?}/)?.[0];
                if (flag) {
                    const message = await trySubmitFlag(flag, team);
                    alerts.push(message);
                }

                const vuln = lineBuf.match(/POTENTIAL VULNERABILITY: (.+)/)?.[1];
                if (vuln) {
                    alerts.push(`Potential vulnerability: ${vuln}`);
                }

                lineBuf = line;
            }
        });
    });
}

export function formatAttackOutput(name: string, alerts: string[]) {
    const alertText = alerts.length > 0
        ? alerts.map(a => '- ' + a).join('\n')
        : '- No vulnerabilities detected.';

    return truncate(`# Automated attack output for \`${name}\`\n-# Summary:\n${alertText}`, 4000);
}
