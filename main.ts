import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const CAP = 65536;

export function run(P: Uint8Array, IN: Uint8Array): [number[], number] {
  const S = new Int32Array(256), M = new Int32Array(256), R = new Int32Array(64);
  const out: number[] = [];
  let sp = 0, cp = 0, pc = 0, st = 0, ip = 0, code = -1;
  while (code < 0) {
    if (st >= 1000000) { code = 10; break; }
    if (pc < 0 || pc >= P.length) { code = 9; break; }
    const op = P[pc++];
    const L = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (pc + L > P.length) { code = 9; break; }
    const i8 = (P[pc] << 24) >> 24;
    const i32 = P[pc] | (P[pc + 1] << 8) | (P[pc + 2] << 16) | (P[pc + 3] << 24);
    const i16 = ((P[pc] | (P[pc + 1] << 8)) << 16) >> 16;
    const u16 = P[pc] | (P[pc + 1] << 8);
    pc += L;
    const need = (n: number) => {
      if (sp < n) { code = 2; return false; }
      return true;
    };
    const room = (n: number) => {
      if (sp + n > 256) { code = 3; return false; }
      return true;
    };
    let a = 0, b = 0;
    switch (op) {
      case 0x00: code = 0; break;
      case 0x01: if (room(1)) S[sp++] = i8; break;
      case 0x02: if (room(1)) S[sp++] = i32; break;
      case 0x03: if (need(1)) sp--; break;
      case 0x04: if (need(1) && room(1)) S[sp] = S[sp - 1], sp++; break;
      case 0x05: if (need(2)) { a = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = a; } break;
      case 0x06: if (need(2) && room(1)) S[sp++] = S[sp - 3]; break;
      case 0x07: if (need(3)) { a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a; } break;
      case 0x10: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] + b) | 0; } break;
      case 0x11: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] - b) | 0; } break;
      case 0x12: if (need(2)) { b = S[--sp]; S[sp - 1] = Math.imul(S[sp - 1], b); } break;
      case 0x13:
        if (need(2)) {
          b = S[--sp]; a = S[sp - 1];
          if (b === 0) code = 4; else S[sp - 1] = a === -2147483648 && b === -1 ? -2147483648 : (a / b) | 0;
        } break;
      case 0x14:
        if (need(2)) {
          b = S[--sp]; a = S[sp - 1];
          if (b === 0) code = 4; else S[sp - 1] = (a % b) | 0;
        } break;
      case 0x15:
        if (need(2)) {
          b = S[--sp]; a = S[sp - 1];
          if (b === 0) code = 4; else S[sp - 1] = ((a >>> 0) / (b >>> 0)) | 0;
        } break;
      case 0x16:
        if (need(2)) {
          b = S[--sp]; a = S[sp - 1];
          if (b === 0) code = 4; else S[sp - 1] = ((a >>> 0) % (b >>> 0)) | 0;
        } break;
      case 0x17: if (need(1)) S[sp - 1] = (-S[sp - 1]) | 0; break;
      case 0x18: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] & b) | 0; } break;
      case 0x19: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] | b) | 0; } break;
      case 0x1a: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] ^ b) | 0; } break;
      case 0x1b: if (need(1)) S[sp - 1] = ~S[sp - 1]; break;
      case 0x1c: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] << (b & 31)) | 0; } break;
      case 0x1d: if (need(2)) { b = S[--sp]; S[sp - 1] = S[sp - 1] >> (b & 31); } break;
      case 0x1e: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] >>> (b & 31)) | 0; } break;
      case 0x20: if (need(2)) { b = S[--sp]; S[sp - 1] = S[sp - 1] === b ? 1 : 0; } break;
      case 0x21: if (need(2)) { b = S[--sp]; S[sp - 1] = S[sp - 1] < b ? 1 : 0; } break;
      case 0x22: if (need(2)) { b = S[--sp]; S[sp - 1] = (S[sp - 1] >>> 0) < (b >>> 0) ? 1 : 0; } break;
      case 0x30: pc += i16; break;
      case 0x31: if (need(1)) { b = S[--sp]; if (b === 0) pc += i16; } break;
      case 0x32: if (need(1)) { b = S[--sp]; if (b !== 0) pc += i16; } break;
      case 0x33: if (cp >= 64) code = 7; else { R[cp++] = pc; pc = u16; } break;
      case 0x34: if (cp <= 0) code = 8; else pc = R[--cp]; break;
      case 0x40:
        if (need(1)) {
          a = S[sp - 1];
          if (a < 0 || a > 255) code = 6; else S[sp - 1] = M[a];
        } break;
      case 0x41:
        if (need(2)) {
          a = S[--sp]; b = S[--sp];
          if (a < 0 || a > 255) code = 6; else M[a] = b;
        } break;
      case 0x50:
        if (need(1)) {
          a = S[--sp];
          const s = String(a);
          if (out.length + s.length > CAP) code = 11;
          else for (let k = 0; k < s.length; k++) out.push(s.charCodeAt(k));
        } break;
      case 0x51:
        if (need(1)) {
          a = S[--sp] & 255;
          if (out.length + 1 > CAP) code = 11; else out.push(a);
        } break;
      case 0x52: if (room(1)) S[sp++] = ip < IN.length ? IN[ip++] : -1; break;
      case 0x53: if (need(1)) code = S[--sp] & 255; break;
      default: code = 5;
    }
    if (code < 0) st++;
  }
  return [out, code];
}

if (!process.env.MF_TEST) for (const id of readdirSync(I).sort()) {
  let P: Uint8Array = new Uint8Array(0), IN: Uint8Array = new Uint8Array(0);
  try { P = readFileSync(join(I, id, 'program.bin')); } catch { /* empty */ }
  try { IN = readFileSync(join(I, id, 'input.bin')); } catch { /* empty */ }
  const [out, code] = run(P, IN);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), Buffer.from(out));
  writeFileSync(join(O, id, 'exit.txt'), String(code) + '\n');
}
