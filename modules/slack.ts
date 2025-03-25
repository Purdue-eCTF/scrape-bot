import { AttachmentBuilder } from 'discord.js';
import { App } from '@slack/bolt';
import AdmZip from 'adm-zip';
import AsyncLock from 'async-lock';
import { writeFile } from 'node:fs/promises';

// Utils
import { execAsync } from '../util/exec';
import { broadcastPeskySubmit, notifyTargetPush, updateInfoForTeam } from '../bot';
import { formatAttackOutput, runAttacksOnLocalTarget } from './attack';
import { trySubmitFlag } from './challenges';

// Config
import { SLACK_SIGNING_SECRET, SLACK_TOKEN, TARGETS_REPO_URL } from '../auth';
import { SLACK_TARGET_CHANNEL_ID, SLACK_TEAM_CHANNEL_ID } from '../config';
import { dispatchPeskyNeighbor } from './peskyNeighbor';


export const slack = new App({
    token: SLACK_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET
});

export const lock = new AsyncLock();

/**
 * On message in attack targets channel: unzip target design and push to targets repository,
 * parse IP / ports and create attack forum channel, and run automated attack tests on it.
 */
slack.message(async ({ client, message }) => {
    console.log('[SLACK]', message);

    if (message.type !== 'message') return;
    if (message.subtype !== 'file_share') return;
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

    await writePortsFile(name, ip, portLow, portHigh);

    // In parallel: send new design to build server, push design to git
    const [logs, thread] = await Promise.all([
        runAttacksOnLocalTarget(name).catch(() => {}),
        (async () => {
            await lock.acquire('git', async () => {
                await execAsync(`cd temp && git pull --ff-only && git add -f "${name}/" && (git diff-index --quiet HEAD || git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${name}" && git push)`);
            })

            return notifyTargetPush(name, ip, portLow, portHigh);
        })(),
        dispatchPeskyNeighbor(name)
    ])

    if (logs) thread?.send({
        content: formatAttackOutput(name, logs[1]),
        files: [new AttachmentBuilder(Buffer.from(logs[0])).setName('logs.txt')]
    });
});

/**
 * When a target message is edited: update channel and targets repo with updated ports / IP.
 * TODO: rerun attack tests?
 */
slack.message(async ({ client, message }) => {
    if (message.type !== 'message') return;
    if (message.subtype !== 'message_changed') return;
    if (message.channel !== SLACK_TARGET_CHANNEL_ID) return;

    if (!('files' in message.message) || !message.message.text) return;

    const raw = message.message.files?.find((f) => f.filetype === 'zip');
    const file = raw && 'file_access' in raw && raw.file_access === 'check_file_info'
        ? (await client.files.info({ file: raw.id })).file
        : raw

    if (!file) return;

    const { ip, portLow, portHigh } = tryParseIpPort(message.message.text);
    const name = file.name!.slice(0, -12);

    await updateInfoForTeam(name, ip, portLow, portHigh);

    await writePortsFile(name, ip, portLow, portHigh);
    await lock.acquire('git', async () => {
        await execAsync(`cd temp && git pull --ff-only && git add -f "${name}/" && (git diff-index --quiet HEAD || git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Update ports for ${name}" && git push)`);
    });
});

/**
 * Listen for and automatically submit `flag.txt` pesky neighbor flags in the team channel.
 */
slack.message(async ({ client, message }) => {
    if (message.type !== 'message') return;
    if (message.subtype !== 'file_share') return;
    if (message.channel !== SLACK_TEAM_CHANNEL_ID) return;

    const file = message.files?.find((f) => f.name === 'flag.txt');
    if (!file) return;

    const flag = file.preview;
    if (!flag) return;

    const res = await client.conversations.history({
        channel: SLACK_TEAM_CHANNEL_ID,
        latest: message.ts,
        limit: 10,
        // inclusive: true,
    });

    // Slice off 2 messages to prevent bronson race condition
    const team = res.messages
        ?.slice(2)
        .find((s) => s.text && /Running Pesky Neighbor on team: (.+)/.test(s.text))
        ?.text
        ?.match(/Running Pesky Neighbor on team: (.+)/)
        ?.[1];

    // TODO: pagination?

    if (!team) {
        // TODO: try everything
    } else {
        const msg = await trySubmitFlag(flag, team);
        await broadcastPeskySubmit(team, msg);
    }
});

export async function loadTargetFromSlackUrl(link: string) {
    // Fetch message object from slack web api
    // TODO: error messages
    const parts = link.match(/\/archives\/(.+?)\/p(\d+)(\d{6})/);
    if (!parts) return;

    const [, channel, ts1, ts2] = parts;
    const res = await slack.client.conversations.history({
        channel: channel,
        latest: `${ts1}.${ts2}`,
        limit: 1,
        inclusive: true,
    })
    console.log('[SLACK] Load response', res);
    if (!res.messages?.[0]) return;

    // TODO: no code reuse because slack api types are garbage
    const message = res.messages[0];
    if (!message.text) return;

    const raw = message.files?.find((f) => f.filetype === 'zip');
    const file = raw && 'file_access' in raw && raw.file_access === 'check_file_info'
        ? (await slack.client.files.info({ file: raw.id! })).file
        : raw

    if (!file) return;

    const { ip, portLow, portHigh } = tryParseIpPort(message.text);
    const name = file.name!.slice(0, -12);

    // Download zip and extract to temp dir
    const buf = await fetch(file.url_private_download!, {
        headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` }
    }).then((r) => r.arrayBuffer())

    const zip = new AdmZip(Buffer.from(buf));
    zip.extractAllTo(`./temp/${name}`);

    await writePortsFile(name, ip, portLow, portHigh);

    // In parallel: send new design to build server, push design to git
    const [logs, thread] = await Promise.all([
        runAttacksOnLocalTarget(name).catch(() => {}),
        (async () => {
            await lock.acquire('git', async () => {
                await execAsync(`cd temp && git pull --ff-only && git add -f "${name}/" && (git diff-index --quiet HEAD || git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${name}" && git push)`);
            })

            return notifyTargetPush(name, ip, portLow, portHigh);
        })(),
        dispatchPeskyNeighbor(name)
    ])

    if (logs) thread?.send({
        content: formatAttackOutput(name, logs[1]),
        files: [new AttachmentBuilder(Buffer.from(logs[0])).setName('logs.txt')]
    });
}

function tryParseIpPort(raw: string) {
    const ip = raw.match(/\d+\.\d+\.\d+\.\d+/)?.[0];

    const portMatches = raw.match(/(?<![.\d])(\d{3,})(?:-(\d+))?(?![.\d])/);
    const portLow = Number(portMatches![1]);
    // const portHigh = portMatches?.[2];

    return {
        ip: ip ?? '34.235.112.89', // If no IP parsed, assume default
        portLow: portLow,
        portHigh: portLow + 4, // Don't bother parsing higher port for typos; assume its always lower + 4
    }
}

export async function writePortsFile(name: string, ip: string, portLow: number, portHigh: number) {
    const ports = new Array(portHigh - portLow + 1).fill(0).map((_, i) => portLow + i);
    await writeFile(`./temp/${name}/ports.txt`, `${ip} ${ports.join(' ')}`);
}

export async function initTargetsRepo() {
    console.log('[GIT] Initializing targets repository');
    await execAsync(`git clone ${TARGETS_REPO_URL} temp || (cd temp && git fetch && git pull --ff-only)`);
    console.log(await execAsync('cd temp && git status'));
}
