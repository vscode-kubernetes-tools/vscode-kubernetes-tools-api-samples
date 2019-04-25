export function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function after<T>(ms: number, result: T): Promise<T> {
    await sleep(ms);
    return result;
}
