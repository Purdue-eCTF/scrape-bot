import AdmZip from 'adm-zip';
import StreamZip from 'node-stream-zip';
import { execAsync } from './exec';


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
