import { VIEW_WIDTH, VIEW_HEIGHT } from './view';
import { GROUND_Y } from './player';
import { entityManager, EntityHitbox } from './entity';
import { GROUND_SCROLL_SPEED } from './level';
import { Sprite,
    PROP_BILLBOARD, PROP_TRAFFIC_SIGN, PROP_STREET_LAMP, PROP_TRAFFIC_CONE,
    PROP_TAXI, PROP_BARRIER, PROP_UTILITY_POLE, PROP_POPLAR,
    PROP_BUSH, PROP_TRASH_BINS, PROP_BIKE,
    PROP_PALETTE_BLACK, PROP_PALETTE_RED, PROP_PALETTE_ORANGE, PROP_PALETTE_YELLOW, PROP_PALETTE_GREEN, PROP_PALETTE_BLUE,
    ENEMY_MOTHLING, ENEMY_DRONE, ENEMY_SPIDER,
    ENEMY_WASP, ENEMY_SPITTER, ENEMY_DRAGONFLY } from './sprite';

// 生成规则名（波次的敌怪种类）
type SpawnRule = 'motlingSwarm' | 'droneRow' | 'droneColumn' | 'spider' | 'waspSwarm' | 'spitter' | 'dragonfly';

// 关卡配置：文本、色板、敌怪池、障碍难度权重与通用怪数值全部数据化
interface StageConfig {
    // 开场文本颜色
    themeColor: string;
    // 开场文本
    introLines: string[];
    // 完成时恢复的近景色板
    restorePalette: string[] | null;
    // 敌怪池（等概率抽取）
    enemyPool: SpawnRule[];
    // 障碍难度权重 [易, 中, 难]
    obstacleTiers: [number, number, number];
    // 障碍轮内生成间隔
    obstacleInterval: number;
    // 警卫无人机：射击间隔与速度
    drone: { fireInterval: number; speed: number };
    // 大型蜘蛛：跳幅与生命
    spider: { amplitude: number; hp: number };
}

const STAGES: StageConfig[] = [
    {
        themeColor: '#e04848',
        introLines: ['Well, well, well', 'Look at our savior', 'You really think you can take back the colors?'],
        restorePalette: PROP_PALETTE_RED,
        enemyPool: ['motlingSwarm', 'droneRow', 'droneColumn'],
        obstacleTiers: [1, 0, 0],
        obstacleInterval: 2.5,
        drone: { fireInterval: 10, speed: 300 },
        spider: { amplitude: 130, hp: 2 },
    },
    {
        themeColor: '#f5a35c',
        introLines: ['Still chasing colors?'],
        restorePalette: PROP_PALETTE_ORANGE,
        enemyPool: ['motlingSwarm', 'droneRow', 'droneColumn', 'spider'],
        obstacleTiers: [0.7, 0.3, 0],
        obstacleInterval: 2.5,
        drone: { fireInterval: 9, speed: 320 },
        spider: { amplitude: 140, hp: 2 },
    },
    {
        themeColor: '#f2dc70',
        introLines: ['You are just wasting your time.'],
        restorePalette: PROP_PALETTE_YELLOW,
        enemyPool: ['motlingSwarm', 'droneRow', 'droneColumn', 'spider', 'waspSwarm'],
        obstacleTiers: [0.4, 0.6, 0],
        obstacleInterval: 2.5,
        drone: { fireInterval: 8, speed: 340 },
        spider: { amplitude: 150, hp: 2 },
    },
    {
        themeColor: '#8fce6e',
        introLines: ['The city is already used to gray.'],
        restorePalette: PROP_PALETTE_GREEN,
        enemyPool: ['motlingSwarm', 'droneRow', 'droneColumn', 'spider', 'waspSwarm', 'spitter'],
        obstacleTiers: [0.3, 0.5, 0.2],
        obstacleInterval: 2.5,
        drone: { fireInterval: 7, speed: 360 },
        spider: { amplitude: 160, hp: 3 },
    },
    {
        themeColor: '#7fb3ec',
        introLines: ['Give up. The sky belongs to us.'],
        restorePalette: PROP_PALETTE_BLUE,
        enemyPool: ['motlingSwarm', 'droneRow', 'droneColumn', 'spider', 'waspSwarm', 'spitter', 'dragonfly'],
        obstacleTiers: [0, 0.6, 0.4],
        obstacleInterval: 2.5,
        drone: { fireInterval: 6, speed: 380 },
        spider: { amplitude: 170, hp: 3 },
    },
    {
        themeColor: '#c9a0ff',
        introLines: ['Fine. Come and take it all... if you can.'],
        restorePalette: null,
        enemyPool: ['motlingSwarm', 'droneRow', 'droneColumn', 'spider', 'waspSwarm', 'spitter', 'dragonfly'],
        obstacleTiers: [0, 0.3, 0.7],
        obstacleInterval: 4,
        drone: { fireInterval: 5, speed: 400 },
        spider: { amplitude: 180, hp: 3 },
    },
];

// 击杀颜色奖励
const KILL_COLOR_REWARD = 1 / 40;

// 敌怪生成高度带（屏幕 1/4 到 1/2 高度）
const ENEMY_HEIGHT_MIN = VIEW_HEIGHT / 4;
const ENEMY_HEIGHT_MAX = VIEW_HEIGHT / 2;

// 小飞蛾（红关基础怪）
const MOTHLING_SPEED = 300;
const MOTHLING_HITBOX: EntityHitbox = { offsetX: -26, offsetY: -18, width: 52, height: 32 };
// 无人机/蜘蛛
const DRONE_HITBOX: EntityHitbox = { offsetX: -34, offsetY: -9, width: 68, height: 16 };
const SPIDER_SPEED = 300;
const SPIDER_HOP_PERIOD = 1.2;
const SPIDER_HITBOX: EntityHitbox = { offsetX: -52, offsetY: -40, width: 104, height: 40 };
// 胡蜂
const WASP_HITBOX: EntityHitbox = { offsetX: -15, offsetY: -19, width: 50, height: 32 };
// 喷吐花
const SPITTER_HITBOX: EntityHitbox = { offsetX: -46, offsetY: -104, width: 92, height: 104 };
// 涡流蜻蜓
const DRAGONFLY_HITBOX: EntityHitbox = { offsetX: -31, offsetY: -23, width: 70, height: 27 };
// 教程敌怪（小飞蛾），高度取站立/轻跳时角尖可达区间，方便练习瞄准
const TUTORIAL_BIRD_SPEED = 300;
const TUTORIAL_BIRD_HITBOX: EntityHitbox = MOTHLING_HITBOX;

// 障碍物定义：碰撞盒近似外接矩形并略内缩；tier 0=易 1=中 2=难
interface ObstacleDef {
    sprite: Sprite;
    hitbox: EntityHitbox;
    tier: number;
}

const OBSTACLE_DEFS: ObstacleDef[] = [
    { sprite: PROP_BILLBOARD, hitbox: { offsetX: -160, offsetY: -310, width: 320, height: 310 }, tier: 2 },
    { sprite: PROP_TRAFFIC_SIGN, hitbox: { offsetX: -20, offsetY: -150, width: 40, height: 150 }, tier: 1 },
    { sprite: PROP_STREET_LAMP, hitbox: { offsetX: -40, offsetY: -240, width: 34, height: 240 }, tier: 2 },
    { sprite: PROP_TRAFFIC_CONE, hitbox: { offsetX: -16, offsetY: -44, width: 32, height: 44 }, tier: 0 },
    { sprite: PROP_TAXI, hitbox: { offsetX: -95, offsetY: -85, width: 190, height: 85 }, tier: 1 },
    { sprite: PROP_BARRIER, hitbox: { offsetX: -88, offsetY: -62, width: 176, height: 62 }, tier: 1 },
    { sprite: PROP_UTILITY_POLE, hitbox: { offsetX: -12, offsetY: -300, width: 24, height: 300 }, tier: 2 },
    { sprite: PROP_POPLAR, hitbox: { offsetX: -12, offsetY: -300, width: 24, height: 300 }, tier: 2 },
    { sprite: PROP_BUSH, hitbox: { offsetX: -60, offsetY: -70, width: 120, height: 70 }, tier: 0 },
    { sprite: PROP_TRASH_BINS, hitbox: { offsetX: -88, offsetY: -80, width: 180, height: 80 }, tier: 0 },
    { sprite: PROP_BIKE, hitbox: { offsetX: -70, offsetY: -55, width: 140, height: 55 }, tier: 0 },
];

// 依据难度权重抽取障碍物；allowHard=false 时难级权重并入中级（保护规则）
function pickObstacleDef(tiers: [number, number, number], allowHard: boolean): ObstacleDef {
    const hardWeight = allowHard ? tiers[2] : 0;
    const total = tiers[0] + tiers[1] + hardWeight;
    let roll = Math.random() * total;
    let tier = 0;
    if ((roll -= tiers[0]) < 0) {
        tier = 0;
    } else if ((roll -= tiers[1]) < 0) {
        tier = 1;
    } else {
        tier = 2;
    }
    const pool = OBSTACLE_DEFS.filter(def => def.tier === tier);
    return pool[Math.floor(Math.random() * pool.length)];
}

// 生成障碍物：纯黑、贴地、与世界同速左移、渲染在玩家身后
function spawnObstacleDef(def: ObstacleDef): void {
    entityManager.spawn({
        x: VIEW_WIDTH + 80 - def.hitbox.offsetX,
        y: GROUND_Y,
        vx: -GROUND_SCROLL_SPEED,
        vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: 999,
        hitbox: def.hitbox,
        sprite: { ...def.sprite, palette: PROP_PALETTE_BLACK },
        background: true,
    });
}

// 教程用：生成易级随机障碍物
function spawnEasyObstacle(): void {
    const pool = OBSTACLE_DEFS.filter(def => def.tier === 0);
    spawnObstacleDef(pool[Math.floor(Math.random() * pool.length)]);
}

// ---- 敌怪生成工厂 ----

// 警卫无人机：直线左移，定时向玩家发射加速射弹
function spawnDrone(x: number, y: number, config: StageConfig): void {
    entityManager.spawn({
        x,
        y,
        vx: -config.drone.speed,
        vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: 1,
        hitbox: DRONE_HITBOX,
        sprite: ENEMY_DRONE,
        colorReward: KILL_COLOR_REWARD,
        attack: { kind: 'accel', interval: config.drone.fireInterval, initialSpeed: 220, accel: 500, maxSpeed: 700, firstDelay: 2.5 + Math.random() * 1.5 },
    });
}

// 大型蜘蛛：贴地按绝对值正弦轨迹跳动，相位随机
function spawnSpider(config: StageConfig): void {
    entityManager.spawn({
        x: VIEW_WIDTH + 60,
        y: GROUND_Y,
        vx: -SPIDER_SPEED,
        vy: 0,
        behavior: { kind: 'hop', amplitude: config.spider.amplitude, frequency: Math.PI * 2 / SPIDER_HOP_PERIOD },
        hitPoints: config.spider.hp,
        hitbox: SPIDER_HITBOX,
        sprite: ENEMY_SPIDER,
        colorReward: KILL_COLOR_REWARD,
        phase: Math.random() * Math.PI * 2,
    });
}

// 执行一次敌怪生成规则
function runSpawnRule(rule: SpawnRule, config: StageConfig): void {
    switch (rule) {
        case 'motlingSwarm': {
            // 小飞蛾群：4~6 只，小幅正弦轨迹随机振幅/相位，整群计为一次执行
            const count = 4 + Math.floor(Math.random() * 3);
            const y = ENEMY_HEIGHT_MIN + Math.random() * (ENEMY_HEIGHT_MAX - ENEMY_HEIGHT_MIN);
            for (let i = 0; i < count; i++) {
                entityManager.spawn({
                    x: VIEW_WIDTH + 60 + i * 70,
                    y,
                    vx: -MOTHLING_SPEED,
                    vy: 0,
                    behavior: { kind: 'sine', amplitude: 30 + Math.random() * 20, frequency: Math.PI * 2 / (0.9 + Math.random() * 0.5) },
                    hitPoints: 1,
                    hitbox: MOTHLING_HITBOX,
                    sprite: ENEMY_MOTHLING,
                    colorReward: KILL_COLOR_REWARD,
                    phase: Math.random() * Math.PI * 2,
                });
            }
            break;
        }
        case 'droneRow': {
            const y = ENEMY_HEIGHT_MIN + Math.random() * (ENEMY_HEIGHT_MAX - ENEMY_HEIGHT_MIN);
            for (let i = 0; i < 5; i++) {
                spawnDrone(VIEW_WIDTH + 60 + i * 130, y, config);
            }
            break;
        }
        case 'droneColumn': {
            const baseY = ENEMY_HEIGHT_MIN + Math.random() * (ENEMY_HEIGHT_MAX - ENEMY_HEIGHT_MIN);
            for (let i = 0; i < 5; i++) {
                spawnDrone(VIEW_WIDTH + 60, baseY + i * 110, config);
            }
            break;
        }
        case 'spider':
            spawnSpider(config);
            break;
        case 'waspSwarm': {
            // 胡蜂群：4~6 只，正弦轨迹随机振幅/周期/相位，整群计为一次执行
            const count = 4 + Math.floor(Math.random() * 3);
            const y = ENEMY_HEIGHT_MIN + Math.random() * (ENEMY_HEIGHT_MAX - ENEMY_HEIGHT_MIN);
            for (let i = 0; i < count; i++) {
                entityManager.spawn({
                    x: VIEW_WIDTH + 60 + i * 90,
                    y,
                    vx: -350,
                    vy: 0,
                    behavior: { kind: 'sine', amplitude: 60 + Math.random() * 60, frequency: Math.PI * 2 / (0.8 + Math.random() * 0.4) },
                    hitPoints: 1,
                    hitbox: WASP_HITBOX,
                    sprite: ENEMY_WASP,
                    colorReward: KILL_COLOR_REWARD,
                    phase: Math.random() * Math.PI * 2,
                });
            }
            break;
        }
        case 'spitter':
            // 喷吐花：扎根地面随世界滚动，周期抛射重力弹
            entityManager.spawn({
                x: VIEW_WIDTH + 60 - SPITTER_HITBOX.offsetX,
                y: GROUND_Y,
                vx: -GROUND_SCROLL_SPEED,
                vy: 0,
                behavior: { kind: 'linear' },
                hitPoints: 2,
                hitbox: SPITTER_HITBOX,
                sprite: ENEMY_SPITTER,
                colorReward: KILL_COLOR_REWARD,
                attack: { kind: 'lob', interval: 4, speed: 420, gravity: 900, firstDelay: 1.5 },
            });
            break;
        case 'dragonfly':
            // 涡流蜻蜓：上沿巡游带浮动，周期释放环形弹幕
            entityManager.spawn({
                x: VIEW_WIDTH + 60,
                y: VIEW_HEIGHT / 6 + Math.random() * (VIEW_HEIGHT / 4 - VIEW_HEIGHT / 6),
                vx: -220,
                vy: 0,
                behavior: { kind: 'sine', amplitude: 12, frequency: Math.PI * 2 / 1.5 },
                hitPoints: 3,
                hitbox: DRAGONFLY_HITBOX,
                sprite: ENEMY_DRAGONFLY,
                colorReward: KILL_COLOR_REWARD,
                attack: { kind: 'ring', interval: 5, count: 6, speed: 260 },
            });
            break;
    }
}

// 生成教程敌怪：黑色小飞蛾，仅向左移动，无颜色奖励
function spawnTutorialBird(): void {
    entityManager.spawn({
        x: VIEW_WIDTH + 60,
        y: 580 + Math.random() * 70,
        vx: -TUTORIAL_BIRD_SPEED,
        vy: 0,
        behavior: { kind: 'linear' },
        hitPoints: 1,
        hitbox: TUTORIAL_BIRD_HITBOX,
        sprite: ENEMY_MOTHLING,
        flipX: true,
    });
}

export { STAGES, pickObstacleDef, spawnObstacleDef, spawnEasyObstacle, runSpawnRule, spawnTutorialBird, OBSTACLE_DEFS };
export type { StageConfig, SpawnRule, ObstacleDef };
