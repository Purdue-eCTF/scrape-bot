export function truncate(str: string, len: number) {
    if (str.length <= len) return str;
    return str.slice(0, len - 3).trimEnd() + '...';
}

export function truncateArr(arr: string[], len: number) {
    let curr = 0;
    let i = 0;
    for (; i < arr.length; i++) {
        curr += arr[i].length + 1;
        if (curr > len) break;
    }

    return arr.slice(0, i);
}

export function chunked<T>(arr: T[], size: number) {
    return arr.reduce((res: T[][], item, index) => {
        const chunkIndex = Math.floor(index / size);
        if (!res[chunkIndex]) res[chunkIndex] = [];

        res[chunkIndex].push(item);
        return res;
    }, []);
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
