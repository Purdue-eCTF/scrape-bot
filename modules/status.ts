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
export type BuildStatusUpdateReq = {
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

export function formatPiStatus(s: PiStatus) {
    const status = s.locked ? (
        '*Locked by user.*'
    ) : !s.active ? (
        '*No images loaded.*'
    ) : (
        `*Status ${s.active.result} for commit*\n${formatCommitShort(s.active)}\n`
    );
    return `\`${s.ip}\`: ${status}`;
}

export function formatCommitShort(c: ActionResult) {
    const runHref = `https://github.com/Purdue-eCTF/2025-eCTF-design/actions/runs/${c.commit.runId}`;
    const ts = Math.floor(c.actionStart);

    return `\\${statusToCircle(c.result)} [[\`${c.commit.hash.slice(0, 7)}\`]](${runHref}): ${c.commit.name} (@${c.commit.author}) updated <t:${ts}:R>`;
}

export function statusToColor(status: ActionResult['result']) {
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
