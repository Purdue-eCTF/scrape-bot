import { Socket } from 'node:net';

export async function readLines(socket: Socket, callback: (line: string) => boolean | void | Promise<boolean | void>) {
    let lineBuf = '';

    async function listen(d: Buffer) {
        const [curr, ...lines] = d.toString().split('\n');
        lineBuf += curr;

        for (const line of lines) {
            if (await callback(lineBuf)) {
                socket.removeListener('data', listen);
                return;
            }
            lineBuf = line;
        }
    }
    socket.on('data', listen);
}
