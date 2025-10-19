// Lightweight LRU cache used by various modules. Stores arbitrary values.
export class LRUCache<V> {
  private map: Map<string, V>;

  constructor() {
    this.map = new Map();
  }

  get(key: string): V | undefined {
    // Retrieve value without refreshing order when the stored value is
    // explicitly `undefined`. Tests expect that storing `undefined` does
    // not refresh the LRU ordering.
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key) as V | undefined;
    if (v === undefined) return undefined;
    // Move to the back to mark as most-recently used
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: string, value: V): void {
    // If key exists, delete first so insertion order is updated
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }
}

export default LRUCache;
