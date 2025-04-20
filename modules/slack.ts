import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { AttachmentBuilder } from 'discord.js';
import { App } from '@slack/bolt';
import AdmZip from 'adm-zip';
import AsyncLock from 'async-lock';

// Utils
import { execAsync } from '../util/exec';
import {
    getAttackThreadIfExists,
    broadcastPeskySubmit,
    notifyTargetPush,
    updateInfoForTeam,
} from '../bot';
import { dispatchPeskyNeighbor } from './peskyNeighbor';
import { formatAttackOutput, runAttacksOnLocalTarget } from './attack';
import { trySubmitFlag } from './challenges';

// Config
import { SLACK_SIGNING_SECRET, SLACK_TOKEN, TARGETS_REPO_URL } from '../auth';
import { SLACK_TARGET_CHANNEL_ID, SLACK_TEAM_CHANNEL_ID } from '../config';


type BaseFile = {
    id: string,
    name: string | null,
    title: string | null,
    filetype: string,
    url_private?: string,
    url_private_download?: string,
    preview?: string,
    preview_highlight?: string,
    file_access?: string
}
type BaseMessage = {
    text: string,
    files?: BaseFile[]
}

export const slack = new App({
    token: SLACK_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
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

    await loadTargetFromSlackMessage(message);
});

/**
 * When a target message is edited: update channel and targets repo with updated ports / IP.
 */
slack.message(async ({ client, message }) => {
    if (message.type !== 'message') return;
    if (message.subtype !== 'message_changed') return;
    if (message.channel !== SLACK_TARGET_CHANNEL_ID) return;

    if (!('files' in message.message) || !message.message.text) return;

    await loadTargetFromSlackMessage(message.message as BaseMessage);
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
        limit: 10
    });

    // Slice off 2 messages to prevent bronson race condition
    const team = res.messages
        ?.slice(2)
        .find((s) => s.text && /Running Pesky Neighbor on team: (.+)/.test(s.text))
        ?.text?.match(/Running Pesky Neighbor on team: (.+)/)?.[1];

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
    });
    console.log('[SLACK] Load response', res);
    if (!res.messages?.[0]) return;

    const message = res.messages[0];

    await loadTargetFromSlackMessage(message as BaseMessage);
}

async function tryLoadPackage(message: BaseMessage) {
    // Look for zip files; if `file_access` is present, we need to handle the Slack Connect file download differently.
    // https://api.slack.com/apis/channels-between-orgs#check_file_info
    const raw = message.files?.find((f) => f.filetype === 'zip');
    if (!raw) return;

    return raw && 'file_access' in raw && raw.file_access === 'check_file_info'
        ? (await slack.client.files.info({ file: raw.id })).file
        : raw;
}

async function loadTargetFromSlackMessage(message: BaseMessage) {
    const file = await tryLoadPackage(message);
    let { ip, portLow, portHigh } = tryParseIpPort(message.text);

    let team = file?.name?.slice(0, -12) ?? tryParseTeam(message.text);
    if (!team) {
        // TODO return error to discord
        console.error('[SLACK] Could not find team');
        return;
    }

    team = team.toLowerCase();
    const portsUpdated = !isNaN(portLow);
    const teamFolder = `./temp/${team}`;
    await mkdir(teamFolder, { recursive: true }); // ignore if exists

    if (file?.name) {
        console.log('[SLACK] Found', file.name);

        // backup ports.txt if necessary
        if (!portsUpdated) {
            try {
                let ports;
                [ip, ...ports] = (await readFile(`${teamFolder}/ports.txt`)).toString().split(' ');
                portLow = Number(ports[0]);
                portHigh = Number(ports[ports.length - 1]);
            } catch (e) {
                // ignore file does not exist errors
                // TODO: check specific error
                console.log(e);
            }
        }

        await rm(teamFolder, { recursive: true, force: true });

        // Download zip and extract to temp dir
        const buf = await fetch(file.url_private_download!, {
            headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
        }).then((r) => r.arrayBuffer());

        const zip = new AdmZip(Buffer.from(buf));
        zip.extractAllTo(teamFolder);
        console.log('[SLACK] Extracted', file.name);
    }

    // If ports were updated: create the attack thread if it doesn't exist, or update the
    // ports embed if it does.
    const attackThread = await getAttackThreadIfExists(team);
    if (!attackThread && portsUpdated)
        await notifyTargetPush(team, ip, portLow, portHigh);
    else if (attackThread && portsUpdated)
        await updateInfoForTeam(team, ip, portLow, portHigh);

    if (!isNaN(portLow))
        await writePortsFile(team, ip, portLow, portHigh);

    const promises: [
        Promise<void>,
        Promise<[string, string[]] | void>?,
        Promise<void>?
    ] = [
        lock.acquire('git', async () => {
            await execAsync(
                `cd temp && git pull --ff-only && git add -f "${team}/" && (git diff-index --quiet HEAD || git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${team}" && git push)`
            );
        })
    ];

    // Run automated attacks if both the package and `ports.txt` exist
    if ((await readdir(teamFolder)).length > 1 && !isNaN(portLow))
        promises.push(runAttacksOnLocalTarget(team).catch(() => {}));

    // Run pesky neighbor if ports exist
    if (portsUpdated)
        promises.push(dispatchPeskyNeighbor(team));

    // In parallel: send new design to build server, push design to git
    const [, logs] = await Promise.all(promises);
    if (!logs) return;

    attackThread?.send({
        content: formatAttackOutput(team, logs[1]),
        files: [new AttachmentBuilder(Buffer.from(logs[0])).setName('logs.txt')],
    });
}

function tryParseTeam(raw: string) {
    return raw.match(/(\w+) package/i)?.[1];
}

function tryParseIpPort(raw: string) {
    const ip = raw.match(/\d+\.\d+\.\d+\.\d+/)?.[0];

    const portMatches = raw.match(/(?<![.\d])(\d{3,})(?:-(\d+))?(?![.\d])/);
    const portLow = Number(portMatches?.[1]);
    // const portHigh = portMatches?.[2];

    return {
        ip: ip ?? '34.235.112.89', // If no IP parsed, assume default
        portLow: portLow,
        portHigh: portLow + 4, // Don't bother parsing higher port for typos; assume its always lower + 4
    };
}

export async function writePortsFile(name: string, ip: string, portLow: number, portHigh: number) {
    const ports = new Array(portHigh - portLow + 1).fill(0).map((_, i) => portLow + i);
    await writeFile(`./temp/${name}/ports.txt`, `${ip} ${ports.join(' ')}`);
}

export async function initTargetsRepo() {
    console.log('[GIT] Initializing targets repository');
    await execAsync(
        `git clone ${TARGETS_REPO_URL} temp || (cd temp && git fetch && git pull --ff-only)`
    );
    console.log(await execAsync('cd temp && git status'));
}
