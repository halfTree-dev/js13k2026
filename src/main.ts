import { drawSprite, UNICORN } from './sprite';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const context = canvas.getContext('2d')!;

function fitCanvasToWindow(): void {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
}
fitCanvasToWindow();
addEventListener('resize', fitCanvasToWindow);

let lastTime = performance.now();
function frame(nowTime: number): void {
    const deltaTime = Math.min(nowTime - lastTime, 100);
    lastTime = nowTime;
    gameUpdate(deltaTime / 1000);
    gameRender();
    requestAnimationFrame(frame);
}

function gameUpdate(elapsedTime: number): void {
}

function gameRender(): void {
    context.fillStyle = '#555555';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // 场景下方的黑色地面
    const groundTop = canvas.height * 0.86;
    context.fillStyle = '#1a1a1a';
    context.fillRect(0, groundTop, canvas.width, canvas.height - groundTop);
    // 单帧独角兽 demo，四蹄基线贴地面顶线
    drawSprite(context, UNICORN, canvas.width * 0.35, groundTop, 2.2);
}

requestAnimationFrame(frame);
