import fs from "fs";
import path from "path";
import glob from "glob-all";
import through from "through";
import del from "del";

const FILES = new Set();
const IGNORE_UNUSED = new Set();

function normalizePath(path) {
    return path.replace(/\\/g, "/");
}

class FileIndex {

    reset() {
        FILES.clear();
    }

    register(src = "/", dest = "/", sourcemaps = false) {
        const files = [];
        return through(function(file) {
            const normalPath = normalizePath(path.resolve(dest, path.relative(src, file.path)));
            FILES.add(normalPath);
            if (sourcemaps) {
                FILES.add(`${normalPath}.map`);
            }
            this.push(file);
            return files.push(file);
        }, function() {
            return this.emit("end");
        });
    }

    addThrough(src = "/", dest = "/", ignoreUnused = false) {
        const files = [];
        return through(function(file) {
            const normalPath = normalizePath(path.resolve(dest, path.relative(src, file.path)));
            FILES.add(normalPath);
            if (ignoreUnused) {
                IGNORE_UNUSED.add(normalPath);
            }
            this.push(file);
            return files.push(file);
        }, function() {
            return this.emit("end");
        });
    }

    add(files = [], ignoreUnused = false) {
        const resolvedFiles = glob.sync(files, {
            nodir: true,
            absolute: true,
            ignore: "node_modules/**"
        });
        for (const fName of resolvedFiles) {
            const normalPath = normalizePath(fName);
            FILES.add(normalPath);
            if (ignoreUnused) {
                IGNORE_UNUSED.add(normalPath);
            }
        }
    }

    finish(dest = "/", index = "index.json", config = {}) {
        const {
            usedImports = null,
            deleteUnused = true,
            reportRemoved = false,
            silent = false
        } = config;
        const indexPath = path.resolve(dest, index);
        const indexPathNormal = normalizePath(indexPath);
        const destFiles = glob.sync("./**/*", {
            nodir: true,
            cwd: dest,
            absolute: true,
            ignore: "node_modules/**"
        });

        const removedImports = [];
        if (deleteUnused) {
            if (usedImports != null) {
                if (!silent) {
                    console.log("removing unused imports");
                }
                for (const fName of FILES) {
                    if (fName.endsWith(".js") && !IGNORE_UNUSED.has(fName) && !usedImports.has(fName)) {
                        if (!silent) {
                            console.log(`remove import: ${fName}`);
                        }
                        FILES.delete(fName);
                        removedImports.push(fName);
                    }
                }
            }
            if (!silent) {
                console.log("deleting unused files");
            }
            for (const fName of destFiles) {
                if (fName != indexPathNormal && !FILES.has(fName)) {
                    if (!silent) {
                        console.log(`delete file: ${fName}`);
                    }
                    del.sync(fName);
                }
            }
        }

        // TODO remove empty folders

        const files = Array.from(FILES).sort().map((el)=>`/${path.relative(dest, el)}`.replace(/\\/g, "/"));
        files.push("/");
        if (!silent) {
            console.log(`write file index: ${indexPathNormal}`);
        }
        fs.writeFileSync(indexPath, JSON.stringify(files, null, 4));
        if (reportRemoved) {
            fs.writeFileSync(path.resolve("import_removed.json"), JSON.stringify(removedImports.sort(), null, 4));
        }
        return indexPath;
    }

}

export default new FileIndex();
