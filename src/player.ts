// player.ts
// 玩家相关逻辑

import { inputManager } from './input';
import { VIEW_WIDTH, VIEW_HEIGHT } from './view';
import { drawSprite, UNICORN_RUN_FRAMES, UNICORN_LEAP, UNICORN_SINK } from './sprite';
import { projectileManager } from './projectile';
import { fx } from './fx';
import { screenFlash } from './caption';

// 地面高度
export const GROUND_Y = 720;

// 横向移动
const PLAYER_MOVE_SPEED = 350;
// 跳跃
const PLAYER_JUMP_VELOCITY = -900;
const PLAYER_DOUBLE_JUMP_VELOCITY = -780;
// 重力
const PLAYER_GRAVITY = 2600;
const PLAYER_HOLD_GRAVITY = 1200;
// 按住 KeyS 时的额外下坠加速度（仅空中生效）
const PLAYER_FAST_FALL_GRAVITY = 3000;
// 最大下落速度
const PLAYER_MAX_FALL_SPEED = 1500;
// 水平边界
const PLAYER_X_MARGIN = 50;
const PLAYER_MIN_Y = 80;
// 奔跑动画帧间隔
const PLAYER_ANIM_INTERVAL = 90e-3;
const PLAYER_ANIM_INTERVAL_FAST = 70e-3;
const PLAYER_ANIM_INTERVAL_SLOW = 105e-3;
const PLAYER_ANIM_SPEED_THRESHOLD = 10;

// 玩家碰撞盒偏移与尺寸（较外观略回缩）
export const PLAYER_HITBOX_OFFSET_X = -28;
export const PLAYER_HITBOX_WIDTH = 56;
export const PLAYER_HITBOX_OFFSET_Y = -66;
export const PLAYER_HITBOX_HEIGHT = 76;

// 玩家碰撞盒中心相对锚点的纵向偏移
export const PLAYER_HITBOX_CENTER_Y = PLAYER_HITBOX_OFFSET_Y + PLAYER_HITBOX_HEIGHT / 2;

// 友方弹幕发射冷却（0.25s × 0.75 × 0.8）
export const PLAYER_SHOOT_COOLDOWN = 0.15;
// 友方弹幕速度（900 × 2.0）
const FRIENDLY_PROJECTILE_SPEED = 1800;
// 独角兽角尖相对玩家锚点偏移
const HORN_OFFSET_X = 40;
const HORN_OFFSET_Y = -77;
// 受击无敌时间
const PLAYER_INVINCIBLE_TIME = 1.0;

// 生命值上限与恒定恢复速率（0.1 × 0.15）
const PLAYER_MAX_HIT_POINT = 4;
const PLAYER_HIT_POINT_REGEN = 0.015;
// 复活后的短暂免伤时长
const PLAYER_REVIVE_INVINCIBLE_TIME = 2;
// 颜色条上限
const COLOR_POINT_MAX = 1;

// 颜色条默认填充色（关卡内随主题色切换）
const COLOR_POINT_BAR_COLOR = '#7fb3ec';

// 生命值 UI
const HP_SLOT_WIDTH = 56;
const HP_SLOT_HEIGHT = 22;
const HP_SLOT_SKEW = 14;
const HP_SLOT_GAP = 10;
// 颜色条 UI
const COLOR_SEG_WIDTH = 26;
const COLOR_SEG_HEIGHT = 22;
const COLOR_SEG_SKEW = -12;
const COLOR_SEG_GAP = 4;
const COLOR_SEG_COUNT = 10;
// UI 与屏幕边缘的距离
const UI_MARGIN = 24;
// UI 空槽背景色与生命值填充色
const UI_SLOT_BACKGROUND = '#3d3d3d';
const HP_SLOT_FILL = '#fffdf0';
// 未满槽半透明度
const PARTIAL_SLOT_ALPHA = 0.35;

function drawParallelogram(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, skew: number, fill: string): void {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y + height);
    context.lineTo(x + width, y + height);
    context.lineTo(x + width + skew, y);
    context.lineTo(x + skew, y);
    context.closePath();
    context.fill();
}

class Player {
    playerX : number = 100;
    playerY : number = GROUND_Y;
    playerAnimationIndex : number = 0;
    playerAnimationTimer : number = 0;
    playerVelocityX : number = 0;
    playerVelocityY : number = 0;

    playerJumpCount : number = 0;

    shootCooldown : number = 0;
    invincibleTimer : number = 0;
    invulnerable : boolean = false;

    // 生命值
    hitPoint : number = PLAYER_MAX_HIT_POINT;
    // 颜色条
    colorPoint : number = 0;
    // 颜色条填充色（随关卡主题色变化）
    colorBarColor : string = COLOR_POINT_BAR_COLOR;
    // 分数（每击杀一名敌怪 +1，死亡减半）
    score : number = 0;
    // 倒下标记（生命值低于 1，交由 director 演出死亡序列）
    isDown : boolean = false;

    update(elapsedTime: number, inputEnabled = true) {
        // 计时器
        this.shootCooldown = Math.max(0, this.shootCooldown - elapsedTime);
        this.invincibleTimer = Math.max(0, this.invincibleTimer - elapsedTime);

        // 生命值恢复
        this.hitPoint = Math.min(PLAYER_MAX_HIT_POINT, this.hitPoint + PLAYER_HIT_POINT_REGEN * elapsedTime);

        this.updateAnimation(elapsedTime);
        if (inputEnabled) {
            this.updateAction(elapsedTime);
        } else {
            this.playerVelocityX = 0;
        }
        this.updatePhysics(elapsedTime);
    }

    damage(): void {
        if (this.invulnerable || this.isDown || this.invincibleTimer > 0) {
            return;
        }
        this.invincibleTimer = PLAYER_INVINCIBLE_TIME;
        this.hitPoint = Math.max(0, this.hitPoint - 1);
        // 受伤红闪
        screenFlash.trigger(0.15, '#e04848');
        // 生命值低于 1：主角倒下
        if (this.hitPoint < 1) {
            this.isDown = true;
        }
    }

    // 复活：恢复生命、清空颜色条，并给予短暂免伤（关卡阶段不变由 director 保证）
    revive(): void {
        this.hitPoint = PLAYER_MAX_HIT_POINT;
        this.colorPoint = 0;
        this.isDown = false;
        this.invincibleTimer = PLAYER_REVIVE_INVINCIBLE_TIME;
    }

    addColor(amount: number): void {
        this.colorPoint = Math.min(COLOR_POINT_MAX, Math.max(0, this.colorPoint + amount));
    }

    updateAnimation(elapsedTime: number) {
        this.playerAnimationTimer += elapsedTime;
        let groundMoveTimerLimit = PLAYER_ANIM_INTERVAL;
        if (this.playerVelocityX > PLAYER_ANIM_SPEED_THRESHOLD) {
            groundMoveTimerLimit = PLAYER_ANIM_INTERVAL_FAST;
        } else if (this.playerVelocityX < -PLAYER_ANIM_SPEED_THRESHOLD) {
            groundMoveTimerLimit = PLAYER_ANIM_INTERVAL_SLOW;
        }
        while (this.playerAnimationTimer >= groundMoveTimerLimit) {
            this.playerAnimationTimer -= groundMoveTimerLimit;
            this.playerAnimationIndex = (this.playerAnimationIndex + 1) % UNICORN_RUN_FRAMES.length;
        }
    }

    updateAction(elapsedTime: number) {
        // 玩家行为
        if (inputManager.isKeyDown('KeyA')) {
            this.playerVelocityX = -PLAYER_MOVE_SPEED;
        } else if (inputManager.isKeyDown('KeyD')) {
            this.playerVelocityX = PLAYER_MOVE_SPEED;
        } else {
            this.playerVelocityX = 0;
        }

        // 跳跃
        if (inputManager.isKeyJustPressed('KeyW')) {
            if (this.playerY >= GROUND_Y - 5) {
                this.playerVelocityY = PLAYER_JUMP_VELOCITY;
                this.playerJumpCount = 1;
            } else if (this.playerJumpCount < 2) {
                this.playerVelocityY = PLAYER_DOUBLE_JUMP_VELOCITY;
                this.playerJumpCount = 2;
            }
        }

        // 发射友方弹幕（按住左键持续发射，朝鼠标方向，冷却限制射速）
        if (inputManager.isMouseLeftDown() && this.shootCooldown <= 0) {
            const hornX = this.playerX + HORN_OFFSET_X;
            const hornY = this.playerY + HORN_OFFSET_Y;
            const deltaX = inputManager.mouseX - hornX;
            const deltaY = inputManager.mouseY - hornY;
            const distance = Math.hypot(deltaX, deltaY) || 1;
            projectileManager.spawn({
                x: hornX,
                y: hornY,
                vx: (deltaX / distance) * FRIENDLY_PROJECTILE_SPEED,
                vy: (deltaY / distance) * FRIENDLY_PROJECTILE_SPEED,
                behavior: { kind: 'linear' },
                friendly: true,
                lifetime: 2.5,
            });
            this.shootCooldown = PLAYER_SHOOT_COOLDOWN;
            // 枪口白色粒子
            fx.burst(hornX, hornY, 3, 240, true);
        }
    }

    updatePhysics(elapsedTime: number) {
        // 纵向行动
        let gravity = this.playerVelocityY < 0 && inputManager.isKeyDown('KeyW') ? PLAYER_HOLD_GRAVITY : PLAYER_GRAVITY;
        if (this.playerY < GROUND_Y - 1 && inputManager.isKeyDown('KeyS')) {
            gravity += PLAYER_FAST_FALL_GRAVITY;
        }
        this.playerVelocityY += gravity * elapsedTime;
        this.playerVelocityY = Math.min(this.playerVelocityY, PLAYER_MAX_FALL_SPEED);

        // 结算速度
        this.playerX += this.playerVelocityX * elapsedTime;
        this.playerY += this.playerVelocityY * elapsedTime;
        this.playerX = Math.max(PLAYER_X_MARGIN, Math.min(VIEW_WIDTH - PLAYER_X_MARGIN, this.playerX));
        this.playerY = Math.max(PLAYER_MIN_Y, this.playerY);

        // 重置跳跃次数
        if (this.playerY >= GROUND_Y) {
            this.playerY = GROUND_Y;
            this.playerVelocityY = 0;
            this.playerJumpCount = 0;
        }
    }

    render(context: CanvasRenderingContext2D) {
        // 玩家动画
        if (this.playerY >= GROUND_Y - 1) {
            drawSprite(context, UNICORN_RUN_FRAMES[this.playerAnimationIndex], this.playerX, this.playerY, 1);
        } else if (this.playerVelocityY < 0) {
            drawSprite(context, UNICORN_LEAP, this.playerX, this.playerY, 1);
        } else {
            drawSprite(context, UNICORN_SINK, this.playerX, this.playerY, 1);
        }
    }

    // 渲染 UI
    renderUI(context: CanvasRenderingContext2D) {
        this.renderScoreUI(context);
        this.renderHitPointUI(context);
        this.renderColorPointUI(context);
    }

    // 分数栏（左上角）
    private renderScoreUI(context: CanvasRenderingContext2D) {
        context.save();
        context.fillStyle = '#fffdf0';
        context.font = 'bold 26px Consolas, monospace';
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillText(`SCORE ${this.score}`, UI_MARGIN, UI_MARGIN + 13);
        context.restore();
    }

    // 生命值 UI
    private renderHitPointUI(context: CanvasRenderingContext2D) {
        const y = VIEW_HEIGHT - UI_MARGIN - HP_SLOT_HEIGHT;
        const fullCount = Math.floor(this.hitPoint);
        const fraction = this.hitPoint - fullCount;
        for (let i = 0; i < PLAYER_MAX_HIT_POINT; i++) {
            const x = UI_MARGIN + i * (HP_SLOT_WIDTH + HP_SLOT_GAP);
            drawParallelogram(context, x, y, HP_SLOT_WIDTH, HP_SLOT_HEIGHT, HP_SLOT_SKEW, UI_SLOT_BACKGROUND);

            if (i < fullCount) {
                drawParallelogram(context, x, y, HP_SLOT_WIDTH, HP_SLOT_HEIGHT, HP_SLOT_SKEW, HP_SLOT_FILL);
            } else if (i === fullCount && fraction > 0) {
                context.save();
                context.globalAlpha = PARTIAL_SLOT_ALPHA;
                drawParallelogram(context, x, y, HP_SLOT_WIDTH * fraction, HP_SLOT_HEIGHT, HP_SLOT_SKEW, HP_SLOT_FILL);
                context.restore();
            }

        }
    }

    // 颜色条 UI
    private renderColorPointUI(context: CanvasRenderingContext2D) {
        const y = VIEW_HEIGHT - UI_MARGIN - COLOR_SEG_HEIGHT;
        const progress = this.colorPoint * COLOR_SEG_COUNT;
        const fullCount = Math.floor(progress);
        const fraction = progress - fullCount;
        const totalWidth = COLOR_SEG_COUNT * COLOR_SEG_WIDTH + (COLOR_SEG_COUNT - 1) * COLOR_SEG_GAP;
        const startX = VIEW_WIDTH - UI_MARGIN - totalWidth;
        for (let i = 0; i < COLOR_SEG_COUNT; i++) {
            const x = startX + i * (COLOR_SEG_WIDTH + COLOR_SEG_GAP);
            drawParallelogram(context, x, y, COLOR_SEG_WIDTH, COLOR_SEG_HEIGHT, COLOR_SEG_SKEW, UI_SLOT_BACKGROUND);

            if (i < fullCount) {
                drawParallelogram(context, x, y, COLOR_SEG_WIDTH, COLOR_SEG_HEIGHT, COLOR_SEG_SKEW, this.colorBarColor);
            } else if (i === fullCount && fraction > 0) {
                context.save();
                context.globalAlpha = PARTIAL_SLOT_ALPHA;
                drawParallelogram(context, x, y, COLOR_SEG_WIDTH * fraction, COLOR_SEG_HEIGHT, COLOR_SEG_SKEW, this.colorBarColor);
                context.restore();
            }

        }
    }
}

const player = new Player();
export { player };
