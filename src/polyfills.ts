declare global {
  interface Map<K, V> {
    getOrInsertComputed(key: K, callback: (key: K) => V): V
  }
}

export function installMapGetOrInsertComputed() {
  if (typeof Map.prototype.getOrInsertComputed === 'function') return
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    configurable: true,
    writable: true,
    value<K, V>(this: Map<K, V>, key: K, callback: (key: K) => V) {
      if (this.has(key)) return this.get(key) as V
      const value = callback(key)
      this.set(key, value)
      return value
    },
  })
}

installMapGetOrInsertComputed()
