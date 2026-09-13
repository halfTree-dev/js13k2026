// fx.ts
// 打击感特效：黑白粒子、敌怪环境粒子与抖屏（短属性名以压缩体积）

const WHITE = '#ffffff';
const BLACK = '#111111';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    // 已存活时长 / 总时长
    t: number;
    d: number;
    // 边长 / 颜色
    s: number;
    c: string;
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
            this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, d: 0.25 + Math.random() * 0.2, s: 3 + Math.random() * 4, c: w || i & 1 ? WHITE : BLACK });
        }
        // 粒子上限，防止堆积
        if (this.particles.length > 150) {
            this.particles.splice(0, this.particles.length - 150);
        }
    }

    // 环境粒子：单枚自定义颜色，自敌怪躯体向上轻飘
    emit(x: number, y: number, c: string): void {
        if (this.particles.length > 150) {
            return;
        }
        this.particles.push({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, t: 0, d: 0.4 + Math.random() * 0.3, s: 2 + Math.random() * 3, c });
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
            const k = this.shake * 36;
            ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        for (const p of this.particles) {
            const s = p.s * (1 - p.t / p.d);
            ctx.fillStyle = p.c;
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
    }
}

const fx = new Fx();
export { fx };
