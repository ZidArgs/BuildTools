import fs from "fs";
import path from "path";
import through from "through";

const FILES = new Map();

function normalizePath(path) {
    return path.replace(/\\/g, "/");
}

class ImageIndex {

    reset() {
        FILES.clear();
    }

    register(src = "/", dest = "/") {
        const files = [];
        return through(function(file) {
            const filePath = normalizePath(path.resolve(dest, path.relative(src, file.path)));
            const parsedPath = path.parse(filePath);
            const name = parsedPath.name;
            FILES.set(filePath, name);
            this.push(file);
            return files.push(file);
        }, function() {
            return this.emit("end");
        });
    }

    finish(dest = "/", index = "index.images.json", filterPattern = null, namePattern = null) {
        const indexPath = path.resolve(dest, index);
        const indexPathNormal = normalizePath(indexPath);

        const files = {};

        for (const [filePath, name] of FILES) {
            const relativePath = `/${path.relative(dest, filePath)}`.replace(/\\/g, "/");
            if (filterPattern == null || filterPattern.test(relativePath)) {
                if (namePattern != null) {
                    const res = namePattern.exec(relativePath);
                    if (res != null) {
                        files[relativePath] = res.at(-1);
                        continue;
                    }
                }
                files[relativePath] = name;
            }
        }

        console.log(`write image index: ${indexPathNormal}`);
        fs.writeFileSync(indexPath, JSON.stringify(files, null, 4));
        return indexPath;
    }

}

export default new ImageIndex();
