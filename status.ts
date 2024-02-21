type CommitInfo = {
    hash: string,
    name: string,
    author: string,
    runId: string,
}
export type BuildStatusUpdateReq = {
    current: CommitInfo,
    status: 'SUCCESS' | 'BUILDING' | 'TESTING' | 'FAILURE',
    queue: CommitInfo[]
}

export function formatCommitShort(c: CommitInfo) {
    const runHref = `https://github.com/Purdue-eCTF-2024/2024-ectf-secure-example/actions/runs/${c.runId}`;
    return `[\`${c.hash}\`]: ${c.name} (@${c.author}) [[link]](${runHref})`;
}

export function statusToColor(status: BuildStatusUpdateReq['status']) {
    switch (status) {
        case 'SUCCESS': return 0x79ff3b;
        case 'BUILDING':
        case 'TESTING':
            return 0xf6b40c;
        case 'FAILURE': return 0xb50300;
    }
}
