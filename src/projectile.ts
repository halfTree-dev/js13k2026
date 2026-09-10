import { gameLevel, PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_OFFSET_Y, PLAYER_HITBOX_HEIGHT, PLAYER_HITBOX_CENTER_Y } from './level';
import { VIEW_WIDTH, VIEW_HEIGHT } from './main';
import { entityManager } from './entity';
import { Sprite, drawSprite, PROJECTILE_FRIENDLY, PROJECTILE_ENEMY } from './sprite';

// 弹幕行为标签
type ProjectileBehavior =
    | { kind: 'linear' }
    | { kind: 'gravity'; g: number }
    | { kind: 'homing'; turnRate: number }
    | { kind: 'accelerate'; ax: number; ay: number; maxSpeed: number }
    | { kind: 'decelerate'; ax: number; ay: number; minSpeed: number }
    | { kind: 'spiral'; radius: number; angularSpeed: number }
    | { kind: 'sine'; amplitude: number; frequency: number };

// 弹幕对象
interface Projectile {
    // 实际位置
    x: number;
    y: number;
    // 运动基点位置
    baseX: number;
    baseY: number;
    // 当前基础速度
    vx: number;
    vy: number;
    // 运动相位
    phase: number;
    // 弹幕外观
    sprite: Sprite | null;
    // 行为标签
    behavior: ProjectileBehavior;
    // 是否友方弹幕，友方命中敌怪，敌方命中玩家，避免自伤判定
    friendly: boolean;
    // 生命周期
    lifetime: number;
    // 已存在时间
    age: number;
    // 碰撞半径
    radius: number;
    // 回收标记
    dead: boolean;
}

// 生成配置
interface ProjectileConfig {
    x: number;
    y: number;
    vx: number;
    vy: number;
    behavior: ProjectileBehavior;
    friendly: boolean;
    radius?: number;
    lifetime?: number;
    sprite?: Sprite | null;
}

// 出屏回收边距
const PROJECTILE_DESPAWN_MARGIN = 80;

// 友方弹幕单发命中伤害
const PROJECTILE_HIT_DAMAGE = 1;

class ProjectileManager {
    private projectiles: Projectile[] = [];

    // 使用配置生成弹幕
    spawn(config: ProjectileConfig): void {
        this.projectiles.push({
            x: config.x,
            y: config.y,
            baseX: config.x,
            baseY: config.y,
            vx: config.vx,
            vy: config.vy,
            phase: 0,
            sprite: config.sprite ?? null,
            behavior: config.behavior,
            friendly: config.friendly,
            lifetime: config.lifetime ?? 0,
            age: 0,
            radius: config.radius ?? 12,
            dead: false,
        });
    }

    // 清空弹幕列表
    clear(): void {
        this.projectiles.length = 0;
    }

    // 更新弹幕
    update(elapsedTime: number): void {

        for (const projectile of this.projectiles) {
            // 生命周期
            projectile.age += elapsedTime;
            if (projectile.lifetime > 0 && projectile.age >= projectile.lifetime) {
                projectile.dead = true;
                continue;
            }

            this.updateBehavior(projectile, elapsedTime);
            projectile.baseX += projectile.vx * elapsedTime;
            projectile.baseY += projectile.vy * elapsedTime;
            this.applyOffset(projectile, elapsedTime);

            // 出屏回收
            if (projectile.x < -PROJECTILE_DESPAWN_MARGIN || projectile.x > VIEW_WIDTH + PROJECTILE_DESPAWN_MARGIN
                || projectile.y < -PROJECTILE_DESPAWN_MARGIN || projectile.y > VIEW_HEIGHT + PROJECTILE_DESPAWN_MARGIN) {
                projectile.dead = true;
                continue;
            }

            // 敌我碰撞判定：友方弹幕只判敌怪，敌方弹幕只判玩家
            if (projectile.friendly) {
                if (this.checkEntityCollision(projectile)) {
                    projectile.dead = true;
                }
            } else if (this.checkPlayerCollision(projectile)) {
                gameLevel.damagePlayer();
                projectile.dead = true;
            }
        }

        // 移除回收
        this.projectiles = this.projectiles.filter(projectile => !projectile.dead);
    }

    render(context: CanvasRenderingContext2D): void {
        for (const projectile of this.projectiles) {
            // 无外观时按敌我落到默认素材
            const sprite = projectile.sprite ?? (projectile.friendly ? PROJECTILE_FRIENDLY : PROJECTILE_ENEMY);
            // 弹幕以其锚点旋转，旋转角度与基础速度方向一致
            const angle = Math.atan2(projectile.vy, projectile.vx);
            drawSprite(context, sprite, projectile.x, projectile.y, 1, 1, false, angle);
        }
    }

    // 依据行为标签更新速度
    private updateBehavior(projectile: Projectile, elapsedTime: number): void {
        const behavior = projectile.behavior;
        switch (behavior.kind) {
            case 'linear':
                break;
            case 'gravity':
                projectile.vy += behavior.g * elapsedTime;
                break;
            case 'homing': {
                const speed = Math.hypot(projectile.vx, projectile.vy);
                if (speed > 0) {
                    const currentAngle = Math.atan2(projectile.vy, projectile.vx);
                    const targetAngle = Math.atan2(
                        gameLevel.playerY + PLAYER_HITBOX_CENTER_Y - projectile.baseY,
                        gameLevel.playerX - projectile.baseX,
                    );
                    let angleDelta = targetAngle - currentAngle;
                    while (angleDelta > Math.PI) {
                        angleDelta -= Math.PI * 2;
                    }
                    while (angleDelta < -Math.PI) {
                        angleDelta += Math.PI * 2;
                    }
                    const maxTurn = behavior.turnRate * elapsedTime;
                    const angle = currentAngle + Math.max(-maxTurn, Math.min(maxTurn, angleDelta));
                    projectile.vx = Math.cos(angle) * speed;
                    projectile.vy = Math.sin(angle) * speed;
                }
                break;
            }
            case 'accelerate': {
                projectile.vx += behavior.ax * elapsedTime;
                projectile.vy += behavior.ay * elapsedTime;
                const speed = Math.hypot(projectile.vx, projectile.vy);
                if (speed > behavior.maxSpeed && speed > 0) {
                    const scale = behavior.maxSpeed / speed;
                    projectile.vx *= scale;
                    projectile.vy *= scale;
                }
                break;
            }
            case 'decelerate': {
                const speed = Math.hypot(projectile.vx, projectile.vy);
                if (speed > behavior.minSpeed && speed > 0) {
                    const deceleration = Math.hypot(behavior.ax, behavior.ay) * elapsedTime;
                    const scale = Math.max(behavior.minSpeed, speed - deceleration) / speed;
                    projectile.vx *= scale;
                    projectile.vy *= scale;
                }
                break;
            }
            case 'spiral':
            case 'sine':
                break;
        }
    }

    // 计算弹幕坐标偏移
    private applyOffset(projectile: Projectile, elapsedTime: number): void {
        const behavior = projectile.behavior;
        switch (behavior.kind) {
            case 'spiral': {
                projectile.phase += behavior.angularSpeed * elapsedTime;
                projectile.x = projectile.baseX + behavior.radius * Math.cos(projectile.phase);
                projectile.y = projectile.baseY + behavior.radius * Math.sin(projectile.phase);
                break;
            }
            case 'sine': {
                projectile.phase += behavior.frequency * elapsedTime;
                const speed = Math.hypot(projectile.vx, projectile.vy);
                if (speed > 0) {
                    const nx = projectile.vy / speed;
                    const ny = -projectile.vx / speed;
                    const offset = behavior.amplitude * Math.sin(projectile.phase);
                    projectile.x = projectile.baseX + nx * offset;
                    projectile.y = projectile.baseY + ny * offset;
                } else {
                    projectile.x = projectile.baseX;
                    projectile.y = projectile.baseY;
                }
                break;
            }
            default:
                projectile.x = projectile.baseX;
                projectile.y = projectile.baseY;
                break;
        }
    }

    // 撞击判定
    private checkPlayerCollision(projectile: Projectile): boolean {
        const left = gameLevel.playerX + PLAYER_HITBOX_OFFSET_X;
        const top = gameLevel.playerY + PLAYER_HITBOX_OFFSET_Y;
        const clampedX = Math.max(left, Math.min(projectile.x, left + PLAYER_HITBOX_WIDTH));
        const clampedY = Math.max(top, Math.min(projectile.y, top + PLAYER_HITBOX_HEIGHT));
        const dx = projectile.x - clampedX;
        const dy = projectile.y - clampedY;
        return dx * dx + dy * dy <= projectile.radius * projectile.radius;
    }

    // 友方弹幕与敌怪碰撞盒（圆与矩形）判定，命中对敌怪造成伤害
    private checkEntityCollision(projectile: Projectile): boolean {
        for (const entity of entityManager.entityList) {
            const left = entity.x + entity.hitbox.offsetX;
            const top = entity.y + entity.hitbox.offsetY;
            const clampedX = Math.max(left, Math.min(projectile.x, left + entity.hitbox.width));
            const clampedY = Math.max(top, Math.min(projectile.y, top + entity.hitbox.height));
            const dx = projectile.x - clampedX;
            const dy = projectile.y - clampedY;
            if (dx * dx + dy * dy <= projectile.radius * projectile.radius) {
                entityManager.damage(entity, PROJECTILE_HIT_DAMAGE);
                return true;
            }
        }
        return false;
    }
}

const projectileManager = new ProjectileManager();
export { projectileManager };
export type { Projectile, ProjectileBehavior, ProjectileConfig };
