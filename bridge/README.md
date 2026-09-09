# bridge/ · Puente SQL Server + Google Sheets → Supabase

Corre en la Mac mini de la oficina. Lee las vistas del ERP (192.168.0.151), cuotas (192.168.0.213), sell out general (192.168.0.160) y el Google Sheet de Master Embarques, y sube por `/api/import-central` con `SYNC_SECRET`.

Guía completa (SQL, Vercel, Google, Mac mini, launchd): **[docs/SYNC_SQL_BRIDGE.md](../docs/SYNC_SQL_BRIDGE.md)**.

```bash
npm ci
cp .env.example .env && chmod 600 .env     # llenar
npm run test-conn                          # prueba conexiones
node --env-file=.env sync.mjs all --dry-run
node --env-file=.env sync.mjs all
./launchd/install.sh                       # 06:30 diario · 12:30 y 17:30 intradía
```
