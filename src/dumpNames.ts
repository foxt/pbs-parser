import { openSync, readFileSync, statSync } from "fs";
import { parseArgs } from "util";
import { PcatReader, PcatTable } from "./index.js";
import { FDReader, U8Reader } from "./reader.js";

const argsConfig = {
    allowNegative: true,
    strict: true,
    allowPositionals: true,
    options: {
        folders: {
            type: 'boolean',
            default: false,
            short: 'f'
        },
        buffered: {
            type: 'boolean',
            default: true,
        }
    }
} as const;

let args: ReturnType<typeof parseArgs<typeof argsConfig>>;
let filename: string;
try {
    args = parseArgs(argsConfig);
    filename = args.positionals.pop();
    if (!filename) throw new Error("No file name provided.")
} catch(e) {
    console.error((e as any)?.message);
    console.log('usage: ');
    console.log(' ' + process.argv0 + ' ' + process.argv[1] + ' [options] <filename>');
    console.log('options:');
    for (let k in argsConfig.options) {
        let opt = argsConfig.options[k];
        let optName = '  --' + k;
        if (opt.type == 'boolean') 
            optName += ', --no-' + k;
        if (opt.short) optName += ', -' + opt.short;
        console.log(optName + ': (default: ' + opt.default + ')');
    }
    process.exit(2);
}
let reader;
if (args.values.buffered) {
    reader = new U8Reader(readFileSync(filename));
} else {
    let size = statSync(filename).size;
    let fd = openSync(filename, 'r');
    reader = new FDReader(fd, size, 0, 0);
}

let cat = new PcatReader(reader);
let totalEntries = 0;
let lastEntry = '';
let peaks = {};
function print(dir: PcatTable, path = '') {
    for (let entry of dir.readEntries()) {
        let fullname = path + entry.name
        if ('table' in entry) print(entry.table, fullname + '/');
        // lastEntry = fullname;
        // totalEntries++;
        if (totalEntries % 100_000 == 0) {
            for (let [k, v] of Object.entries(process.memoryUsage())) {
                peaks[k] = Math.max(peaks[k] || 0, v);
            }
        }
        // console.log([
        //     entry.type,
        //     fullname
        // ].join('\t'))
    }
}
print(cat.root)
console.log('Total entries: ' + totalEntries);
console.log("Memory usage:");
console.table(peaks);
