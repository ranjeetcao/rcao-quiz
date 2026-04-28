// Storage abstraction for built artefacts (packs + manifest).
//
// Phase 0 writes to the local disk (`./packs/`); Phase 1 will swap in an
// R2 implementation that uploads to Cloudflare R2. The same `put` shape
// works for both — the only difference is what `url` means in the
// returned value (a relative filename locally, an absolute https URL on
// R2). The manifest builder records that `url` verbatim, so swapping
// storage flips where the app fetches packs from with no schema change.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface PutResult {
  /**
   * Where the artefact lives. Used directly as `ContentManifestEntry.url`
   * (or `StatsManifestEntry.url`). Phase 0 returns a relative filename so
   * the app can resolve it against `EXPO_PUBLIC_PACKS_BASE_URL` at fetch
   * time; Phase 1 will return an absolute R2 URL and the app's URL-resolve
   * step degenerates to a no-op.
   */
  url: string;
  bytes: number;
}

export interface PackStorage {
  /**
   * Write `bytes` under `key`. Implementations MUST be idempotent —
   * writing the same `key` twice with the same `bytes` is a no-op from
   * the consumer's perspective. The build-time idempotency guarantee
   * (same content in → byte-identical content out) lives at the bytes
   * level, not here.
   */
  put(key: string, bytes: Uint8Array): Promise<PutResult>;
}

export class LocalDiskStorage implements PackStorage {
  constructor(private readonly outDir: string) {}

  async put(key: string, bytes: Uint8Array): Promise<PutResult> {
    await fs.mkdir(this.outDir, { recursive: true });
    const target = path.join(this.outDir, key);
    await fs.writeFile(target, bytes);
    // Relative URL: just the key. The mobile app will prefix with
    // `EXPO_PUBLIC_PACKS_BASE_URL` (MVP-07) so the same manifest works
    // unchanged when storage swaps to R2 (Phase 1).
    return { url: key, bytes: bytes.byteLength };
  }
}
