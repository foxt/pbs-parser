import { catalog_decode_unsigned } from "./number.js";
import { type IReader } from "./reader.js";
import { withLazy } from "./util.js";

const ExpectedMagic = [ 145, 253, 96, 249, 196, 103, 88, 213 ];

export const readTableBounds = (reader: IReader) => {
    let offset = reader.offset;
    let lenTable = catalog_decode_unsigned(reader);
    let posTable = reader.offset;
    let count = catalog_decode_unsigned(reader);
    let posContent = reader.offset;
    let posEnd = posTable + lenTable;
    return { offset, posContent, posEnd, count };
}
type TableBounds = ReturnType<typeof readTableBounds>;

const tableAt = (reader: IReader, offset: number) => {
    let c = reader.clone();
    c.offset = offset;
    let bounds = readTableBounds(c);
    return new PcatTable(c, bounds);
}

export type PcatEntryBase = {
    type: string;
    name: string;
}
export type PcatEntryDir = PcatEntryBase & {
    type: 'd';
    table: PcatTable;
}
export type PcatEntryFile = PcatEntryBase & {
    type: "f";
    size: number;
    mtime: Date;
}

export type PcatEntry = PcatEntryDir | PcatEntryFile;
let td = new TextDecoder();

export class PcatTable {
    constructor(private data: IReader, public readonly offs: TableBounds) {}
    private readEntry(data: IReader): PcatEntry {
        let typeByte = data.readByte();
        let type = String.fromCharCode(typeByte);
        let nameLength = catalog_decode_unsigned(data);
        let nameBuf = data.subreader(nameLength);
        const name = () => td.decode(nameBuf.readBytes(nameLength));
        switch (type) {
            case "d":
                let offset = catalog_decode_unsigned(data);
                return withLazy({ type }, { 
                    name,
                    table: () => tableAt(this.data, this.offs.offset - offset)
                })
            case "f":
                let size = catalog_decode_unsigned(data);
                let mtime = new Date(catalog_decode_unsigned(data) * 1000);
                return withLazy({ type, size, mtime }, { name })
            default:
                throw new Error("Invalid entry type: " + type + " (" + typeByte + ")");
        }
    }

    public* readEntries() {
        let r = this.data.subreader(this.offs.posEnd - this.offs.posContent, this.offs.posContent);
        for (let i = 0; i < this.offs.count; i++) 
            yield this.readEntry(r);
    }

    readRecursive() {
        return [...this.readEntries()].map(e => {
            if (e.type == 'd') {
                let d = {
                    ...e,
                    entries: e.table.readRecursive()
                }
                delete d['table']
                return d;
            } else return e;
        })
    }
}

export class PcatReader {
    public data: IReader;
    public root: PcatTable;
    _rootEntryOffset: number;

    constructor(
        data: IReader,
    ) {
        this.data = data;
        let magic = this.data.readBytes(8, 0);
        magic.forEach((v, i) => {
            if (v != ExpectedMagic[i]) 
                throw new Error("Invalid magic (expected: " + ExpectedMagic + ", got: " + magic + ")");
        });
        this._rootEntryOffset = this.data.readUint64(this.data.length - 8);
        this.root = tableAt(this.data, this._rootEntryOffset)

        
    }
}