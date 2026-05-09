import fs from "fs";
import jsonParse from "./JSONParser.js";

export function readJSONFile(filePath) {
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath).toString();
        return jsonParse(fileContent);
    }
    return null;
}
