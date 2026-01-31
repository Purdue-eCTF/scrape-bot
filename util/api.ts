const API_BASE = 'https://api.ectf.mitre.org/api';


export async function stealDesign(team: string, hash: string) {
    const res = await fetch(`${API_BASE}/flag/steal_design/${team}`, {
        method: 'POST',
        body: hash,
        headers: { Authorization: `Bearer example-token` }  // TODO: authorization, content type json?
    });

    const data = await res.json();
    return data as { flag_hex: string }; // TODO
}

export async function getPackages() {
    const res = await fetch(`${API_BASE}/package`, {
        headers: { Authorization: `Bearer example-token` }  // TODO: authorization
    });

    return await res.json() as string[];
}

export async function getPackageStream(team: string) {
    const res = await fetch(`${API_BASE}/package/${team}`, {
        headers: { Authorization: `Bearer example-token` }  // TODO: authorization
    });

    // TODO
    return res.body!;
}

export async function submitTeamPhoto(photo: ArrayBuffer) {
    const res = await fetch(`${API_BASE}/flag/team_photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer example-token` },  // TODO
        body: photo
    });

    // TODO
}
