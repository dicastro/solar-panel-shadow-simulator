import { MeshBVH } from 'three-mesh-bvh';

declare module 'three' {
  interface BufferGeometry {
    computeBoundsTree(): void;
    disposeBoundsTree(): void;
    /**
     * Typed as MeshBVH — the concrete class assigned by computeBoundsTree().
     * three-mesh-bvh internally declares this as the narrower GeometryBVH
     * interface, but the runtime object is always a full MeshBVH instance,
     * which is required for serialisation via MeshBVH.serialize().
     */
    boundsTree?: MeshBVH;
  }
}