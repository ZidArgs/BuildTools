import path from "path";
import {normalizePath} from "./NormalizePath.js";

export default class ExportsResolver {

    #rootDir = "/";

    #patternList = [];

    constructor(rootDir = "/") {
        this.#rootDir = normalizePath(rootDir);
    }

    addResolver(pattern, substitute) {
        const patternPath = this.#cleanupPathName(pattern).split("/");
        const replacerPath = this.#cleanupPathName(substitute).split("/");

        const result = {
            pattern,
            path: patternPath,
            params: [],
            specifity: [],
            substitute
        };

        const matcherList = [];
        for (const part of patternPath) {
            if (part === "*") {
                matcherList.push("(.*)");
                result.specifity.push(2);
            } else if (part.includes("*")) {
                matcherList.push(part.replace(/\*/g, "(.*)"));
                result.specifity.push(1);
            } else {
                matcherList.push(part);
                result.specifity.push(0);
            }
        }

        const replacerList = [];
        let replacerCounter = 1;
        for (const part of replacerPath) {
            if (part === "*") {
                replacerList.push(`$${replacerCounter++}`);
            } else if (part.includes("*")) {
                replacerList.push(part.replace(/\*/g, `$$${replacerCounter++}`));
            } else {
                replacerList.push(part);
            }
        }

        result.matcher = new RegExp(`^${matcherList.join("/")}$`);
        result.length = patternPath.length;

        result.replacer = `${this.#rootDir, replacerList.join("/")}`;

        this.#patternList.push(result);
        this.#patternList.sort(this.#comparePathConfig);
    }

    resolvePath(pathName) {
        const pathParts = pathName.split("/");
        for (const entry of this.#patternList) {
            if (pathParts.length < entry.length) {
                continue;
            }
            if (entry.matcher.test(pathName)) {
                const resolvedPath = pathName.replace(entry.matcher, entry.replacer);
                const fullPath = path.resolve(this.#rootDir, resolvedPath);
                return normalizePath(fullPath);
            }
        }
        return pathName;
    }

    #cleanupPathName(pathName) {
        return this.#trimPathName(pathName).replace(/^\.\//, "").replace(/\\/g, "\\\\").replace(/\./g, "\\.");
    }

    #trimPathName(pathName) {
        if (typeof pathName !== "string" || pathName === "") {
            return "";
        }
        return pathName.trim().replace(/(^\/|\/$)/g, "");
    }

    #comparePathConfig(a, b) {
        for (let i = 0; i < a.length; ++i) {
            if (a.specifity[i] == null) {
                return 1;
            }
            if (b.specifity[i] == null) {
                return -1;
            }
            if (a.specifity[i] === b.specifity[i]) {
                continue;
            }
            return a.specifity[i] - b.specifity[i];
        }
        return 0;
    }

}
