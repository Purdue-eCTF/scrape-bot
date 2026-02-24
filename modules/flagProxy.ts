import { Publisher, Subscriber } from 'zeromq';
import { EmbedBuilder } from 'discord.js';

// Utils
import { CHALLENGE_FORMATS, challenges, ctfd } from './challenges';
import { ATTACK_NOTIFY_CHANNEL_ID, FLAG_IN_PORT, FLAG_OUT_PORT } from '../config';
import { client } from '../bot';


export async function initFlagProxy() {
    const sub = new Subscriber();
    await sub.bind(`tcp://0.0.0.0:${FLAG_IN_PORT}`);
    sub.subscribe();

    const pub = new Publisher();
    await pub.bind(`tcp://0.0.0.0:${FLAG_OUT_PORT}`);

    for await (const [msg] of sub) {
        try {
            const parsed = JSON.parse(msg.toString()) as FlagSubmissionInput;
            console.log(parsed);

            // TODO: convert hash to flag
            const flag = parsed.type === 'HASH'
                ? parsed.data
                : parsed.data;

            const prefix = flag.match(/ectf\{(\w+?_).+}/)?.[1];
            if (!prefix) {
                void dispatchFlagError(flag, parsed.team, 'missing discernible prefix');
                continue;
            }

            const scenario = CHALLENGE_FORMATS.find((c) => c.prefix === prefix)?.name;
            if (!scenario) {
                void dispatchFlagError(flag, parsed.team, `prefix \`${prefix}\` not matched to any scenario`);
                continue;
            }

            const chall = challenges.find((c) => c.name.toLowerCase() === `${scenario} - ${parsed.team}`.toLowerCase());
            if (!chall) {
                void dispatchFlagError(flag, parsed.team, `could not find challenge \`${scenario} - ${parsed.team}\``);
                continue;
            }

            const res = await ctfd.challenges.submitFlag(chall.id, flag);
            void dispatchFlagSubmit(flag, parsed.team, res.status);

            if (res.status !== 'correct') continue;

            // Only pass on successful submits to log server
            await pub.send(JSON.stringify({
                team: parsed.team,
                challengeId: chall.id,
                method: parsed.method,
                flag
            } satisfies FlagSubmissionOutput));
        } catch (e) {
            console.error('Malformed flag submission message', e);
        }
    }
}

type FlagSubmissionInput = {
    team: string,
    method: 'TESTS' | 'SUS',
    type: 'FLAG' | 'HASH',
    data: string
}

type FlagSubmissionOutput = {
    team: string,
    challengeId: number,
    method: 'TESTS' | 'SUS',
    flag: string
}

async function dispatchFlagError(flag: string, team: string, error: string) {
    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isSendable()) return;

    const flagEmbed = new EmbedBuilder()
        .setTitle(`Flag submission error for team ${team}`)
        .setDescription(`Found flag:\`\`\`${flag}\`\`\`\nwith error: ${error}`)
        .setColor('#C61130')
        .setTimestamp();

    await channel.send({ embeds: [flagEmbed] });
}

async function dispatchFlagSubmit(flag: string, team: string, status: string) {
    const channel = client.channels.cache.get(ATTACK_NOTIFY_CHANNEL_ID);
    if (!channel?.isSendable()) return;

    const flagEmbed = new EmbedBuilder()
        .setTitle(`Flag submitted for team ${team}`)
        .setDescription(`Found flag:\`\`\`${flag}\`\`\`\nwith status: \`${status}\``)
        .setColor('#C61130')
        .setTimestamp();

    await channel.send({ embeds: [flagEmbed] });
}
