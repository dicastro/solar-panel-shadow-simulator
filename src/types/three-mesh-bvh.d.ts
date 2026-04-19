import { BufferGeometry } from 'three';

declare module 'three' {
  interface BufferGeometry {
    computeBoundsTree(): void;
    disposeBoundsTree(): void;
    boundsTree?: unknown;
  }
}