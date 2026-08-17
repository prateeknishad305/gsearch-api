'use strict';

class TtlCache {
  constructor(defaultTtlMs = 5 * 60 * 1000, maxEntries = 500) {
    this.defaultTtl = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtl) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }
}

module.exports = { TtlCache };
