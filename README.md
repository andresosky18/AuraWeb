<p align="center">
  <img src="aura_logo_inner.png" alt="Aura TV" width="220" />
</p>

<h1 align="center">AuraWeb — Official Web Portal, Cloud Sync &amp; Web Player</h1>

<p align="center">
  The official web portal, device cloud-pairing dashboard, and browser-based IPTV &amp; VOD player for the <b>Aura TV v2.1</b> ecosystem (<a href="https://auratv.site.je">auratv.site.je</a>).<br/>
  Manage your M3U playlists, Xtream Codes accounts, and Stremio-compatible add-ons from one place, or launch the full 10-foot Web Player directly in your browser.
</p>

<p align="center">
  <a href="https://auratv.site.je">Live Website</a> ·
  <a href="https://auratv.site.je/samsung/index.html">Launch Web Player</a> ·
  <a href="https://github.com/andresosky18/AuraTV-Android">AuraTV (Android TV)</a> ·
  <a href="https://github.com/andresosky18/AuraMobile">AuraMobile (Android)</a> ·
  <a href="https://github.com/andresosky18/AuraTV-Samsung">AuraTV (Samsung Tizen)</a>
</p>

---

### Ecosystem Repositories

| Repository | Platform | Description |
| :--- | :--- | :--- |
| [**AuraTV-Windows**](https://github.com/andresosky18/AuraTV-Windows) | Windows 10 & 11 (64-bit) | Native C# WebView2 desktop client (`AURA_TV.exe` & Setup Installer) |
| [**AuraMobile**](https://github.com/andresosky18/AuraMobile) | Android (Phone & Tablet) | Native Media3 ExoPlayer client with touch & AMOLED cinema UI |
| [**AuraTV-Android**](https://github.com/andresosky18/AuraTV-Android) | Android TV, Google TV & Fire TV | 10-foot D-pad client with hardware + software decoder fallback |
| [**AuraTV-Samsung**](https://github.com/andresosky18/AuraTV-Samsung) | Samsung Smart TV (Tizen OS) | Native `.wgt` widget (`AVPlay`) & Smart TV Web App |
| [**AuraTV-Roku**](https://github.com/andresosky18/AuraTV-Roku) | Roku OS (SceneGraph) | Native BrightScript & SceneGraph 10-foot TV client |
| [**AuraWeb**](https://github.com/andresosky18/AuraWeb) | Web Portal & Desktop Browser | Cloud Device Sync (`MAC` + `Device Key`), Add-ons manager & Web Player |

---

### Key Features

* **Cloud Device Pairing (`MAC` + 6-Digit `Device Key`):** Instantly link any Aura TV screen (Android TV, Android Mobile, Samsung Smart TV, Roku, or Desktop) to add, update, or remove playlists and add-ons remotely without typing long URLs on a TV remote.
* **Multi-Source Management:**
  * **Xtream Codes API:** Connect server URL, username, and password with automatic live TV, VOD movie, and series catalog indexing.
  * **M3U / M3U8 Playlists:** Add remote playlist links with instant cloud sync.
  * **External Add-ons (`manifest.json`):** Install and manage third-party catalog and metadata add-ons synced across your linked devices.
* **Smart OS Detection (`autoDetectVisitorOs`):** Automatically detects whether the visitor is browsing from an **Android Phone/Tablet**, **Android TV**, **Samsung Tizen TV**, or **Desktop** and highlights the appropriate download or direct Web App launch option.
* **Integrated Web Player (`samsung/index.html`):** Full browser-based 10-foot OLED player powered by `HLS.js` and `proxy.php` (CORS / Mixed-Content relay) for Windows, macOS, Linux, and Smart TV browsers.

---

### Project Structure

```text
AuraWeb/
├── index.html            # Official Landing Page, Multi-OS Download Hub & Cloud Sync Workspace
├── styles.css            # Nuvio-inspired Dark OLED design system (zero external CSS framework bloat)
├── app.js                # Cloud API client (Playlists & Add-ons sync), OS auto-detection & UI tabs
├── aura_logo_inner.png   # Official Aura TV brand wordmark
├── mountains.jpg         # Hero 16:9 interactive TV showcase backdrop
├── samsung/              # Integrated 10-foot Web Player (HTML5 / HLS.js / Tizen Web App)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── tizen-bridge.js
│   ├── proxy.php
│   └── images/
└── LICENSE               # GNU General Public License v3.0
```

---

### Local Development & Deployment

You can serve `AuraWeb` locally with any static HTTP server or PHP built-in server (if using `proxy.php` for HTTP streams):

```bash
git clone https://github.com/andresosky18/AuraWeb.git
cd AuraWeb
php -S localhost:8080
```

Open `http://localhost:8080` in your browser.

---

### Author

* **Andres Aragon** — [@andresosky18](https://github.com/andresosky18)

### License

[GNU General Public License v3.0](LICENSE)
