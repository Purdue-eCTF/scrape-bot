import { bufferAndUnzip, bufferAndUnzipF, streamAndUnzip, streamAndUnzipF } from '../util/files';
import { rm } from 'node:fs/promises';
import path from 'node:path';


const URL = 'https://ectf.zulipchat.com/user_uploads/74293/h7nClLV18sL-TiBbJb6M2CiR/ba_1080.zip';

async function benchBuffered() {
    const start = new Date().getTime();
    await bufferAndUnzipF('./test.zip', './tmp');
    const end = new Date().getTime();

    console.log('Buf:', end - start, 'ms');
}

async function benchStream() {
    const start = new Date().getTime();
    await streamAndUnzipF('./test.zip', path.join(__dirname, 'tmp'));
    const end = new Date().getTime();

    console.log('Stm:', end - start, 'ms');
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
