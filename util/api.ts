const API_BASE = 'https://api.ectf.mitre.org/api';


export async function stealDesign(team: string, hash: string) {
    const res = await fetch(`${API_BASE}/flag/steal_design/${team}/`, {
        method: 'POST',
        body: hash,
        headers: { Authorization: `Bearer ${process.env.ETCF_API_TOKEN}` }  // TODO: content type json?
    });

    const data = await res.json();
    return data as { flag_hex: string }; // TODO
}

export async function getPackages() {
    const res = await fetch(`${API_BASE}/package/`, {
        headers: { Authorization: `Bearer ${process.env.ETCF_API_TOKEN}` }
    });

    return await res.json() as string[];
}

export async function getPackageStream(team: string) {
    const res = await fetch(`${API_BASE}/package/${team}/`, {
        headers: { Authorization: `Bearer ${process.env.ETCF_API_TOKEN}` }
    });

    // TODO
    return res.body!;
}

export async function submitTeamPhoto(name: string, raw: Blob) {
    const data = new FormData();
    data.append('team_photo', raw, name);

    const res = await fetch(`${API_BASE}/flag/team_photo/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.ETCF_API_TOKEN}` },
        body: data
    });
    const out = await res.json();

    console.log(res);
    console.log(out);

    // TODO
}

export async function submitDesignDoc(name: string, raw: Blob) {
    const data = new FormData();
    data.append('design_doc', raw, name);

    const res = await fetch(`${API_BASE}/flag/design_doc/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.ETCF_API_TOKEN}` },
        body: data
    });
    const out = await res.json();

    console.log(res);
    console.log(out);

    // TODO
}
