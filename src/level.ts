import { inputManager } from './input';
import { VIEW_WIDTH, VIEW_HEIGHT } from './main';
import { drawSprite, UNICORN_RUN_FRAMES, UNICORN_LEAP } from './sprite';

class GameLevel {
    playerX : number = 100;
    playerY : number = 720;
    playerAnimationIndex : number = 0;
    playerAnimationTimer : number = 0;
    playerVelocityX : number = 0;
    playerVelocityY : number = 0;

    

    groundY : number = 720;
    groundScrollX : number = 0;

    constructor() {
    }

    update(elapsedTime: number) {
        this.updateAnimation(elapsedTime);
        this.updateAction(elapsedTime);
        this.updatePhysics(elapsedTime);
    }

    updateAnimation(elapsedTime: number) {
        // 地面滚动
        this.groundScrollX = (this.groundScrollX + elapsedTime * 420) % 60;
        // 玩家动画
        this.playerAnimationTimer += elapsedTime;
        let groundMoveTimerLimit = 90e-3;
        if (this.playerVelocityX > 10) {
            groundMoveTimerLimit = 70e-3;
        } else if (this.playerVelocityX < -10) {
            groundMoveTimerLimit = 105e-3;
        }
        while (this.playerAnimationTimer >= groundMoveTimerLimit) {
            this.playerAnimationTimer -= groundMoveTimerLimit;
            this.playerAnimationIndex = (this.playerAnimationIndex + 1) % UNICORN_RUN_FRAMES.length;
        }
    }

    updateAction(elapsedTime: number) {
        // 玩家行为
        if (inputManager.isKeyDown('KeyA')) {
            this.playerVelocityX = -200;
        } else if (inputManager.isKeyDown('KeyD')) {
            this.playerVelocityX = 200;
        } else {
            this.playerVelocityX = 0;
        }
    }

    updatePhysics(elapsedTime: number) {
        this.playerX += this.playerVelocityX * elapsedTime;
        this.playerY += this.playerVelocityY * elapsedTime;
        this.playerX = Math.max(50, Math.min(VIEW_WIDTH - 50, this.playerX));
        this.playerY = Math.max(80, Math.min(this.groundY, this.playerY));
    }

    render(context: CanvasRenderingContext2D) {
        // 黑色地面
        context.fillStyle = '#1a1a1a';
        context.fillRect(0, this.groundY, VIEW_WIDTH, VIEW_HEIGHT - this.groundY);

        // 地面滚动刻度
        context.fillStyle = '#3d3d3d';
        for (let x = -scrollX; x < VIEW_WIDTH; x += 60) {
            context.fillRect(x - this.groundScrollX, this.groundY + 16, 4, 12);
        }

        // 玩家动画
        if (this.playerY <= this.groundY - 10) {
            drawSprite(context, UNICORN_RUN_FRAMES[this.playerAnimationIndex], this.playerX, this.playerY, 1);
        } else {
            drawSprite(context, UNICORN_LEAP, this.playerX, this.playerY, 1);
        }
    }
}

const gameLevel = new GameLevel();
export { gameLevel };