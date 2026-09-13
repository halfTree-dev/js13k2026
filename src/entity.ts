// entity.ts
// 管理敌怪和其行为

import { player, PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_OFFSET_Y, PLAYER_HITBOX_HEIGHT, PLAYER_HITBOX_CENTER_Y } from './player';
import { VIEW_WIDTH, VIEW_HEIGHT } from './view';
import { projectileManager, ProjectileBehavior } from './projectile';
import { Sprite, drawSprite } from './sprite';
import { fx } from './fx';

// 行为标签
type EntityBehavior =
    | { kind: 'linear' }
    // y = baseY - amplitude·|sin(phase)|
    | { kind: 'hop'; amplitude: number; frequency: number }
    // 沿 axis 轴正弦摆动（默认纵轴）
    | { kind: 'sine'; axis?: 'x' | 'y'; amplitude: number; frequency: number };

// 射弹样式
type ShotStyle = 'linear' | 'accel' | 'decel' | 'homing' | 'spiral';

// 射弹共享参数
interface ShotParams {
    interval: number;
    speed: number;
    accel?: number;
    maxSpeed?: number;
    minSpeed?: number;
    turnRate?: number;
    spiralRadius?: number;
    spiralOmega?: number;
}

// 攻击类型
type EntityAttack =
    // 对玩家射弹（发射瞬间瞄准玩家，count>1 时按 spreadDeg 扇形同时发射）
    | ({ kind: 'aimed'; shot: 'linear' | 'accel' | 'decel' | 'homing' | 'spiral'; count?: number; spreadDeg?: number } & ShotParams)
    // 环形弹幕（count 向均匀分布）
    | ({ kind: 'ring'; count: number } & ShotParams)
    // 重力抛射弹（skyward 取天顶方向随机角，否则全向随机角散射 count 枚）
    | ({ kind: 'lob'; gravity: number; skyward?: boolean; count?: number } & ShotParams);

// 敌怪实体
interface Entity {
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
    // 实体外观
    sprite: Sprite | null;
    // 行为标签
    behavior: EntityBehavior;
    // 攻击组件，无则不发射
    attack: EntityAttack | null;
    // 攻击计时
    attackTimer: number;
    // 生命周期
    lifetime: number;
    // 已存在时间
    age: number;
    // 生命值
    hitPoints: number;
    // 碰撞盒，相对实体锚点
    hitbox: EntityHitbox;
    // 渲染时按速度方向旋转
    rotate: boolean;
    // 渲染在玩家身后（障碍物层）
    background: boolean;
    // 渲染时水平翻转
    flipX: boolean;
    // 被击杀时返还的颜色条
    colorReward: number;
    // 回收标记
    dead: boolean;
}

// 碰撞盒
interface EntityHitbox {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
}

// 生成配置
interface EntityConfig {
    x: number;
    y: number;
    vx: number;
    vy: number;
    behavior: EntityBehavior;
    hitPoints?: number;
    lifetime?: number;
    sprite?: Sprite | null;
    hitbox?: EntityHitbox;
    rotate?: boolean;
    background?: boolean;
    flipX?: boolean;
    colorReward?: number;
    attack?: EntityAttack;
    phase?: number;
}

// 出界回收边距
const ENTITY_DESPAWN_MARGIN = 80;

const DEFAULT_HITBOX: EntityHitbox = { offsetX: -15, offsetY: -14, width: 32, height: 20 };

class EntityManager {
    public entityList: Entity[] = [];

    // 使用配置生成敌怪
    spawn(config: EntityConfig): void {
        this.entityList.push({
            x: config.x,
            y: config.y,
            baseX: config.x,
            baseY: config.y,
            vx: config.vx,
            vy: config.vy,
            phase: config.phase ?? 0,
            sprite: config.sprite ?? null,
            behavior: config.behavior,
            attack: config.attack ?? null,
            // 发射计时器预填充为发射间隔：生成后首个更新帧即发射
            attackTimer: config.attack ? config.attack.interval : 0,
            lifetime: config.lifetime ?? 0,
            age: 0,
            hitPoints: config.hitPoints ?? 1,
            hitbox: config.hitbox ?? DEFAULT_HITBOX,
            rotate: config.rotate ?? false,
            background: config.background ?? false,
            flipX: config.flipX ?? false,
            colorReward: config.colorReward ?? 0,
            dead: false,
        });
    }

    // 清空敌怪列表
    clear(): void {
        this.entityList.length = 0;
    }

    // 造成损伤，击杀时返还颜色条并计分
    damage(entity: Entity, amount: number): void {
        if (entity.dead) {
            return;
        }
        entity.hitPoints -= amount;
        if (entity.hitPoints <= 0) {
            entity.dead = true;
            // 击杀特效：黑白粒子爆发 + 抖屏
            fx.burst(entity.x, entity.y, 10, 460, false);
            fx.shakeScreen();
            if (entity.colorReward > 0) {
                player.addColor(entity.colorReward);
                player.score++;
            }
        }
    }

    // 更新敌怪
    update(elapsedTime: number): void {
        for (const entity of this.entityList) {
            if (entity.dead) {
                continue;
            }

            // 生命周期
            entity.age += elapsedTime;
            if (entity.lifetime > 0 && entity.age >= entity.lifetime) {
                entity.dead = true;
                continue;
            }

            // 攻击计时
            if (entity.attack) {
                entity.attackTimer += elapsedTime;
                if (entity.attackTimer >= entity.attack.interval) {
                    entity.attackTimer -= entity.attack.interval;
                    this.fireAttack(entity);
                }
            }

            entity.baseX += entity.vx * elapsedTime;
            entity.baseY += entity.vy * elapsedTime;
            this.applyOffset(entity, elapsedTime);

            // 环境粒子：敌怪持续冒出当前回收颜色的粒子（密集发射）
            if (!entity.background && Math.random() < elapsedTime * 14) {
                fx.emit(entity.x, entity.y, player.colorBarColor);
            }

            // 出界回收：按运动方向判定，左移者出左界、右移者出右界、下落者出下界
            // （不判反向边界，容纳屏外成排/上方纵列入场）
            if ((entity.vx < 0 && entity.x + entity.hitbox.offsetX + entity.hitbox.width < -ENTITY_DESPAWN_MARGIN)
                || (entity.vx > 0 && entity.x + entity.hitbox.offsetX > VIEW_WIDTH + ENTITY_DESPAWN_MARGIN)
                || (entity.vy >= 0 && entity.y + entity.hitbox.offsetY > VIEW_HEIGHT + ENTITY_DESPAWN_MARGIN)) {
                entity.dead = true;
                continue;
            }

            // 玩家碰撞判定
            if (this.checkPlayerCollision(entity)) {
                player.damage();
            }
        }

        // 移除回收
        this.entityList = this.entityList.filter(entity => !entity.dead);
    }

    // 渲染在玩家身后的实体
    renderBack(context: CanvasRenderingContext2D): void {
        this.renderLayer(context, true);
    }

    // 渲染在玩家身前的实体
    renderFront(context: CanvasRenderingContext2D): void {
        this.renderLayer(context, false);
    }

    // 计算实体坐标偏移
    private applyOffset(entity: Entity, elapsedTime: number): void {
        switch (entity.behavior.kind) {
            case 'hop':
                entity.phase += entity.behavior.frequency * elapsedTime;
                entity.x = entity.baseX;
                entity.y = entity.baseY - entity.behavior.amplitude * Math.abs(Math.sin(entity.phase));
                break;
            case 'sine':
                entity.phase += entity.behavior.frequency * elapsedTime;
                entity.x = entity.baseX;
                entity.y = entity.baseY;
                if (entity.behavior.axis === 'x') {
                    entity.x = entity.baseX + entity.behavior.amplitude * Math.sin(entity.phase);
                } else {
                    entity.y = entity.baseY + entity.behavior.amplitude * Math.sin(entity.phase);
                }
                break;
            default:
                entity.x = entity.baseX;
                entity.y = entity.baseY;
                break;
        }
    }

    // 依据攻击类型发射敌方弹幕
    private fireAttack(entity: Entity): void {
        const attack = entity.attack!;

        if (attack.kind === 'ring') {
            for (let i = 0; i < attack.count; i++) {
                const angle = (Math.PI * 2 * i) / attack.count;
                this.spawnShot(entity, 'linear', angle, attack);
            }
            return;
        }

        if (attack.kind === 'lob') {
            const count = attack.count ?? 1;
            for (let i = 0; i < count; i++) {
                // 天顶抛射取上半平面随机角，散射取全向随机角
                const angle = attack.skyward
                    ? -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 2 / 3)
                    : Math.random() * Math.PI * 2;
                projectileManager.spawn({
                    x: entity.x,
                    y: entity.y,
                    vx: Math.cos(angle) * attack.speed,
                    vy: Math.sin(angle) * attack.speed,
                    behavior: { kind: 'gravity', g: attack.gravity },
                    friendly: false,
                    lifetime: 6,
                });
            }
            return;
        }

        const angle = Math.atan2(player.playerY + PLAYER_HITBOX_CENTER_Y - entity.y, player.playerX - entity.x);
        const count = attack.count ?? 1;
        const spread = ((attack.spreadDeg ?? 0) * Math.PI) / 180;
        for (let i = 0; i < count; i++) {
            this.spawnShot(entity, attack.shot, count > 1 ? angle + (i - (count - 1) / 2) * spread : angle, attack);
        }
    }

    // 以 angle 方向发射一枚指定样式射弹
    private spawnShot(entity: Entity, style: ShotStyle, angle: number, params: ShotParams): void {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        let behavior: ProjectileBehavior = { kind: 'linear' };
        switch (style) {
            case 'accel':
                behavior = { kind: 'accelerate', ax: cos * params.accel!, ay: sin * params.accel!, maxSpeed: params.maxSpeed! };
                break;
            case 'decel':
                behavior = { kind: 'decelerate', ax: cos * params.accel!, ay: sin * params.accel!, minSpeed: params.minSpeed! };
                break;
            case 'homing':
                behavior = { kind: 'homing', turnRate: params.turnRate! };
                break;
            case 'spiral':
                behavior = { kind: 'spiral', radius: params.spiralRadius!, angularSpeed: params.spiralOmega! };
                break;
        }
        projectileManager.spawn({
            x: entity.x,
            y: entity.y,
            vx: cos * params.speed,
            vy: sin * params.speed,
            behavior,
            friendly: false,
            lifetime: 6,
        });
    }

    // 渲染实体
    private renderLayer(context: CanvasRenderingContext2D, background: boolean): void {
        for (const entity of this.entityList) {
            if (entity.background !== background || !entity.sprite) {
                continue;
            }
            const angle = entity.rotate ? Math.atan2(entity.vy, entity.vx) : 0;
            drawSprite(context, entity.sprite, entity.x, entity.y, 1, 1, entity.flipX, angle);
        }
    }

    // 敌怪碰撞盒碰撞判定
    private checkPlayerCollision(entity: Entity): boolean {
        const left = player.playerX + PLAYER_HITBOX_OFFSET_X;
        const top = player.playerY + PLAYER_HITBOX_OFFSET_Y;
        const entityLeft = entity.x + entity.hitbox.offsetX;
        const entityTop = entity.y + entity.hitbox.offsetY;
        return entityLeft < left + PLAYER_HITBOX_WIDTH && entityLeft + entity.hitbox.width > left
            && entityTop < top + PLAYER_HITBOX_HEIGHT && entityTop + entity.hitbox.height > top;
    }
}

const entityManager = new EntityManager();
export { entityManager };
export type { Entity, EntityBehavior, EntityConfig, EntityHitbox, EntityAttack };
