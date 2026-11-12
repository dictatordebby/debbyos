/* debbyOS shared behaviors
   - boot-up splash screen (#edbedc + spinning ⚝ + audio/boot.mp3 + skip button, once per session)
   - global persistent CD player (8 MP3s across all pages via sessionStorage + taskbar mini-player)
   - theme persistence (plum / matcha / midnight) + clickable .theme-switch cycler
   - audio toggle with subtle WebAudio "mechanical" clicks
   - live taskbar clock
   - global visitor counter (Supabase REST + localStorage fallback)
   - interactive window controls (_ minimize, □ maximize, × close/restore)
   - ⭐ start menu popup
*/
(function () {
    'use strict';

    const THEME_KEY = 'debbyOS_theme';
    const AUDIO_KEY = 'debbyOS_audio';
    const SESSION_VISIT_KEY = 'debbyOS_visited_session';
    const SESSION_BOOT_KEY = 'debbyOS_boot_shown';
    const LOCAL_COUNT_KEY = 'debbyOS_local_visitor_count';
    const BOOT_AUDIO_SRC = 'audio/boot.mp3';

    /* Bumped key to v2 so any old 1/3 session cache is wiped automatically */
    const CD_STATE_KEY = 'debbyOS_cd_state_v2';

    /* Global 8-Track Playlist */
    const CD_TRACKS = [
        {
            title: "didn't we almost have it all",
            artist: "whitney houston",
            src: "audio/didnt-we-almost-have-it-all.mp3",
            query: "whitney+houston+didnt+we+almost+have+it+all"
        },
        {
            title: "ryuusei",
            artist: "tia",
            src: "audio/ryuusei.mp3",
            query: "tia+ryuusei"
        },
        {
            title: "two worlds collide",
            artist: "demi lovato",
            src: "audio/two-worlds-collide.mp3",
            query: "demi+lovato+two+worlds+collide"
        },
        {
            title: "tuning",
            artist: "yseult",
            src: "audio/tuning.mp3",
            query: "yseult+tuning"
        },
        {
            title: "still into you",
            artist: "paramore",
            src: "audio/still-into-you.mp3",
            query: "paramore+still+into+you"
        },
        {
            title: "the way",
            artist: "ariana grande",
            src: "audio/the-way.mp3",
            query: "ariana+grande+the+way"
        },
        {
            title: "try sleeping with a broken heart",
            artist: "alicia keys",
            src: "audio/try-sleeping.mp3",
            query: "alicia+keys+try+sleeping+with+a+broken+heart"
        },
        {
            title: "always come back to your love",
            artist: "samantha mumba",
            src: "audio/always-come-back.mp3",
            query: "samantha+mumba+always+come+back+to+your+love"
        }
    ];

    /* Supabase credentials */
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
        'star-sweeper.html',
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

    /* ---------- AUDIO & MECHANICAL CLICKS ---------- */
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
        } catch (e) {}
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

        if (cdAudio) {
            cdAudio.muted = !audioEnabled;
        }
    }

    window.debbyOS_setAudio = function (on) {
        audioEnabled = !!on;
        localStorage.setItem(AUDIO_KEY, audioEnabled ? 'on' : 'off');
        updateAudioIcons();
        beep(1200, 0.08, 0.04);
    };

    window.debbyOS_isAudioEnabled = function () { return audioEnabled; };

    document.addEventListener('click', function (e) {
        const target = e.target.closest(
            'button, a.nav-item, a.win-btn, .game-btn, .choice-btn, .setting-btn, .mini-btn, .tab-pill, .start-btn, .task-pill, .clear-link, .submit-btn, .start-menu-link, .start-Quick-btn, .theme-switch, .win-controls span'
        );
        if (target) beep(880, 0.05, 0.018);
    }, true);

    /* ---------- GLOBAL PERSISTENT CD PLAYER ---------- */
    let currentTrackIdx = 0;
    const cdAudio = new Audio();
    cdAudio.preload = 'metadata';
    cdAudio.muted = !audioEnabled;

    function formatSec(sec) {
        if (!sec || isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function isCDActuallyPlaying() {
        return Boolean(cdAudio && !cdAudio.paused && !cdAudio.ended && cdAudio.readyState > 0);
    }

    function saveCDState() {
        try {
            sessionStorage.setItem(CD_STATE_KEY, JSON.stringify({
                idx: currentTrackIdx,
                time: cdAudio.currentTime || 0,
                playing: isCDActuallyPlaying()
            }));
        } catch (e) {}
    }

    function loadCDState() {
        try {
            const raw = sessionStorage.getItem(CD_STATE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function renderAllCDWidgets() {
        const track = CD_TRACKS[currentTrackIdx] || CD_TRACKS[0];
        const playing = isCDActuallyPlaying();
        const statusString = playing
            ? `now playing · track ${currentTrackIdx + 1}/${CD_TRACKS.length}`
            : `paused · track ${currentTrackIdx + 1}/${CD_TRACKS.length}`;

        /* Update Home Page Widget (supports both old & new HTML IDs!) */
        const titleEl = document.getElementById('cd-track-title');
        const artistEl = document.getElementById('cd-track-artist');
        const statusTextEl = document.getElementById('cd-status-text');
        const statusLabelEl = document.getElementById('cd-status-label');
        const playBtn = document.getElementById('cd-play-btn');
        const discEl = document.getElementById('cd-disc');
        const selectEl = document.getElementById('cd-track-select');
        const ytLinkEl = document.getElementById('cd-yt-link');

        if (titleEl) titleEl.textContent = track.title;
        if (artistEl) artistEl.textContent = track.artist;

        /* Update whichever status ID exists in index.html */
        if (statusTextEl) {
            statusTextEl.textContent = statusString;
        } else if (statusLabelEl) {
            statusLabelEl.textContent = statusString;
        }

        if (playBtn) playBtn.textContent = playing ? '⏸ pause' : '▶ play';
        if (discEl) discEl.classList.toggle('spinning', playing);
        if (selectEl && selectEl.value !== String(currentTrackIdx)) {
            selectEl.value = String(currentTrackIdx);
        }
        if (ytLinkEl) {
            ytLinkEl.href = `https://www.youtube.com/results?search_query=${track.query}`;
        }

        /* Update Taskbar Mini-Player on Every Page */
        const miniDisc = document.getElementById('taskbar-cd-disc');
        const miniTitle = document.getElementById('taskbar-cd-title');
        const miniPlayBtn = document.getElementById('taskbar-cd-play');

        if (miniDisc) miniDisc.classList.toggle('spinning', playing);
        if (miniTitle) miniTitle.textContent = `${track.title} · ${track.artist}`;
        if (miniPlayBtn) miniPlayBtn.textContent = playing ? '⏸' : '▶';
    }

    function loadCDTrack(idx, shouldPlay, startTime) {
        currentTrackIdx = ((idx % CD_TRACKS.length) + CD_TRACKS.length) % CD_TRACKS.length;
        const track = CD_TRACKS[currentTrackIdx];
        cdAudio.src = track.src;

        const progressBar = document.getElementById('cd-progress-bar');
        const timeDisplay = document.getElementById('cd-time-display');
        if (progressBar) progressBar.style.width = '0%';
        if (timeDisplay) timeDisplay.textContent = '0:00 / 0:00';

        if (startTime && startTime > 0) {
            const setTimeOnce = () => {
                if (startTime < (cdAudio.duration || Infinity)) {
                    cdAudio.currentTime = startTime;
                }
                cdAudio.removeEventListener('loadedmetadata', setTimeOnce);
            };
            cdAudio.addEventListener('loadedmetadata', setTimeOnce);
        }

        renderAllCDWidgets();

        if (shouldPlay) {
            cdAudio.play().then(() => {
                renderAllCDWidgets();
                saveCDState();
            }).catch(() => {
                renderAllCDWidgets();
                const resumeOnFirstClick = () => {
                    cdAudio.play().then(() => {
                        renderAllCDWidgets();
                        saveCDState();
                    }).catch(() => {});
                    document.removeEventListener('click', resumeOnFirstClick);
                };
                document.addEventListener('click', resumeOnFirstClick, { once: true });
            });
        } else {
            renderAllCDWidgets();
            saveCDState();
        }
    }

    window.cdTogglePlay = function () {
        if (!cdAudio.src) {
            loadCDTrack(currentTrackIdx, true, 0);
            return;
        }
        if (cdAudio.paused) {
            cdAudio.play().then(() => {
                renderAllCDWidgets();
                saveCDState();
            }).catch(() => {
                const statusTextEl = document.getElementById('cd-status-text') || document.getElementById('cd-status-label');
                if (statusTextEl) statusTextEl.textContent = `missing: ${CD_TRACKS[currentTrackIdx].src}`;
            });
        } else {
            cdAudio.pause();
            renderAllCDWidgets();
            saveCDState();
        }
    };

    window.cdNextTrack = function () {
        const wasPlaying = isCDActuallyPlaying();
        loadCDTrack(currentTrackIdx + 1, wasPlaying, 0);
    };

    window.cdPrevTrack = function () {
        const wasPlaying = isCDActuallyPlaying();
        loadCDTrack(currentTrackIdx - 1, wasPlaying, 0);
    };

    window.cdJumpToTrack = function (val) {
        loadCDTrack(parseInt(val, 10) || 0, true, 0);
    };

    function initGlobalCDPlayer() {
        /* Inject Taskbar Mini-Player on every page */
        const taskbarRight = document.querySelector('.taskbar-right');
        if (taskbarRight && !document.getElementById('taskbar-cd-mini')) {
            const mini = document.createElement('div');
            mini.id = 'taskbar-cd-mini';
            mini.className = 'taskbar-cd-mini';
            mini.innerHTML = `
                <span class="taskbar-cd-disc" id="taskbar-cd-disc">💿</span>
                <span class="taskbar-cd-title" id="taskbar-cd-title">loading...</span>
                <button type="button" class="taskbar-cd-btn" onclick="cdPrevTrack()" title="previous song">⏮</button>
                <button type="button" class="taskbar-cd-btn" id="taskbar-cd-play" onclick="cdTogglePlay()" title="play / pause">▶</button>
                <button type="button" class="taskbar-cd-btn" onclick="cdNextTrack()" title="next song">⏭</button>
            `;
            taskbarRight.insertBefore(mini, taskbarRight.firstChild);
        }

        /* Populate track dropdown on index.html if present */
        const selectEl = document.getElementById('cd-track-select');
        if (selectEl) {
            selectEl.innerHTML = '';
            CD_TRACKS.forEach((t, idx) => {
                const opt = document.createElement('option');
                opt.value = String(idx);
                opt.textContent = `${idx + 1}. ${t.title}`;
                selectEl.appendChild(opt);
            });
        }

        /* Wire progress bar click-to-seek on index.html */
        const progressWrap = document.getElementById('cd-progress-wrap') || document.querySelector('.cd-progress-wrap');
        if (progressWrap) {
            progressWrap.style.cursor = 'pointer';
            progressWrap.addEventListener('click', (e) => {
                if (!cdAudio.duration || isNaN(cdAudio.duration)) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                cdAudio.currentTime = ratio * cdAudio.duration;
                saveCDState();
            });
        }

        /* Always sync UI when audio state changes */
        cdAudio.addEventListener('play', renderAllCDWidgets);
        cdAudio.addEventListener('playing', renderAllCDWidgets);
        cdAudio.addEventListener('pause', renderAllCDWidgets);

        cdAudio.addEventListener('timeupdate', () => {
            if (cdAudio.duration && !isNaN(cdAudio.duration)) {
                const pct = (cdAudio.currentTime / cdAudio.duration) * 100;
                const bar = document.getElementById('cd-progress-bar');
                const timeEl = document.getElementById('cd-time-display');
                if (bar) bar.style.width = `${pct}%`;
                if (timeEl) {
                    timeEl.textContent = `${formatSec(cdAudio.currentTime)} / ${formatSec(cdAudio.duration)}`;
                }
            }
            saveCDState();
        });

        cdAudio.addEventListener('loadedmetadata', () => {
            const timeEl = document.getElementById('cd-time-display');
            if (timeEl) {
                timeEl.textContent = `${formatSec(cdAudio.currentTime)} / ${formatSec(cdAudio.duration)}`;
            }
            renderAllCDWidgets();
        });

        cdAudio.addEventListener('ended', () => {
            loadCDTrack(currentTrackIdx + 1, true, 0);
        });

        window.addEventListener('beforeunload', saveCDState);
        window.addEventListener('pagehide', saveCDState);

        /* Restore state from previous page if available */
        const saved = loadCDState();
        if (saved && typeof saved.idx === 'number') {
            loadCDTrack(saved.idx, Boolean(saved.playing), Number(saved.time) || 0);
        } else {
            loadCDTrack(0, false, 0);
        }
    }

    /* ---------- BOOT-UP SPLASH SCREEN (#edbedc + ⚝ + boot.mp3) ---------- */
    function showBootSplash(forceShow) {
        if (!forceShow && sessionStorage.getItem(SESSION_BOOT_KEY) === 'true') {
            return;
        }
        sessionStorage.setItem(SESSION_BOOT_KEY, 'true');

        const existing = document.getElementById('debbyos-boot-splash');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'boot-splash-overlay';
        overlay.id = 'debbyos-boot-splash';
        overlay.innerHTML = `
            <div class="boot-star-icon" aria-hidden="true">⚝</div>
            <div class="boot-title">booting debbyos...</div>
            <div class="boot-status-text" id="boot-status-msg">loading pastel desktop & shaders ✨</div>
            <div class="boot-progress-track">
                <div class="boot-progress-fill" id="boot-progress-fill"></div>
            </div>
            <div class="boot-actions">
                <button type="button" class="boot-btn secondary" id="boot-sound-btn" style="display:none;">🔊 play boot sound</button>
                <button type="button" class="boot-btn" id="boot-skip-btn">skip ⏭</button>
            </div>
        `;
        document.body.appendChild(overlay);

        const fillEl = document.getElementById('boot-progress-fill');
        const statusEl = document.getElementById('boot-status-msg');
        const skipBtn = document.getElementById('boot-skip-btn');
        const soundBtn = document.getElementById('boot-sound-btn');

        const bootAudio = new Audio(BOOT_AUDIO_SRC);
        bootAudio.preload = 'auto';
        bootAudio.volume = 0.65;

        let closed = false;
        let fallbackTimer = null;
        let progressTimer = null;

        function closeBootSplash() {
            if (closed) return;
            closed = true;
            if (fallbackTimer) clearTimeout(fallbackTimer);
            if (progressTimer) clearInterval(progressTimer);
            try {
                bootAudio.pause();
                bootAudio.currentTime = 0;
            } catch (e) {}
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
            }, 480);
        }

        const startTime = Date.now();
        const fallbackDurationMs = 12800;

        progressTimer = setInterval(() => {
            if (closed) return;
            let pct = 0;
            if (bootAudio.duration && !isNaN(bootAudio.duration) && bootAudio.currentTime > 0) {
                pct = Math.min(100, (bootAudio.currentTime / bootAudio.duration) * 100);
            } else {
                pct = Math.min(100, ((Date.now() - startTime) / fallbackDurationMs) * 100);
            }
            if (fillEl) fillEl.style.width = `${pct}%`;

            if (pct > 70 && statusEl) {
                statusEl.textContent = 'initializing windows & games...';
            } else if (pct > 35 && statusEl) {
                statusEl.textContent = 'mounting star archives & audio...';
            }
        }, 100);

        bootAudio.addEventListener('ended', closeBootSplash);
        fallbackTimer = setTimeout(closeBootSplash, 13500);

        if (audioEnabled) {
            const playPromise = bootAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    if (soundBtn) soundBtn.style.display = 'inline-block';
                    if (statusEl) statusEl.textContent = 'click anywhere to hear boot music or press skip ✨';

                    const unlockAudio = (e) => {
                        if (e.target === skipBtn) return;
                        bootAudio.play().catch(() => {});
                        if (soundBtn) soundBtn.style.display = 'none';
                        if (statusEl) statusEl.textContent = 'loading pastel desktop & shaders ✨';
                        overlay.removeEventListener('click', unlockAudio);
                    };
                    overlay.addEventListener('click', unlockAudio);
                });
            }
        }

        if (soundBtn) {
            soundBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                bootAudio.play().catch(() => {});
                soundBtn.style.display = 'none';
            });
        }

        skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeBootSplash();
        });
    }

    window.debbyOS_replayBoot = function () {
        showBootSplash(true);
    };

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

        const taskbarRight = document.querySelector('.taskbar-right');
        if (taskbarRight) {
            let pill = document.getElementById('taskbar-visitor-pill');
            if (!pill) {
                pill = document.createElement('span');
                pill.id = 'taskbar-visitor-pill';
                pill.className = 'visitor-pill';
                pill.title = 'total site visitors';
                taskbarRight.appendChild(pill);
            }
            pill.textContent = `👁️ ${formatted}`;
        }

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
            } catch (err) {}
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

        startBtn.removeAttribute('onclick');

        const popup = document.createElement('div');
        popup.className = 'start-menu-popup';
        popup.id = 'debbyos-start-menu';
        popup.innerHTML = `
            <div class="start-menu-header">
                <span>⭐️ debbyos system menu</span>
                <span>v2.8</span>
            </div>
            <div class="start-menu-body">
                <a href="index.html" class="start-menu-link"><span>🏠 home desktop</span><span>→</span></a>
                <a href="games.html" class="start-menu-link"><span>🎮 games lobby</span><span>→</span></a>
                <a href="connections.html" class="start-menu-link"><span>🧩 connections</span><span>→</span></a>
                <a href="mystery.html" class="start-menu-link"><span>🕵️‍♀️ eight at l'ombre</span><span>→</span></a>
                <a href="star-sweeper.html" class="start-menu-link"><span>🪐 star sweeper</span><span>→</span></a>
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
                <button type="button" class="start-menu-link" id="start-replay-boot-btn">
                    <span>⚝ replay boot screen</span><span>♪</span>
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

        document.getElementById('start-replay-boot-btn').addEventListener('click', () => {
            popup.classList.remove('open');
            startBtn.classList.remove('active');
            window.debbyOS_replayBoot();
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
        showBootSplash(false);
        initStartMenu();
        initGlobalCDPlayer();
        applyTheme();
        updateAudioIcons();
        updateClock();
        updateVisitorCounter();
        initWindowControls();

        const themeSwitchEl = document.querySelector('.theme-switch');
        if (themeSwitchEl) {
            themeSwitchEl.addEventListener('click', () => {
                window.debbyOS_cycleTheme();
            });
        }

        document.querySelectorAll('.audio-icon').forEach(el => {
            el.style.cursor = 'pointer';
            el.title = 'click to toggle sound';
            el.addEventListener('click', () => {
                window.debbyOS_setAudio(!audioEnabled);
            });
        });

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