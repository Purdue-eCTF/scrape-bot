type ActionResult = {
    result: 'SUCCESS' | 'TESTING' | 'BUILDING' | 'PENDING' | 'FAILURE',
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
    build: {
        active: ActionResult
        queue: ActionResult[]
    }
    test: {
        activeTests: PiStatus[]
        queue: ActionResult[]
    }
}

export function formatPiStatus(s: PiStatus) {
    const status = s.locked ? (
        '*Locked by user.*'
    ) : !s.active ? (
        '*No images loaded.*'
    ) : (
        `*Active for commit*\n${formatCommitShort(s.active)}\nStatus: ${s.active.result}\n`
    );
    return `\`${s.ip}\`: ${status}`;
}

export function formatCommitShort(c: ActionResult) {
    const runHref = `https://github.com/Purdue-eCTF-2024/2024-ectf-secure-example/actions/runs/${c.commit.runId}`;
    const ts = Math.floor(c.actionStart);

    return `[\`${c.commit.hash}\`]: ${c.commit.name} (@${c.commit.author}) [[link]](${runHref}) updated <t:${ts}:>`;
}

export function statusToColor(status: ActionResult['result']) {
    switch (status) {
        case 'SUCCESS': return 0x79ff3b;
        case 'FAILURE': return 0xb50300;
        default: return 0xf6b40c;
    }
}
