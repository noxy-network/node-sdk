/** Type declarations for Emscripten-generated kyber.js */
interface KyberModuleOptions {
  /**
   * Pre-loaded WASM binary. When set, the module uses this instead of fetching.
   * Useful in Node/test environments where fetch(file://) is not supported.
   */
  wasmBinary?: ArrayBuffer;
  /**
   * Called to resolve the URL/path for a requested file.
   * In this build it is only called once with path === "kyber.wasm".
   * Second argument is the script directory URL (directory of kyber.js).
   */
  locateFile?: (path: string, scriptDirectory: string) => string;
}

interface KyberModuleInstance {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _kyber_keypair: (pk: number, sk: number) => void;
  _kyber_enc: (ct: number, ss: number, pk: number) => void;
  _kyber_dec: (ss: number, ct: number, sk: number) => void;
  HEAPU8: Uint8Array;
}

declare function KyberModule(
  opts?: KyberModuleOptions
): Promise<KyberModuleInstance>;

export default KyberModule;
