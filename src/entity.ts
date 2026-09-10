import { gameLevel, PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_OFFSET_Y, PLAYER_HITBOX_HEIGHT } from './level';
import { VIEW_WIDTH } from './main';
import { Sprite, drawSprite, ENEMY_PLACEHOLDER } from './sprite';

// 敌怪行为标签：对象包含行为类别字段与参数
type EntityBehavior =
    // 匀速直线
    | { kind: 'linear' };

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
    // 生命周期
    lifetime: number;
    // 已存在时间
    age: number;
    // 生命值
    hitPoints: number;
    // 自定义碰撞盒，相对实体锚点
    hitbox: EntityHitbox;
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
            phase: 0,
            sprite: config.sprite ?? null,
            behavior: config.behavior,
            lifetime: config.lifetime ?? 0,
            age: 0,
            hitPoints: config.hitPoints ?? 1,
            hitbox: config.hitbox ?? DEFAULT_HITBOX,
            dead: false,
        });
    }

    // 清空敌怪列表
    clear(): void {
        this.entityList.length = 0;
    }

    // 造成损伤
    damage(entity: Entity, amount: number): void {
        entity.hitPoints -= amount;
        if (entity.hitPoints <= 0) {
            entity.dead = true;
        }
    }

    // 更新敌怪
    update(elapsedTime: number): void {
        for (const entity of this.entityList) {
            // 生命周期
            entity.age += elapsedTime;
            if (entity.lifetime > 0 && entity.age >= entity.lifetime) {
                entity.dead = true;
                continue;
            }

            this.updateBehavior(entity, elapsedTime);
            entity.baseX += entity.vx * elapsedTime;
            entity.baseY += entity.vy * elapsedTime;
            this.applyOffset(entity, elapsedTime);

            // 出界回收
            if (entity.x < -ENTITY_DESPAWN_MARGIN || entity.x > VIEW_WIDTH + ENTITY_DESPAWN_MARGIN) {
                entity.dead = true;
                continue;
            }

            // 玩家碰撞判定
            if (this.checkPlayerCollision(entity)) {
                gameLevel.damagePlayer();
            }
        }

        // 移除回收
        this.entityList = this.entityList.filter(entity => !entity.dead);
    }

    render(context: CanvasRenderingContext2D): void {
        for (const entity of this.entityList) {
            // 实体以其锚点旋转，旋转角度与基础速度方向一致
            const angle = Math.atan2(entity.vy, entity.vx);
            drawSprite(context, entity.sprite ?? ENEMY_PLACEHOLDER, entity.x, entity.y, 1, 1, false, angle);
        }
    }

    // 依据行为标签更新速度
    private updateBehavior(entity: Entity, elapsedTime: number): void {
        switch (entity.behavior.kind) {
            case 'linear':
                break;
        }
    }

    // 计算实体坐标偏移
    private applyOffset(entity: Entity, elapsedTime: number): void {
        switch (entity.behavior.kind) {
            default:
                entity.x = entity.baseX;
                entity.y = entity.baseY;
                break;
        }
    }

    // 敌怪碰撞盒与玩家碰撞盒（AABB）相交测试
    private checkPlayerCollision(entity: Entity): boolean {
        const left = gameLevel.playerX + PLAYER_HITBOX_OFFSET_X;
        const top = gameLevel.playerY + PLAYER_HITBOX_OFFSET_Y;
        const entityLeft = entity.x + entity.hitbox.offsetX;
        const entityTop = entity.y + entity.hitbox.offsetY;
        return entityLeft < left + PLAYER_HITBOX_WIDTH && entityLeft + entity.hitbox.width > left
            && entityTop < top + PLAYER_HITBOX_HEIGHT && entityTop + entity.hitbox.height > top;
    }
}

const entityManager = new EntityManager();
export { entityManager };
export type { Entity, EntityBehavior, EntityConfig, EntityHitbox };
