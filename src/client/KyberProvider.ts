import KyberModule from '@/kyber/kyber.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PK_SIZE = 1184;
const SK_SIZE = 2400;
const CT_SIZE = 1088;
const SS_SIZE = 32;

function getWasmBinaryPath(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.url
      ? path.dirname(fileURLToPath(import.meta.url))
      : process.cwd();
  return path.join(base, 'kyber.wasm');
}

export class NoxyKyberProvider {
  private mod: any;

  private constructor(mod: any) {
    this.mod = mod;
  }

  static async create(): Promise<NoxyKyberProvider> {
    let wasmBinary: ArrayBuffer | undefined =
      typeof globalThis !== 'undefined'
        ? (globalThis as unknown as Record<string, ArrayBuffer | undefined>).__NOXY_KYBER_WASM_BINARY__
        : undefined;

    if (!wasmBinary && typeof process !== 'undefined' && process.versions?.node) {
      const wasmPath = getWasmBinaryPath();
      const buf = await readFile(wasmPath);
      wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }

    const mod = await KyberModule({
      ...(wasmBinary && { wasmBinary }),
      locateFile: (pathName: string, scriptDirectory?: string) => {
        const base =
          scriptDirectory ||
          (typeof import.meta !== 'undefined' && import.meta.url
            ? new URL('.', import.meta.url).href
            : `file://${process.cwd()}/`);
        return new URL(pathName, base).href;
      },
    });
    return new NoxyKyberProvider(mod);
  }

  keypair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
    this.assertReady();

    const pkPtr = this.mod._malloc(PK_SIZE);
    const skPtr = this.mod._malloc(SK_SIZE);

    try {
      this.mod._kyber_keypair(pkPtr, skPtr);

      return {
        publicKey: this.read(pkPtr, PK_SIZE),
        secretKey: this.read(skPtr, SK_SIZE),
      };
    } finally {
      this.zeroAndFree(pkPtr, PK_SIZE);
      this.zeroAndFree(skPtr, SK_SIZE);
    }
  }

  encapsulate(publicKey: Uint8Array): {
    ciphertext: Uint8Array;
    sharedSecret: Uint8Array;
  } {
    this.assertReady();
    this.assertSize(publicKey, PK_SIZE, 'publicKey');

    const pkPtr = this.allocAndWrite(publicKey);
    const ctPtr = this.mod._malloc(CT_SIZE);
    const ssPtr = this.mod._malloc(SS_SIZE);

    try {
      this.mod._kyber_enc(ctPtr, ssPtr, pkPtr);

      return {
        ciphertext: this.read(ctPtr, CT_SIZE),
        sharedSecret: this.read(ssPtr, SS_SIZE),
      };
    } finally {
      this.zeroAndFree(pkPtr, PK_SIZE);
      this.zeroAndFree(ctPtr, CT_SIZE);
      this.zeroAndFree(ssPtr, SS_SIZE);
    }
  }

  decapsulate(
    secretKey: Uint8Array,
    ciphertext: Uint8Array
  ): Uint8Array {
    this.assertReady();
    this.assertSize(secretKey, SK_SIZE, 'secretKey');
    this.assertSize(ciphertext, CT_SIZE, 'ciphertext');

    const skPtr = this.allocAndWrite(secretKey);
    const ctPtr = this.allocAndWrite(ciphertext);
    const ssPtr = this.mod._malloc(SS_SIZE);

    try {
      this.mod._kyber_dec(ssPtr, ctPtr, skPtr);
      return this.read(ssPtr, SS_SIZE);
    } finally {
      this.zeroAndFree(skPtr, SK_SIZE);
      this.zeroAndFree(ctPtr, CT_SIZE);
      this.zeroAndFree(ssPtr, SS_SIZE);
    }
  }

  private allocAndWrite(buf: Uint8Array): number {
    const ptr = this.mod._malloc(buf.length);
    this.mod.HEAPU8.set(buf, ptr);
    return ptr;
  }

  private read(ptr: number, len: number): Uint8Array {
    return new Uint8Array(this.mod.HEAPU8.buffer, ptr, len).slice();
  }

  private zeroAndFree(ptr: number, len: number) {
    this.mod.HEAPU8.fill(0, ptr, ptr + len);
    this.mod._free(ptr);
  }

  private assertReady() {
    if (!this.mod) {
      throw new Error('KyberProvider not initialized');
    }
  }

  private assertSize(
    buf: Uint8Array,
    expected: number,
    name: string
  ) {
    if (buf.length !== expected) {
      throw new Error(
       `${name} must be ${expected} bytes, got ${buf.length}`
      );
    }
  }
}