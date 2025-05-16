import type { IReader } from "./reader.js";

export function catalog_decode_unsigned(reader: IReader) {
    let v = 0;
    for (let i = 0; i < 10; i++) {
        const t = reader.readByte();
        if (t < 128) {
            v |= (t << (i * 7));
            return v;
        } else {
            v |= ((t & 127) << (i * 7));
        }
    }
    throw new Error("Invalid catalog number");
}

export function catalog_decode_signed(reader: IReader) {
    let v = 0;
    for (let i = 0; i < 11; i++) {
        const t = reader.readByte();
        if (t == 0) {
            if (v == 0) return v;
            else return (((v - 1) * -1) - 1) 
        } else if (t < 128) {
            v |= (t << (i * 7));
            return v;
        } else {
            v |= ((t & 127) << (i * 7));
        }
    }
    throw new Error("Invalid catalog number");
}