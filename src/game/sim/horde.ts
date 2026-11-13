export class Horde {
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly tx: Float32Array;
  readonly ty: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly speed: Float32Array;
  readonly radius: Float32Array;
  readonly slowTimer: Float32Array;
  readonly slowFactor: Float32Array;
  readonly burnTimer: Float32Array;
  readonly aux: Float32Array;
  readonly flash: Float32Array;
  readonly phase: Float32Array;
  readonly kind: Uint8Array;
  readonly flying: Uint8Array;
  readonly id: Float64Array;
  private readonly floats: Float32Array[];
  private readonly slotOfIndex: Int32Array;
  private readonly indexOfSlot: Int32Array;
  private readonly generation: Int32Array;
  private readonly freeSlots: Int32Array;
  private freeCount: number;

  constructor(readonly capacity: number) {
    this.floats = [];
    const f = (): Float32Array => {
      const array = new Float32Array(capacity);
      this.floats.push(array);
      return array;
    };
    this.x = f();
    this.y = f();
    this.vx = f();
    this.vy = f();
    this.tx = f();
    this.ty = f();
    this.hp = f();
    this.maxHp = f();
    this.speed = f();
    this.radius = f();
    this.slowTimer = f();
    this.slowFactor = f();
    this.burnTimer = f();
    this.aux = f();
    this.flash = f();
    this.phase = f();
    this.kind = new Uint8Array(capacity);
    this.flying = new Uint8Array(capacity);
    this.id = new Float64Array(capacity);
    this.slotOfIndex = new Int32Array(capacity);
    this.indexOfSlot = new Int32Array(capacity).fill(-1);
    this.generation = new Int32Array(capacity);
    this.freeSlots = new Int32Array(capacity);
    for (let i = 0; i < capacity; i += 1) this.freeSlots[i] = capacity - 1 - i;
    this.freeCount = capacity;
  }

  spawn(kind: number, x: number, y: number, hp: number, speed: number, radius: number): number {
    if (this.count >= this.capacity || this.freeCount === 0) return -1;
    const i = this.count;
    this.count += 1;
    this.freeCount -= 1;
    const slot = this.freeSlots[this.freeCount]!;
    this.slotOfIndex[i] = slot;
    this.indexOfSlot[slot] = i;
    this.id[i] = this.generation[slot]! * this.capacity + slot;
    for (const array of this.floats) array[i] = 0;
    this.kind[i] = kind;
    this.flying[i] = 0;
    this.x[i] = x;
    this.y[i] = y;
    this.hp[i] = hp;
    this.maxHp[i] = hp;
    this.speed[i] = speed;
    this.radius[i] = radius;
    this.slowFactor[i] = 1;
    return i;
  }

  remove(i: number): void {
    if (i < 0 || i >= this.count) return;
    const slot = this.slotOfIndex[i]!;
    this.indexOfSlot[slot] = -1;
    this.generation[slot]! += 1;
    this.freeSlots[this.freeCount] = slot;
    this.freeCount += 1;
    const last = this.count - 1;
    if (i !== last) {
      for (const array of this.floats) array[i] = array[last]!;
      this.kind[i] = this.kind[last]!;
      this.flying[i] = this.flying[last]!;
      this.id[i] = this.id[last]!;
      const moved = this.slotOfIndex[last]!;
      this.slotOfIndex[i] = moved;
      this.indexOfSlot[moved] = i;
    }
    this.count = last;
  }

  indexOf(id: number): number {
    if (id < 0) return -1;
    const slot = id % this.capacity;
    const generation = (id - slot) / this.capacity;
    if (this.generation[slot] !== generation) return -1;
    return this.indexOfSlot[slot] ?? -1;
  }
}
