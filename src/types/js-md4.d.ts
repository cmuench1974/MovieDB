declare module "js-md4" {
  interface Md4Hasher {
    update(message: string | ArrayBuffer | Uint8Array | number[]): Md4Hasher;
    hex(): string;
    array(): number[];
    digest(): number[];
  }

  interface Md4Fn {
    (message: string | ArrayBuffer | Uint8Array | number[]): string;
    create(): Md4Hasher;
    update(message: string | ArrayBuffer | Uint8Array | number[]): Md4Hasher;
    array(message: string | ArrayBuffer | Uint8Array | number[]): number[];
  }

  const md4: Md4Fn;
  export default md4;
}
