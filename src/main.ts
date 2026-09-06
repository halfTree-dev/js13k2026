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
    context.fillStyle = '#cccccc';
    context.fillRect(0, 0, canvas.width, canvas.height);
}

requestAnimationFrame(frame);
