const API_BASE = 'https://api.ectf.mitre.org/api';


type ValidationError = {
    type: string,
    msg: string,
    input: string,
    loc: string[],
    ctx: { pattern: string }
}

export async function stealDesign(team: string, hash: string) {
    const res = await fetch(`${API_BASE}/flag/steal_design/${team}/`, {
        method: 'POST',
        body: hash,
        headers: { Authorization: `Bearer ${process.env.ECTF_API_TOKEN}` }
    });

    const data = await res.json() as { detail: string | ValidationError[] } | { flag_hex: string };
    if ('detail' in data)
        return { detail: data.detail, status: res.status }

    return data;
}

export async function getPackages() {
    const res = await fetch(`${API_BASE}/package/`, {
        headers: { Authorization: `Bearer ${process.env.ECTF_API_TOKEN}` }
    });

    return await res.json() as string[];
}

// {@Link https://api.ectf.mitre.org/docs#/package/get_package_zip_api_package__package_name___get}
export async function getPackageContents(team: string) {
    const res = await fetch(`${API_BASE}/package/${team}/`, {
        headers: { Authorization: `Bearer ${process.env.ECTF_API_TOKEN}` }
    });

    return res.text();
}

// {@Link https://api.ectf.mitre.org/docs#/remote/queue_flow_remote_api_flow_remote__post}
export async function queueRemoteFlow(team: string) {
    const res = await fetch(`${API_BASE}/flow/remote/`, {
        method: 'POST',
        body: JSON.stringify({ target_team: team.toLowerCase() }),
        headers: {
            Authorization: `Bearer ${process.env.ECTF_API_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await res.json() as { detail: string | ValidationError[] } | string;
    if (typeof data !== 'string')
        return { detail: data.detail, status: res.status }

    return data;
}

// {@Link https://rules.ectf.mitre.org/2026/system/api.html#flow-details}
export async function getFlowDetails(type: string, id: string) {
    const res = await fetch(`${API_BASE}/flow/${type}/${id}/`, {
        headers: { Authorization: `Bearer ${process.env.ECTF_API_TOKEN}` }
    });

    const data = await res.json() as { detail: string | ValidationError[] } | any;
    if ('detail' in data)
        return { detail: data.detail, status: res.status }

    return data;
}

export async function submitTeamPhoto(name: string, raw: Blob) {
    const data = new FormData();
    data.append('team_photo', raw, name);

    const res = await fetch(`${API_BASE}/flag/team_photo/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.ECTF_API_TOKEN}` },
        body: data
    });

    const out = await res.json() as { detail: string } | { flag_hex: string };
    if ('detail' in out)
        return { detail: out.detail, status: res.status }

    return out;
}

export async function submitDesignDoc(name: string, raw: Blob) {
    const data = new FormData();
    data.append('design_doc', raw, name);

    const res = await fetch(`${API_BASE}/flag/design_doc/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.ECTF_API_TOKEN}` },
        body: data
    });

    const out = await res.json() as { detail: string } | { flag_hex: string };
    if ('detail' in out)
        return { detail: out.detail, status: res.status }

    return out;
}
