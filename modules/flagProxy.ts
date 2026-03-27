import { Publisher, Reply } from 'zeromq';
import { EmbedBuilder } from 'discord.js';

// Utils
import { CHALLENGE_FORMATS, challenges, ctfd } from './challenges';
import { ATTACK_NOTIFY_CHANNEL_ID, FLAG_IN_PORT, FLAG_OUT_PORT } from '../config';
import { client } from '../bot';
import { stealDesign } from '../util/api';


export async function initFlagProxy() {
    const rep = new Reply();
    await rep.bind(`tcp://0.0.0.0:${FLAG_IN_PORT}`);

    const pub = new Publisher();
    await pub.bind(`tcp://0.0.0.0:${FLAG_OUT_PORT}`);

    async function handleFlagError(flag: string, team: string, error: string) {
        await rep.send(JSON.stringify({
            ok: false,
            msg: error,
        } satisfies FlagSubmissionReply));
        void dispatchFlagError(flag, team, error);
    }

    for await (const [msg] of rep) {
        try {
            const parsed = JSON.parse(msg.toString()) as FlagSubmissionRequest;
            console.log(parsed);

            // We are sent either a direct flag (type = 'FLAG') or a steal design hash (type = 'HASH')
            // which we submit through the API.
            let flag = parsed.data;
            if (parsed.type === 'HASH') {
                const res = await stealDesign(parsed.team, parsed.data);
                if ('detail' in res) {
                    const message = typeof res.detail === 'string' ? res.detail : res.detail[0].msg;
                    await handleFlagError(parsed.data, parsed.team, `steal design hash submission failed w/ message \`${message}\``);
                    continue;
                }

                flag = res.flag_hex;
            }

            const prefix = flag.match(/ectf\{(\w+?_).+}/)?.[1];
            if (!prefix) {
                await handleFlagError(flag, parsed.team, 'missing discernible prefix');
                continue;
            }

            const scenario = CHALLENGE_FORMATS.find((c) => c.prefix === prefix)?.name;
            if (!scenario) {
                await handleFlagError(flag, parsed.team, `prefix \`${prefix}\` not matched to any scenario`);
                continue;
            }

            const chall = challenges.find((c) => c.name.toLowerCase() === `${scenario} - ${parsed.team}`.toLowerCase());
            if (!chall) {
                await handleFlagError(flag, parsed.team, `could not find challenge \`${scenario} - ${parsed.team}\``);
                continue;
            }

            const res = await ctfd.challenges.submitFlag(chall.id, flag);
            void dispatchFlagSubmit(flag, parsed.team, res.status);

            if (res.status !== 'correct') {
                await rep.send(JSON.stringify({ ok: false, msg: 'incorrect flag' } satisfies FlagSubmissionReply));
                continue;
            }

            await rep.send(JSON.stringify({ ok: true } satisfies FlagSubmissionReply));

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

type FlagSubmissionRequest = {
    team: string,
    method: 'TESTS' | 'SUS',
    type: 'FLAG' | 'HASH',
    data: string
}

type FlagSubmissionReply = {
    ok: boolean,
    msg?: string
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
