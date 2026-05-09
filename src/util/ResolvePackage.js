import fs from "fs";
import path from "path";
import {normalizePath} from "./NormalizePath.js";
import {readJSONFile} from "./ReadJSONFile.js";
import ExportsResolver from "./ExportsResolver.js";

export function readPackageConfig(importPath) {
    const parts = normalizePath(importPath).split("/");
    while (parts.length > 0) {
        parts.pop();
        const packagePath = parts.join("/");
        const packageFile = path.resolve(packagePath, "package.json");
        if (fs.existsSync(packageFile)) {
            return readJSONFile(packageFile);
        }
    }
    return null;
}

export function resolvePackageName(importPath) {
    return readPackageConfig(importPath)?.name;
}

export function resolvePackagePath(root, importPath) {
    const parts = importPath.split("/");
    const module_path = [];
    while (parts.length > 0) {
        module_path.push(parts.shift());
        const packageName = module_path.join("/");
        const packageFile = path.resolve(`${root}/node_modules`, packageName, "package.json");
        if (fs.existsSync(packageFile)) {
            return path.dirname(packageFile);
        }
    }
    return null;
}

export function resolvePackageFilePath(root, importPath) {
    const packagePath = resolvePackagePath(root, importPath);
    if (packagePath != null) {
        const packageFile = path.resolve(packagePath, "package.json");
        if (fs.existsSync(packageFile)) {
            const packageConfig = readJSONFile(packageFile);
            const exportsResolver = new ExportsResolver(packagePath);
            if ("exports" in packageConfig) {
                for (const [matcher, substitute] of Object.entries(packageConfig.exports)) {
                    exportsResolver.addResolver(matcher, substitute);
                }
            }
            const restPath = importPath.slice(packageConfig.name.length);
            const filePath = exportsResolver.resolvePath(restPath);
            return path.resolve(packagePath, filePath);
        }
    }
    return "";
}
