import { VIEW_WIDTH, VIEW_HEIGHT } from './main';
import { cityScenery } from './scenery';
import { GROUND_Y } from './player';

// 地面滚动速度
const GROUND_SCROLL_SPEED = 420;
// 地面刻度间距
const GROUND_TICK_SPACING = 60;

class GameLevel {
    groundY : number = GROUND_Y;

    worldScroll : number = 0;

    constructor() {
    }

    update(elapsedTime: number) {
        // 世界滚动
        this.worldScroll += elapsedTime * GROUND_SCROLL_SPEED;
    }

    render(context: CanvasRenderingContext2D) {
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
