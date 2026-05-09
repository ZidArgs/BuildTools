import fs from "fs";
import path from "path";
import {Transform} from "stream";
import {normalizePath} from "./util/NormalizePath.js";
import {resolvePackageFilePath} from "./util/ResolvePackage.js";

const LNBR_SEQ = /(?:\r\n|\n|\r)/g;
const CHECKS = [
    /* native static import */
    /^\s*import(?:\s+[a-zA-Z0-9_${}, ]+\s+from)?\s+"([^"]+)"\s*;?$/,
    /* native static import - named with newline */
    /^\}\s+from\s+"([^"]+)"\s*;?$/,
    /* native dynamic import */
    /^(?:.*\s)?import\s*\(\s*"([^"]+)"s*\)/,
    /* custom module import */
    /^(?:.*\s)?Import\.module\s*\(\s*"([^"]+)"s*\)/,
    /* custom module injection */
    /^(?:.*\s)?Inject\.module\s*\(\s*"([^"]+)"s*\)/,
    /* custom script injection */
    /^(?:.*\s)?Inject\.script\s*\(\s*"([^"]+)"s*\)/
];

const originalPaths = new Map();
const resolvedPaths = new Map();
const resolvedPathsReverse = new Map();
const rewriteRules = new Map();
const allImports = new Map();

function resolveAbsolutePath(distRoot, filePath) {
    return normalizePath(path.resolve(`${distRoot}${filePath}`));
}

function resolvePackagePath(root, filePath) {
    return normalizePath(resolvePackageFilePath(root, filePath));
}

function resolveRelativePath(src, dest, sourceDir, filePath) {
    const fullPath = normalizePath(path.resolve(sourceDir, filePath));
    if (resolvedPaths.has(fullPath)) {
        return resolvedPaths.get(fullPath);
    }
    const resolvedPath = normalizePath(path.resolve(dest, path.relative(src, fullPath)));
    resolvedPaths.set(fullPath, resolvedPath);
    resolvedPathsReverse.set(resolvedPath, fullPath);
    return resolvedPath;
}

function getRewritePath(filePath) {
    for (const [rewriteSrc, rewriteDest] of rewriteRules) {
        if (filePath.startsWith(rewriteSrc)) {
            const newFilelPath = `${rewriteDest}${filePath.slice(rewriteSrc.length)}`;
            return newFilelPath;
        }
    }
    return filePath;
}

function analyzeFile(sourcePath, src = "/", dest = "/", root = "/", distRoot = "/", fileContent = "") {
    const sourceDir = path.dirname(sourcePath);
    const lines = fileContent.split(LNBR_SEQ);
    const usedImports = new Map();
    for (const line of lines) {
        for (const regExp of CHECKS) {
            const result = regExp.exec(line);
            if (result != null) {
                const filePath = result[1];
                if (filePath.endsWith(".js")) {
                    if (filePath.startsWith("/")) {
                        usedImports.set(getRewritePath(resolveAbsolutePath(distRoot, filePath)),  filePath);
                    } else if (!filePath.startsWith(".")) {
                        usedImports.set(getRewritePath(resolvePackagePath(root, filePath)),  filePath);
                    } else {
                        usedImports.set(getRewritePath(resolveRelativePath(src, dest, sourceDir, filePath)),  filePath);
                    }
                }
                break;
            }
        }
    }
    const resolvedPath = normalizePath(path.resolve(dest, path.relative(src, sourcePath)));
    originalPaths.set(resolvedPath, sourcePath);
    allImports.set(resolvedPath, usedImports);
}

class ImportAnalyzer {

    setPathRewriteRule(src, dest) {
        src = normalizePath(src);
        dest = normalizePath(dest);
        console.log(`set rewrite: ${src} -> ${dest}`);
        rewriteRules.set(src, dest);
    }

    register(src, dest, root, distRoot = root) {
        const transformStream = new Transform({objectMode: true});
        transformStream._transform = function(file, encoding, callback) {
            analyzeFile(file.path, src, dest, root, distRoot, String(file.contents));
            callback(null, file);
        };
        return transformStream;
    }

    #calculateUsedImports(...filePaths) {
        const result = new Set();
        for (const currentFilePath of filePaths) {
            const normalizedFilePath = normalizePath(currentFilePath);
            const usedImports = allImports.get(normalizedFilePath);
            if (usedImports != null) {
                result.add(normalizedFilePath);
                for (const [filePath] of usedImports) {
                    if (!result.has(filePath)) {
                        const used = this.#calculateUsedImports(filePath);
                        for (const imp of used) {
                            result.add(imp);
                        }
                    }
                }
            }
        }
        return result;
    }

    getUsedImports(...filePaths) {
        const result = this.#calculateUsedImports(...filePaths);
        if (result.size) {
            return result;
        }
    }

    getUnresolvedImports() {
        const unresolved = {};
        for (const [srcFile, imports] of allImports) {
            const originalPath = normalizePath(originalPaths.get(srcFile) ?? srcFile);
            for (const [current, filePath] of imports) {
                if (!allImports.has(current)) {
                    const currentPath = resolvedPathsReverse.get(current) ?? current;
                    if (!fs.existsSync(currentPath)) {
                        unresolved[originalPath] = unresolved[originalPath] ?? {};
                        unresolved[originalPath][filePath] = currentPath;
                    }
                }
            }
        }
        return unresolved;
    }

    printUnresolvedImports() {
        const unresolvedImports = Object.entries(this.getUnresolvedImports());
        if (unresolvedImports.length > 0) {
            console.error("Unresolved imported files detected");
            for (const unresolvedImportEntry of unresolvedImports) {
                const [srcPath, imports] = unresolvedImportEntry;
                console.log(`Unknown imports in "${srcPath}": ${JSON.stringify(imports, null, 4)}`);
            }
        }
    }

    writeImportFile() {
        const importTree = {};
        for (const [file, imports] of allImports) {
            importTree[file] = Array.from(imports);
        }
        fs.writeFileSync(path.resolve("import_tree.json"), JSON.stringify(importTree, null, 4));
    }

    writeUnresolvedImports() {
        const importTree = {};
        const unresolvedImports = Object.entries(this.getUnresolvedImports());
        if (unresolvedImports.length > 0) {
            for (const unresolvedImportEntry of unresolvedImports) {
                const [srcPath, imports] = unresolvedImportEntry;
                importTree[srcPath] = imports;
            }
        }
        fs.writeFileSync(path.resolve("import_unresolved.json"), JSON.stringify(importTree, null, 4));
    }

}

export default new ImportAnalyzer();
