import { Publisher, Subscriber } from 'zeromq';
import { CHALLENGE_FORMATS, challenges, ctfd } from './challenges';
import { FLAG_IN_PORT, FLAG_OUT_PORT } from '../config';


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

            // TODO: replace with discord logging
            const prefix = flag.match(/ectf\{(\w+?_).+}/)?.[1];
            if (!prefix) {
                console.error(`Flag ${flag} missing discernible prefix`);
                continue;
            }

            const scenario = CHALLENGE_FORMATS.find((c) => c.prefix === prefix)?.name;
            if (!scenario) {
                console.error(`Flag ${flag} prefix ${prefix} not matched to any scenario`);
                continue;
            }

            const chall = challenges.find((c) => c.name.toLowerCase() === `${scenario} - ${parsed.team}`.toLowerCase());
            if (!chall) {
                console.error(`Could not find challenge for flag ${flag} (${scenario} - ${parsed.team})`);
                continue;
            }

            const res = await ctfd.challenges.submitFlag(chall.id, flag);
            if (res.status !== 'correct') {
                console.error('...');
                continue;
            }

            // Only pass on successful submits to log server
            void pub.send(JSON.stringify({
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
