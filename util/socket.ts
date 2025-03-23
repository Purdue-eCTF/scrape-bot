import { Socket } from "node:net";

export async function readLines(socket: Socket, callback: (line: string) => boolean | void) {
    let lineBuf = "";

    function listen(d: Buffer) {
        const [curr, ...lines] = d.toString().split("\n");
        lineBuf += curr;

        for (const line of lines) {
            if (callback(lineBuf)) {
                socket.removeListener("data", listen);
                return;
            }
            lineBuf = line;
        }
    }
    socket.on("data", listen);
}
