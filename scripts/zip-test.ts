import { bufferAndUnzipLocal, streamAndUnzipLocal } from '../util/files';
import { rm } from 'node:fs/promises';
import path from 'node:path';


async function benchBuffered() {
    const start = new Date().getTime();
    await bufferAndUnzipLocal('./test.zip', './tmp');
    const end = new Date().getTime();

    console.log('Buf:', end - start, 'ms');
}

async function benchStream() {
    const start = new Date().getTime();
    await streamAndUnzipLocal('./test.zip', './tmp');
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
