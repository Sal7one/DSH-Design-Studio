// Shared client runtime set by apply(); components never close over the plugin context.
export const runtime = { ctx: null, t: (key) => key }
