function clampNumber(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
var Vector3Utils = class _Vector3Utils {
  /**
   * equals
   *
   * Check the equality of two vectors
   */
  static equals(v1, v2) {
    return v1.x === v2.x && v1.y === v2.y && v1.z === v2.z;
  }
  /**
   * add
   *
   * Add two vectors to produce a new vector
   */
  static add(v1, v2) {
    return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
  }
  /**
   * subtract
   *
   * Subtract two vectors to produce a new vector (v1-v2)
   */
  static subtract(v1, v2) {
    return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
  }
  /** scale
   *
   * Multiple all entries in a vector by a single scalar value producing a new vector
   */
  static scale(v1, scale) {
    return { x: v1.x * scale, y: v1.y * scale, z: v1.z * scale };
  }
  /**
   * dot
   *
   * Calculate the dot product of two vectors
   */
  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
  /**
   * cross
   *
   * Calculate the cross product of two vectors. Returns a new vector.
   */
  static cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
  /**
   * magnitude
   *
   * The magnitude of a vector
   */
  static magnitude(v) {
    return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  }
  /**
   * distance
   *
   * Calculate the distance between two vectors
   */
  static distance(a, b) {
    return _Vector3Utils.magnitude(_Vector3Utils.subtract(a, b));
  }
  /**
   * normalize
   *
   * Takes a vector 3 and normalizes it to a unit vector
   */
  static normalize(v) {
    const mag = _Vector3Utils.magnitude(v);
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }
  /**
   * floor
   *
   * Floor the components of a vector to produce a new vector
   */
  static floor(v) {
    return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
  }
  /**
   * toString
   *
   * Create a string representation of a vector3
   */
  static toString(v, options) {
    const decimals = options?.decimals ?? 2;
    const str = [v.x.toFixed(decimals), v.y.toFixed(decimals), v.z.toFixed(decimals)];
    return str.join(options?.delimiter ?? ", ");
  }
  /**
   * clamp
   *
   * Clamps the components of a vector to limits to produce a new vector
   */
  static clamp(v, limits) {
    return {
      x: clampNumber(v.x, limits?.min?.x ?? Number.MIN_SAFE_INTEGER, limits?.max?.x ?? Number.MAX_SAFE_INTEGER),
      y: clampNumber(v.y, limits?.min?.y ?? Number.MIN_SAFE_INTEGER, limits?.max?.y ?? Number.MAX_SAFE_INTEGER),
      z: clampNumber(v.z, limits?.min?.z ?? Number.MIN_SAFE_INTEGER, limits?.max?.z ?? Number.MAX_SAFE_INTEGER),
    };
  }
  /**
   * lerp
   *
   * Constructs a new vector using linear interpolation on each component from two vectors.
   */
  static lerp(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }
  /**
   * slerp
   *
   * Constructs a new vector using spherical linear interpolation on each component from two vectors.
   */
  static slerp(a, b, t) {
    const theta = Math.acos(_Vector3Utils.dot(a, b));
    const sinTheta = Math.sin(theta);
    const ta = Math.sin((1 - t) * theta) / sinTheta;
    const tb = Math.sin(t * theta) / sinTheta;
    return _Vector3Utils.add(_Vector3Utils.scale(a, ta), _Vector3Utils.scale(b, tb));
  }
};
var Vector2Utils = class {
  /**
   * toString
   *
   * Create a string representation of a vector2
   */
  static toString(v, options) {
    const decimals = options?.decimals ?? 2;
    const str = [v.x.toFixed(decimals), v.y.toFixed(decimals)];
    return str.join(options?.delimiter ?? ", ");
  }
};
var VECTOR3_UP = { x: 0, y: 1, z: 0 };
var VECTOR3_DOWN = { x: 0, y: -1, z: 0 };
var VECTOR3_LEFT = { x: -1, y: 0, z: 0 };
var VECTOR3_RIGHT = { x: 1, y: 0, z: 0 };
var VECTOR3_FORWARD = { x: 0, y: 0, z: 1 };
var VECTOR3_BACK = { x: 0, y: 0, z: -1 };
var VECTOR3_ONE = { x: 1, y: 1, z: 1 };
var VECTOR3_ZERO = { x: 0, y: 0, z: 0 };
var VECTOR3_WEST = { x: -1, y: 0, z: 0 };
var VECTOR3_EAST = { x: 1, y: 0, z: 0 };
var VECTOR3_NORTH = { x: 0, y: 0, z: 1 };
var VECTOR3_SOUTH = { x: 0, y: 0, z: -1 };

// lib/vector3/vectorWrapper.js
var Vector3Builder = class {
  constructor(first, y, z) {
    if (typeof first === "object") {
      this.x = first.x;
      this.y = first.y;
      this.z = first.z;
    } else {
      this.x = first;
      this.y = y ?? 0;
      this.z = z ?? 0;
    }
  }
  /**
   * Assigns the values of the passed in vector to this vector. Returns itself.
   */
  assign(vec) {
    this.x = vec.x;
    this.y = vec.y;
    this.z = vec.z;
    return this;
  }
  /**
   * equals
   *
   * Check the equality of two vectors
   */
  equals(v) {
    return Vector3Utils.equals(this, v);
  }
  /**
   * add
   *
   * Adds the vector v to this, returning itself.
   */
  add(v) {
    return this.assign(Vector3Utils.add(this, v));
  }
  /**
   * subtract
   *
   * Subtracts the vector v from this, returning itself.
   */
  subtract(v) {
    return this.assign(Vector3Utils.subtract(this, v));
  }
  /** scale
   *
   * Scales this by the passed in value, returning itself.
   */
  scale(val) {
    return this.assign(Vector3Utils.scale(this, val));
  }
  /**
   * dot
   *
   * Computes the dot product of this and the passed in vector.
   */
  dot(vec) {
    return Vector3Utils.dot(this, vec);
  }
  /**
   * cross
   *
   * Computes the cross product of this and the passed in vector, returning itself.
   */
  cross(vec) {
    return this.assign(Vector3Utils.cross(this, vec));
  }
  /**
   * magnitude
   *
   * The magnitude of the vector
   */
  magnitude() {
    return Vector3Utils.magnitude(this);
  }
  /**
   * distance
   *
   * Calculate the distance between two vectors
   */
  distance(vec) {
    return Vector3Utils.distance(this, vec);
  }
  /**
   * normalize
   *
   * Normalizes this vector, returning itself.
   */
  normalize() {
    return this.assign(Vector3Utils.normalize(this));
  }
  /**
   * floor
   *
   * Floor the components of a vector to produce a new vector
   */
  floor() {
    return this.assign(Vector3Utils.floor(this));
  }
  /**
   * toString
   *
   * Create a string representation of a vector
   */
  toString(options) {
    return Vector3Utils.toString(this, options);
  }
  /**
   * clamp
   *
   * Clamps the components of a vector to limits to produce a new vector
   */
  clamp(limits) {
    return this.assign(Vector3Utils.clamp(this, limits));
  }
  /**
   * lerp
   *
   * Constructs a new vector using linear interpolation on each component from two vectors.
   */
  lerp(vec, t) {
    return this.assign(Vector3Utils.lerp(this, vec, t));
  }
  /**
   * slerp
   *
   * Constructs a new vector using spherical linear interpolation on each component from two vectors.
   */
  slerp(vec, t) {
    return this.assign(Vector3Utils.slerp(this, vec, t));
  }
};
var Vector2Builder = class {
  constructor(first, y) {
    if (typeof first === "object") {
      this.x = first.x;
      this.y = first.y;
    } else {
      this.x = first;
      this.y = y ?? 0;
    }
  }
  toString(options) {
    return Vector2Utils.toString(this, options);
  }
};
export {
  VECTOR3_BACK,
  VECTOR3_DOWN,
  VECTOR3_EAST,
  VECTOR3_FORWARD,
  VECTOR3_LEFT,
  VECTOR3_NORTH,
  VECTOR3_ONE,
  VECTOR3_RIGHT,
  VECTOR3_SOUTH,
  VECTOR3_UP,
  VECTOR3_WEST,
  VECTOR3_ZERO,
  Vector2Builder,
  Vector2Utils,
  Vector3Builder,
  Vector3Utils,
  clampNumber,
};
