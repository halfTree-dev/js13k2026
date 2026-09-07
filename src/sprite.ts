export interface Sprite {
    // 精灵的顶点，两个为一组
    pts: number[];
    // 三角形顶点索引，三个为一组
    tris: number[];
    // 每个三角形对应的色板索引
    shades: number[];
    // 色阶
    palette: string[];
}

export const UNICORN: Sprite = {
    pts: [18, -62, 34, -62, 43, -49, 40, -45, 32, -44, 25, -46,
    31, -62, 34, -61, 40, -77, 10, -46, 22, -40, -3, -45,
    -28, -44, -32, -24, -15, -22, 19, -26, -30, -34, -22, -34,
    -28, 0, -36, 0, -17, -34, -10, -35, -13, 0, -21, 0,
    9, -32, 17, -32, 16, 0, 9, 0, 10, -34, 18, -34,
    27, 0, 19, 0, -46, -30, -38, -28, -44, -6, 25, -63],
    tris: [12, 32, 33, 33, 32, 34, 16, 17, 18, 16, 18, 19,
    24, 25, 26, 24, 26, 27, 12, 11, 14, 12, 14, 13,
    11, 10, 15, 11, 14, 15, 20, 21, 22, 20, 22, 23,
    28, 29, 30, 28, 30, 31, 0, 9, 5, 0, 2, 3,
    0, 3, 4, 0, 4, 5, 6, 7, 8, 9, 10, 5,
    9, 11, 10, 0, 35, 1, 0, 1, 2],
    shades: [4, 5, 4, 5, 4, 5, 2, 3, 2, 1, 3, 4,
    3, 4, 3, 2, 2, 3, 0, 4, 2, 0, 1],
    palette: ['#ffffff', '#efefef', '#dadada', '#bdbdbd', '#949494', '#737373'],
};

// 制造指定三角形的闭合路径
function traceTriangle(ctx: CanvasRenderingContext2D, sprite: Sprite, index: number): void {
    const base = index * 3;
    ctx.beginPath();
    for (let corner = 0; corner < 3; corner++) {
        const vertex = sprite.tris[base + corner] * 2;
        if (corner === 0) {
            ctx.moveTo(sprite.pts[vertex], sprite.pts[vertex + 1]);
        } else {
            ctx.lineTo(sprite.pts[vertex], sprite.pts[vertex + 1]);
        }
    }
    ctx.closePath();
}

// 绘制指定精灵
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, scale = 1, flipX = false): void {
    const triangleCount = sprite.tris.length / 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX ? -scale : scale, scale);

    ctx.fillStyle = sprite.palette[3];
    for (let i = 0; i < triangleCount; i++) {
        traceTriangle(ctx, sprite, i);
        ctx.fill();
    }

    for (let i = 0; i < triangleCount; i++) {
        ctx.fillStyle = sprite.palette[sprite.shades[i]];
        traceTriangle(ctx, sprite, i);
        ctx.fill();
    }
    ctx.restore();
}
