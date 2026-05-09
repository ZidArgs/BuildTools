export function normalizePath(path) {
    return path.replace(/\\/g, "/").replace(/^file:\/\/\//, "");
}
