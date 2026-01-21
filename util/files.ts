import { Readable } from 'node:stream';
import AdmZip from 'adm-zip';
import StreamZip from 'node-stream-zip';


// export async function streamAndUnzip(res: Response, dest: string) {
//     return new Promise<void>(async (resolve) => {
//         Readable.fromWeb(res.body!)
//             .pipe(unzip.Extract({ path: dest }))
//             .on('close', () => resolve());
//     })
// }

export async function bufferAndUnzipLocal(path: string, dest: string) {
    const zip = new AdmZip(path);
    zip.extractAllTo(dest);
}

export async function streamAndUnzipLocal(path: string, dest: string) {
    const zip = new StreamZip.async({ file: path });
    await zip.extract(null, dest);
    await zip.close();
}
