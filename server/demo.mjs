// Explicit local demo entry point; no payment provider is contacted.
process.env.CHECKOUT_MODE = 'demo';
await import('./index.mjs');
