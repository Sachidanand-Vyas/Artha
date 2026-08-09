/** Simulated network latency for mock services (so loading states are real). */
export const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
