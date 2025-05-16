import { readSync } from "fs";


export interface IReader {
    offset: number;
    readonly length: number;

    readBytes(length: number, at?: number): Uint8Array;
    readByte(at?: number): number;
    readUint64(at?: number): number;
    subreader(length: number, at?: number): IReader;
    clone(): IReader;

}

export abstract class BaseReader implements IReader {

    abstract readBytes(length: number, at?: number): Uint8Array;
    abstract subreader(length: number, at?: number): IReader;
    abstract get offset(): number;
    abstract set offset(value: number);
    abstract get length(): number;

    readByte(at?: number): number {
        return this.readBytes(1, at)[0];
    }

    readUint64(at?: number): number {
        const bytes = this.readBytes(8, at);
        return (
            bytes[0] +
            (bytes[1] << 8) +
            (bytes[2] << 16) +
            (bytes[3] << 24) +
            (bytes[4] * 2 ** 32) +
            (bytes[5] * 2 ** 40) +
            (bytes[6] * 2 ** 48) +
            (bytes[7] * 2 ** 56)
        );
    }

    clone() {
        let c = this.subreader(this.length, 0);
        c.offset = this.offset;
        return c;
    }
}

export class U8Reader extends BaseReader {
    public readonly length;
    constructor(
        private data: Uint8Array,
        public offset: number = 0
    ) {
        super();
        this.data = data;
        this.length = data.length;
    }

    readBytes(length: number, at = this.offset) {
        if (at + length > this.length)
            throw new Error("Out of bounds (" + at + " + " + length + " > " + this.length + ")");
        const bytes = new Uint8Array(this.data.buffer, at + this.data.byteOffset, length);
        this.offset = at + length;
        return bytes;
    }

    subreader(length: number, at = this.offset) {
        this.offset = at + length;
        return new U8Reader(this.readBytes(length, at), 0);
    }
}


export class FDReader extends BaseReader {
    constructor(
        private fd: number,
        public readonly length: number,
        public offset: number = 0,
        public readonly fileOffset: number = 0
    ) {
        super();
    }
    readBytes(length: number, at = this.offset) {
        if (at + length > this.length)
            throw new Error("Out of bounds (" + at + " + " + length + " > " + this.length + ")");
        let buf = new Uint8Array(length);
        readSync(this.fd, buf, 0, length, at + this.fileOffset);
        this.offset = at + length;
        return buf;
    }

    subreader(length: number, at = this.offset) {
        if (at + length > this.length)
            throw new Error("Out of bounds (" + at + " + " + length + " > " + this.length + ")");
        this.offset = at + length;
        return new FDReader(this.fd, length, 0, at + this.fileOffset);
    }

}
