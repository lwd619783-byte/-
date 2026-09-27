/** Shared deterministic calculation; UI and MCP have one implementation. */
export * from '../../shared/oil-shipping-observation.mjs';
export function shanghaiToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
