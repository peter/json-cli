#!/usr/bin/env node --max-old-space-size=16384

// Simple node script that provides a jq alternative for processing JSON using JavaScript on the command line.
// Supports newline separated JSON (JSON lines) as well as JSON data.
// Also supports log data where some lines are JSON and some aren't and log lines where the
// beginning of the line is text and the end of the line is JSON, i.e.:
//
// 2022-10-18T14:07:53.960Z [INFO ] starting server with config: {"port":3000}

// With pipe (can break for large amounts of JSON data)
//
// cat some-data.json | json <javascript-code>
//
// With a file path (works better for large amounts of data):
//
// json <javascript-code> <file-path>
// The JSON data is available in a `data` variable. If the JavaScript code argument starts with a "." then that is equivalent to starting it with "data.".
//
// You can use map and filter and useful lodash functions like get:
//
// cat some-data.json | json ".Items.map(i => ({id: get(i, 'id.S'), updatedAt: get(i, 'updatedAt.N')})).filter(i => new Date(Number(i.updatedAt)) < new Date())"
//
// You can access the JSON data with the data variable:
//
// cat some-data.json | json "Object.keys(data)"
//
// Split complex processing with pipes if it helps readability:
//
// cat some-data.json \
//  | json ".Items.map(i => ({id: get(i, 'id.S'), updatedAt: get(i, 'updatedAt.N')}))" \
//  | json ".filter(i => new Date(Number(i.updatedAt)) < new Date())"
//
// Easily print lengths of arrays or keys of objects etc:
//
// cat some-data.json | json ".Items.length"
//
// Pretty print (echo) JSON data:
//
// cat some-data.json | json .

const fs = require("fs");
const readline = require("readline");

const _ = require("lodash");
Object.assign(global, require("lodash"));
Object.assign(global, require("../src/helpers.js"));
if (process.env.JSON_HELPERS_PATH) {
    Object.assign(global, require(process.env.JSON_HELPERS_PATH));
}

const { diff } = require("object-diffy");
const { colorize } = require("json-colorizer");

const VALID_JSON_OUTPUT_TYPES = [
  "json",
  "json_pretty",
  "raw",
  "jsonl"
]
VALID_JSON_STRINGIFIERS = ["stable", "default"]

const USAGE_TEXT = `
    Usage: json [javascript-code] [input-json-file]
    
    Arguments:
      [javascript-code] JavaScript code to evaluate (optional, defaults to "data")
      [input-json-file] Path to input JSON data (optional, by default stdin is used)
    
    Examples:
      echo '{"foo": "1"}' | json .foo
      cat test/input/basic.json | json 'Object.keys(data)'
      cat test/input/basic.json | json '.data.length'
      cat test/input/basic.json | json '.data.map(d => pick(d, ["value"]))'
      cat test/input/basic.json | json 'flattenJson(data)'
      cat test/input/basic.json | json 'data.data.map(d => d.value)' | json 'stats(data)'
      cat test/input/data.json| json 'groupBy(data, "name")' | json 'mapValues(data, items => items.map(i => i.value))' | json 'mapValues(data, d => pick(stats(d), ["p90"]))'
      cat test/input/array.json | json
      cat test/input/basic.json | JSON_OUTPUT=json json
      cat test/input/array.json | JSON_OUTPUT=jsonl json 
      cat test/input/array.jsonl | json
      cat test/input/log-with-json.log | json
      echo '{"values1": [1, 2, 3, 4], "values2": [3, 5, 1, 11]}' | JSON_HELPERS_PATH="$(pwd)/test/custom-helpers.js" json 'correlation(data.values1, data.values2)'
`

function debugLog(message) {
  if (process.env.JSON_DEBUG === "true") {
    console.log(message)
  }
}

function getCodeArg(args) {
    let code = args[0] || "data"
    // Support jq like dot syntax
    if (code === ".") {
        code = "data"
    } else if (code.startsWith(".")) {
        code = "data" + code
    }
    return code
}

function readStdIn() {
    return fs.readFileSync(0).toString();
}

function parseLine(line, openLines) {
  let result = { openLines: [...openLines] };
  try {
    const openIndex = line.startsWith("[") ? 0 : line.indexOf("{");
    if (
      openLines.length === 0 &&
      ((line.indexOf("{") >= 0 && line.endsWith("}")) ||
        (line.startsWith("[") && line.endsWith("]")))
    ) {
      const doc = JSON.parse(line.substring(openIndex));
      if (openIndex > 0 && !doc._line) doc._line = line.substring(0, openIndex);
      result.parsedLine = doc;
    } else if (line === "{") {
      result.openLines = [line];
    } else if (openLines.length > 0) {
      result.openLines.push(line);
      if (line === "}") {
        result.parsedLine = JSON.parse(openLines.join("\n"));
        result.openLines = [];
      }
    } else {
      result.parsedLine = { _line: line };
    }
  } catch (err) {
    result.error = `Error thrown parsing line: ${line} - ${err.stack}`;
    result.openLines = [];
    result.parsedLine = { _line: line, _lineError: `Error thrown parsing line - ${err.stack}` };
  }
  return result;
}

async function jsonIn(filePath) {
    let textInput
    try {
      if (filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
      } else {
        textInput = readStdIn()
        // NOTE: I've found JSON.parse intermittently errors out for data sizes around 15 MB but require(filePath) can handle more?
        // const dataSizeMb = Buffer.byteLength(textInput) / 1024 / 1024
        return JSON.parse(textInput)
      }
    } catch (jsonErr) {
      try {
        const lines = []
        let openLines = []
        let nErrors = 0
        let lineCount = 0
        const processLine = (line) => {
          lineCount += 1
          const result = parseLine(line, openLines)
          if (result.error) {
            debugLog(result.error)
            nErrors += 1
          }
          if (result.parsedLine) lines.push(result.parsedLine)
          openLines = result.openLines
        }
        if (filePath) {
          const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity,
          })
          for await (const line of rl) {
            processLine(line)
          }
        } else {
          textInput = textInput || readStdIn()
          const textLines = textInput
            .trim()
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
          for (const [index, line] of textLines.entries()) {
            processLine(line)
          }
        }
        if (nErrors > 0)
          debugLog(
            `Failed to parse ${nErrors} lines due to errors`
          )
        return lines
      } catch (linesErr) {
        console.log(jsonErr.stack)
        console.log(linesErr.stack)
        throw new Error("Could not parse input as JSON or as JSON lines")
      }
    }
}

function printJsonLines(data) {
  for (const line of data) {
    console.log(jsonStringify(line));
  }
}

function printJson(data, stringifier = "stable") {
    console.log(jsonStringify(data, stringifier))
}

function printPrettyJson(data, stringifier = "stable") {
    console.log(colorize(jsonStringify(data, stringifier)))
}

async function main() {
    const args = process.argv.slice(2)
    if (args.includes('--help') || args.includes('-h')) {
      console.log(USAGE_TEXT);
      process.exit(0);
    }      
    const code = getCodeArg(args)
    const filePath = args[1]
    const data = await jsonIn(filePath)  

    const processedData = eval(code)

    const JSON_OUTPUT = process.env.JSON_OUTPUT || "json_pretty"
    if (!VALID_JSON_OUTPUT_TYPES.includes(JSON_OUTPUT)) {
      throw new Error(`Invalid JSON output type: ${JSON_OUTPUT}, must be one of: ${VALID_JSON_OUTPUT_TYPES.join(", ")}`)
    }
    const JSON_STRINGIFIER = process.env.JSON_STRINGIFIER || "stable"
    if (!VALID_JSON_STRINGIFIERS.includes(JSON_STRINGIFIER)) {
      throw new Error(`Invalid JSON stringifier: ${JSON_STRINGIFIER}, must be one of: ${VALID_JSON_STRINGIFIERS.join(", ")}`)
    }
    if (JSON_OUTPUT === "raw" || (["string", "number", "boolean"].includes(typeof processedData))) {
      console.log(processedData)
    } else if (JSON_OUTPUT === "jsonl" && Array.isArray(processedData)) {
      printJsonLines(processedData)
    } else if (JSON_OUTPUT === "json") {
      printJson(processedData, JSON_STRINGIFIER)
    } else if (JSON_OUTPUT === "json_pretty") {
      printPrettyJson(processedData, JSON_STRINGIFIER)
    } else {
      throw new Error(`Don't know how to handle JSON output type: ${JSON_OUTPUT}`)
    }
}
  

if (require.main === module) {
  main()
}
