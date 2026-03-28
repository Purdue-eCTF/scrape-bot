import { Subscriber } from 'zeromq';
import { EmbedBuilder } from 'discord.js';
import { readdir } from 'node:fs/promises';

// Utils
import { BUILD_ELF_PUSH_PORT } from '../config';
import { execAsync } from '../util/exec';
import { getAttackThread, lock } from './zulip';


export async function initBuildElfSubscription() {
    const sock = new Subscriber();
    sock.connect(`tcp://attack_build_server:${BUILD_ELF_PUSH_PORT}`);
    sock.subscribe();

    for await (const [s, t] of sock) {
        try {
            const status = s.toString() as 'success' | 'failure';
            const team = t.toString();

            console.log('Build ELF:', status, team);

            if (status === 'success') {
                void handleElfSuccess(team);
                continue;
            }

            void handleElfFailure(team);
        } catch (e) {
            console.error('Malformed attack build message', e);
        }
    }
}

async function handleElfSuccess(team: string) {
    await lock.acquire('git', async () => {
        await execAsync(
            `cd temp && git pull --ff-only && git add -f "${team}/" && (git diff-index --quiet HEAD || git -c user.name="eCTF scrape bot" -c user.email="purdue@ectf.fake" commit -m "Add ${team} ELFs" && git push)`
        );
    });

    const attackThread = await getAttackThread(team);
    if (!attackThread) return;

    const files = await readdir(`./temp/${team}/dev`);
    const desc = files.map((f) => `|_ ${f}`).join('\n');

    const elfEmbed = new EmbedBuilder()
        .setTitle('Built ELFs pushed to targets repository')
        .setDescription(`\`\`\`\n/${team}/dev\n${desc}\n\`\`\``)
        .setColor('#C61130')
        .setTimestamp();

    await attackThread.send({ embeds: [elfEmbed] });
}

async function handleElfFailure(team: string) {
    const attackThread = await getAttackThread(team);
    if (!attackThread) return;

    const elfEmbed = new EmbedBuilder()
        .setDescription(`Failure building ELFs for team ${team}.`)
        .setColor('#C61130')
        .setTimestamp();

    await attackThread.send({ embeds: [elfEmbed] });
}
