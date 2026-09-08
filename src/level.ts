import { inputManager } from './input';
import { VIEW_WIDTH, VIEW_HEIGHT } from './main';
import { drawSprite, UNICORN_RUN_FRAMES, UNICORN_LEAP, UNICORN_SINK } from './sprite';
import { cityScenery } from './scenery';

// 横向移动
const PLAYER_MOVE_SPEED = 350;
// 跳跃
const PLAYER_JUMP_VELOCITY = -900;
const PLAYER_DOUBLE_JUMP_VELOCITY = -780;
// 重力
const PLAYER_GRAVITY = 2600;
const PLAYER_HOLD_GRAVITY = 1200;
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

// 地面滚动速度（即世界滚动速度，近景层 1.0x，远景/中景按系数折算）
const GROUND_SCROLL_SPEED = 420;
// 地面刻度间距
const GROUND_TICK_SPACING = 60;

class GameLevel {
    playerX : number = 100;
    playerY : number = 720;
    playerAnimationIndex : number = 0;
    playerAnimationTimer : number = 0;
    playerVelocityX : number = 0;
    playerVelocityY : number = 0;

    playerJumpCount : number = 0;

    groundY : number = 720;

    worldScroll : number = 0;

    constructor() {
    }

    update(elapsedTime: number) {
        this.updateAnimation(elapsedTime);
        this.updateAction(elapsedTime);
        this.updatePhysics(elapsedTime);
    }

    updateAnimation(elapsedTime: number) {
        // 世界滚动
        this.worldScroll += elapsedTime * GROUND_SCROLL_SPEED;
        // 玩家动画
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
            if (this.playerY >= this.groundY - 5) {
                this.playerVelocityY = PLAYER_JUMP_VELOCITY;
                this.playerJumpCount = 1;
            } else if (this.playerJumpCount < 2) {
                this.playerVelocityY = PLAYER_DOUBLE_JUMP_VELOCITY;
                this.playerJumpCount = 2;
            }
        }
    }

    updatePhysics(elapsedTime: number) {
        // 按住 KeyW 时受弱重力
        const gravity = this.playerVelocityY < 0 && inputManager.isKeyDown('KeyW') ? PLAYER_HOLD_GRAVITY : PLAYER_GRAVITY;
        this.playerVelocityY += gravity * elapsedTime;
        // 最大下落速度
        this.playerVelocityY = Math.min(this.playerVelocityY, PLAYER_MAX_FALL_SPEED);

        // 结算速度
        this.playerX += this.playerVelocityX * elapsedTime;
        this.playerY += this.playerVelocityY * elapsedTime;
        this.playerX = Math.max(PLAYER_X_MARGIN, Math.min(VIEW_WIDTH - PLAYER_X_MARGIN, this.playerX));
        this.playerY = Math.max(PLAYER_MIN_Y, this.playerY);

        // 重置跳跃次数
        if (this.playerY >= this.groundY) {
            this.playerY = this.groundY;
            this.playerVelocityY = 0;
            this.playerJumpCount = 0;
        }
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
            context.fillRect(x - groundOffset, this.groundY + 16, 4, 12);
        }

        // 玩家动画：地面奔跑；空中上升为上仰跳跃造型，下落为后仰下落造型
        if (this.playerY >= this.groundY - 1) {
            drawSprite(context, UNICORN_RUN_FRAMES[this.playerAnimationIndex], this.playerX, this.playerY, 1);
        } else if (this.playerVelocityY < 0) {
            drawSprite(context, UNICORN_LEAP, this.playerX, this.playerY, 1);
        } else {
            drawSprite(context, UNICORN_SINK, this.playerX, this.playerY, 1);
        }
    }
}

const gameLevel = new GameLevel();
export { gameLevel };