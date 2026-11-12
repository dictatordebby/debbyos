/* debbyOS shared behaviors
   - theme persistence (plum / matcha / midnight) + clickable .theme-switch cycler
   - audio toggle with subtle WebAudio "mechanical" clicks
   - global persistent CD audio player + taskbar mini-player + home widget sync
   - seamless SPA page router (keeps music playing uninterrupted across all pages)
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
    const CD_STATE_KEY = 'debbyOS_cd_state_v1';

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

    /* ---------- GLOBAL CD PLAYER ENGINE ---------- */
    const CD_TRACKS = [
        {
            title: "the way (feat. mac miller)",
            artist: "ariana grande",
            src: "audio/the-way.mp3",
            query: "ariana+grande+the+way"
        },
        {
            title: "always come back to your love",
            artist: "samantha mumba",
            src: "audio/always-come-back.mp3",
            query: "samantha+mumba+always+come+back+to+your+love"
        },
        {
            title: "try sleeping with a broken heart",
            artist: "alicia keys",
            src: "audio/try-sleeping.mp3",
            query: "alicia+keys+try+sleeping+with+a+broken+heart"
        }
    ];

    let currentTrackIdx = 0;
    let isPlayingCD = false;
    const cdAudio = new Audio();
    cdAudio.preload = 'metadata';

    function saveCDState() {
        try {
            sessionStorage.setItem(CD_STATE_KEY, JSON.stringify({
                idx: currentTrackIdx,
                time: cdAudio.currentTime || 0,
                playing: isPlayingCD
            }));
        } catch (e) {}
    }

    function restoreCDState() {
        try {
            const raw = sessionStorage.getItem(CD_STATE_KEY);
            if (!raw) {
                cdAudio.src = CD_TRACKS[0].src;
                return;
            }
            const state = JSON.parse(raw);
            if (typeof state.idx === 'number' && CD_TRACKS[state.idx]) {
                currentTrackIdx = state.idx;
            }
            cdAudio.src = CD_TRACKS[currentTrackIdx].src;
            if (typeof state.time === 'number' && state.time > 0) {
                cdAudio.currentTime = state.time;
            }
            if (state.playing) {
                cdAudio.play().then(() => {
                    isPlayingCD = true;
                    syncCDUI();
                }).catch(() => {
                    isPlayingCD = false;
                    syncCDUI();
                });
            }
        } catch (e) {
            cdAudio.src = CD_TRACKS[0].src;
        }
    }

    function injectTaskbarPlayerStyles() {
        if (document.getElementById('debbyos-global-cd-styles')) return;
        const style = document.createElement('style');
        style.id = 'debbyos-global-cd-styles';
        style.textContent = `
            .taskbar-cd-pill {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: var(--plum-bg);
                color: var(--pastel-pink);
                border: 1px solid var(--pastel-pink);
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                max-width: 240px;
            }
            .taskbar-cd-disc {
                display: inline-block;
                font-size: 12px;
                user-select: none;
            }
            .taskbar-cd-disc.spinning {
                animation: taskbarSpin 2.8s linear infinite;
            }
            @keyframes taskbarSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            .taskbar-cd-title {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 110px;
                font-size: 10px;
            }
            .taskbar-cd-btn {
                background: none;
                border: none;
                color: var(--pastel-pink);
                cursor: pointer;
                font-size: 10px;
                padding: 0 3px;
                line-height: 1;
                font-weight: bold;
            }
            .taskbar-cd-btn:hover {
                color: #fff;
                transform: scale(1.1);
            }
            @media (max-width: 600px) {
                .taskbar-cd-title { max-width: 65px; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureTaskbarMiniPlayer() {
        injectTaskbarPlayerStyles();
        const taskbarRight = document.querySelector('.taskbar-right');
        if (!taskbarRight) return;

        let pill = document.getElementById('taskbar-cd-pill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'taskbar-cd-pill';
            pill.className = 'taskbar-cd-pill';
            pill.innerHTML = `
                <span class="taskbar-cd-disc" id="tb-cd-disc">💿</span>
                <span class="taskbar-cd-title" id="tb-cd-title"></span>
                <button type="button" class="taskbar-cd-btn" id="tb-cd-prev" title="previous track">⏮</button>
                <button type="button" class="taskbar-cd-btn" id="tb-cd-play" title="play / pause">▶</button>
                <button type="button" class="taskbar-cd-btn" id="tb-cd-next" title="next track">⏭</button>
            `;
            taskbarRight.insertBefore(pill, taskbarRight.firstChild);

            document.getElementById('tb-cd-prev').addEventListener('click', (e) => {
                e.stopPropagation();
                window.cdPrevTrack();
            });
            document.getElementById('tb-cd-play').addEventListener('click', (e) => {
                e.stopPropagation();
                window.cdTogglePlay();
            });
            document.getElementById('tb-cd-next').addEventListener('click', (e) => {
                e.stopPropagation();
                window.cdNextTrack();
            });
        }
    }

    function syncCDUI() {
        const track = CD_TRACKS[currentTrackIdx];
        ensureTaskbarMiniPlayer();

        /* 1. Sync Taskbar Mini-Player (present on every page) */
        const tbDisc = document.getElementById('tb-cd-disc');
        const tbTitle = document.getElementById('tb-cd-title');
        const tbPlay = document.getElementById('tb-cd-play');
        if (tbDisc) tbDisc.classList.toggle('spinning', isPlayingCD);
        if (tbTitle) tbTitle.textContent = track.title;
        if (tbPlay) tbPlay.textContent = isPlayingCD ? '⏸' : '▶';

        /* 2. Sync Main CD Player Window (when on index.html) */
        const titleEl = document.getElementById('cd-track-title');
        const artistEl = document.getElementById('cd-track-artist');
        const ytEl = document.getElementById('cd-yt-link');
        const statusEl = document.getElementById('cd-status-label');
        const playBtn = document.getElementById('cd-play-btn');
        const discEl = document.getElementById('cd-disc');
        const progBar = document.getElementById('cd-progress-bar');

        if (titleEl) titleEl.textContent = track.title;
        if (artistEl) artistEl.textContent = track.artist;
        if (ytEl) ytEl.href = `https://www.youtube.com/results?search_query=${track.query}`;
        if (statusEl) {
            statusEl.textContent = isPlayingCD
                ? `now playing (${currentTrackIdx + 1}/${CD_TRACKS.length})`
                : `paused · track ${currentTrackIdx + 1}/${CD_TRACKS.length}`;
        }
        if (playBtn) playBtn.textContent = isPlayingCD ? '⏸ pause' : '▶ play';
        if (discEl) discEl.classList.toggle('spinning', isPlayingCD);
        if (progBar && cdAudio.duration) {
            progBar.style.width = `${(cdAudio.currentTime / cdAudio.duration) * 100}%`;
        }
    }

    function bindHomeCDWidgetEvents() {
        const wrap = document.getElementById('cd-progress-wrap') || document.querySelector('.cd-progress-wrap');
        if (wrap && !wrap.dataset.cdBound) {
            wrap.dataset.cdBound = 'true';
            wrap.style.cursor = 'pointer';
            wrap.addEventListener('click', (e) => {
                if (!cdAudio.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                cdAudio.currentTime = (clickX / rect.width) * cdAudio.duration;
                saveCDState();
            });
        }
        syncCDUI();
    }

    cdAudio.addEventListener('timeupdate', () => {
        const progBar = document.getElementById('cd-progress-bar');
        if (progBar && cdAudio.duration) {
            progBar.style.width = `${(cdAudio.currentTime / cdAudio.duration) * 100}%`;
        }
        saveCDState();
    });

    cdAudio.addEventListener('ended', () => {
        window.cdNextTrack();
    });

    window.cdTogglePlay = function () {
        if (isPlayingCD) {
            cdAudio.pause();
            isPlayingCD = false;
            saveCDState();
            syncCDUI();
        } else {
            if (!cdAudio.src) {
                cdAudio.src = CD_TRACKS[currentTrackIdx].src;
            }
            cdAudio.play().then(() => {
                isPlayingCD = true;
                saveCDState();
                syncCDUI();
            }).catch(err => {
                console.error('Audio playback error:', err);
                const statusEl = document.getElementById('cd-status-label');
                if (statusEl) statusEl.textContent = 'error · check audio/ folder';
            });
        }
    };

    window.cdNextTrack = function () {
        currentTrackIdx = (currentTrackIdx + 1) % CD_TRACKS.length;
        cdAudio.src = CD_TRACKS[currentTrackIdx].src;
        cdAudio.load();
        if (isPlayingCD) {
            cdAudio.play().catch(() => {});
        } else {
            const progBar = document.getElementById('cd-progress-bar');
            if (progBar) progBar.style.width = '0%';
        }
        saveCDState();
        syncCDUI();
    };

    window.cdPrevTrack = function () {
        currentTrackIdx = (currentTrackIdx - 1 + CD_TRACKS.length) % CD_TRACKS.length;
        cdAudio.src = CD_TRACKS[currentTrackIdx].src;
        cdAudio.load();
        if (isPlayingCD) {
            cdAudio.play().catch(() => {});
        } else {
            const progBar = document.getElementById('cd-progress-bar');
            if (progBar) progBar.style.width = '0%';
        }
        saveCDState();
        syncCDUI();
    };

    window.renderCDTrack = syncCDUI;

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
        cdAudio.muted = !audioEnabled;
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
    let cachedVisitorCount = null;

    function renderVisitorCount(count) {
        cachedVisitorCount = count;
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
        if (cachedVisitorCount !== null) {
            renderVisitorCount(cachedVisitorCount);
            return;
        }

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
            if (win.dataset.controlsBound) return;
            win.dataset.controlsBound = 'true';

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

        startBtn.removeAttribute('onclick');

        let popup = document.getElementById('debbyos-start-menu');
        if (!popup) {
            popup = document.createElement('div');
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

            document.getElementById('start-random-btn').addEventListener('click', () => {
                const pick = RANDOM_DESTINATIONS[Math.floor(Math.random() * RANDOM_DESTINATIONS.length)];
                popup.classList.remove('open');
                startBtn.classList.remove('active');
                navigateWithoutReload(pick, true);
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
                const currentStartBtn = document.querySelector('.start-btn');
                if (!popup.contains(e.target) && e.target !== currentStartBtn) {
                    popup.classList.remove('open');
                    if (currentStartBtn) currentStartBtn.classList.remove('active');
                }
            });
        }

        if (!startBtn.dataset.startBound) {
            startBtn.dataset.startBound = 'true';
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = popup.classList.toggle('open');
                startBtn.classList.toggle('active', isOpen);
            });
        }
    }

    /* ---------- SEAMLESS SPA ROUTER (KEEPS MUSIC PLAYING) ---------- */
    async function loadExternalScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) return;
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function navigateWithoutReload(url, pushState = true) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                window.location.href = url;
                return;
            }
            const html = await res.text();
            const parser = new DOMParser();
            const nextDoc = parser.parseFromString(html, 'text/html');

            /* 1. Update document title */
            document.title = nextDoc.title;

            /* 2. Swap page-specific inline <style> tags */
            document.querySelectorAll('head style:not(#debbyos-global-cd-styles)').forEach(el => el.remove());
            nextDoc.querySelectorAll('head style').forEach(styleEl => {
                document.head.appendChild(styleEl.cloneNode(true));
            });

            /* 3. Swap top browser-bar & main os-container */
            const currentBar = document.querySelector('.browser-bar');
            const nextBar = nextDoc.querySelector('.browser-bar');
            if (currentBar && nextBar) {
                currentBar.replaceWith(nextBar.cloneNode(true));
            }

            const currentOS = document.querySelector('.os-container');
            const nextOS = nextDoc.querySelector('.os-container');
            if (currentOS && nextOS) {
                currentOS.replaceWith(nextOS.cloneNode(true));
            }

            /* 4. Close start menu if open */
            const popup = document.getElementById('debbyos-start-menu');
            if (popup) popup.classList.remove('open');

            if (pushState) {
                history.pushState({ url }, '', url);
            }
            window.scrollTo(0, 0);

            /* 5. Load any extra external scripts (e.g. Supabase on guestbook.html) */
            const extScripts = Array.from(nextDoc.querySelectorAll('body script[src]'));
            for (const ext of extScripts) {
                const src = ext.getAttribute('src');
                if (src && !src.includes('app.js')) {
                    await loadExternalScript(src);
                }
            }

            /* 6. Re-bind shared debbyOS controls on the newly swapped DOM */
            bindPageElements();

            /* 7. Execute page-specific inline scripts inside an isolated scope */
            nextDoc.querySelectorAll('body script:not([src])').forEach(inlineScript => {
                const code = inlineScript.textContent;
                if (code && code.trim()) {
                    try {
                        const runner = document.createElement('script');
                        runner.textContent = `(function(){\n${code}\n})();`;
                        document.body.appendChild(runner);
                        runner.remove();
                    } catch (err) {
                        console.error('Page script execution error:', err);
                    }
                }
            });
        } catch (err) {
            window.location.href = url;
        }
    }

    function initSeamlessNavigation() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            if (link.target === '_blank' || link.hasAttribute('download')) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

            const resolvedUrl = new URL(href, window.location.href);
            if (resolvedUrl.origin !== window.location.origin) return;

            e.preventDefault();
            navigateWithoutReload(resolvedUrl.href, true);
        });

        window.addEventListener('popstate', () => {
            navigateWithoutReload(window.location.href, false);
        });
    }

    /* ---------- BIND PAGE ELEMENTS ---------- */
    function bindPageElements() {
        initStartMenu();
        applyTheme();
        updateAudioIcons();
        updateClock();
        updateVisitorCounter();
        initWindowControls();
        bindHomeCDWidgetEvents();

        const themeSwitchEl = document.querySelector('.theme-switch');
        if (themeSwitchEl && !themeSwitchEl.dataset.themeBound) {
            themeSwitchEl.dataset.themeBound = 'true';
            themeSwitchEl.addEventListener('click', () => {
                window.debbyOS_cycleTheme();
            });
        }

        document.querySelectorAll('.audio-icon').forEach(el => {
            if (el.dataset.audioBound) return;
            el.dataset.audioBound = 'true';
            el.style.cursor = 'pointer';
            el.title = 'click to toggle sound';
            el.addEventListener('click', () => {
                window.debbyOS_setAudio(!audioEnabled);
            });
        });

        const audioBtn = document.getElementById('audio-toggle-btn');
        if (audioBtn && !audioBtn.dataset.audioBound) {
            audioBtn.dataset.audioBound = 'true';
            audioBtn.addEventListener('click', () => {
                window.debbyOS_setAudio(!audioEnabled);
            });
        }
    }

    function init() {
        cdAudio.muted = !audioEnabled;
        restoreCDState();
        bindPageElements();
        initSeamlessNavigation();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();