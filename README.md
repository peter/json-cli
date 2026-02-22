# json - JavaScript based JSON CLI

An npm package that provides a convenient way to use JavaScript to work with JSON in the terminal. This tool is for those of us who like `jq` but prefer JavaScript over `jq` syntax.

## Installation

```sh
npm install @peter_marklund/json -g
```

## Usage

```sh
json [javascript-code] [input-json-file]
```

The JSON data is typically passed to the `json` command via `stdin` but can also be passed as a file path via the second argument. The first argument to the `json` command is a string with JavaScript code to be evaluated. All [lodash](https://lodash.com/docs/4.17.23) functions (i.e. `pick`, `pickBy`, `groupBy`, `mapValues`, `sum` etc.) are available as are a number of [helper functions](src/helpers.js). It is also possible to provide custom JavaScript helper functions via the `JSON_HELPERS_PATH` environment variable.

Environment variables for configuration:

* `JSON_OUTPUT` - determines how output is serialized and the default value is `json_pretty`. Valid values are: `json`, `json_pretty`, `raw`, `jsonl`
* `JSON_STRINGIFIER` - what function/library is used to stringify. The default value is `stable` and this means the `fast-json-stable-stringify` library is used to yield stable/sorted output but this can be changed to `JSON.stringify` by setting `JSON_STRINGIFIER=default`
* `JSON_HELPERS_PATH` - path to a JavaScript file that exports custom helper functions

Get the value at a path:

```sh
echo '{"foo": "1"}' | json .foo
```

Get the keys of a JSON object:

```sh
cat test/input/basic.json | json 'Object.keys(data)'
# [
#   "foo",
#   "bar",
#   "baz",
#   "nested",
#   "data"
# ]
```

Get the length of an array:

```sh
cat test/input/basic.json | json '.data.length'
# 3
```

Use lodash functions:

```sh
cat test/input/basic.json | json '.data.map(d => pick(d, ["value"]))'
# [
#   {
#     "value": 100
#   },
#   {
#     "value": 200
#   },
#   {
#     "value": 300
#   }
# ]
```

Use the flattenJson helper to find the path of a deeply nested value:

```sh
cat test/input/basic.json | json 'flattenJson(data)'
# {
#   "bar": "Hello world",
#   "baz": false,
#   "data.0.id": 1,
#   "data.0.name": "Item 1",
#   "data.0.value": 100,
#   "data.1.id": 2,
#   "data.1.name": "Item 2",
#   "data.1.value": 200,
#   "data.2.id": 3,
#   "data.2.name": "Item 3",
#   "data.2.value": 300,
#   "foo": 1,
#   "nested.foo.bar": "nested value"
# }
```

Use the stats helper function to get min/max/avg/median/p90 etc. for numerical values

```sh
cat test/input/basic.json | json 'data.data.map(d => d.value)' | json 'stats(data)'
# {
#   "avg": 200,
#   "count": 3,
#   "max": 300,
#   "min": 100,
#   "p1": 102,
#   "p10": 120,
#   "p20": 140,
#   "p30": 160,
#   "p40": 180,
#   "p5": 110,
#   "p50": 200,
#   "p60": 220,
#   "p70": 240,
#   "p80": 260,
#   "p90": 280,
#   "p95": 290,
#   "p99": 298,
#   "p999": 299.79999999999995,
#   "stdDev": 81.64965809277261,
#   "sum": 600
# }
```

Use lodash groupBy with stats:

```sh
cat test/input/data.json| json 'groupBy(data, "name")' | json 'mapValues(data, items => items.map(i => i.value))' | json 'mapValues(data, d => pick(stats(d), ["p90"]))'
# {
#   "Name 1": {
#     "p90": 370
#   },
#   "Name 2": {
#     "p90": 290
#   },
#   "Name 3": {
#     "p90": 500
#   }
# }
```

Colorized pretty printing is the default

```sh
cat test/input/array.json | json
# [
#   {
#     "id": 1,
#     "name": "Item 1",
#     "value": 100
#   },
#   {
#     "id": 2,
#     "name": "Item 2",
#     "value": 200
#   },
#   {
#     "id": 3,
#     "name": "Item 3",
#     "value": 300
#   }
# ]
```

Without pretty printing (single line):

```sh
cat test/input/basic.json | JSON_OUTPUT=json json
# {"bar":"Hello world","baz":false,"data":[{"id":1,"name":"Item 1","value":100},{"id":2,"name":"Item 2","value":200},{"id":3,"name":"Item 3","value":300}],"foo":1,"nested":{"foo":{"bar":"nested value"}}}
```

JSONL output (for an array with one JSON object per line)

```sh
cat test/input/array.json | JSON_OUTPUT=jsonl json 
# {"id":1,"name":"Item 1","value":100}
# {"id":2,"name":"Item 2","value":200}
# {"id":3,"name":"Item 3","value":300}
```

The json command can take JSONL as input as well:

```sh
cat test/input/array.jsonl | json
```

The json command can also parse JSON data at the end of log lines:

```sh
cat test/input/log-with-json.log | json
# [
#   {
#     "_line": "192.168.1.1 - - [21/Feb/2026:10:00:01 +0000] \"GET /api/users HTTP/1.1\" 200 ",
#     "cache": "hit",
#     "duration_ms": 42,
#     "user_id": 1021
#   },
#   {
#     "_line": "192.168.1.2 - - [21/Feb/2026:10:00:03 +0000] \"POST /api/orders HTTP/1.1\" 201 ",
#     "cache": "miss",
#     "duration_ms": 87,
#     "user_id": 4432
#   },
#   ...
# ]
```

Using custom helper functions via the JSON_HELPERS_PATH env var and a javascript module with exported functions:

```sh
echo '{"values1": [1, 2, 3, 4], "values2": [3, 5, 1, 11]}' | JSON_HELPERS_PATH="$(pwd)/test/custom-helpers.js" json 'correlation(data.values1, data.values2)'
# 0.5976143046671968
```

## Running the Tests

```sh
npm install
npm link
npm test
```

## Publishing a new Version

```sh
npm login
npm publish --access public
```

# Prior Art

* [jq](https://github.com/jqlang/jq) - the standard for processing JSON in the terminal
* [trentm/json](https://github.com/trentm/json) - nice library with [very good documentation](https://trentm.com/json/)
