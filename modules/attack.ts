import { createConnection } from 'node:net';
import { trySubmitFlag } from './challenges';
import { AUTH_SECRET } from '../auth';


export async function runAttacksOnLocalTarget(team: string): Promise<string> {
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
        let msg = '';
        let lineBuf = '';

        attackSocket.on('data', async (d) => {
            const [curr, ...lines] = d.toString().split('\n');
            lineBuf += curr;

            for (const line of lines) {
                // Flush the current line
                msg += lineBuf + '\n';

                if (lineBuf.startsWith('%*&')) {
                    res(msg);
                    return;
                }

                const flag = lineBuf.match(/ectf\{.+?}/)?.[0];
                if (flag) {
                    const message = await trySubmitFlag(flag, team);
                    // TODO
                }

                lineBuf = line;
            }
        });
    });
}
