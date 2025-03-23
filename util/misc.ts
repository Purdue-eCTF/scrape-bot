export function truncate(str: string, len: number) {
    if (str.length <= len) return str;
    return str.slice(0, len - 3).trimEnd() + '...';
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
