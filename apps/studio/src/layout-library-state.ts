export function createLifecycleActionGate() {
  let activeKey = ''
  return {
    start(key: string) {
      if (activeKey) return false
      activeKey = key
      return true
    },
    finish(key: string) {
      if (activeKey === key) activeKey = ''
    },
    current() {
      return activeKey
    },
  }
}

export function isOutsideMenu(menuRoot: { contains(target: unknown): boolean } | null, target: unknown): boolean {
  return menuRoot === null || !menuRoot.contains(target)
}
