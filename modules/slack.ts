import { App } from '@slack/bolt';
import AdmZip from 'adm-zip';
import { exec } from 'node:child_process';
import { notifyTargetPush } from '../bot';

// Config
import { SLACK_SIGNING_SECRET, SLACK_TOKEN, TARGETS_REPO_URL } from '../auth';
import { SLACK_TARGET_CHANNEL_ID } from '../config';


export const slack = new App({
    token: SLACK_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET
});

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

    // Parse ip, ports from message content
    const [, ip, portLow, portHigh] = message.text.match(/IP:\s+(.+?)\n.*?Ports:\s+(\d+)-(\d+)/)!;

    // In parallel: fetch raw file from Slack API and prepare repo for extraction
    const [, buf] = await Promise.all([
        execAsync('cd temp && git fetch && git reset --hard origin/main'),
        fetch(file.url_private_download!, {
            headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` }
        }).then((r) => r.arrayBuffer())
    ])

    const zip = new AdmZip(Buffer.from(buf));
    zip.extractAllTo(`./temp/${name}`);
    console.log('[SLACK] Extracted', file.name);

    // TODO: automated attack tests

    await execAsync(`cd temp && git add . && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${name}" && git push`);

    await notifyTargetPush(name, ip, portLow, portHigh);
});

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
    await execAsync(`git clone ${TARGETS_REPO_URL} temp || (cd temp && git fetch && git reset --hard origin/main)`);
    console.log(await execAsync('cd temp && git status'));
}
