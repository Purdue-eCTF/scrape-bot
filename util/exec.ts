import { exec } from 'node:child_process';


export function execAsync(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            return resolve(stdout);
        });
    })
}
