import {Transform} from "stream";

class InjectAssets {

    #assets = new Map();

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

    addInlineStyle(assetName, content) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "inline-style",
            content
        });
    }

    addStyle(assetName, url) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "style",
            content: url
        });
    }

    addInlineScript(assetName, content) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "inline-script",
            content
        });
    }

    addScript(assetName, url, async = false, defer = false) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "script",
            content: url,
            opts: {
                async,
                defer
            }
        });
    }

    addInlineModule(assetName, content) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "inline-module",
            content
        });
    }

    addModule(assetName, url, async = false) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "module",
            content: url,
            opts: {async}
        });
    }

    addData(assetName, id, mime, content) {
        const assetSet = this.#getAssetSet(assetName);
        assetSet.add({
            type: "data",
            content,
            opts: {
                id,
                mime
            }
        });
    }

    #augmentFile(sourcePath, fileContent) {
        const needle = /<!--\s*\$\{([a-z0-9]+)\}\s*-->/gi;
        return fileContent.replace(needle, (value, assetName) => {
            const assetSet = this.#assets.get(assetName);
            if (assetSet == null) {
                return value;
            }
            const result = [];
            for (const resource of assetSet) {
                result.push(this.#createAsset(resource));
            }
            return result.join("\n");
        });
    }

    #createAsset(resource) {
        const {
            content, type, opts = {}
        } = resource;
        switch (type) {
            case "inline-style": {
                return `<style>${content}</style>`;
            }
            case "style": {
                return `<link rel="stylesheet" href="${content}">`;
            }
            case "inline-script": {
                return `<script>${content}</script>`;
            }
            case "script": {
                if (opts.async) {
                    return `<script src="${content}" async></script>`;
                }
                if (opts.defer) {
                    return `<script src="${content}" defer></script>`;
                }
                return `<script src="${content}"></script>`;
            }
            case "inline-module": {
                return `<script type="module">${content}</script>`;
            }
            case "module": {
                if (opts.async) {
                    return `<script type="module" src="${content}" async></script>`;
                }
                return `<script type="module" src="${content}"></script>`;
            }
            case "data": {
                const {
                    id = "custom-data",
                    mime = "x-appliccation/custom-data"
                } = opts;
                return `<script id="${id}" type="${mime}">${content}</script>`;
            }
        }
        return "";
    }

    #getAssetSet(name) {
        if (this.#assets.has(name)) {
            return this.#assets.get(name);
        }
        const assetSet = new Set();
        this.#assets.set(name, assetSet);
        return assetSet;
    }

}

export default new InjectAssets();
