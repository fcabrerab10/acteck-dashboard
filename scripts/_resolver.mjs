// Resolver de extensiones para correr los parsers de src/lib/parsers (ESM sin extensión) en Node.
import { existsSync } from 'node:fs';
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (spec.startsWith('.') && ctx.parentURL) {
      const base = new URL(spec, ctx.parentURL);
      for (const ext of ['.js', '.jsx', '/index.js']) {
        const u = new URL(base.href + ext);
        if (existsSync(u)) return next(spec + ext, ctx);
      }
    }
    throw e;
  }
}
