import { App } from '@slack/bolt';
import AdmZip from 'adm-zip';
import AsyncLock from 'async-lock';
import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Config
import { SLACK_SIGNING_SECRET, SLACK_TOKEN, TARGETS_REPO_URL } from '../auth';
import { SLACK_TARGET_CHANNEL_ID } from '../config';

// Utils
import { notifyTargetPush } from '../bot';
import { runAttacksOnLocalTarget } from './attack';


export const slack = new App({
    token: SLACK_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET
});

const lock = new AsyncLock();

slack.message(async ({ client, message }) => {
    console.log('[SLACK]', message);

    if (message.type !== 'message') return;
    if (message.subtype !== 'file_share') return;

    // Download zip files from the attack files channel, automatically unzipping and committing
    // them to the targets repository.
    if (message.channel !== SLACK_TARGET_CHANNEL_ID) return;

    // Look for zip files; if `file_access` is present, we need to handle the Slack Connect file download differently.
    // https://api.slack.com/apis/channels-between-orgs#check_file_info
    const raw = message.files?.find((f) => f.filetype === 'zip');
    const file = raw && 'file_access' in raw && raw.file_access === 'check_file_info'
        ? (await client.files.info({ file: raw.id })).file
        : raw

    if (!file) return;

    // Slice off `_package.zip`
    const name = file.name!.slice(0, -12);
    console.log('[SLACK] Found', file.name);

    const { ip, portLow, portHigh } = tryParseIpPort(message.text);

    // Download zip and extract to temp dir
    const buf = await fetch(file.url_private_download!, {
        headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` }
    }).then((r) => r.arrayBuffer())

    const zip = new AdmZip(Buffer.from(buf));
    zip.extractAllTo(`./temp/${name}`);
    console.log('[SLACK] Extracted', file.name);

    // Write ports to target for build server
    await writePortsFile(name, ip, portLow, portHigh);

    // In parallel: send new design to build server, push design to git
    await Promise.all([
        runAttacksOnLocalTarget(name),
        async () => {
            await lock.acquire('git', async () => {
                await execAsync(`cd temp && git pull --ff-only && git add "${name}/" && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${name}" && git push`);
            })

            await notifyTargetPush(name, ip, portLow, portHigh);
        }
    ])
});

function tryParseIpPort(raw: string) {
    const ip = raw.match(/\d+\.\d+\.\d+\.\d+/)?.[0];

    const portMatches = raw.match(/(?<![.\d])(\d+)(?:-(\d+))?(?![.\d])/);
    const portLow = Number(portMatches![1]);
    // const portHigh = portMatches?.[2];

    return {
        ip: ip ?? '34.235.112.89', // If no IP parsed, assume default
        portLow: portLow,
        portHigh: portLow + 4, // Don't bother parsing higher port for typos; assume its always lower + 4
    }
}

export async function writePortsFile(name: string, ip: string, portLow: number, portHigh: number) {
    const ports = new Array(portHigh - portLow).fill(0).map((_, i) => portLow + i);
    await writeFile(`./temp/${name}/ports.txt`, `${ip} ${ports.join(' ')}`);
}

function execAsync(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            return resolve(stdout);
        });
    })
}

export async function initTargetsRepo() {
    console.log('[GIT] Initializing targets repository');
    await execAsync(`git clone ${TARGETS_REPO_URL} temp || (cd temp && git fetch && git pull --ff-only)`);
    console.log(await execAsync('cd temp && git status'));
}
