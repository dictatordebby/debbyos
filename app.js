/* debbyOS shared behaviors
   - theme persistence (plum / matcha / midnight) + clickable .theme-switch cycler
   - audio toggle with subtle WebAudio "mechanical" clicks
   - live taskbar clock
   - global visitor counter (Supabase REST + localStorage fallback)
   - interactive window controls (_ minimize, □ maximize, × close/restore)
   - ⭐ start menu popup (quick links, random page/game, theme/audio toggles, sleep screensaver)
*/
(function () {
    'use strict';

    const THEME_KEY = 'debbyOS_theme';
    const AUDIO_KEY = 'debbyOS_audio';
    const SESSION_VISIT_KEY = 'debbyOS_visited_session';
    const LOCAL_COUNT_KEY = 'debbyOS_local_visitor_count';

    /* Supabase credentials (shared with guestbook) */
    const SUPABASE_URL = 'https://bjnjdnggpryurvnhjckb.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_GrUnMeA9ANc18PXoV5jTWA_ASvhbwOC';

    const THEME_ORDER = ['plum', 'matcha', 'midnight'];
    const THEME_LABELS = {
        plum: 'pastel star 🌸',
        matcha: 'matcha sage 🍵',
        midnight: 'midnight blue 🌙'
    };

    const RANDOM_DESTINATIONS = [
        'index.html',
        'games.html',
        'connections.html',
        'mystery.html',
        'about.html',
        'favourites.html',
        'guestbook.html',
        'settings.html'
    ];

    /* ---------- THEME ---------- */
    function getCurrentTheme() {
        return localStorage.getItem(THEME_KEY) || 'plum';
    }

    function applyTheme() {
        const theme = getCurrentTheme();
        document.body.classList.remove('matcha-sage', 'midnight-blue');
        if (theme === 'matcha') document.body.classList.add('matcha-sage');
        else if (theme === 'midnight') document.body.classList.add('midnight-blue');

        const indicator = document.querySelector('.theme-switch');
        if (indicator) {
            indicator.textContent = THEME_LABELS[theme] || THEME_LABELS.plum;
            indicator.title = 'click to cycle theme (plum → matcha → midnight)';
        }

        const startThemeBtn = document.getElementById('start-theme-cycle-btn');
        if (startThemeBtn) {
            startThemeBtn.textContent = `🎨 ${theme}`;
        }
    }

    window.debbyOS_setTheme = function (theme) {
        localStorage.setItem(THEME_KEY, theme);
        applyTheme();
        beep(980, 0.06, 0.025);
    };

    window.debbyOS_cycleTheme = function () {
        const current = getCurrentTheme();
        const nextIndex = (THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length;
        window.debbyOS_setTheme(THEME_ORDER[nextIndex]);
    };

    /* ---------- AUDIO ---------- */
    let audioEnabled = localStorage.getItem(AUDIO_KEY) !== 'off';
    let audioCtx = null;

    function getCtx() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                audioCtx = null;
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    window.debbyOS_getAudioContext = getCtx;

    function beep(freq, dur, vol) {
        if (!audioEnabled) return;
        const ctx = getCtx();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.6), ctx.currentTime + dur);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + dur);
        } catch (e) { /* ignore */ }
    }

    function updateAudioIcons() {
        document.querySelectorAll('.audio-icon').forEach(el => {
            el.textContent = audioEnabled ? '🔊' : '🔇';
        });
        const btn = document.getElementById('audio-toggle-btn');
        if (btn) btn.textContent = audioEnabled ? 'enabled 🔊' : 'muted 🔇';

        const startAudioBtn = document.getElementById('start-audio-toggle-btn');
        if (startAudioBtn) {
            startAudioBtn.textContent = audioEnabled ? '🔊 sound: on' : '🔇 sound: off';
        }
    }

    window.debbyOS_setAudio = function (on) {
        audioEnabled = !!on;
        localStorage.setItem(AUDIO_KEY, audioEnabled ? 'on' : 'off');
        updateAudioIcons();
        beep(1200, 0.08, 0.04);
    };

    window.debbyOS_isAudioEnabled = function () { return audioEnabled; };

    /* click sounds (delegated so it works on dynamically created buttons too) */
    document.addEventListener('click', function (e) {
        const target = e.target.closest(
            'button, a.nav-item, a.win-btn, .game-btn, .choice-btn, .setting-btn, .mini-btn, .tab-pill, .start-btn, .task-pill, .clear-link, .submit-btn, .start-menu-link, .start-Quick-btn, .theme-switch, .win-controls span'
        );
        if (target) beep(880, 0.05, 0.018);
    }, true);

    /* ---------- CLOCK ---------- */
    function updateClock() {
        const el = document.getElementById('live-clock');
        if (!el) return;
        const now = new Date();
        el.textContent =
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
    }
    setInterval(updateClock, 1000);

    /* ---------- VISITOR COUNTER ---------- */
    function renderVisitorCount(count) {
        const formatted = String(Math.max(1, Number(count) || 1)).padStart(6, '0');

        /* 1. Inject or update taskbar badge on every page */
        const taskbarRight = document.querySelector('.taskbar-right');
        if (taskbarRight) {
            let pill = document.getElementById('taskbar-visitor-pill');
            if (!pill) {
                pill = document.createElement('span');
                pill.id = 'taskbar-visitor-pill';
                pill.className = 'visitor-pill';
                pill.title = 'total site visitors';
                taskbarRight.insertBefore(pill, taskbarRight.firstChild);
            }
            pill.textContent = `👁️ ${formatted}`;
        }

        /* 2. Update retro odometer on home page if present */
        const odometer = document.getElementById('visitor-odometer');
        if (odometer) {
            odometer.innerHTML = '';
            formatted.split('').forEach(digit => {
                const span = document.createElement('span');
                span.className = 'odometer-digit';
                span.textContent = digit;
                odometer.appendChild(span);
            });
        }

        const subtext = document.getElementById('visitor-status-text');
        if (subtext) {
            subtext.textContent = `you are visitor #${Number(count).toLocaleString()} to debbyos ✨`;
        }
    }

    async function updateVisitorCounter() {
        const alreadyCountedThisSession = sessionStorage.getItem(SESSION_VISIT_KEY) === 'true';

        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            try {
                if (!alreadyCountedThisSession) {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_visitor_count`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    });
                    if (res.ok) {
                        const count = await res.json();
                        sessionStorage.setItem(SESSION_VISIT_KEY, 'true');
                        localStorage.setItem(LOCAL_COUNT_KEY, String(count));
                        renderVisitorCount(count);
                        return;
                    }
                } else {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_stats?id=eq.global&select=visits`, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    });
                    if (res.ok) {
                        const rows = await res.json();
                        if (rows && rows.length > 0) {
                            const count = rows[0].visits;
                            localStorage.setItem(LOCAL_COUNT_KEY, String(count));
                            renderVisitorCount(count);
                            return;
                        }
                    }
                }
            } catch (err) {
                /* Fall back silently to local counter */
            }
        }

        let localCount = parseInt(localStorage.getItem(LOCAL_COUNT_KEY) || '104', 10);
        if (!alreadyCountedThisSession) {
            localCount += 1;
            localStorage.setItem(LOCAL_COUNT_KEY, String(localCount));
            sessionStorage.setItem(SESSION_VISIT_KEY, 'true');
        }
        renderVisitorCount(localCount);
    }

    /* ---------- INTERACTIVE WINDOW CONTROLS (_ □ ×) ---------- */
    function initWindowControls() {
        document.querySelectorAll('.retro-window').forEach(win => {
            const controls = win.querySelector('.win-controls');
            if (!controls) return;

            controls.querySelectorAll('span').forEach(btn => {
                const sym = btn.textContent.trim();
                if (sym === '_') {
                    btn.title = 'minimize / expand window';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        win.classList.toggle('minimized');
                        if (win.id === 'dossier-section') {
                            win.classList.remove('collapsed');
                        }
                    });
                } else if (sym === '□') {
                    btn.title = 'maximize / restore window width';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        win.classList.toggle('maximized');
                    });
                } else if (sym === '×') {
                    btn.title = 'close window (can be restored from ⭐ start menu)';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        win.classList.add('closed-win');
                    });
                }
            });
        });
    }

    window.debbyOS_restoreAllWindows = function () {
        document.querySelectorAll('.retro-window').forEach(win => {
            win.classList.remove('closed-win', 'minimized', 'collapsed');
        });
    };

    /* ---------- SCREENSAVER (🌙 SLEEP MODE) ---------- */
    let screensaverEl = null;
    let screensaverArmed = false;

    function buildScreensaver() {
        if (screensaverEl) return screensaverEl;
        screensaverEl = document.createElement('div');
        screensaverEl.className = 'screensaver-overlay';
        screensaverEl.innerHTML = `
            <div class="screensaver-center-box">
                <h2>🌙 debbyos sleep mode</h2>
                <p>move your mouse or press any key to wake up ✨</p>
            </div>
        `;

        const icons = ['⭐️', '🪐', '🎀', '🌸', '✨', '🌙'];
        for (let i = 0; i < 18; i++) {
            const star = document.createElement('span');
            star.className = 'floating-star';
            star.textContent = icons[i % icons.length];
            star.style.left = `${Math.random() * 94}%`;
            star.style.animationDuration = `${6 + Math.random() * 7}s`;
            star.style.animationDelay = `-${Math.random() * 8}s`;
            star.style.fontSize = `${16 + Math.floor(Math.random() * 18)}px`;
            screensaverEl.appendChild(star);
        }

        document.body.appendChild(screensaverEl);

        const wakeUp = () => {
            if (!screensaverArmed) return;
            screensaverArmed = false;
            screensaverEl.classList.remove('active');
            beep(1040, 0.06, 0.02);
        };

        window.addEventListener('mousemove', wakeUp, { passive: true });
        window.addEventListener('keydown', wakeUp);
        window.addEventListener('touchstart', wakeUp, { passive: true });
        screensaverEl.addEventListener('click', wakeUp);

        return screensaverEl;
    }

    window.debbyOS_startScreensaver = function () {
        const el = buildScreensaver();
        el.classList.add('active');
        screensaverArmed = false;
        setTimeout(() => {
            screensaverArmed = true;
        }, 350);
    };

    /* ---------- ⭐ START MENU POPUP ---------- */
    function initStartMenu() {
        const startBtn = document.querySelector('.start-btn');
        if (!startBtn) return;

        /* Remove inline redirect so it opens our popup menu instead */
        startBtn.removeAttribute('onclick');

        const popup = document.createElement('div');
        popup.className = 'start-menu-popup';
        popup.id = 'debbyos-start-menu';
        popup.innerHTML = `
            <div class="start-menu-header">
                <span>⭐️ debbyos system menu</span>
                <span>v2.5</span>
            </div>
            <div class="start-menu-body">
                <a href="index.html" class="start-menu-link"><span>🏠 home desktop</span><span>→</span></a>
                <a href="games.html" class="start-menu-link"><span>🎮 games lobby</span><span>→</span></a>
                <a href="connections.html" class="start-menu-link"><span>🧩 connections</span><span>→</span></a>
                <a href="mystery.html" class="start-menu-link"><span>🕵️‍♀️ eight at l'ombre</span><span>→</span></a>
                <a href="favourites.html" class="start-menu-link"><span>💖 favourites cloud</span><span>→</span></a>
                <a href="guestbook.html" class="start-menu-link"><span>💌 guestbook</span><span>→</span></a>
                <a href="about.html" class="start-menu-link"><span>⭐ about debby</span><span>→</span></a>
                <a href="settings.html" class="start-menu-link"><span>⚙️ settings</span><span>→</span></a>
                <div class="start-menu-divider"></div>
                <button type="button" class="start-menu-link" id="start-random-btn">
                    <span>🎲 random page / game</span><span>↗</span>
                </button>
                <button type="button" class="start-menu-link" id="start-restore-win-btn">
                    <span>🪟 restore all windows</span><span>↺</span>
                </button>
                <div class="start-menu-divider"></div>
                <div class="start-menu-controls">
                    <button type="button" class="start-Quick-btn" id="start-theme-cycle-btn">🎨 plum</button>
                    <button type="button" class="start-Quick-btn" id="start-audio-toggle-btn">🔊 sound: on</button>
                    <button type="button" class="start-Quick-btn" id="start-sleep-btn" style="grid-column: 1 / -1;">🌙 sleep / screensaver</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);

        startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popup.classList.toggle('open');
            startBtn.classList.toggle('active', isOpen);
        });

        document.getElementById('start-random-btn').addEventListener('click', () => {
            const pick = RANDOM_DESTINATIONS[Math.floor(Math.random() * RANDOM_DESTINATIONS.length)];
            window.location.href = pick;
        });

        document.getElementById('start-restore-win-btn').addEventListener('click', () => {
            window.debbyOS_restoreAllWindows();
            popup.classList.remove('open');
            startBtn.classList.remove('active');
        });

        document.getElementById('start-theme-cycle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.debbyOS_cycleTheme();
        });

        document.getElementById('start-audio-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.debbyOS_setAudio(!audioEnabled);
        });

        document.getElementById('start-sleep-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            popup.classList.remove('open');
            startBtn.classList.remove('active');
            window.debbyOS_startScreensaver();
        });

        document.addEventListener('click', (e) => {
            if (!popup.contains(e.target) && e.target !== startBtn) {
                popup.classList.remove('open');
                startBtn.classList.remove('active');
            }
        });
    }

    /* ---------- INIT ---------- */
    function init() {
        initStartMenu();
        applyTheme();
        updateAudioIcons();
        updateClock();
        updateVisitorCounter();
        initWindowControls();

        /* make .theme-switch in top browser bar cycle themes on click */
        const themeSwitchEl = document.querySelector('.theme-switch');
        if (themeSwitchEl) {
            themeSwitchEl.addEventListener('click', () => {
                window.debbyOS_cycleTheme();
            });
        }

        /* make the taskbar audio icon clickable */
        document.querySelectorAll('.audio-icon').forEach(el => {
            el.style.cursor = 'pointer';
            el.title = 'click to toggle sound';
            el.addEventListener('click', () => {
                window.debbyOS_setAudio(!audioEnabled);
            });
        });

        /* wire the settings page toggle */
        const audioBtn = document.getElementById('audio-toggle-btn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                window.debbyOS_setAudio(!audioEnabled);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();