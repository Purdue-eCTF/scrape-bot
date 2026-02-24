import { writeFile } from 'node:fs/promises';
import AdmZip from 'adm-zip';
import StreamZip from 'node-stream-zip';
import { execAsync } from './exec';


// TODO
export async function writePortsFile(name: string, ip: string, portLow: number, portHigh: number) {
    const ports = new Array(portHigh - portLow + 1).fill(0).map((_, i) => portLow + i);
    await writeFile(`./temp/${name}/ports.txt`, `${ip} ${ports.join(' ')}`);
}

export async function initTargetsRepo() {
    console.log('[GIT] Initializing targets repository');
    await execAsync(
        `git clone ${process.env.TARGETS_REPO_URL} temp || (cd temp && git fetch && git pull --ff-only)`
    );
    console.log(await execAsync('cd temp && git status'));
}

export async function bufferAndUnzipLocal(path: string, dest: string) {
    const zip = new AdmZip(path);
    zip.extractAllTo(dest);
}

export async function streamAndUnzipLocal(path: string, dest: string) {
    const zip = new StreamZip.async({ file: path });
    await zip.extract(null, dest);
    await zip.close();
}
