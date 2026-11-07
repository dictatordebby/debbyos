/* debbyOS shared behaviors
   - theme persistence (plum / matcha / midnight) across every page
   - audio toggle with subtle WebAudio "mechanical" clicks
   - live taskbar clock
   - global visitor counter (Supabase REST + localStorage fallback)
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

    const THEME_LABELS = {
        plum: 'pastel star 🌸',
        matcha: 'matcha sage 🍵',
        midnight: 'midnight blue 🌙'
    };

    /* ---------- THEME ---------- */
    function applyTheme() {
        const theme = localStorage.getItem(THEME_KEY) || 'plum';
        document.body.classList.remove('matcha-sage', 'midnight-blue');
        if (theme === 'matcha') document.body.classList.add('matcha-sage');
        else if (theme === 'midnight') document.body.classList.add('midnight-blue');

        const indicator = document.querySelector('.theme-switch');
        if (indicator) indicator.textContent = THEME_LABELS[theme] || THEME_LABELS.plum;
    }

    window.debbyOS_setTheme = function (theme) {
        localStorage.setItem(THEME_KEY, theme);
        applyTheme();
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
            'button, a.nav-item, a.win-btn, .game-btn, .choice-btn, .setting-btn, .mini-btn, .tab-pill, .start-btn, .task-pill, .clear-link, .submit-btn'
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

        /* Try Supabase REST API first */
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

        /* Fallback to localStorage if Supabase SQL hasn't been run yet */
        let localCount = parseInt(localStorage.getItem(LOCAL_COUNT_KEY) || '104', 10);
        if (!alreadyCountedThisSession) {
            localCount += 1;
            localStorage.setItem(LOCAL_COUNT_KEY, String(localCount));
            sessionStorage.setItem(SESSION_VISIT_KEY, 'true');
        }
        renderVisitorCount(localCount);
    }

    /* ---------- INIT ---------- */
    function init() {
        applyTheme();
        updateAudioIcons();
        updateClock();
        updateVisitorCounter();

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