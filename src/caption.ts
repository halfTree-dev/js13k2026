// caption.ts
// 浮字和闪屏管理器

import { VIEW_WIDTH, VIEW_HEIGHT } from './view';

export const CAPTION_TOP_CENTER = { x: 640, y: 200 };
export const CAPTION_MID_TOP = { x: 640, y: 340 };
export const CAPTION_MID_BOTTOM = { x: 640, y: 470 };
export const CAPTION_LEFT_THIRD = { x: 250, y: 400 };
export const CAPTION_RIGHT_THIRD = { x: 1030, y: 400 };

export const CAPTION_ABOVE_HP = { x: 200, y: 716 };
export const CAPTION_ABOVE_COLOR = { x: 1108, y: 726 };

export function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, alpha = 1, size = 28): void {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.font = `bold ${size}px Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const lines = text.split('\n');
    const lineHeight = size * 1.4;
    const top = y - ((lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, top + i * lineHeight);
    }
    context.restore();
}

// 浮字条目
interface Caption {
    text: string;
    x: number;
    y: number;
    color: string;
    size: number;
    fadeIn: number;
    hold: number;
    fadeOut: number;
    elapsed: number;
}

// 浮字生成配置
interface CaptionConfig {
    text: string;
    x: number;
    y: number;
    color?: string;
    size?: number;
    fadeIn?: number;
    hold?: number;
    fadeOut?: number;
}

// 定时浮字
class CaptionManager {
    private captions: Caption[] = [];

    // 添加浮字
    show(config: CaptionConfig): void {
        this.captions.push({
            text: config.text,
            x: config.x,
            y: config.y,
            color: config.color ?? '#fffdf0',
            size: config.size ?? 28,
            fadeIn: config.fadeIn ?? 0.5,
            hold: config.hold ?? 2,
            fadeOut: config.fadeOut ?? 0.5,
            elapsed: 0,
        });
    }

    // 清空浮字
    clear(): void {
        this.captions.length = 0;
    }

    update(elapsedTime: number): void {
        for (let i = this.captions.length - 1; i >= 0; i--) {
            const caption = this.captions[i];
            caption.elapsed += elapsedTime;
            if (caption.elapsed >= caption.fadeIn + caption.hold + caption.fadeOut) {
                this.captions.splice(i, 1);
            }
        }
    }

    render(context: CanvasRenderingContext2D): void {
        for (const caption of this.captions) {
            let alpha = 1;
            if (caption.elapsed < caption.fadeIn) {
                alpha = caption.elapsed / caption.fadeIn;
            } else if (caption.elapsed > caption.fadeIn + caption.hold) {
                alpha = 1 - (caption.elapsed - caption.fadeIn - caption.hold) / caption.fadeOut;
            }
            drawText(context, caption.text, caption.x, caption.y, caption.color, alpha, caption.size);
        }
    }
}

const captionManager = new CaptionManager();
export { captionManager };
export type { CaptionConfig };

// 全屏闪光
class ScreenFlash {
    private timer: number = 0;
    private duration: number = 0;
    private color: string = '#ffffff';

    trigger(duration: number = 0.35, color: string = '#ffffff'): void {
        this.duration = duration;
        this.timer = duration;
        this.color = color;
    }

    update(elapsedTime: number): void {
        this.timer = Math.max(0, this.timer - elapsedTime);
    }

    render(context: CanvasRenderingContext2D): void {
        if (this.timer <= 0) {
            return;
        }
        context.save();
        context.globalAlpha = this.timer / this.duration;
        context.fillStyle = this.color;
        context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
        context.restore();
    }
}

const screenFlash = new ScreenFlash();
export { screenFlash };
