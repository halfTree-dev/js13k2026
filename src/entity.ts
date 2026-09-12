// entity.ts
// 管理敌怪和其行为

import { player, PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_OFFSET_Y, PLAYER_HITBOX_HEIGHT, PLAYER_HITBOX_CENTER_Y } from './player';
import { VIEW_WIDTH } from './view';
import { projectileManager } from './projectile';
import { Sprite, drawSprite } from './sprite';

// 行为标签
type EntityBehavior =
    | { kind: 'linear' }
    // y = baseY - amplitude·|sin(phase)|
    | { kind: 'hop'; amplitude: number; frequency: number }
    // y = baseY + amplitude·sin(phase)
    | { kind: 'sine'; amplitude: number; frequency: number };

// 攻击类型
type EntityAttack =
    // 加速直线弹（射向发射瞬间的玩家位置并持续加速）
    | { kind: 'accel'; interval: number; initialSpeed: number; accel: number; maxSpeed: number; firstDelay?: number }
    // 追踪弹（恒速，持续转向玩家）
    | { kind: 'homing'; interval: number; speed: number; turnRate: number; firstDelay?: number }
    // 重力抛物弹（朝玩家方向固定仰角）
    | { kind: 'lob'; interval: number; speed: number; gravity: number; firstDelay?: number }
    // 环形弹幕（count 向均匀分布）
    | { kind: 'ring'; interval: number; count: number; speed: number };

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
// 右侧额外回收余量：容纳成排/宽体生成物入场
const ENTITY_DESPAWN_RIGHT_EXTRA = 700;

const DEFAULT_HITBOX: EntityHitbox = { offsetX: -15, offsetY: -14, width: 32, height: 20 };

class EntityManager {
    public entityList: Entity[] = [];

    // 使用配置生成敌怪
    spawn(config: EntityConfig): void {
        const firstDelay = config.attack && 'firstDelay' in config.attack ? config.attack.firstDelay : undefined;
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
            attackTimer: config.attack
                ? config.attack.interval - (firstDelay ?? config.attack.interval)
                : 0,
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

    // 造成损伤，击杀时返还颜色条
    damage(entity: Entity, amount: number): void {
        if (entity.dead) {
            return;
        }
        entity.hitPoints -= amount;
        if (entity.hitPoints <= 0) {
            entity.dead = true;
            if (entity.colorReward > 0) {
                player.addColor(entity.colorReward);
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

            // 出界回收
            if (entity.x + entity.hitbox.width < -ENTITY_DESPAWN_MARGIN
                || entity.x - entity.hitbox.width > VIEW_WIDTH + ENTITY_DESPAWN_MARGIN + ENTITY_DESPAWN_RIGHT_EXTRA) {
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
                entity.y = entity.baseY + entity.behavior.amplitude * Math.sin(entity.phase);
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
        const targetX = player.playerX;
        const targetY = player.playerY + PLAYER_HITBOX_CENTER_Y;

        if (attack.kind === 'ring') {
            for (let i = 0; i < attack.count; i++) {
                const angle = (Math.PI * 2 * i) / attack.count;
                projectileManager.spawn({
                    x: entity.x,
                    y: entity.y,
                    vx: Math.cos(angle) * attack.speed,
                    vy: Math.sin(angle) * attack.speed,
                    behavior: { kind: 'linear' },
                    friendly: false,
                    lifetime: 6,
                });
            }
            return;
        }
        if (attack.kind === 'lob') {
            const directionX = targetX >= entity.x ? 1 : -1;
            const elevation = 35 * Math.PI / 180;
            projectileManager.spawn({
                x: entity.x,
                y: entity.y,
                vx: Math.cos(elevation) * attack.speed * directionX,
                vy: -Math.sin(elevation) * attack.speed,
                behavior: { kind: 'gravity', g: attack.gravity },
                friendly: false,
                lifetime: 6,
            });
            return;
        }

        const angle = Math.atan2(targetY - entity.y, targetX - entity.x);
        if (attack.kind === 'accel') {
            projectileManager.spawn({
                x: entity.x,
                y: entity.y,
                vx: Math.cos(angle) * attack.initialSpeed,
                vy: Math.sin(angle) * attack.initialSpeed,
                behavior: { kind: 'accelerate', ax: Math.cos(angle) * attack.accel, ay: Math.sin(angle) * attack.accel, maxSpeed: attack.maxSpeed },
                friendly: false,
                lifetime: 6,
            });
        } else {
            projectileManager.spawn({
                x: entity.x,
                y: entity.y,
                vx: Math.cos(angle) * attack.speed,
                vy: Math.sin(angle) * attack.speed,
                behavior: { kind: 'homing', turnRate: attack.turnRate },
                friendly: false,
                lifetime: 6,
            });
        }
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
