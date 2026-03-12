import zulipInit from '@ky28059/zulip-js';
import { ChannelType, EmbedBuilder, GuildForumTag } from 'discord.js';
import { readdir } from 'node:fs/promises';
import AsyncLock from 'async-lock';

// Utils
import { client } from '../bot';
import { gravatarUrl } from '../util/gravatar';
import { truncate } from '../util/misc';
import { execAsync } from '../util/exec';
import { streamAndUnzipLocal } from '../util/files';
import { downloadEncPackage } from '../util/api';

// Config
import { ATTACK_FORUM_CHANNEL_ID, ATTACK_NOTIFY_CHANNEL_ID } from '../config';


export const lock = new AsyncLock();

const WEBHOOK_NAME = 'zulip-mirror'

export async function initZulipClient() {
    const zulip = await zulipInit({
        username: process.env.ZULIP_USERNAME!,
        apiKey: process.env.ZULIP_API_KEY!,
        realm: process.env.ZULIP_REALM!,
    });

    await zulip.callOnEachEvent(async (e) => {
        if (e.type !== 'message') return; // TODO?

        console.log(e.message);

        // Attack phase
        if (e.message.display_recipient === '2026-attack-packages' && e.message.subject === 'upcoming attack packages')
            void handlePackageMessage(e.message.content);

        if (e.message.display_recipient === '2026-attack-packages' && e.message.subject === 'attack package keys')
            void handleKeyMessage(e.message.content);

        // Mirror selected zulip channels to discord
        const category = client.channels.cache.get('1470601140113506407');
        if (category?.type !== ChannelType.GuildCategory) return;

        // Ignore Zulip DMs
        if (typeof e.message.display_recipient !== 'string') return;

        const name = e.message.display_recipient.toLowerCase().replaceAll(' ', '-');
        const topic = e.message.subject.replace(/^✔ /, '');
        const resolved = e.message.subject.startsWith('✔ ');
        const content = e.message.content
            .replace(/\[(.+?)]\((\/.+?)\)/g, `[$1](${process.env.ZULIP_REALM}$2)`) // Replace relative links with absolute

        const forum = category.children.cache.find((v) => v.name === name);
        if (forum?.type !== ChannelType.GuildForum) return;

        const thread = forum.threads.cache.find((t) => t.name === topic)
            ?? await forum.threads.create({ name: topic, message: { content: '*[Zulip mirror truncated above this point]*' } });

        // Mirror the resolved status of the topic as a discord forum channel tag
        if (resolved) {
            const resTag: GuildForumTag = forum.availableTags.find((t) => t.name === 'Resolved')
                ?? await forum.setAvailableTags([{ name: 'Resolved', emoji: { id: null, name: '✅' }, moderated: true }])
                    .then(f => f.availableTags.find((t) => t.name === 'Resolved')!);

            await thread.setAppliedTags([resTag.id]);
        } else if (thread.appliedTags.length > 0) {
            await thread.setAppliedTags([]);
        }

        const hook = (await forum.fetchWebhooks()).find((v) => v.name === WEBHOOK_NAME)
            ?? await forum.createWebhook({ name: WEBHOOK_NAME });

        await hook.send({
            content: truncate(content, 2000, '...\n\n-# Message truncated; view full message on Zulip'),
            username: e.message.sender_full_name,
            avatarURL: e.message.avatar_url ?? gravatarUrl(e.message.sender_email),
            threadId: thread.id,
            allowedMentions: { parse: [] }
        });
    }, ['message']);
}

async function handlePackageMessage(c: string) {
    const match = c.match(/The encrypted attack package for \*\*(.+?)\*\* can now be downloaded from the testing service.\n/);
    if (!match) return console.error(':(');

    const team = match[1];
    await downloadEncPackage(team);

    // Report download to Discord
    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isSendable()) return;

    const packageEmbed = new EmbedBuilder()
        .setDescription(`Downloaded encrypted attack package for team \`${team}\`.`)
        .setColor('#C61130')
        .setTimestamp();

    await channel.send({ embeds: [packageEmbed] });
}

async function handleKeyMessage(c: string) {
    const match = c.match(/\*\*(.+?)\*\*: (.+?)\n/);
    if (!match) return console.error(':(');

    const [, team, key] = match;
    await loadAndDecryptTeam(team, key);
}

export async function loadAndDecryptTeam(team: string, key: string) {
    // Ensure we have the `.enc` file in `./temp` already; if not, download it again
    const files = await readdir('./temp');
    if (!files.includes(`${team}.enc`))
        await downloadEncPackage(team);

    // Decrypt with key and unzip
    await execAsync(`openssl enc -d -aes-256-cbc -pbkdf2 -salt -k ${key} -in ./temp/${team}.enc -out ./temp/${team}.zip`);
    await streamAndUnzipLocal(`./temp/${team}.zip`, `./temp/${team}`);

    lock.acquire('git', async () => {
        await execAsync(
            `cd temp && git pull --ff-only && git add -f "${team}/" && (git diff-index --quiet HEAD || git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${team}" && git push)`
        );
    })

    // TODO: attacks

    // Report download to Discord
    await notifyTargetPush(team);
}

async function notifyTargetPush(team: string) {
    const attackThreadsChannel = client.channels.cache.get(ATTACK_FORUM_CHANNEL_ID);
    if (attackThreadsChannel?.type !== ChannelType.GuildForum) return;

    // If the channel already exists, use it; otherwise, make a new channel.
    let attackThread = attackThreadsChannel.threads.cache.find((c) => c.name === team);
    if (!attackThread) {
        const targetEmbed = new EmbedBuilder()
            .setTitle(team)
            .setDescription(`Check \`targets/${team}\` for attack binaries and target source.`)
            .setColor('#C61130')
            .setTimestamp();

        attackThread = await attackThreadsChannel.threads.create({
            name: team,
            message: { embeds: [targetEmbed] }
        });

        // Pin ports info message
        const message = await attackThread.fetchStarterMessage();
        await message?.pin();
    }

    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isSendable()) return;

    const packageEmbed = new EmbedBuilder()
        .setTitle('New target pushed to targets repository')
        .setDescription(`**${team}**: (\`${team}.zip\`)\n↳ Discussion: ${attackThread}`)
        .setColor('#C61130')
        .setTimestamp();

    await channel.send({ embeds: [packageEmbed] });

    return attackThread;
}
