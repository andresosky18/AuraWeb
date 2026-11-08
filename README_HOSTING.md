# AURA TV - Portal web para InfinityFree

Dominio configurado: https://auratv.site.je/
Directorio de InfinityFree: auratv.site.je/htdocs/

## Subir al hosting
Sube directamente dentro de `htdocs`:
- index.html
- styles.css
- app.js
- api.php
- carpeta data/

Luego abre: https://auratv.site.je/

## Importante sobre la sincronización con Roku
La web sí puede funcionar en InfinityFree desde un navegador. Sin embargo, el plan gratuito de InfinityFree bloquea accesos automatizados/API desde dispositivos externos. Por eso Roku no podrá consultar `api.php` directamente en este hosting.

La arquitectura recomendada es:
- Frontend web: https://auratv.site.je/ (InfinityFree)
- Backend de sincronización Roku/MAC: servicio API externo (por ejemplo Cloudflare Worker, Supabase, Render, etc.)

El QR del proyecto Roku ya apunta a:
https://auratv.site.je/?mac=94%3A23%3A87%3A99%3A03%3A15&key=862416

Cuando exista el backend externo, solo hay que cambiar la constante de API en `app.js` y `m.backendBaseUrl` en Roku.
