// fx.ts
// 打击感特效：黑白粒子与抖屏（短属性名以压缩体积）

const COLORS = ['#ffffff', '#111111'];

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    // 已存活时长 / 总时长
    t: number;
    d: number;
    // 边长 / 颜色索引（0 白 1 黑）
    s: number;
    c: number;
}

class Fx {
    private particles: Particle[] = [];
    // 抖屏剩余时长
    private shake: number = 0;

    // 爆发粒子：w 为真时全白，否则黑白相间
    burst(x: number, y: number, n: number, sp: number, w: boolean): void {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283;
            const v = sp * (0.4 + Math.random() * 0.6);
            this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, d: 0.25 + Math.random() * 0.2, s: 3 + Math.random() * 4, c: w || i & 1 ? 0 : 1 });
        }
        // 粒子上限，防止堆积
        if (this.particles.length > 150) {
            this.particles.splice(0, this.particles.length - 150);
        }
    }

    // 触发抖屏
    shakeScreen(): void {
        this.shake = 0.2;
    }

    update(e: number): void {
        for (const p of this.particles) {
            p.t += e;
            p.x += p.vx * e;
            p.y += p.vy * e;
        }
        this.particles = this.particles.filter(p => p.t < p.d);
        if (this.shake > 0) {
            this.shake -= e;
        }
    }

    // 应用抖屏偏移（须在画布裁剪之后调用，避免露出视口边缘）
    applyShake(ctx: CanvasRenderingContext2D): void {
        if (this.shake > 0) {
            const k = this.shake * 25;
            ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        for (const p of this.particles) {
            const s = p.s * (1 - p.t / p.d);
            ctx.fillStyle = COLORS[p.c];
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
    }
}

const fx = new Fx();
export { fx };
