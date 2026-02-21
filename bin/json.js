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
const stringify = require('fast-json-stable-stringify')

function getCodeArg() {
    let code = process.argv[2] || "data"
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
    result.parsedLine = { _line: line };
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
            console.log(error)
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
          console.log(
            `Failed to parse ${nErrors}/${textLines.length} lines due to errors`
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
    console.log(stringify(line));
  }
}

function printJson(data) {
    console.log(stringify(data))
}

function printPrettyJson(data) {
    console.log(colorize(stringify(data, null, 4)))
}

async function main() {
    const code = getCodeArg()
    const filePath = process.argv[3]
  
    const data = await jsonIn(filePath)
  
    const processedData = eval(code)
  
    if (process.env.RAW === "true" || (process.env.RAW !== "false" && ["string", "number", "boolean"].includes(typeof processedData))) {
      console.log(processedData)
    } else if (process.env.JSONL === "true" && Array.isArray(processedData)) {
      printJsonLines(processedData)
    } else if (process.env.PRETTY === "false") {
      printJson(processedData)
    } else {
      printPrettyJson(processedData)
    }
}
  

if (require.main === module) {
  main()
}
