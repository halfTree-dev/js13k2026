import { VIEW_WIDTH } from './main';
import { Sprite, drawSprite, CITY_FAR_SKYLINE, CITY_MID_FAR_SKYLINE, CITY_VIADUCT } from './sprite';

// 滚动系数
const FAR_SCROLL_FACTOR = 0.05;
const MID_FAR_SCROLL_FACTOR = 0.08;
const MID_SCROLL_FACTOR = 0.20;

// 远景平铺宽度
const FAR_TILE_WIDTH = 1280;

// 中远景纵向拉伸倍率与相位差
const MID_FAR_SCALE_Y = 1.3;
const MID_FAR_PHASE = 640;

// 中景高架桥
const MID_VIADUCT_WIDTH = 185;

class CityScenery {
    render(context: CanvasRenderingContext2D, worldScroll: number, baseY: number): void {
        // 远景天际线剪影
        const farOffset = (worldScroll * FAR_SCROLL_FACTOR) % FAR_TILE_WIDTH;
        for (let x = -farOffset; x < VIEW_WIDTH; x += FAR_TILE_WIDTH) {
            drawSprite(context, CITY_FAR_SKYLINE, x, baseY, 1);
        }

        // 中远景
        const midFarOffset = (worldScroll * MID_FAR_SCROLL_FACTOR + MID_FAR_PHASE) % FAR_TILE_WIDTH;
        for (let x = -midFarOffset; x < VIEW_WIDTH; x += FAR_TILE_WIDTH) {
            drawSprite(context, CITY_MID_FAR_SKYLINE, x, baseY, 1, MID_FAR_SCALE_Y);
        }

        // 中景高架桥
        const midOffset = (worldScroll * MID_SCROLL_FACTOR) % MID_VIADUCT_WIDTH;
        for (let x = -midOffset; x < VIEW_WIDTH; x += MID_VIADUCT_WIDTH) {
            drawSprite(context, CITY_VIADUCT, x, baseY);
        }
    }
}

const cityScenery = new CityScenery();
export { cityScenery };
