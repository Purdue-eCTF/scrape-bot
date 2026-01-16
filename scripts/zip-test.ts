import { bufferAndUnzip, streamAndUnzip } from '../util/files';
import { rm } from 'node:fs/promises';


const URL = 'https://ectf.zulipchat.com/user_uploads/74293/h7nClLV18sL-TiBbJb6M2CiR/ba_1080.zip';

async function benchBuffered() {
    const s1 = new Date().getTime();
    const res = await fetch(URL, {
        headers: {
            cookie: '__Host-csrftoken=bsybsFWHjp10um5TBWvxlsNYqpmVY2cP; __Host-sessionid=asjh985fkaakx99det52zwn6c3bzqzpq; django_language=en'
        },
    })
    const e1 = new Date().getTime();

    const s2 = new Date().getTime();
    await bufferAndUnzip(res, './tmp');
    const e2 = new Date().getTime();

    console.log('Fetch:', e1 - s1, 'ms    Buf:', e2 - s2, 'ms');
}

async function benchStream() {
    const s1 = new Date().getTime();
    const res = await fetch(URL, {
        headers: {
            cookie: '__Host-csrftoken=bsybsFWHjp10um5TBWvxlsNYqpmVY2cP; __Host-sessionid=asjh985fkaakx99det52zwn6c3bzqzpq; django_language=en'
        },
    })
    const e1 = new Date().getTime();

    const s2 = new Date().getTime();
    await streamAndUnzip(res, './tmp');
    const e2 = new Date().getTime();

    console.log('Fetch:', e1 - s1, 'ms    Stm:', e2 - s2, 'ms');
}

;(async () => {
    for (let i = 0; i < 5; i++) {
        await rm('./tmp', { recursive: true, force: true });
        await benchBuffered();
    }

    for (let i = 0; i < 5; i++) {
        await rm('./tmp', { recursive: true, force: true });
        await benchStream();
    }
})();
