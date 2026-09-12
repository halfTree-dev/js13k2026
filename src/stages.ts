import { VIEW_WIDTH } from './view';
import { GROUND_Y } from './player';
import { entityManager, EntityBehavior, EntityAttack, EntityHitbox } from './entity';
import { GROUND_SCROLL_SPEED } from './level';
import { Sprite,
    PROP_BILLBOARD, PROP_TRAFFIC_SIGN, PROP_STREET_LAMP, PROP_TRAFFIC_CONE,
    PROP_TAXI, PROP_BARRIER, PROP_UTILITY_POLE, PROP_POPLAR,
    PROP_BUSH, PROP_TRASH_BINS, PROP_BIKE,
    PROP_PALETTE_BLACK, PROP_PALETTE_RED, PROP_PALETTE_ORANGE, PROP_PALETTE_YELLOW, PROP_PALETTE_GREEN, PROP_PALETTE_BLUE,
    ENEMY_MOTHLING, ENEMY_DRONE, ENEMY_SPIDER,
    ENEMY_WASP, ENEMY_SPITTER, ENEMY_DRAGONFLY } from './sprite';

// 关卡配置：文本、色板与生成难度均值全部数据化
interface StageConfig {
    // 开场文本颜色
    themeColor: string;
    // 开场文本（逐次浮现）
    introLines: string[];
    // 完成时恢复的近景色板
    restorePalette: string[] | null;
    // 障碍物难度均值
    obstacleMean: number;
    // 敌怪难度均值
    enemyMean: number;
}

const STAGES: StageConfig[] = [
    { themeColor: '#e04848', introLines: ['Look at our savior', "What do you think you're doing"], restorePalette: PROP_PALETTE_RED, obstacleMean: 0.2, enemyMean: 0.15 },
    { themeColor: '#f5a35c', introLines: ['Bright is so inefficient', 'Why feel?'], restorePalette: PROP_PALETTE_ORANGE, obstacleMean: 0.25, enemyMean: 0.2 },
    { themeColor: '#f2dc70', introLines: ["I'm here to liberate"], restorePalette: PROP_PALETTE_YELLOW, obstacleMean: 0.3, enemyMean: 0.25 },
    { themeColor: '#8fce6e', introLines: ['Green will decay', 'Slow death'], restorePalette: PROP_PALETTE_GREEN, obstacleMean: 0.4, enemyMean: 0.3 },
    { themeColor: '#7fb3ec', introLines: ['Sky', 'For lost'], restorePalette: PROP_PALETTE_BLUE, obstacleMean: 0.45, enemyMean: 0.35 },
    { themeColor: '#c9a0ff', introLines: ['I took colors', 'To stop the pain', 'You want it back?'], restorePalette: null, obstacleMean: 0.5, enemyMean: 0.4 },
];

// 击杀颜色奖励（统一 1/55 颜色条）
const KILL_COLOR_REWARD = 1 / 55;

// 障碍物生命值（可被击破）
const OBSTACLE_HIT_POINT = 4;

// 水平移动型敌怪生成高度带
const ENEMY_ROW_Y_MIN = 100;
const ENEMY_ROW_Y_MAX = 550;
// 垂直移动型敌怪生成横坐标带
const ENEMY_COL_X_MIN = 200;
const ENEMY_COL_X_MAX = 1080;
// 垂直敌怪纵列屏外入场起点 / 右移敌怪左侧入场起点
const ENEMY_COL_START_Y = -80;
const ENEMY_RIGHT_ENTER_X = -60;

// 碰撞盒
const MOTHLING_HITBOX: EntityHitbox = { offsetX: -26, offsetY: -18, width: 52, height: 32 };
const DRONE_HITBOX: EntityHitbox = { offsetX: -34, offsetY: -9, width: 68, height: 16 };
const SPIDER_HITBOX: EntityHitbox = { offsetX: -52, offsetY: -40, width: 104, height: 40 };
const WASP_HITBOX: EntityHitbox = { offsetX: -15, offsetY: -19, width: 50, height: 32 };
const SPITTER_HITBOX: EntityHitbox = { offsetX: -46, offsetY: -104, width: 92, height: 104 };
const DRAGONFLY_HITBOX: EntityHitbox = { offsetX: -31, offsetY: -23, width: 70, height: 27 };

// 障碍物定义：碰撞盒近似外接矩形并略内缩
interface ObstacleDef {
    sprite: Sprite;
    hitbox: EntityHitbox;
    // 难度系数（供抽取）
    coeff: number;
    // 生成后的定时器加时（秒）
    timerAdd: number;
}

const OBSTACLE_DEFS: ObstacleDef[] = [
    { sprite: PROP_TRAFFIC_CONE, hitbox: { offsetX: -16, offsetY: -44, width: 32, height: 44 }, coeff: 0.1, timerAdd: 1.5 },
    { sprite: PROP_BUSH, hitbox: { offsetX: -60, offsetY: -70, width: 120, height: 70 }, coeff: 0.15, timerAdd: 2 },
    { sprite: PROP_TRASH_BINS, hitbox: { offsetX: -88, offsetY: -80, width: 180, height: 80 }, coeff: 0.15, timerAdd: 2 },
    { sprite: PROP_BIKE, hitbox: { offsetX: -70, offsetY: -55, width: 140, height: 55 }, coeff: 0.2, timerAdd: 2.5 },
    { sprite: PROP_TAXI, hitbox: { offsetX: -95, offsetY: -85, width: 190, height: 85 }, coeff: 0.25, timerAdd: 3.5 },
    { sprite: PROP_BARRIER, hitbox: { offsetX: -88, offsetY: -62, width: 176, height: 62 }, coeff: 0.25, timerAdd: 3 },
    { sprite: PROP_TRAFFIC_SIGN, hitbox: { offsetX: -20, offsetY: -150, width: 40, height: 150 }, coeff: 0.35, timerAdd: 4 },
    { sprite: PROP_POPLAR, hitbox: { offsetX: -12, offsetY: -300, width: 24, height: 300 }, coeff: 0.5, timerAdd: 4.5 },
    { sprite: PROP_STREET_LAMP, hitbox: { offsetX: -40, offsetY: -240, width: 34, height: 240 }, coeff: 0.6, timerAdd: 6.5 },
    { sprite: PROP_UTILITY_POLE, hitbox: { offsetX: -12, offsetY: -300, width: 24, height: 300 }, coeff: 0.6, timerAdd: 6.5 },
    { sprite: PROP_BILLBOARD, hitbox: { offsetX: -160, offsetY: -310, width: 320, height: 310 }, coeff: 0.9, timerAdd: 7.5 },
];

// 敌怪定义
interface EnemyDef {
    sprite: Sprite;
    // 阵型：count 数量 / row 横排 / col 纵列 / spacing 间隔
    formation: { count: number; kind: 'row' | 'col'; spacing: number };
    vx: number;
    vy: number;
    behavior: EntityBehavior;
    hitPoints: number;
    hitbox: EntityHitbox;
    // 攻击变体，生成时随机抽取一个
    attacks: EntityAttack[];
    coeff: number;
    timerAdd: number;
    // 渲染时水平翻转
    flipX: boolean;
    // 贴地生成（行阵型时纵坐标取地面）
    grounded: boolean;
}

// 定版标记速度的敌怪：移动速度 ×2.2，弹幕速度（含加速弹最大速度/减速弹最小速度）×1.8，
// 追踪弹转向能力 ×0.25，重力弹初始抛射速度 ×1.4，全数敌怪 HitPoints +1
const ENEMY_DEFS: EnemyDef[] = [
    // 0 飞蛾群：左移 + 纵向小幅正弦
    {
        sprite: ENEMY_MOTHLING, formation: { count: 5, kind: 'row', spacing: 120 }, vx: -160 * 2.2, vy: 0,
        behavior: { kind: 'sine', amplitude: 40, frequency: Math.PI },
        hitPoints: 3, hitbox: MOTHLING_HITBOX, attacks: [], coeff: 0.1, timerAdd: 5, flipX: false, grounded: false,
    },
    // 1 飞蛾群：慢速左移 + 纵向大幅正弦
    {
        sprite: ENEMY_MOTHLING, formation: { count: 5, kind: 'row', spacing: 120 }, vx: -100 * 2.2, vy: 0,
        behavior: { kind: 'sine', amplitude: 120, frequency: Math.PI * 2 / 2.6 },
        hitPoints: 3, hitbox: MOTHLING_HITBOX, attacks: [], coeff: 0.1, timerAdd: 6, flipX: false, grounded: false,
    },
    // 2 警卫无人机横排：对玩家发射加速弹/螺旋弹/减速弹（三选一）
    {
        sprite: ENEMY_DRONE, formation: { count: 3, kind: 'row', spacing: 130 }, vx: -240 * 2.2, vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: 3, hitbox: DRONE_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'accel', interval: 3.5 * 0.6, speed: 260 * 1.8, accel: 500, maxSpeed: 700 * 1.8, firstDelay: 1.8 },
            { kind: 'aimed', shot: 'spiral', interval: 3.5 * 0.6, speed: 300 * 1.8, spiralRadius: 40, spiralOmega: 5, firstDelay: 1.8 },
            { kind: 'aimed', shot: 'decel', interval: 3.5 * 0.6, speed: 480 * 1.8, accel: 300, minSpeed: 160 * 1.8, firstDelay: 1.8 },
        ],
        coeff: 0.2, timerAdd: 8, flipX: false, grounded: false,
    },
    // 3 警卫无人机纵列：下落 + 横向正弦，对玩家发射匀速弹/螺旋弹
    {
        sprite: ENEMY_DRONE, formation: { count: 3, kind: 'col', spacing: 110 }, vx: 0, vy: 65 * 2.2,
        behavior: { kind: 'sine', axis: 'x', amplitude: 40, frequency: Math.PI },
        hitPoints: 3, hitbox: DRONE_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'linear', interval: 3.5 * 0.6, speed: 320 * 1.8, firstDelay: 2 },
            { kind: 'aimed', shot: 'spiral', interval: 3.5 * 0.6, speed: 300 * 1.8, spiralRadius: 36, spiralOmega: 5, firstDelay: 2 },
        ],
        coeff: 0.2, timerAdd: 8, flipX: false, grounded: false,
    },
    // 4 警卫无人机纵列：直线下落，对玩家加速弹/全向重力散射
    {
        sprite: ENEMY_DRONE, formation: { count: 3, kind: 'col', spacing: 110 }, vx: 0, vy: 80 * 2.2,
        behavior: { kind: 'linear' },
        hitPoints: 3, hitbox: DRONE_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'accel', interval: 3.5 * 0.6, speed: 200 * 1.8, accel: 420, maxSpeed: 640 * 1.8, firstDelay: 2 },
            { kind: 'lob', interval: 4 * 0.6, speed: 340 * 1.4, gravity: 900, count: 3, firstDelay: 2 },
        ],
        coeff: 0.3, timerAdd: 9, flipX: false, grounded: false,
    },
    // 5 大型蜘蛛：贴地高跳
    {
        sprite: ENEMY_SPIDER, formation: { count: 5, kind: 'row', spacing: 120 }, vx: -120 * 2.2, vy: 0,
        behavior: { kind: 'hop', amplitude: 250, frequency: Math.PI * 2 / 1.4 },
        hitPoints: 2, hitbox: SPIDER_HITBOX, attacks: [], coeff: 0.2, timerAdd: 10, flipX: false, grounded: true,
    },
    // 6 大型蜘蛛：贴地快移小跳
    {
        sprite: ENEMY_SPIDER, formation: { count: 5, kind: 'row', spacing: 160 }, vx: -180 * 2.2, vy: 0,
        behavior: { kind: 'hop', amplitude: 60, frequency: Math.PI * 2 / 1.1 },
        hitPoints: 3, hitbox: SPIDER_HITBOX, attacks: [], coeff: 0.3, timerAdd: 9, flipX: false, grounded: true,
    },
    // 7 胡蜂横排：快速左移，对玩家匀速/追踪弹
    {
        sprite: ENEMY_WASP, formation: { count: 5, kind: 'row', spacing: 90 }, vx: -240 * 2.2, vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: 2, hitbox: WASP_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'linear', interval: 4 * 0.6, speed: 380 * 1.8, firstDelay: 1.6 },
            { kind: 'aimed', shot: 'homing', interval: 4 * 0.6, speed: 300 * 1.8, turnRate: 2.2 * 0.25, firstDelay: 1.6 },
        ],
        coeff: 0.3, timerAdd: 8, flipX: true, grounded: false,
    },
    // 8 胡蜂纵列：缓降 + 横向正弦，对玩家匀速/追踪弹
    {
        sprite: ENEMY_WASP, formation: { count: 5, kind: 'col', spacing: 100 }, vx: 0, vy: 45 * 2.2,
        behavior: { kind: 'sine', axis: 'x', amplitude: 40, frequency: Math.PI },
        hitPoints: 4, hitbox: WASP_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'linear', interval: 4 * 0.6, speed: 380 * 1.8, firstDelay: 2 },
            { kind: 'aimed', shot: 'homing', interval: 4 * 0.6, speed: 300 * 1.8, turnRate: 2.2 * 0.25, firstDelay: 2 },
        ],
        coeff: 0.5, timerAdd: 10, flipX: false, grounded: false,
    },
    // 9 胡蜂横排：左移 + 纵向正弦，对玩家三枚加速弹/追踪弹
    {
        sprite: ENEMY_WASP, formation: { count: 5, kind: 'row', spacing: 100 }, vx: -120 * 2.2, vy: 0,
        behavior: { kind: 'sine', amplitude: 50, frequency: Math.PI },
        hitPoints: 3, hitbox: WASP_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'accel', count: 3, spreadDeg: 24, interval: 4 * 0.6, speed: 240 * 1.8, accel: 450, maxSpeed: 660 * 1.8, firstDelay: 1.6 },
            { kind: 'aimed', shot: 'homing', interval: 4 * 0.6, speed: 300 * 1.8, turnRate: 2.2 * 0.25, firstDelay: 1.6 },
        ],
        coeff: 0.5, timerAdd: 10, flipX: true, grounded: false,
    },
    // 10 喷吐花：扎根地面随世界滚动，向天空随机角抛射重力弹
    {
        sprite: ENEMY_SPITTER, formation: { count: 5, kind: 'row', spacing: 160 }, vx: -GROUND_SCROLL_SPEED, vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: 4, hitbox: SPITTER_HITBOX,
        attacks: [{ kind: 'lob', skyward: true, interval: 4 * 0.6, speed: 460 * 1.4, gravity: 900, firstDelay: 1.5 }],
        coeff: 0.3, timerAdd: 14, flipX: false, grounded: true,
    },
    // 11 涡流蜻蜓：慢速左移 + 纵向正弦，对玩家螺旋弹/六向环形弹
    {
        sprite: ENEMY_DRAGONFLY, formation: { count: 3, kind: 'row', spacing: 160 }, vx: -60 * 2.2, vy: 0,
        behavior: { kind: 'sine', amplitude: 60, frequency: Math.PI * 2 / 2.4 },
        hitPoints: 5, hitbox: DRAGONFLY_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'spiral', interval: 5 * 0.6, speed: 280 * 1.8, spiralRadius: 32, spiralOmega: 4.5, firstDelay: 1.5 },
            { kind: 'ring', interval: 5 * 0.6, count: 6, speed: 260 * 1.8, firstDelay: 1.5 },
        ],
        coeff: 0.7, timerAdd: 16, flipX: true, grounded: false,
    },
    // 12 涡流蜻蜓：慢速右移（自左侧入场），其余同 11
    {
        sprite: ENEMY_DRAGONFLY, formation: { count: 3, kind: 'row', spacing: 160 }, vx: 60 * 2.2, vy: 0,
        behavior: { kind: 'sine', amplitude: 60, frequency: Math.PI * 2 / 2.4 },
        hitPoints: 5, hitbox: DRAGONFLY_HITBOX,
        attacks: [
            { kind: 'aimed', shot: 'spiral', interval: 5 * 0.6, speed: 280 * 1.8, spiralRadius: 32, spiralOmega: 4.5, firstDelay: 1.5 },
            { kind: 'ring', interval: 5 * 0.6, count: 6, speed: 260 * 1.8, firstDelay: 1.5 },
        ],
        coeff: 0.7, timerAdd: 16, flipX: false, grounded: false,
    },
];

// 难度抽取：target 在 mean ± (mean - 0.1) 内随机，取系数最接近者（并列时随机）
function rollDef<T extends { coeff: number }>(defs: T[], mean: number): T {
    const halfRange = mean - 0.1;
    const target = mean + (Math.random() * 2 - 1) * halfRange;
    let bestDiff = Infinity;
    let bestPool: T[] = [];
    for (const def of defs) {
        const diff = Math.abs(def.coeff - target);
        if (diff < bestDiff - 1e-6) {
            bestDiff = diff;
            bestPool = [def];
        } else if (diff < bestDiff + 1e-6) {
            bestPool.push(def);
        }
    }
    return bestPool[Math.floor(Math.random() * bestPool.length)];
}

function rollObstacle(mean: number): ObstacleDef {
    return rollDef(OBSTACLE_DEFS, mean);
}

function rollEnemy(mean: number): EnemyDef {
    return rollDef(ENEMY_DEFS, mean);
}

// 生成障碍物：纯黑、贴地、与世界同速左移、渲染在玩家身后、可被击破
function spawnObstacleDef(def: ObstacleDef): void {
    entityManager.spawn({
        x: VIEW_WIDTH + 80 - def.hitbox.offsetX,
        y: GROUND_Y,
        vx: -GROUND_SCROLL_SPEED,
        vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: OBSTACLE_HIT_POINT,
        hitbox: def.hitbox,
        sprite: { ...def.sprite, palette: PROP_PALETTE_BLACK },
        background: true,
    });
}

// 生成一波敌怪：阵型排布 + 攻击变体抽取（首发延迟逐体抖动）
function spawnEnemyWave(def: EnemyDef): void {
    const { count, kind, spacing } = def.formation;
    const rowY = ENEMY_ROW_Y_MIN + Math.random() * (ENEMY_ROW_Y_MAX - ENEMY_ROW_Y_MIN);
    const colX = ENEMY_COL_X_MIN + Math.random() * (ENEMY_COL_X_MAX - ENEMY_COL_X_MIN);
    const baseAttack = def.attacks.length > 0
        ? def.attacks[Math.floor(Math.random() * def.attacks.length)]
        : null;
    for (let i = 0; i < count; i++) {
        // 行：左移自右入，右移自左入；列：自屏幕上方入
        const x = kind === 'col'
            ? colX
            : def.vx >= 0 ? ENEMY_RIGHT_ENTER_X - (count - 1 - i) * spacing : VIEW_WIDTH + 60 + i * spacing;
        const y = kind === 'col'
            ? ENEMY_COL_START_Y - i * spacing
            : def.grounded ? GROUND_Y : rowY;
        entityManager.spawn({
            x,
            y,
            vx: def.vx,
            vy: def.vy,
            behavior: def.behavior,
            hitPoints: def.hitPoints,
            hitbox: def.hitbox,
            sprite: def.sprite,
            colorReward: KILL_COLOR_REWARD,
            attack: baseAttack
                ? { ...baseAttack, firstDelay: (baseAttack.firstDelay ?? 1.5) + 0.3 + Math.random() * 1.2 }
                : undefined,
            flipX: def.flipX,
            phase: Math.random() * Math.PI * 2,
        });
    }
}

// 教程用：生成黑色电线杆障碍
function spawnTutorialPole(): void {
    spawnObstacleDef(OBSTACLE_DEFS.find(def => def.sprite === PROP_UTILITY_POLE)!);
}

// 教程用：半速左移 + 纵向正弦的小飞蛾，无攻击、无颜色奖励
// 高度取站立/轻跳时角尖可达区间，方便练习瞄准
function spawnTutorialMoth(): void {
    entityManager.spawn({
        x: VIEW_WIDTH + 60,
        y: 580 + Math.random() * 70,
        vx: -GROUND_SCROLL_SPEED / 2,
        vy: 0,
        behavior: { kind: 'sine', amplitude: 50, frequency: Math.PI },
        hitPoints: 1,
        hitbox: MOTHLING_HITBOX,
        sprite: ENEMY_MOTHLING,
        flipX: true,
        phase: Math.random() * Math.PI * 2,
    });
}

export { STAGES, ENEMY_DEFS, OBSTACLE_DEFS, rollObstacle, rollEnemy, spawnObstacleDef, spawnEnemyWave, spawnTutorialPole, spawnTutorialMoth };
export type { StageConfig, ObstacleDef, EnemyDef };
