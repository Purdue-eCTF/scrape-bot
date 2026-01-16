import { Readable } from 'node:stream';
import AdmZip from 'adm-zip';
import unzip from 'unzip-stream';


export async function bufferAndUnzip(res: Response, dest: string) {
    const buf = await res.arrayBuffer();

    const zip = new AdmZip(Buffer.from(buf));
    zip.extractAllTo(dest);
}

export async function streamAndUnzip(res: Response, dest: string) {
    return new Promise<void>(async (resolve) => {
        Readable.fromWeb(res.body!)
            .pipe(unzip.Extract({ path: dest }))
            .on('close', () => resolve());
    })
}
