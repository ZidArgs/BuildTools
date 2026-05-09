const UNDEF = void 0;

function patchReviver(key, value) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return UNDEF;
    }
    return value;
}

export default function jsonParse(text, reviver) {
    const reviverComposition = reviver ? (key, value) => {
        value = patchReviver(key, value);
        return value === UNDEF ? UNDEF : reviver(key, value);
    } : patchReviver;
    return JSON.parse(text, reviverComposition);
}
