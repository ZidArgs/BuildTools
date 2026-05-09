import path from "path";
import gulp from "gulp";
import webpackStream from "webpack-stream";
import through from "through";
import {Transform} from "stream";

export function packScript() {
    const transformStream = new Transform({objectMode: true});
    transformStream._transform = function(file, encoding, callback) {
        const parsedPath = path.parse(file.path);
        gulp.src(file.path).pipe(webpackStream({
            mode: "production",
            optimization: {
                mangleExports: false,
                minimize: false
            },
            stats: "minimal",
            infrastructureLogging: {
                level: "error"
            }
        })).pipe(through((packedFile) => {
            let contents = packedFile.contents;
            if (packedFile.isBuffer() === true) {
                contents = String(contents);
                contents = removeWebpackComments(contents);
                contents = Buffer.from(contents);
            } else {
                contents = removeWebpackComments(contents);
            }
            file.contents = contents;
            file.path = `${parsedPath.dir}/${parsedPath.name}.leg.js`;
            callback(null, file);
        }));
    };
    return transformStream;
}

const WEWBPACK_COMMENT_PATTERNS = [
    / \/\/ webpackBootstrap/,
    /\/\*\*\*\*\*\*\/ /g,
    /\/\* harmony default export \*\/ /
];

function removeWebpackComments(contents) {
    for (const pattern of WEWBPACK_COMMENT_PATTERNS) {
        contents = contents.replace(pattern, "");
    }
    return contents.replace(/;\/\/ .*\n/g, ";// ==========\n");
}
