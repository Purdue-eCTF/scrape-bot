import type { User } from 'discord.js';
import { createConnection } from 'node:net';
import { AUTH_SECRET } from '../auth';

// Utils
import { trySubmitFlag } from './challenges';
import { truncate } from '../util/misc';


type BuildServerAttackMethod = 'attack-target' | 'attack-script';

/**
 * Initializes a connection to the build server attack interface over raw socket.
 * @param method The attack method to run.
 * @param params Any additional parameters the build server expects to receive, sent immediately after the first ack.
 */
function initBuildServerAttackConn(method: BuildServerAttackMethod, ...params: string[]) {
    const socket = createConnection({
        host: 'host.docker.internal',
        port: 8888
    }, () => {
        socket.write(`${AUTH_SECRET}|${method}`);
        socket.once('data', () => socket.write(params.join('|')));
    });

    return socket;
}

export async function runAttacksOnLocalTarget(team: string): Promise<[string, string[]]> {
    const attackSocket = initBuildServerAttackConn('attack-target', team);

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

                if (lineBuf.startsWith('%*&')) {
                    attackSocket.destroy();
                    return res([logs, alerts]);
                }

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

export async function runCustomAttackOnTarget(team: string, scriptUrl: string): Promise<[string, string[]]> {
    const attackSocket = initBuildServerAttackConn('attack-script', team, scriptUrl);

    return new Promise((res, rej) => {
        const alerts: string[] = [];
        let logs = '';
        let lineBuf = '';
        let flagSubmissions: Promise<void>[] = [];

        attackSocket.on('data', async (d) => {
            const [curr, ...lines] = d.toString().split('\n');
            lineBuf += curr;

            for (const line of lines) {
                // Flush the current line
                logs += lineBuf + '\n';

                if (lineBuf.startsWith('%*&')) {
                    await Promise.all(flagSubmissions);
                    return res([logs, alerts]);
                }

                const flag = lineBuf.match(/ectf\{.+?}/)?.[0];
                if (flag) {
                    flagSubmissions.push(
                        trySubmitFlag(flag, team).then((message) => {
                            alerts.push(message);
                        })
                    );
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

export function formatCustomAttackOutput(name: string, alerts: string[], author: User) {
    const alertText = alerts.length > 0
        ? alerts.map(a => '- ' + a).join('\n')
        : '- No vulnerabilities detected.';

    return truncate(`# Custom attack output for \`${name}\`\n↳ invoked by ${author}\n-# Summary:\n${alertText}`, 4000);
}
