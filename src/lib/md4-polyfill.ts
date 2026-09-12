import crypto from "node:crypto";
import md4 from "js-md4";

const originalCreateHash = crypto.createHash.bind(crypto);

// OpenSSL 3 (Node 17+) rejects MD4, which NTLM still needs for SMB logins.
crypto.createHash = ((algorithm: string, options?: crypto.HashOptions) => {
  if (algorithm.toLowerCase() === "md4") {
    return createMd4Hash();
  }
  return originalCreateHash(algorithm, options);
}) as typeof crypto.createHash;

function createMd4Hash() {
  const chunks: Buffer[] = [];
  return {
    update(data: string | Buffer, encoding?: BufferEncoding) {
      chunks.push(typeof data === "string" ? Buffer.from(data, encoding) : Buffer.from(data));
      return this;
    },
    digest(encoding?: BufferEncoding | "binary") {
      const hasher = md4.create();
      hasher.update(Array.from(Buffer.concat(chunks)));
      const buffer = Buffer.from(hasher.array());
      if (!encoding) return buffer;
      if (encoding === "binary") return buffer.toString("binary");
      return buffer.toString(encoding);
    },
  };
}
