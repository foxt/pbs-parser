import { deepStrictEqual, strictEqual } from "assert";
import { assert } from "console";
import { openSync, readFileSync, statSync } from "fs";
import { test, type TestContext } from "node:test";
import { PcatEntry, PcatEntryDir, PcatReader, PcatTable, readTableBounds } from "../index.js";
import { catalog_decode_signed, catalog_decode_unsigned } from "../number.js";
import { FDReader, U8Reader } from "../reader.js";
import { omit } from "../util.js";
console.clear();

const reader = (v: ArrayLike<number>, o = 0) => new U8Reader(new Uint8Array(v), o);

type TestStructure = Exclude<PcatEntry, PcatEntryDir> | (Omit<PcatEntryDir, "table"> & {
    entries: TestStructure[];
});

const typeEmojis: Record<TestStructure['type'], string> = {
    'f': '📄',
    'd': '📁'
}

const formatChildren = (e: (PcatEntry | TestStructure)[]) =>
    e.map(e => typeEmojis[e.type] + ' ' + e.name);

async function assertStructure(t: TestContext, actual: PcatTable, expected: TestStructure[]) {
    let children = [...actual.readEntries()];
    
    for (let entry of expected) {
        await t.test(typeEmojis[entry.type] + ' ' + entry.name, async t => {
            let found = children.find(e => e.name === entry.name && e.type == entry.type);
            assert(found, `Entry ${entry.name} not found in [` + children.map(e => e.name).join(", ") + `]`);
            deepStrictEqual(omit(found as any, "table"), omit(entry as any, "entries"));
            if ('entries' in entry) {
                strictEqual(found.type, "d", `Bad Test: Entry ${entry.name} should be a directory`);
                await assertStructure(t, found.table, entry.entries);
            }
        }).catch(e => {})
    }

    let childNames = formatChildren(children);
    let expectedNames = formatChildren(expected);
    deepStrictEqual(childNames, expectedNames);

}

test("catalog_decode_unsigned", t => {
    strictEqual(218, catalog_decode_unsigned(reader([0xDA,1])));
})

test("catalog_decode_signed", t => {
    strictEqual(1719758276, catalog_decode_signed(reader([0xC4, 0xDB, 0x85, 0xB4, 0x06])));
})


test("readTable", t => {
    let read = readTableBounds(reader([0,0,0,0,0, 3, 69, 13, 37, 0], 5));
    deepStrictEqual(read, {
        posContent: 7,
        posEnd: 9,
        count: 69,
        offset: 5
    })
})

test("ram", async t =>{
    let file = reader(readFileSync("./catalog-small.pcat1"));
    let cat = new PcatReader(file);
    strictEqual(cat._rootEntryOffset, 53, 'root entry offset')
    deepStrictEqual(cat.root.offs, {
        posContent: 55,
        posEnd: 72,
        offset: 53,
        count: 1,
    }, 'root table bounds');
    await assertStructure(t, cat.root, [
        {
            type: 'd',
            name: 'test.pxar.didx',
            entries: [
                {
                    type: 'd',
                    name: 'hello',
                    entries: [
                        {
                            type: 'f',
                            name: 'hello.txt',
                            mtime: new Date('2024-06-30T14:37:50.000Z'),
                            size: 3
                        }
                    ]
                },
                {
                    type: 'f',
                    name: 'root.txt',
                    mtime: new Date('2024-06-30T14:37:56.000Z'),
                    size: 5
                }
            ],
        }
    ])
})

test("fd", async t =>{
    let fd = openSync("./catalog-small.pcat1", 'r');
    let { size } = statSync("./catalog-small.pcat1");
    let reader = new FDReader(fd, size);
    let cat = new PcatReader(reader);
    strictEqual(cat._rootEntryOffset, 53, 'root entry offset')
    deepStrictEqual(cat.root.offs, {
        posContent: 55,
        posEnd: 72,
        offset: 53,
        count: 1,
    }, 'root table bounds');
    await assertStructure(t, cat.root, [
        {
            type: 'd',
            name: 'test.pxar.didx',
            entries: [
                {
                    type: 'd',
                    name: 'hello',
                    entries: [
                        {
                            type: 'f',
                            name: 'hello.txt',
                            mtime: new Date('2024-06-30T14:37:50.000Z'),
                            size: 3
                        }
                    ]
                },
                {
                    type: 'f',
                    name: 'root.txt',
                    mtime: new Date('2024-06-30T14:37:56.000Z'),
                    size: 5
                }
            ],
        }
    ])
})
