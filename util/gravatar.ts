import crypto from 'node:crypto';


export function gravatarUrl(email: string) {
    const hash = crypto.createHash('md5').update(email).digest('hex');
    return `https://s.gravatar.com/avatar/${hash}?d=identicon`;
}
