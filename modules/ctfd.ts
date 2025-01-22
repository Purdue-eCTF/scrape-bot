import { CTFD_API_KEY, CTFD_EMAIL, CTFD_PASSWORD } from '../auth';


type ScoreboardResponse = {
    success: true,
    data: ScoreboardData[],
}

type ScoreboardData = {
    pos: number,
    account_id: number,
    account_url: string,
    account_type: "user",
    oauth_id: null,
    name: string,
    score: number,
    bracket_id: null,
    bracket_name: null
}

export async function getScoreboard() {
    return await (await fetch('https://ectf.ctfd.io/api/v1/scoreboard', {
        headers: { 'Authorization': CTFD_API_KEY }
    })).json() as ScoreboardResponse;
}

type ChallengesResponse = {
    success: true,
    data: ChallengeData[]
}

export type ChallengeData = {
    id: number,
    type: 'standard',
    name: string,
    category: string,
    script: string,
    solved_by_me: boolean,
    solves: number,
    tags: string[],
    template: string,
    value: number,
}

export async function getChallenges() {
    const { session } = await getAuthedSessionNonce();

    return await (await fetch("https://ectf.ctfd.io/api/v1/challenges", {
        headers: { cookie: session }
    })).json() as ChallengesResponse;
}

function extractNonce(raw: string) {
    return raw.match(/'csrfNonce': "(.+?)"/)![1];
}

function parseSetCookie(c: string) {
    return c.split(';')[0];
}

async function getAuthedSessionNonce() {
    const res = await fetch('https://ectf.ctfd.io/login');

    const session = parseSetCookie(res.headers.getSetCookie()[0]);
    const nonce = extractNonce(await res.text());

    const formData = new FormData();
    formData.append('name', CTFD_EMAIL);
    formData.append('password', CTFD_PASSWORD);
    formData.append('_submit', 'Submit');
    formData.append('nonce', nonce);

    const loginRes = await fetch("https://ectf.ctfd.io/login", {
        method: 'POST',
        headers: { cookie: session },
        redirect: 'manual',
        body: formData,
    });

    const authedSession = parseSetCookie(loginRes.headers.getSetCookie()[0]);
    const authedRaw = await (await fetch('https://ectf.ctfd.io/challenges', {
        headers: { cookie: authedSession }
    })).text();

    return {
        nonce: extractNonce(authedRaw),
        session: authedSession
    };
}

type FlagSubmissionResponse = {
    success: true,
    data: {
        status: "incorrect", // TODO
        message: "Incorrect"
    }
}

export async function submitFlag(id: number, flag: string) {
    const { session, nonce } = await getAuthedSessionNonce();

    return await (await fetch('https://ectf.ctfd.io/api/v1/challenges/attempt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Csrf-Token': nonce,
            cookie: session,
        },
        body: JSON.stringify({ challenge_id: id, submission: flag }),
    })).json() as FlagSubmissionResponse;
}
