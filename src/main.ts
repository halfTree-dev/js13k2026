// main.ts
// 游戏主入口

import { gameLevel, skyStatus } from './level';
import { player } from './player';
import { entityManager } from './entity';
import { projectileManager } from './projectile';
import { inputManager } from './input';
import { director } from './director';
import { fx } from './fx';
import { drawText } from './caption';
import { VIEW_WIDTH, VIEW_HEIGHT } from './view';

const LETTERBOX_COLOR = '#1a1a1a';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const context = canvas.getContext('2d')!;

// 虚拟画布到实际画布的等比缩放系数与居中偏移
let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;

// 上次适配画布时的窗口尺寸与像素比
let lastFitWidth = -1;
let lastFitHeight = -1;
let lastFitRatio = -1;

function fitCanvasToWindow(): void {
    const deviceRatio = devicePixelRatio || 1;
    lastFitWidth = innerWidth;
    lastFitHeight = innerHeight;
    lastFitRatio = deviceRatio;

    canvas.width = Math.round(innerWidth * deviceRatio);
    canvas.height = Math.round(innerHeight * deviceRatio);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    viewScale = Math.min(canvas.width / VIEW_WIDTH, canvas.height / VIEW_HEIGHT);
    viewOffsetX = (canvas.width - VIEW_WIDTH * viewScale) / 2;
    viewOffsetY = (canvas.height - VIEW_HEIGHT * viewScale) / 2;
}
fitCanvasToWindow();
addEventListener('resize', fitCanvasToWindow);

function screenToView(clientX: number, clientY: number): { x: number; y: number } {
    const deviceRatio = devicePixelRatio || 1;
    return {
        x: (clientX * deviceRatio - viewOffsetX) / viewScale,
        y: (clientY * deviceRatio - viewOffsetY) / viewScale,
    };
}

// Blank Check 引导标记
let bootMarkTime = 0.2;

// 游戏计时器（秒）：自正式开始（标题画面首次输入）起累计，
// 关卡切换、死亡复活均不清零，死亡冻结期间照常流逝
let gameTimerSeconds = 0;

let lastTime = performance.now();
function frame(nowTime: number): void {
    // 重新适配
    if (innerWidth !== lastFitWidth || innerHeight !== lastFitHeight || devicePixelRatio !== lastFitRatio) {
        fitCanvasToWindow();
    }

    const deltaTime = Math.min(nowTime - lastTime, 100);
    lastTime = nowTime;

    const elapsedTime = deltaTime / 1000;
    if (bootMarkTime > 0) {
        bootMarkTime -= elapsedTime;
    }
    if (director.hudVisible) {
        gameTimerSeconds += elapsedTime;
    }

    gameUpdate(elapsedTime);
    gameRender();

    requestAnimationFrame(frame);
}

function gameUpdate(elapsedTime: number): void {
    director.update(elapsedTime);
    // 死亡序列期间冻结世界
    if (!director.worldFrozen) {
        gameLevel.update(elapsedTime);
        player.update(elapsedTime, director.hudVisible);
        entityManager.update(elapsedTime);
        projectileManager.update(elapsedTime);
        fx.update(elapsedTime);
    }
    inputManager.endFrame();
}

function gameRender(): void {
    // 填充画布黑边
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = LETTERBOX_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    // 这个线性变换令以下变换成立：
    // x' = viewScale · x + viewOffsetX
    // y' = viewScale · y + viewOffsetY
    // 所以 1280 * 800 的区域现在映射到绘制区域
    context.setTransform(viewScale, 0, 0, viewScale, viewOffsetX, viewOffsetY);
    context.beginPath();
    context.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    context.clip();
    // 抖屏偏移（裁剪后应用，避免露出视口边缘）
    fx.applyShake(context);

    context.fillStyle = skyStatus.color;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    gameLevel.render(context);
    entityManager.renderBack(context);
    player.render(context);
    entityManager.renderFront(context);
    projectileManager.render(context);
    fx.render(context);

    if (director.hudVisible) {
        player.renderUI(context);
        const timerMinutes = Math.floor(gameTimerSeconds / 60);
        const timerSeconds = Math.floor(gameTimerSeconds % 60);
        drawText(context, `${timerMinutes}:${String(timerSeconds).padStart(2, '0')}`, VIEW_WIDTH / 2, 48, '#fffdf0', 1, 24);
    }
    director.render(context);

    // 该死，为什么要有 Blank Check？
    if (bootMarkTime > 0) {
        const centerX = VIEW_WIDTH / 2;
        const centerY = VIEW_HEIGHT / 2;
        context.fillStyle = '#888888';
        context.beginPath();
        context.moveTo(centerX, centerY - 100);
        context.lineTo(centerX + 87, centerY + 50);
        context.lineTo(centerX - 87, centerY + 50);
        context.closePath();
        context.fill();
    }

    context.restore();
}

requestAnimationFrame(frame);

export { LETTERBOX_COLOR, screenToView }
