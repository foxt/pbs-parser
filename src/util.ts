
export function withLazy<
    Predef extends Record<string,any>,
    Lazy extends Record<string, () => any>
>(predef: Predef, lazy: Lazy): Predef & { [K in keyof Lazy]: ReturnType<Lazy[K]> } {
    for (let k in lazy) {
        Object.defineProperty(predef, k, {
            get: () => {
                delete predef[k];
                return predef[k] = lazy[k]();
            },
            configurable: true,
            enumerable: true,
        });
    }
    return predef as any;
}

export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, ...removeKeys: K[]) {
    let nnew = {...obj};
    for (let key of removeKeys) 
        delete nnew[key];
    return nnew as Omit<T, K>;
}