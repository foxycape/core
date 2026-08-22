export const applyNamed = (text: string, named?: object): string => {
    if (!named) {
        return text;
    }
    let result = text;
    for (const [name, value] of Object.entries(named)) {
        result = result.split(`{${name}}`).join(String(value ?? ""));
    }
    return result;
};
