// Shared by the early theme loader, the live site and the draft preview.
(function (root) {
    'use strict';
    const motion = root.matchMedia('(prefers-reduced-motion: reduce)');
    function createPlayer(video) {
        let source = '', enabled = false, failed = false;
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'none';
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.tabIndex = -1;
        video.style.display = 'none';
        const resume = () => {
            if (!source || !enabled || failed || motion.matches || document.hidden) {
                video.pause();
                if (!enabled || motion.matches || failed) video.style.display = 'none';
                return;
            }
            if (video.getAttribute('src') !== source) { video.src = source; video.load(); }
            if (video.paused) {
                const expected = source;
                video.play().catch(() => {
                    if (source === expected && video.paused) video.style.display = 'none';
                });
            }
        };
        video.addEventListener('playing', () => {
            if (enabled && !motion.matches && !failed) video.style.display = 'block';
        });
        video.addEventListener('error', () => { failed = true; video.style.display = 'none'; });
        document.addEventListener('visibilitychange', resume);
        motion.addEventListener('change', resume);
        return {
            update(url, active) {
                const next = root.FPTSafe.wallpaperVideoUrl(url);
                if (next !== source) {
                    source = next; failed = false;
                    video.pause(); video.removeAttribute('src'); video.load();
                    video.style.display = 'none';
                }
                enabled = !!active;
                resume();
            },
            dispose() {
                enabled = false; source = '';
                video.pause(); video.removeAttribute('src'); video.load();
                document.removeEventListener('visibilitychange', resume);
                motion.removeEventListener('change', resume);
            }
        };
    }
    let live = null, pending = null, waiting = false;
    function apply(settings, enabled) {
        pending = { settings, enabled };
        if (!document.body) {
            if (!waiting) {
                waiting = true;
                document.addEventListener('DOMContentLoaded', () => {
                    waiting = false;
                    apply(pending.settings, pending.enabled);
                }, { once: true });
            }
            return;
        }
        const url = enabled && settings.baseStyle !== 'original' ? root.FPTSafe.wallpaperVideoUrl(settings.bgVideo) : '';
        if (!url) {
            if (live) { live.player.dispose(); live.video.remove(); live = null; }
            return;
        }
        if (!live) {
            const video = document.createElement('video');
            video.id = 'fp-tools-wallpaper-video';
            video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:-1;border-radius:0;visibility:visible;';
            const player = createPlayer(video);
            document.body.prepend(video);
            live = { video, player };
        }
        live.video.style.filter = `blur(${root.FPTSafe.cssNumber(settings.bgBlur, 0, 100, 0)}px) brightness(${root.FPTSafe.cssNumber(settings.bgBrightness, 0, 200, 100)}%)`;
        live.player.update(url, true);
    }
    root.FPTThemeVideo = Object.freeze({ createPlayer, apply });
})(window);
