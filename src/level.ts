// level.ts
// 管理世界滚动并绘制地面

import { VIEW_WIDTH, VIEW_HEIGHT } from './view';
import { cityScenery } from './scenery';
import { GROUND_Y } from './player';

// 地面滚动速度
export const GROUND_SCROLL_SPEED = 420;
// 地面刻度间距
const GROUND_TICK_SPACING = 60;

export const skyStatus = { color: '#2b2b2b', rainbow: false };

const RAINBOW_COLORS = ['#ff5a5a', '#ff9a3c', '#f5d948', '#7fce62', '#5ab7f0', '#7a6ff0', '#b45af0'];
const RAINBOW_STRIPE_HEIGHT = 14;
const RAINBOW_TOP = 40;

class GameLevel {
    groundY : number = GROUND_Y;

    worldScroll : number = 0;

    constructor() {
    }

    update(elapsedTime: number) {
        this.worldScroll += elapsedTime * GROUND_SCROLL_SPEED;
    }

    render(context: CanvasRenderingContext2D) {
        if (skyStatus.rainbow) {
            for (let i = 0; i < RAINBOW_COLORS.length; i++) {
                context.fillStyle = RAINBOW_COLORS[i];
                context.fillRect(0, RAINBOW_TOP + i * RAINBOW_STRIPE_HEIGHT, VIEW_WIDTH, RAINBOW_STRIPE_HEIGHT);
            }
        }

        // 背景景观
        cityScenery.render(context, this.worldScroll, this.groundY);

        // 黑色地面
        context.fillStyle = '#1a1a1a';
        context.fillRect(0, this.groundY, VIEW_WIDTH, VIEW_HEIGHT - this.groundY);

        // 地面滚动刻度
        context.fillStyle = '#3d3d3d';
        const groundOffset = this.worldScroll % GROUND_TICK_SPACING;
        for (let x = 0; x < VIEW_WIDTH; x += GROUND_TICK_SPACING) {
            context.fillRect(x - groundOffset, this.groundY + 14, 4, 12);
        }
    }
}

const gameLevel = new GameLevel();
export { gameLevel };
