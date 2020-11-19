export const reducedObject = (object, keyArray) =>
    keyArray.reduce((obj, key) => ({
        ...obj,
        [key]: object[key]
    }), {});