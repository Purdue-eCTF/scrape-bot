import express from 'express';
import bodyParser from 'body-parser';
import { EmbedBuilder } from 'discord.js';
import { client } from '../bot';

// Config
import { DESIGN_REPO_URL, FAILURE_CHANNEL_ID, STATUS_CHANNEL_ID, STATUS_MESSAGE_ID } from '../config';


export const server = express();

server.use(bodyParser.json());
server.post('/', async (req, res) => {
    console.log(`[BUILD] Received webhook push:\n${JSON.stringify(req.body)}`);
    try {
        await updateBuildStatus(req.body);
        res.status(200).json({ ok: true });
    } catch {
        res.status(400).json({ ok: false });
    }
});

async function updateBuildStatus(req: BuildStatusUpdateReq) {
    const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
    if (!channel?.isSendable())
        return console.error('[BUILD] Could not find build status channel!');

    const message = channel.messages.cache.get(STATUS_MESSAGE_ID)
        || await channel.messages.fetch(STATUS_MESSAGE_ID)
        || channel.lastMessage;

    const queueStatus = req.build.queue.map((d, i) => `${i + 1}. ${formatCommitShort(d)}`).join('\n')
        || '*No commits queued.*'
    const piStatus = req.test.activeTests.map((s, i) => `${i + 1}. ${formatPiStatus(s)}`).join('\n');
    const buildStatus = req.build.active
        ? formatCommitShort(req.build.active)
        : '*No commits loaded.*'

    const color = req.status
        ? statusToColor(req.status)
        : '#27272a'

    const statusEmbed = new EmbedBuilder()
        .setTitle('Secure design build status')
        .setDescription(`**Status:** ${req.status || 'N/A'}`)
        .addFields(
            { name: 'Pis', value: piStatus },
            { name: 'Building:', value: buildStatus },
            { name: 'Queued:', value: queueStatus }
        )
        .setColor(color)
        .setTimestamp()

    // Report build failures to the appropriate channel
    if (
        (req.update.type === 'BUILD' || req.update.type === 'TEST')
        && req.update.state.result === 'FAILED'
    ) {
        const runHref = `${DESIGN_REPO_URL}/actions/runs/${req.update.state.commit.runId}`;

        const failureChannel = client.channels.cache.get(FAILURE_CHANNEL_ID);
        const failureEmbed = new EmbedBuilder()
            .setTitle(`${req.update.type === 'BUILD' ? 'Build' : 'Tests'} failed for commit`)
            .setColor(0xb50300)
            .setDescription(`[\`${req.update.state.commit.hash.slice(0, 7)}\`]: ${req.update.state.commit.name} (@${req.update.state.commit.author})\n[[Jump to failed workflow]](${runHref})`)
            .setTimestamp()

        if (failureChannel?.isSendable())
            failureChannel.send({ embeds: [failureEmbed] })
    }

    if (!message?.editable) return channel.send({ embeds: [statusEmbed] });
    return message.edit({ embeds: [statusEmbed] });
}

type ActionStatus = 'SUCCESS' | 'TESTING' | 'BUILDING' | 'PENDING' | 'FAILED';

type ActionResult = {
    result: ActionStatus,
    commit: {
        hash: string,
        name: string,
        author: string,
        runId: string,
    },
    actionStart: number // epoch s
}
type PiStatus = {
    ip: string,
    locked: boolean,
    active?: ActionResult
}
type BuildStatusUpdateReq = {
    status?: ActionStatus,
    update: QueueUpdate | BuildUpdate | TestUpdate
    build: {
        active?: ActionResult
        queue: ActionResult[]
    }
    test: {
        activeTests: PiStatus[]
        queue: ActionResult[]
    }
}

type QueueUpdate = {
    type: 'QUEUE'
}
type BuildUpdate = {
    type: 'BUILD',
    state: ActionResult
}
type TestUpdate = {
    type: 'TEST',
    state: ActionResult
}

function formatPiStatus(s: PiStatus) {
    const status = s.locked ? (
        '*Locked by user.*'
    ) : !s.active ? (
        '*No images loaded.*'
    ) : (
        `*Status ${s.active.result} for commit*\n${formatCommitShort(s.active)}\n`
    );
    return `\`${s.ip}\`: ${status}`;
}

function formatCommitShort(c: ActionResult) {
    const runHref = `${DESIGN_REPO_URL}/actions/runs/${c.commit.runId}`;
    const ts = Math.floor(c.actionStart);

    return `\\${statusToCircle(c.result)} [[\`${c.commit.hash.slice(0, 7)}\`]](${runHref}): ${c.commit.name} (@${c.commit.author}) updated <t:${ts}:R>`;
}

function statusToColor(status: ActionResult['result']) {
    switch (status) {
        case 'SUCCESS': return 0x79ff3b;
        case 'FAILED': return 0xb50300;
        default: return 0xf6b40c;
    }
}

function statusToCircle(status: ActionResult['result']) {
    switch (status) {
        case 'SUCCESS': return '🟢';
        case 'FAILED': return '🔴';
        default: return '🟡';
    }
}
