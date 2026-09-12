// scenery.ts
// 管理背景元素

import { VIEW_WIDTH } from './view';
import { Sprite, drawSprite, CITY_FAR_SKYLINE, CITY_MID_FAR_SKYLINE, CITY_VIADUCT,
    PROP_BILLBOARD, PROP_TRAFFIC_SIGN, PROP_STREET_LAMP, PROP_TRAFFIC_CONE,
    PROP_TAXI, PROP_BARRIER, PROP_POPLAR, PROP_BUSH, PROP_BIKE,
    PROP_UTILITY_POLE, PROP_TRASH_BINS,
    PROP_PALETTE_RED, PROP_PALETTE_ORANGE, PROP_PALETTE_YELLOW, PROP_PALETTE_GREEN, PROP_PALETTE_BLUE } from './sprite';

// 滚动系数
const FAR_SCROLL_FACTOR = 0.05;
const MID_FAR_SCROLL_FACTOR = 0.08;
const MID_SCROLL_FACTOR = 0.20;
const NEAR_SCROLL_FACTOR = 0.45;

// 远景平铺宽度
const FAR_TILE_WIDTH = 1280;

// 中远景纵向拉伸倍率与相位差
const MID_FAR_SCALE_Y = 1.3;
const MID_FAR_PHASE = 640;

// 中景高架桥
const MID_VIADUCT_WIDTH = 185;

// 近景
const NEAR_SPAWN_MARGIN = 720;

interface NearProp {
    sprite: Sprite;
    spacing: number;
    scale: number;
    palette: string[];
}

// 已恢复颜色的色板组（按数组引用比较）
const restoredPalettes = new Set<string[]>();

// 恢复指定色板组的近景颜色（阶段完成时调用）
function restorePropPalette(palette: string[]): void {
    restoredPalettes.add(palette);
}

function tinted(sprite: Sprite, palette: string[]): Sprite {
    return restoredPalettes.has(palette) ? { ...sprite, palette } : sprite;
}

const NEAR_PROPS: NearProp[] = [
    { sprite: PROP_BILLBOARD, spacing: 480, scale: 0.65, palette: PROP_PALETTE_RED },
    { sprite: PROP_TRAFFIC_SIGN, spacing: 150, scale: 0.65, palette: PROP_PALETTE_RED },
    { sprite: PROP_STREET_LAMP, spacing: 260, scale: 0.65, palette: PROP_PALETTE_ORANGE },
    { sprite: PROP_TRAFFIC_CONE, spacing: 120, scale: 0.65, palette: PROP_PALETTE_ORANGE },
    { sprite: PROP_UTILITY_POLE, spacing: 300, scale: 0.65, palette: PROP_PALETTE_ORANGE },
    { sprite: PROP_TAXI, spacing: 330, scale: 0.65, palette: PROP_PALETTE_YELLOW },
    { sprite: PROP_BARRIER, spacing: 300, scale: 0.65, palette: PROP_PALETTE_YELLOW },
    { sprite: PROP_POPLAR, spacing: 240, scale: 0.65, palette: PROP_PALETTE_GREEN },
    { sprite: PROP_BUSH, spacing: 240, scale: 0.65, palette: PROP_PALETTE_GREEN },
    { sprite: PROP_TRASH_BINS, spacing: 200, scale: 0.65, palette: PROP_PALETTE_GREEN },
    { sprite: PROP_BIKE, spacing: 140, scale: 0.65, palette: PROP_PALETTE_BLUE },
];

class NearScenery {
    private propPlaced: { x: number; right: number; sprite: Sprite; scale: number; flip: boolean }[] = [];
    private propPlaceCursor = 250;

    render(context: CanvasRenderingContext2D, worldScroll: number, baseY: number): void {
        const scroll = worldScroll * NEAR_SCROLL_FACTOR;

        // 放置新资产
        while (this.propPlaceCursor < scroll + VIEW_WIDTH + NEAR_SPAWN_MARGIN) {
            let index = Math.floor(Math.random() * NEAR_PROPS.length);
            const prop = NEAR_PROPS[index];
            const scale = prop.scale * (0.85 + Math.random() * 0.2);
            this.propPlaced.push({
                x: this.propPlaceCursor + (prop.spacing * prop.scale) / 2,
                right: this.propPlaceCursor + prop.spacing,
                sprite: tinted(prop.sprite, prop.palette),
                scale,
                flip: Math.random() < 0.5,
            });
            this.propPlaceCursor += prop.spacing;
        }

        // 回收资产
        for (let i = this.propPlaced.length - 1; i >= 0; i--) {
            const item = this.propPlaced[i];
            if (item.right < scroll - 100) {
                this.propPlaced.splice(i, 1);
                continue;
            }
            drawSprite(context, item.sprite, item.x - scroll, baseY, item.scale, item.scale, item.flip);
        }
    }
}
const nearScenery = new NearScenery();

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

        // 近景连续街景
        nearScenery.render(context, worldScroll, baseY);
    }
}

const cityScenery = new CityScenery();
export { cityScenery, restorePropPalette, restoredPalettes };
