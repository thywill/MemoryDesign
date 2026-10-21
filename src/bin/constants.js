// Dimensions in metres. The hover-to-record mapping in Compartment depends on these; change them together.
export const S = 0.315;            // 12" sleeve
export const T = 0.006;            // sleeve thickness
export const GAP = 0.02;           // spacing between records in a crate
export const N = 12;               // records per crate
export const LEAN = 0.2;           // records lean back (radians)
export const W_IN = 0.34, D_IN = 0.36, WT = 0.014;
export const CRATE_W = W_IN + 2 * WT;
export const FRONT_H = 0.11, SIDE_H = 0.19, BACK_H = 0.23;
export const RACK_W = 4 * CRATE_W + 3 * 0.04 + 0.1;
export const RACK_GAP = 0.32;
export const RACK_STEP = RACK_W + RACK_GAP;

export const z0 = D_IN / 2 - 0.045;
export const zFor = (k) => z0 - k * GAP;
export const PICK_H = S * Math.cos(LEAN) + 0.02;
export const zTop0 = z0 - S * Math.sin(LEAN);

// Layout of the bin
export const SIDE_T = 0.008;
export const PITCH = W_IN + SIDE_T + 0.004;
export const EDGE_PAD = 0.07;
export const TIER_Y = [0.74, 0.94, 1.14];
export const TIER_Z = [0.38, 0.0, -0.38];
export const colX = (i) => i * PITCH;

// The shop wall behind the bin: one texture tile is WALL_TILE wide, repeating along the wall.
export const WALL_Z = TIER_Z[2] - 0.7;
export const WALL_H = 2.4, WALL_TILE = 4.8, WALL_MARGIN = 3;

// Camera
export const CAM = { y: 1.88, z: 1.9, lookY: 0.9, lookZ: -0.14 };