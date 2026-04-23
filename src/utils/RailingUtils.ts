import { RailingRailRenderData } from '../types/installation';
import { RailingShape } from '../types/config';

const RAILING_COLOR = '#333';
const CYLINDER_SEGMENTS = 8;
const HALF_CYLINDER_SEGMENTS = 8;

/**
 * Builds the render data for a railing rail segment of any shape.
 *
 * `length` is the extent of the rail along the wall direction (the local Z
 * axis of the wall group). The Y position places the rail on top of the wall
 * at `wallHeight + heightOffset`.
 *
 * CylinderGeometry constructor signature used for cylinder and half-cylinder:
 *   (radiusTop, radiusBottom, height, radialSegments, heightSegments,
 *    openEnded, thetaStart, thetaLength)
 * The geometry is rotated 90° around X so its height axis aligns with Z
 * (the wall direction). Half-cylinder uses openEnded=true and thetaLength=π.
 * See README for the full table of shape parameters and their Three.js
 * geometry equivalents.
 */
export const RailingUtils = {
  buildRailRenderData: (
    shape: RailingShape,
    wallHeight: number,
    heightOffset: number,
    length: number,
  ): RailingRailRenderData => {
    const localPosition: [number, number, number] = [0, wallHeight + heightOffset, 0];
    const cylinderRotation: [number, number, number] = [Math.PI / 2, 0, 0];
    const noRotation: [number, number, number] = [0, 0, 0];

    switch (shape.kind) {
      case 'square':
        return {
          kind: 'square',
          localPosition,
          localRotation: noRotation,
          args: [shape.width, shape.height, length],
          color: RAILING_COLOR,
        };

      case 'cylinder':
        return {
          kind: 'cylinder',
          localPosition,
          localRotation: cylinderRotation,
          args: [shape.radius, shape.radius, length, CYLINDER_SEGMENTS],
          color: RAILING_COLOR,
        };

      case 'half-cylinder': {
        const thetaStart = shape.orientation === 'up' ? 0 : Math.PI;
        return {
          kind: 'half-cylinder',
          localPosition,
          localRotation: cylinderRotation,
          args: [shape.radius, shape.radius, length, HALF_CYLINDER_SEGMENTS, 1, true, thetaStart, Math.PI],
          color: RAILING_COLOR,
        };
      }
    }
  },
};