/**
 * AURA TV v2.1 - Puente Nativo para Samsung Smart TV (Tizen OS)
 * Implementa window.AuraNative (100% compatible con Android TV / Roku)
 * usando webapis.avplay, webapis.appcommon, tizen.tvinputdevice y XMLHttpRequest / proxy.php.
 */
(function () {
    "use strict";

    const PREF_PREFIX = "AuraTV_";
    let currentPlayingUrl = "";
    let currentAspectMode = "fill";
    let currentRect = { x: 0, y: 0, w: 1280, h: 720, fullscreen: true };
    let avplayActive = false;
    let hlsInstance = null;
    let reconnectCount = 0;
    let wakeLockSentinel = null;

    function hasAvPlay() {
        return Boolean(
            typeof window.webapis !== "undefined" &&
            window.webapis &&
            window.webapis.avplay &&
            document.getElementById("av-player")
        );
    }

    // --- 0. PROTECTOR DE PANTALLA Y CICLO DE VIDA SAMSUNG TIZEN ---
    function setSamsungScreenSaver(allowSaver) {
        try {
            if (window.webapis && window.webapis.appcommon && typeof window.webapis.appcommon.setScreenSaver === "function") {
                const state = allowSaver
                    ? window.webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON
                    : window.webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF;
                window.webapis.appcommon.setScreenSaver(state, function () {}, function () {});
            }
        } catch (e) {}

        // Fallback WakeLock API cuando se ejecuta en el navegador Samsung Internet
        try {
            if (!allowSaver && navigator.wakeLock && typeof navigator.wakeLock.request === "function") {
                if (!wakeLockSentinel) {
                    navigator.wakeLock.request("screen").then((sentinel) => {
                        wakeLockSentinel = sentinel;
                        sentinel.addEventListener("release", () => {
                            wakeLockSentinel = null;
                        });
                    }).catch(() => {});
                }
            } else if (allowSaver && wakeLockSentinel) {
                wakeLockSentinel.release().catch(() => {});
                wakeLockSentinel = null;
            }
        } catch (e) {}
    }

    document.addEventListener("visibilitychange", () => {
        if (!hasAvPlay()) return;
        try {
            if (document.hidden) {
                if (avplayActive) {
                    window.webapis.avplay.suspend();
                }
            } else {
                if (avplayActive && currentPlayingUrl) {
                    setSamsungScreenSaver(false);
                    window.webapis.avplay.restore(currentPlayingUrl, 0, false);
                }
            }
        } catch (e) {}
    });

    // --- 1. REGISTRO DE TECLAS DEL CONTROL REMOTO SAMSUNG TIZEN ---
    function registerSamsungKeys() {
        try {
            if (typeof window.tizen !== "undefined" && window.tizen.tvinputdevice) {
                const keysToRegister = [
                    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
                    "ChannelUp", "ChannelDown", "ChannelList",
                    "MediaPlay", "MediaPause", "MediaPlayPause", "MediaStop",
                    "MediaFastForward", "MediaRewind",
                    "Info", "Guide",
                    "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
                    "Exit"
                ];
                if (typeof window.tizen.tvinputdevice.registerKeyBatch === "function") {
                    try {
                        window.tizen.tvinputdevice.registerKeyBatch(keysToRegister, function () {}, function () {
                            keysToRegister.forEach((k) => {
                                try { window.tizen.tvinputdevice.registerKey(k); } catch (e) {}
                            });
                        });
                    } catch (e) {
                        keysToRegister.forEach((k) => {
                            try { window.tizen.tvinputdevice.registerKey(k); } catch (e2) {}
                        });
                    }
                } else {
                    keysToRegister.forEach((k) => {
                        try { window.tizen.tvinputdevice.registerKey(k); } catch (e) {}
                    });
                }
            }
        } catch (err) {}

        window.addEventListener("keydown", (ev) => {
            const code = ev.keyCode || ev.which;

            // Números 0-9 del control remoto Samsung (fila superior 48-57 y numpad 96-105)
            if ((code >= 48 && code <= 57) || (code >= 96 && code <= 105)) {
                const digit = code >= 96 ? (code - 96) : (code - 48);
                if (typeof window.onRokuKey === "function") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    window.onRokuKey("num_" + digit);
                }
                return;
            }

            let mapped = null;
            switch (code) {
                case 38: // Flecha Arriba
                case 427: // Samsung ChannelUp (CH+)
                    mapped = "up";
                    break;
                case 40: // Flecha Abajo
                case 428: // Samsung ChannelDown (CH-)
                    mapped = "down";
                    break;
                case 37: // Flecha Izquierda
                    mapped = "left";
                    break;
                case 39: // Flecha Derecha
                    mapped = "right";
                    break;
                case 13: // Botón central OK / Enter en Samsung
                    mapped = "OK";
                    break;
                case 10009: // Botón RETURN / ATRÁS de Samsung Tizen
                case 27: // Escape
                case 8: // Backspace
                    mapped = "back";
                    break;
                case 415: // MediaPlay
                case 19: // MediaPause
                case 10252: // MediaPlayPause en controles Samsung Smart Remote
                case 457: // Info
                case 458: // Guide
                case 10073: // ChannelList
                case 403: // Botón Rojo
                case 404: // Botón Verde
                case 405: // Botón Amarillo
                case 406: // Botón Azul
                    mapped = "fav";
                    break;
                case 10182: // Exit en Samsung
                    try {
                        setSamsungScreenSaver(true);
                        if (window.tizen && window.tizen.application) {
                            window.tizen.application.getCurrentApplication().exit();
                        }
                    } catch (e) {}
                    return;
            }

            if (mapped && typeof window.onRokuKey === "function") {
                ev.preventDefault();
                ev.stopPropagation();
                window.onRokuKey(mapped);
            }
        }, true);

        // En el navegador de Samsung TV (Tizen Browser), interceptamos el botón físico Atrás/Return vía History API para que no salga de la página
        try {
            window.history.pushState({ auraTv: true }, "", window.location.href);
            window.addEventListener("popstate", () => {
                window.history.pushState({ auraTv: true }, "", window.location.href);
                if (typeof window.onRokuKey === "function") {
                    window.onRokuKey("back");
                }
            });
        } catch (e) {}

        // Botones flotantes discretos para usar con el puntero/mouse del control Samsung en el navegador
        window.addEventListener("DOMContentLoaded", () => {
            if (hasAvPlay()) return;
            const bar = document.createElement("div");
            bar.style.cssText = "position:fixed;right:18px;bottom:14px;z-index:9999;display:flex;gap:8px;opacity:0.78;";
            const btnStyle = "background:rgba(15,22,36,0.92);color:#F8FAFC;border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.6);";

            const backBtn = document.createElement("button");
            backBtn.type = "button";
            backBtn.style.cssText = btnStyle;
            backBtn.textContent = "← Atrás";
            backBtn.onclick = () => {
                if (typeof window.onRokuKey === "function") window.onRokuKey("back");
            };

            const fsBtn = document.createElement("button");
            fsBtn.type = "button";
            fsBtn.style.cssText = btnStyle;
            fsBtn.textContent = "⛶ Pantalla Completa";
            fsBtn.onclick = () => {
                const docEl = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
                    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
                } else {
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                }
            };

            bar.appendChild(backBtn);
            bar.appendChild(fsBtn);
            document.body.appendChild(bar);
        });
    }

    // --- 2. IDENTIDAD DETERMINÍSTICA DEL TV SAMSUNG (MAC + DEVICE KEY) ---
    function getSamsungHardwareSeed() {
        try {
            if (window.webapis && window.webapis.productinfo && typeof window.webapis.productinfo.getDuid === "function") {
                const duid = window.webapis.productinfo.getDuid();
                if (duid && duid.length >= 6) return "SAMSUNG_" + duid;
            }
        } catch (e) {}
        let localSeed = localStorage.getItem(PREF_PREFIX + "hwSeed");
        if (!localSeed) {
            localSeed = "SAMSUNG_" + Math.random().toString(36).substring(2) + "_" + Date.now();
            localStorage.setItem(PREF_PREFIX + "hwSeed", localSeed);
        }
        return localSeed;
    }

    function simpleHashBytes(str) {
        const out = [0x94, 0x23, 0, 0, 0, 0, 0, 0];
        let h1 = 2166136261;
        let h2 = 16777619;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            h1 ^= c;
            h1 = Math.imul(h1, 16777619) >>> 0;
            h2 = (Math.imul(h2 ^ c, 2246822507) >>> 0);
        }
        out[2] = (h1 >>> 24) & 0xFF;
        out[3] = (h1 >>> 16) & 0xFF;
        out[4] = (h1 >>> 8) & 0xFF;
        out[5] = h1 & 0xFF;
        out[6] = (h2 >>> 8) & 0xFF;
        out[7] = h2 & 0xFF;
        return out;
    }

    function toHex2(n) {
        return ("0" + (n & 0xFF).toString(16).toUpperCase()).slice(-2);
    }

    function computeMacFromSeed(seed) {
        const b = simpleHashBytes("AURA_TV_MAC_V2_" + seed);
        return `94:23:${toHex2(b[2])}:${toHex2(b[3])}:${toHex2(b[4])}:${toHex2(b[5])}`;
    }

    function computeKeyFromSeed(seed) {
        const b = simpleHashBytes("AURA_TV_KEY_V2_" + seed);
        const val = (((b[2] << 24) | (b[3] << 16) | (b[4] << 8) | b[5]) >>> 0);
        const six = (val % 900000) + 100000;
        return String(six);
    }

    // --- 3. ESCALADO Y REPRODUCCIÓN DE VIDEO (Samsung AVPlay + Fallback HTML5/HLS.js) ---
    function computeAvPlayRect(x, y, w, h, fullscreen) {
        const screenW = document.documentElement.clientWidth || window.innerWidth || 1920;
        const screenH = document.documentElement.clientHeight || window.innerHeight || 1080;
        if (fullscreen) {
            return { rx: 0, ry: 0, rw: screenW, rh: screenH };
        }
        // Alineación exacta 1:1 con resizeStage() en app.js (scaleX = vw/1280, scaleY = vh/720)
        const scaleX = screenW / 1280;
        const scaleY = screenH / 720;
        return {
            rx: Math.max(0, Math.round(x * scaleX)),
            ry: Math.max(0, Math.round(y * scaleY)),
            rw: Math.max(10, Math.round(w * scaleX)),
            rh: Math.max(10, Math.round(h * scaleY))
        };
    }

    window.addEventListener("resize", () => {
        if (hasAvPlay() && avplayActive && currentPlayingUrl) {
            try {
                const rect = computeAvPlayRect(
                    currentRect.x,
                    currentRect.y,
                    currentRect.w,
                    currentRect.h,
                    currentRect.fullscreen
                );
                window.webapis.avplay.setDisplayRect(rect.rx, rect.ry, rect.rw, rect.rh);
            } catch (e) {}
        }
    });

    function applyAspectToAvPlay(mode) {
        if (!hasAvPlay() || !avplayActive) return;
        try {
            if (mode === "fit") {
                window.webapis.avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
            } else {
                window.webapis.avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_FULL_SCREEN");
            }
        } catch (e) {}
    }

    function stopHtml5Fallback() {
        const v = document.getElementById("fallbackVideo");
        if (hlsInstance) {
            try { hlsInstance.destroy(); } catch (e) {}
            hlsInstance = null;
        }
        if (v) {
            try {
                v.pause();
                v.removeAttribute("src");
                v.style.display = "none";
            } catch (e) {}
        }
    }

    function playWithHtml5Fallback(url, x, y, w, h, fullscreen) {
        const v = document.getElementById("fallbackVideo");
        if (!v) return;
        if (hlsInstance) {
            try { hlsInstance.destroy(); } catch (e) {}
            hlsInstance = null;
        }

        v.style.display = "block";
        if (fullscreen) {
            v.style.left = "0px";
            v.style.top = "0px";
            v.style.width = "1280px";
            v.style.height = "720px";
            v.style.borderRadius = "0px";
        } else {
            v.style.left = x + "px";
            v.style.top = y + "px";
            v.style.width = w + "px";
            v.style.height = h + "px";
            v.style.borderRadius = "8px";
        }

        // En navegadores HTML5 (incluyendo Tizen Browser), los streams Xtream /live/.../*.ts se reproducen vía HLS (.m3u8)
        let playbackUrl = url;
        if (/\.ts(\?|$)/i.test(playbackUrl) && playbackUrl.indexOf("/live/") >= 0) {
            playbackUrl = playbackUrl.replace(/\.ts(\?|$)/i, ".m3u8$1");
        }

        const startNativeVideoElement = (srcUrl) => {
            v.src = srcUrl;
            v.load();
            v.play().then(() => {
                if (typeof window.onNativePlayerStatus === "function") {
                    window.onNativePlayerStatus("playing", currentPlayingUrl, "");
                }
            }).catch(() => {});
        };

        if (window.Hls && window.Hls.isSupported() && /\.m3u8(\?|$)/i.test(playbackUrl)) {
            let fellBackToNative = false;
            hlsInstance = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true
            });
            hlsInstance.loadSource(playbackUrl);
            hlsInstance.attachMedia(v);
            hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
                v.play().catch(() => {});
            });
            hlsInstance.on(window.Hls.Events.LEVEL_LOADED, () => {
                if (typeof window.onNativePlayerStatus === "function") {
                    window.onNativePlayerStatus("playing", currentPlayingUrl, "");
                }
            });
            hlsInstance.on(window.Hls.Events.ERROR, (ev, data) => {
                if (data && data.fatal) {
                    // Si el servidor IPTV no envía cabeceras CORS para XHR de Hls.js, probamos el reproductor HLS nativo del navegador Tizen
                    if (!fellBackToNative) {
                        fellBackToNative = true;
                        try { hlsInstance.destroy(); } catch (e) {}
                        hlsInstance = null;
                        startNativeVideoElement(playbackUrl);
                        return;
                    }
                    if (typeof window.onNativePlayerStatus === "function") {
                        window.onNativePlayerStatus("unavailable", currentPlayingUrl, "Sin señal de video");
                    }
                }
            });
        } else {
            startNativeVideoElement(playbackUrl);
        }
    }

    function playWithSamsungAvPlay(url, x, y, w, h, fullscreen, isRetry) {
        const avplay = window.webapis.avplay;
        const avObj = document.getElementById("av-player");
        if (avObj) avObj.style.display = "block";

        try {
            const state = avplay.getState();
            if (state !== "NONE" && state !== "IDLE") {
                avplay.stop();
                avplay.close();
            }
        } catch (e) {
            try { avplay.close(); } catch (e2) {}
        }

        const rect = computeAvPlayRect(x, y, w, h, fullscreen);

        try {
            avplay.open(url);
            avplay.setDisplayRect(rect.rx, rect.ry, rect.rw, rect.rh);
            avplay.setDisplayMethod(
                currentAspectMode === "fit"
                    ? "PLAYER_DISPLAY_MODE_LETTER_BOX"
                    : "PLAYER_DISPLAY_MODE_FULL_SCREEN"
            );

            avplay.setListener({
                onbufferingstart: function () {
                    if (typeof window.onNativePlayerStatus === "function") {
                        window.onNativePlayerStatus("buffering", currentPlayingUrl, "");
                    }
                },
                onbufferingcomplete: function () {
                    if (typeof window.onNativePlayerStatus === "function") {
                        window.onNativePlayerStatus("playing", currentPlayingUrl, "");
                    }
                    try {
                        const trackInfo = avplay.getTotalTrackInfo();
                        if (Array.isArray(trackInfo)) {
                            trackInfo.forEach((t) => {
                                if (t.type === "VIDEO" && t.extra_info) {
                                    const info = JSON.parse(t.extra_info);
                                    if (info.Width && info.Height && typeof window.onNativeVideoResolution === "function") {
                                        window.onNativeVideoResolution(Number(info.Width), Number(info.Height));
                                    }
                                }
                            });
                        }
                    } catch (e) {}
                },
                onstreamcompleted: function () {
                    if (currentPlayingUrl) {
                        playWithSamsungAvPlay(url, currentRect.x, currentRect.y, currentRect.w, currentRect.h, currentRect.fullscreen, true);
                    }
                },
                onerror: function () {
                    if (!isRetry && reconnectCount < 2) {
                        reconnectCount++;
                        if (typeof window.onNativePlayerStatus === "function") {
                            window.onNativePlayerStatus("reconnecting", currentPlayingUrl, reconnectCount + "/2");
                        }
                        let altUrl = url;
                        if (/\.ts(\?|$)/i.test(url)) altUrl = url.replace(/\.ts(\?|$)/i, ".m3u8$1");
                        else if (/\.m3u8(\?|$)/i.test(url)) altUrl = url.replace(/\.m3u8(\?|$)/i, ".ts$1");
                        setTimeout(() => {
                            if (currentPlayingUrl) {
                                playWithSamsungAvPlay(altUrl, currentRect.x, currentRect.y, currentRect.w, currentRect.h, currentRect.fullscreen, true);
                            }
                        }, 550);
                    } else {
                        if (typeof window.onNativePlayerStatus === "function") {
                            window.onNativePlayerStatus("unavailable", currentPlayingUrl, "Sin señal de video");
                        }
                    }
                }
            });

            avplayActive = true;
            avplay.prepareAsync(
                function () {
                    if (!avplayActive) return;
                    try {
                        avplay.setDisplayRect(rect.rx, rect.ry, rect.rw, rect.rh);
                        avplay.play();
                        if (typeof window.onNativePlayerStatus === "function") {
                            window.onNativePlayerStatus("playing", currentPlayingUrl, "");
                        }
                    } catch (e) {}
                },
                function () {
                    // Si AVPlay falla con un stream específico, intentamos con HTML5/HLS.js
                    playWithHtml5Fallback(url, x, y, w, h, fullscreen);
                }
            );
        } catch (err) {
            playWithHtml5Fallback(url, x, y, w, h, fullscreen);
        }
    }

    // --- 4. PARSEADOR RÁPIDO DE M3U EN MEMORIA PARA +15.000 CANALES ---
    function parseM3uFast(rawText) {
        const channels = [];
        let count = 1;
        let name = "Canal";
        let category = "General";
        let logo = "";
        const len = rawText.length;
        let pos = 0;

        while (pos < len) {
            let nextNl = rawText.indexOf("\n", pos);
            if (nextNl === -1) nextNl = len;
            const line = rawText.substring(pos, nextNl).trim();
            pos = nextNl + 1;

            if (!line) continue;
            if (line.charCodeAt(0) === 35) { // '#'
                if (line.lastIndexOf("#EXTINF", 0) === 0) {
                    const catIdx = line.indexOf('group-title="');
                    if (catIdx >= 0) {
                        const start = catIdx + 13;
                        const end = line.indexOf('"', start);
                        if (end > start) category = line.substring(start, end) || "General";
                    }
                    const logoIdx = line.indexOf('tvg-logo="');
                    if (logoIdx >= 0) {
                        const start = logoIdx + 10;
                        const end = line.indexOf('"', start);
                        if (end > start) logo = line.substring(start, end);
                    }
                    const comma = line.indexOf(",");
                    if (comma >= 0) {
                        name = line.substring(comma + 1).trim() || "Canal";
                    }
                }
            } else if (/^(https?|rtmp):\/\//i.test(line)) {
                channels.push({
                    num: count++,
                    name: name,
                    url: line,
                    category: category,
                    logo: logo
                });
                name = "Canal";
                category = "General";
                logo = "";
            }
        }
        return channels;
    }

    // --- 5. EXPOSICIÓN DE window.AuraNative ---
    window.AuraNative = {
        readPref: function (key, defVal) {
            const v = localStorage.getItem(PREF_PREFIX + key);
            return v !== null ? v : (defVal || "");
        },
        writePref: function (key, val) {
            localStorage.setItem(PREF_PREFIX + key, String(val));
        },
        getDeviceMac: function () {
            const existing = localStorage.getItem(PREF_PREFIX + "deviceMac");
            if (existing && existing.length === 17) return existing;
            const mac = computeMacFromSeed(getSamsungHardwareSeed());
            localStorage.setItem(PREF_PREFIX + "deviceMac", mac);
            return mac;
        },
        getOrCreateDeviceKey: function () {
            const existing = localStorage.getItem(PREF_PREFIX + "deviceKey");
            if (existing && existing.length === 6) return existing;
            const key = computeKeyFromSeed(getSamsungHardwareSeed());
            localStorage.setItem(PREF_PREFIX + "deviceKey", key);
            return key;
        },
        rotateDeviceIdentity: function () {
            const newSeed = getSamsungHardwareSeed() + "_ROT_" + Date.now();
            localStorage.setItem(PREF_PREFIX + "hwSeed", newSeed);
            const mac = computeMacFromSeed(newSeed);
            const key = computeKeyFromSeed(newSeed);
            localStorage.setItem(PREF_PREFIX + "deviceMac", mac);
            localStorage.setItem(PREF_PREFIX + "deviceKey", key);
            return mac + "|" + key;
        },
        setAspectMode: function (mode) {
            currentAspectMode = mode || "fill";
            applyAspectToAvPlay(currentAspectMode);
        },
        playVideo: function (url, title, x, y, w, h, fullscreen) {
            if (!url) return;
            const sameUrl = (currentPlayingUrl === url);
            currentPlayingUrl = url;
            currentRect = { x: x, y: y, w: w, h: h, fullscreen: Boolean(fullscreen) };
            setSamsungScreenSaver(false);

            if (hasAvPlay()) {
                stopHtml5Fallback();
                if (sameUrl && avplayActive) {
                    const rect = computeAvPlayRect(x, y, w, h, fullscreen);
                    try {
                        window.webapis.avplay.setDisplayRect(rect.rx, rect.ry, rect.rw, rect.rh);
                        return;
                    } catch (e) {}
                }
                reconnectCount = 0;
                playWithSamsungAvPlay(url, x, y, w, h, fullscreen, false);
            } else {
                playWithHtml5Fallback(url, x, y, w, h, fullscreen);
            }
        },
        stopVideo: function () {
            currentPlayingUrl = "";
            avplayActive = false;
            setSamsungScreenSaver(true);
            if (hasAvPlay()) {
                try {
                    window.webapis.avplay.stop();
                    window.webapis.avplay.close();
                } catch (e) {}
                const avObj = document.getElementById("av-player");
                if (avObj) avObj.style.display = "none";
            }
            stopHtml5Fallback();
        },
        executeRequest: function (reqJson) {
            let req = {};
            try { req = JSON.parse(reqJson); } catch (e) { return; }
            const action = req.action || "";
            const method = (req.method || "GET").toUpperCase();
            const url = req.url || "";
            const raw = Boolean(req.raw);
            const diagnostic = Boolean(req.diagnostic);

            const sendResult = (obj) => {
                if (typeof window.onNativeApiResponse === "function") {
                    window.onNativeApiResponse(JSON.stringify(obj));
                }
            };

            const performXhr = (targetUrl, isProxyFallback) => {
                const xhr = new XMLHttpRequest();
                xhr.open(method, targetUrl, true);
                xhr.timeout = action === "fetch_m3u" || action === "fetch_xtream" ? 45000 : 18000;
                if (req.accept) {
                    try { xhr.setRequestHeader("Accept", req.accept); } catch (e) {}
                }
                if (method === "POST") {
                    try { xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8"); } catch (e) {}
                }

                xhr.onload = function () {
                    const code = xhr.status;
                    const body = xhr.responseText || "";

                    if (code >= 200 && code < 300) {
                        if (action === "fetch_m3u") {
                            const parsed = parseM3uFast(body);
                            sendResult({ action: action, httpCode: code, parsedChannels: parsed });
                            return;
                        }
                        if (raw) {
                            sendResult({ action: action, httpCode: code, rawData: body });
                            return;
                        }
                        try {
                            sendResult({ action: action, httpCode: code, data: JSON.parse(body) });
                        } catch (e) {
                            sendResult({
                                action: action,
                                httpCode: code,
                                error: "Invalid JSON",
                                bodySnippet: body.substring(0, 220)
                            });
                        }
                    } else {
                        sendResult({
                            action: action,
                            httpCode: code,
                            error: "HTTP " + code,
                            failureReason: xhr.statusText || ("HTTP " + code),
                            bodySnippet: body.substring(0, 220)
                        });
                    }
                };

                xhr.onerror = function () {
                    // Si se abre desde el navegador Samsung Internet y una lista M3U/Xtream externa bloquea CORS, reintentamos por proxy.php local
                    if (!isProxyFallback && !hasAvPlay() && /^https?:\/\//i.test(url)) {
                        performXhr("proxy.php?url=" + encodeURIComponent(url), true);
                        return;
                    }
                    sendResult({
                        action: action,
                        httpCode: 0,
                        error: "HTTP/Network Error",
                        failureReason: "Network / Connection Error",
                        diagnostic: diagnostic
                    });
                };

                xhr.ontimeout = function () {
                    sendResult({
                        action: action,
                        httpCode: 0,
                        error: "Timeout",
                        failureReason: "Request Timed Out"
                    });
                };

                try {
                    if (method === "POST") {
                        xhr.send(JSON.stringify(req.payload || {}));
                    } else {
                        xhr.send();
                    }
                } catch (err) {
                    if (!isProxyFallback && !hasAvPlay() && /^https?:\/\//i.test(url)) {
                        performXhr("proxy.php?url=" + encodeURIComponent(url), true);
                        return;
                    }
                    sendResult({
                        action: action,
                        httpCode: 0,
                        error: "Send Error",
                        failureReason: String(err && err.message ? err.message : err)
                    });
                }
            };

            // Si estamos en un navegador sobre HTTPS y el servidor IPTV es HTTP plano, usamos proxy.php directo para evitar bloqueo Mixed-Content
            if (!hasAvPlay() && window.location && window.location.protocol === "https:" && /^http:\/\//i.test(url)) {
                performXhr("proxy.php?url=" + encodeURIComponent(url), true);
            } else {
                performXhr(url, false);
            }
        }
    };

    registerSamsungKeys();
})();
