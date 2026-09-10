import { gameLevel } from './level';
import { entityManager } from './entity';
import { projectileManager } from './projectile';
import { inputManager } from './input';

// 虚拟画布尺寸
const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 800;
const LETTERBOX_COLOR = '#1a1a1a';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const context = canvas.getContext('2d')!;

// 虚拟画布到实际画布的等比缩放系数与居中偏移
let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;

// 上次适配画布时的窗口尺寸与像素比，用于检测变化
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
    // 设置画布品质
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // 设置缩放取值
    viewScale = Math.min(canvas.width / VIEW_WIDTH, canvas.height / VIEW_HEIGHT);
    viewOffsetX = (canvas.width - VIEW_WIDTH * viewScale) / 2;
    viewOffsetY = (canvas.height - VIEW_HEIGHT * viewScale) / 2;
}
fitCanvasToWindow();
addEventListener('resize', fitCanvasToWindow);

let lastTime = performance.now();
function frame(nowTime: number): void {
    // 重新适配
    if (innerWidth !== lastFitWidth || innerHeight !== lastFitHeight || devicePixelRatio !== lastFitRatio) {
        fitCanvasToWindow();
    }

    const deltaTime = Math.min(nowTime - lastTime, 100);
    lastTime = nowTime;

    gameUpdate(deltaTime / 1000);
    gameRender();

    requestAnimationFrame(frame);
}

function gameUpdate(elapsedTime: number): void {
    gameLevel.update(elapsedTime);
    // 敌怪更新在玩家之后、弹幕之前，保证友方弹幕对最新敌怪位置判定
    entityManager.update(elapsedTime);
    projectileManager.update(elapsedTime);
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

    context.fillStyle = '#2b2b2b';
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    gameLevel.render(context);

    // 敌怪绘制在玩家之上，弹幕最上
    entityManager.render(context);
    projectileManager.render(context);

    context.restore();
}

requestAnimationFrame(frame);

export { VIEW_WIDTH, VIEW_HEIGHT, LETTERBOX_COLOR }
