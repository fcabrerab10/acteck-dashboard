# bridge/ · Puente SQL Server + Google Sheets → Supabase

Corre en la Mac mini de la oficina. Lee las vistas del ERP (192.168.0.151), cuotas (192.168.0.213 · RevkoBi · dbo.BP), sell out general (192.168.0.160 · SELLOUT · vista "sell out") y el Google Sheet de Master Embarques, y escribe directo en Supabase con el service role key.

## En la Mac mini, 3 pasos

```bash
git clone https://github.com/fcabrerab10/acteck-dashboard.git ~/acteck/acteck-dashboard
cd ~/acteck/acteck-dashboard/bridge
./setup.sh
```
`setup.sh` instala lo que falte, crea **`credenciales.env`** en esta misma carpeta y lo abre. Llena las líneas vacías (service role key, base del ERP, usuarios y contraseñas SQL) y guarda. Ese archivo nunca se sube al repo.

```bash
npm run test-conn        # prueba cada SQL, el Sheet y Supabase
npm run dry              # lee y mapea todo sin subir nada
./launchd/install.sh     # programa 06:30 diario · 12:30 y 17:30 intradía
```

Guía completa (usuarios SQL, Mac mini, Google, troubleshooting): **[docs/SYNC_SQL_BRIDGE.md](../docs/SYNC_SQL_BRIDGE.md)**.
Master Embarques desde un .xlsx bajado con el conector de Drive: `npm run embarques-xlsx -- "Master Embarques.xlsx"`.
