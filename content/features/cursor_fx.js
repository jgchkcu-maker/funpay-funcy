class CursorFX {
    constructor() {
        this.canvas = createElement('canvas', { id: 'fp-tools-cursor-fx' });
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: false, alpha: true });
        this.config = {};
        this.particles = [];
        this.hue = 0;
        this.mouse = { x: -100, y: -100 };
        this.animationFrame = null;
        this.isEnabled = false;
        this.customCursor = null;
        this.customCursorConfig = {};
        this._customCursorActive = false;
        this.cursorHideStyleTag = null;
        this.maxParticles = 120; // 2.8: reduced for GPU perf (review #5)
        this._lastMouseTime = 0;

        this.init();
    }

    init() {
        Object.assign(this.canvas.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100vw', height: '100vh',
            pointerEvents: 'none', zIndex: '999999'
        });
        document.body.appendChild(this.canvas);
        
        this.customCursor = createElement('div', { id: 'fp-tools-custom-cursor' });
        Object.assign(this.customCursor.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '9999999',
            left: '0px',
            top: '0px',
            display: 'none',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center'
        });
        document.body.appendChild(this.customCursor);

        this.cursorHideStyleTag = createElement('style', { id: 'fp-tools-cursor-hide-style' });
        document.head.appendChild(this.cursorHideStyleTag);

        window.addEventListener('resize', this.resize.bind(this));
        this.resize();

        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;

            // PERF: only touch the custom-cursor element when it's actually enabled.
            // Previously this wrote a transform on EVERY mousemove even with the feature
            // off (display:none), causing constant layout/style work and visible lag.
            if (this._customCursorActive) {
                this.customCursor.style.transform = `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;
            }

            // Only spawn cursor-fx particles when that effect is enabled.
            if (this.isEnabled) {
                const now = performance.now();
                if (now - this._lastMouseTime >= 16) {
                    this._lastMouseTime = now;
                    this.createParticle();
                }
            }
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    updateCustomCursor(newConfig) {
        this.customCursorConfig = { ...this.customCursorConfig, ...newConfig };
        
        if (this.customCursorConfig.enabled && this.customCursorConfig.image) {
            this._customCursorActive = true;
            this.customCursor.style.display = 'block';
            
            if (this.customCursorConfig.hideSystem) {
                this.cursorHideStyleTag.textContent = `* { cursor: none !important; }`;
            } else {
                this.cursorHideStyleTag.textContent = '';
            }
            
            this.customCursor.style.backgroundImage = `url(${this.customCursorConfig.image})`;
            this.customCursor.style.width = `${this.customCursorConfig.size}px`;
            this.customCursor.style.height = `${this.customCursorConfig.size}px`;
            this.customCursor.style.opacity = this.customCursorConfig.opacity / 100;
            // place it under the current pointer immediately so it doesn't jump from 0,0
            this.customCursor.style.transform = `translate(calc(${this.mouse.x}px - 50%), calc(${this.mouse.y}px - 50%))`;
        } else {
            this._customCursorActive = false;
            this.customCursor.style.display = 'none';
            this.cursorHideStyleTag.textContent = '';
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.config.enabled && !this.isEnabled) {
            this.start();
        } else if (!this.config.enabled && this.isEnabled) {
            this.stop();
        }
    }

    start() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        // Не запускаем animate() сразу, он запустится при первом движении мыши
    }

    stop() {
        if (!this.isEnabled) return;
        this.isEnabled = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        // Очищаем холст через некоторое время, чтобы частицы успели исчезнуть
        setTimeout(() => this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height), 200);
    }
    
    spawnSingleParticle() {
        if (this.particles.length >= this.maxParticles) {
            return;
        }
        
        const p = {
            x: this.mouse.x, y: this.mouse.y,
            life: Math.random() * 40 + 40,
        };

        const hexToRgb = hex => hex.match(/\w\w/g).map(x => parseInt(x, 16));

        switch(this.config.type) {
            case 'trail': p.vx = 0; p.vy = 0; p.size = Math.random() * 3 + 2; break;
            case 'snow': p.vx = Math.random() * 2 - 1; p.vy = Math.random() * 1 + 0.5; p.size = Math.random() * 2 + 1; break;
            case 'blood': p.vx = Math.random() * 2 - 1; p.vy = Math.random() * 1 - 2; p.gravity = 0.15; p.size = Math.random() * 4 + 2; break;
            default: const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 3 + 1; p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed; p.size = Math.random() * 2 + 1; break;
        }

        if (this.config.rgb) {
            p.color = `hsl(${this.hue}, 100%, 70%)`;
            if (this.config.type === 'snow') p.color = `hsla(${this.hue}, 100%, 90%, ${Math.random() * 0.5 + 0.3})`;
        } else {
            const t = Math.random();
            const c1 = hexToRgb(this.config.color1);
            const c2 = hexToRgb(this.config.color2);
            const r = Math.round(c1[0] * (1 - t) + c2[0] * t);
            const g = Math.round(c1[1] * (1 - t) + c2[1] * t);
            const b = Math.round(c1[2] * (1 - t) + c2[2] * t);
            p.color = `rgb(${r},${g},${b})`;
            if (this.config.type === 'snow') p.color = `rgba(255,255,255,${Math.random() * 0.5 + 0.3})`;
        }
        this.particles.push(p);
    }

    createParticle() {
        // Если анимация неактивна, запускаем ее
        if (!this.animationFrame && this.isEnabled) {
            this.animate();
        }

        const count = (this.config.count / 100) * 5;
        const numToSpawn = Math.floor(count) + (Math.random() < (count % 1) ? 1 : 0);

        for(let i = 0; i < numToSpawn; i++) {
            this.spawnSingleParticle();
        }
    }

    animate() {
        if (!this.isEnabled) {
            this.animationFrame = null;
            return;
        }

        // Очищаем только если есть частицы, чтобы не нагружать впустую
        if (this.particles.length > 0) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.hue = (this.hue + 1) % 360;

        // Создаем частицы при движении мыши (уже делается в mousemove

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life--;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            p.x += p.vx; p.y += p.vy;
            if (p.gravity) p.vy += p.gravity;

            this.ctx.globalAlpha = p.life / 35;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;

        // Если частиц больше нет, останавливаем цикл анимации
        if (this.particles.length === 0) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Финальная очистка
            this.animationFrame = null;
            return;
        }

        this.animationFrame = requestAnimationFrame(this.animate.bind(this));
    }
}
const cursorFx = new CursorFX();

// Runtime initialization is independent of popup views.
chrome.storage.local.get(['fpToolsCursorFx', 'fpToolsCustomCursor']).then(settings => {
    cursorFx.updateConfig(settings.fpToolsCursorFx || {});
    cursorFx.updateCustomCursor(settings.fpToolsCustomCursor || {});
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.fpToolsCursorFx) cursorFx.updateConfig(changes.fpToolsCursorFx.newValue || { enabled: false });
    if (changes.fpToolsCustomCursor) cursorFx.updateCustomCursor(changes.fpToolsCustomCursor.newValue || { enabled: false });
});
