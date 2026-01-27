import { EmbedBuilder } from 'discord.js';
import { client } from '../bot';

// Config
import { DESIGN_REPO_URL, FAILURE_CHANNEL_ID, STATUS_CHANNEL_ID, STATUS_MESSAGE_ID } from '../config';


async function updateBuildStatus(req: BuildStatusUpdateBody) {
    const channel = client.channels.cache.get(STATUS_CHANNEL_ID);
    if (!channel?.isSendable())
        return console.error('[BUILD] Could not find build status channel!');

    const message = channel.messages.cache.get(STATUS_MESSAGE_ID)
        ?? await channel.messages.fetch(STATUS_MESSAGE_ID)
        ?? channel.lastMessage;

    const queueStatus = req.queue.map((d, i) => `${i + 1}. ${formatActionShort(d)}`).join('\n')
        || '*No commits queued.*'
    const activeStatus = req.active.map((d, i) => `${i + 1}. ${formatActionShort(d)}`).join('\n')
        || '*No commits loaded.*'

    // Take the highest severity status among the active jobs for the embed color
    const status = req.active.reduce<ActionStatus | null>((s, c) => {
        if (!s) return c.status;
        if (s === 'SUCCESS' || c.status === 'BUILD_FAILED' || c.status === 'TEST_FAILED')
            return c.status;
        return s;
    }, null);

    const statusEmbed = new EmbedBuilder()
        .setTitle('Secure design build status')
        .addFields(
            { name: 'Active:', value: activeStatus },
            { name: 'Queued:', value: queueStatus }
        )
        .setColor(status ? statusToColor(status) : '#27272a')
        .setTimestamp()

    // Report all build / test failures to the appropriate channel;  this assumes that each
    // build / test failure is sent only once to Tom.
    const failures = req.active.filter((r) => r.status === 'BUILD_FAILED' || r.status === 'TEST_FAILED');
    for (const failed of failures) {
        const runHref = `${DESIGN_REPO_URL}/actions/runs/${failed.commit.runId}`;

        const failureChannel = client.channels.cache.get(FAILURE_CHANNEL_ID);
        const failureEmbed = new EmbedBuilder()
            .setTitle(`${failed.status === 'BUILD_FAILED' ? 'Build' : 'Tests'} failed for commit`)
            .setColor(0xb50300)
            .setDescription(`[\`${failed.commit.hash.slice(0, 7)}\`]: ${failed.commit.name} (@${failed.commit.author})\n[[Jump to failed workflow]](${runHref})`)
            .setTimestamp()

        if (failureChannel?.isSendable())
            failureChannel.send({ embeds: [failureEmbed] })
    }

    if (!message?.editable) return channel.send({ embeds: [statusEmbed] }); // TODO
    return message.edit({ embeds: [statusEmbed] });
}

type ActionStatus = 'SUCCESS' | 'TESTING' | 'BUILDING' | 'BUILD_PENDING' | 'TEST_PENDING' | 'BUILD_FAILED' | 'TEST_FAILED';

type ActionInfo = {
    status: ActionStatus,
    commit: {
        hash: string,
        name: string,
        author: string,
        runId: string,
    },
    start: number // epoch s
}

type BuildStatusUpdateBody = {
    active: ActionInfo[],
    queue: ActionInfo[]
}

function formatActionShort(c: ActionInfo) {
    const runHref = `${DESIGN_REPO_URL}/actions/runs/${c.commit.runId}`;
    const ts = Math.floor(c.start);

    return `\\${statusToCircle(c.status)} [[\`${c.commit.hash.slice(0, 7)}\`]](${runHref}): ${c.commit.name} (@${c.commit.author}) updated <t:${ts}:R>`;
}

function statusToColor(status: ActionStatus) {
    switch (status) {
        case 'SUCCESS': return 0x79ff3b;
        case 'BUILD_FAILED':
        case 'TEST_FAILED':
            return 0xb50300;
        default: return 0xf6b40c;
    }
}

function statusToCircle(status: ActionStatus) {
    switch (status) {
        case 'SUCCESS': return '🟢';
        case 'BUILD_FAILED':
        case 'TEST_FAILED':
            return '🔴';
        default: return '🟡';
    }
}
