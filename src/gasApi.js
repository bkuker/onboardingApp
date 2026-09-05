// src/gasApi.js
//
// Promise wrapper around google.script.run, with dev-mode mocks so
// `vite dev` doesn't throw when google.script.run doesn't exist, plus a
// reader for the single boot-data payload injected by gas/Auth.gs.

const isInGas = typeof google !== 'undefined' && !!google.script?.run

// Simulated network latency for dev mocks, so loading states are actually
// visible in `vite dev` instead of resolving instantly.
const MOCK_DELAY_MS = 2000
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Fixtures for local development. Keep these just realistic enough to
// build/test the UI against without a real deployment.
const devMocks = {
  search: async (token, needle) => {
    const all = [
      { Id: 1, FirstName: 'Jane', LastName: 'Doe', Email: 'jane@example.com', Status: 'PendingNew' },
      { Id: 2, FirstName: 'John', LastName: 'Smith', Email: 'john@example.com', Status: 'Active' },
      { Id: 3, FirstName: 'Alex', LastName: 'Kim', Email: 'alex@example.com', Status: 'PendingNew' },
    ]
    const q = needle.toLowerCase()
    return {
      Contacts: all.filter((c) =>
        `${c.FirstName} ${c.LastName} ${c.Email}`.toLowerCase().includes(q),
      ),
    }
  },
  canActivate: async (c) => (c.Status === 'PendingNew' ? [] : ['Membership is not pending.']),
  activate: async () => null,
}

/**
 * Call a server-side Apps Script function and get a real Promise back.
 * Falls back to a registered mock when running outside Apps Script
 * (e.g. `npm run dev`).
 */
export function gasRun(fnName, ...args) {
  if (isInGas) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler((err) => reject(err))
        [fnName](...args)
    })
  }

  const mock = devMocks[fnName]
  if (!mock) {
    console.warn(`[gasApi] no dev mock registered for "${fnName}" — returning null`)
    return Promise.resolve(null)
  }
  console.info(`[gasApi] dev mock: ${fnName}(${args.map((a) => JSON.stringify(a)).join(', ')})`)
  return delay(MOCK_DELAY_MS).then(() => mock(...args))
}

/**
 * The boot payload injected via gas/Auth.gs → template.bootDataJson →
 * <?!= bootDataJson ?>. In dev (placeholder never replaced), returns a
 * fake "already logged in" session so you can build the app UI without
 * running the real WildApricot OAuth flow.
 */
export function getBootData() {
  const raw = window.__GAS_BOOT_DATA__

  if (raw === 'GAS_BOOT_DATA_PLACEHOLDER_TOKEN' || raw === undefined) {
    return { token: 'dev-token', error: null, authUrl: '#' }
  }

  return raw
}