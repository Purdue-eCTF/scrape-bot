import {App} from '@slack/bolt';
import AdmZip from 'adm-zip';
import {execSync} from 'node:child_process';
import {notifyTargetPush} from '../bot';
import {ATTACK_CHANNEL_ID, SLACK_SIGNING_SECRET, SLACK_TOKEN, TARGETS_REPO_URL} from '../auth';


export const app = new App({
    token: SLACK_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET
});

app.message(async ({message}) => {
    console.log('[SLACK]', message);

    if (message.type !== 'message') return;
    if (message.subtype !== 'file_share') return;

    // Download zip files from the attack files channel, automatically unzipping and committing
    // them to the targets repository.
    if (message.channel !== ATTACK_CHANNEL_ID) return;
    if (!message.files) return;

    const messages: string[] = [];

    for (const file of message.files.filter((f) => f.filetype === 'zip')) {
        console.log('[SLACK] Found', file.name);

        const buf = await (await fetch(file.url_private_download!, {
            headers: {'Authorization': `Bearer ${SLACK_TOKEN}`}
        })).arrayBuffer();

        const name = file.name!.slice(0, -4);

        const zip = new AdmZip(Buffer.from(buf));
        zip.extractEntryTo(`${name}/`, `./temp`, true, true); // TODO: spotty?
        console.log('[SLACK] Extracted', file.name);

        execSync(`cd temp && git add . && git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${file.name}" && git push`);
        messages.push(`- ${name} (\`${name}.zip\`)`);
    }

    await notifyTargetPush(messages);
});

export async function initGitRepo() {
    console.log('[GIT] Initializing git repository');
    execSync(`git clone ${TARGETS_REPO_URL} temp || (cd temp && git reset origin --hard)`);
    console.log(execSync('cd temp && git status').toString());
}
