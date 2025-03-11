import { Socket } from 'node:net';
import { trySubmitFlag } from './challenges';
import { AUTH_SECRET } from '../auth';


export async function runAttacksOnLocalTarget(team: string): Promise<string> {
    const attackSocket = new Socket();

    attackSocket.connect({
        host: 'ctf.b01lers.com',
        port: 8888
    });

    attackSocket.once('ready', () => {
        attackSocket.write(`${AUTH_SECRET}|attack-target`);
        attackSocket.write(`${team}`)
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
