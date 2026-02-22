const fastStableStringify = require('fast-json-stable-stringify')

function flattenJson(data, path = []) {
    if (Array.isArray(data)) {
        return data.reduce((acc, value, index) => {
            const valueJson = flattenJson(value, [...path, index]);
            for (const [key, value] of Object.entries(valueJson)) {
                acc[key] = value;
            }
            return acc;
        }, {});
    } else if (typeof data === "object" && data !== null) {
        return Object.keys(data).reduce((acc, key) => {
            const keyJson = flattenJson(data[key], [...path, key]);
            for (const [key, value] of Object.entries(keyJson)) {
                acc[key] = value;
            }
            return acc;
        }, {});
    } else {
        return { [path.join(".")]: data };
    }
}

// https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object
function sizeOfObject(object) {
    var objectList = [];
    var stack = [object];
    var bytes = 0;
    
    while (stack.length) {
        var value = stack.pop();
        
        if (typeof value === "boolean") {
            bytes += 4;
        } else if (typeof value === "string") {
            bytes += value.length * 2;
        } else if (typeof value === "number") {
            bytes += 8;
        } else if (typeof value === "object" && objectList.indexOf(value) === -1) {
            objectList.push(value);
            
            for (var i in value) {
                stack.push(value[i]);
            }
        }
    }
    return bytes;
}

function base64Decode(data) {
    return data && Buffer.from(data, "base64").toString();
}

function base64Encode(data) {
    return data && Buffer.from(data).toString("base64");
}

function percentile(arr, p) {
    if (typeof p !== 'number' || p <= 0 || p >= 1.0) {
        throw new Error('Percentile must be a number between 0 and 1');
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
  
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function p50(values) {
    return percentile(values, 0.5);
}

function p90(values) {
    return percentile(values, 0.9);
}

function p99(values) {
    return percentile(values, 0.99);
}

function stdDev(values, avg) {
    const sum = values.reduce((acc, v) => acc + (v - avg) ** 2, 0);
    return Math.sqrt(sum / values.length);
}

function stats(values) {
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        stdDev: stdDev(values, avg),
        sum,
        avg,
        p1: percentile(values, 0.01),
        p5: percentile(values, 0.05),
        p10: percentile(values, 0.1),
        p20: percentile(values, 0.2),
        p30: percentile(values, 0.3),
        p40: percentile(values, 0.4),
        p50: percentile(values, 0.5),
        p60: percentile(values, 0.6),
        p70: percentile(values, 0.7),
        p80: percentile(values, 0.8),
        p90: percentile(values, 0.9),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
        p999: percentile(values, 0.999),
    };
}

function jsonStringify(data, stringifier = "stable") {
    if (stringifier === "stable") {
        return fastStableStringify(data)
    } else if (stringifier === "default") {
        return JSON.stringify(data)
    } else {
        throw new Error(`Invalid stringifier: ${stringifier}`)
    }
}
  

module.exports = {
    flattenJson,
    sizeOfObject,
    base64Decode,
    base64Encode,
    stats,
    jsonStringify,
}
