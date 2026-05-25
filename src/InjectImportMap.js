import {Transform} from "stream";

const IMPORTMAP = /<script type="importmap">.*?<\/script>/s;

export default class InjectImportMap {

    #importMap = {"imports": {}};

    inject() {
        const transformStream = new Transform({objectMode: true});
        transformStream._transform = (file, encoding, callback) => {
            const contents = this.#augmentFile(file.path, String(file.contents));
            if (file.isBuffer() === true) {
                file.contents = Buffer.from(contents);
            } else {
                file.contents = contents;
            }
            callback(null, file);
        };
        return transformStream;
    }

    setImport(key, path) {
        this.#importMap.imports[key] = path;
    }

    #augmentFile(sourcePath, fileContent) {
        return fileContent.replace(IMPORTMAP, `<script type="importmap">${JSON.stringify(this.#importMap)}</script>`);
    }

}
