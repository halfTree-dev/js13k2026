// tools/smoke.ts
// 无头冒烟测试：桩替浏览器环境后驱动游戏主循环，验证与 Note.md 定版对齐的核心流程
// 用法：npm run smoke

type AnyRecord = Record<string, unknown>;

// 类型导入在编译期擦除，不影响运行时桩的加载顺序
import type { EntityConfig } from '../src/entity';
import type { ProjectileConfig } from '../src/projectile';

// ---- 浏览器环境桩（须在任何 src 模块加载前就绪） ----
const canvasStub: AnyRecord = { width: 1280, height: 800 };
const contextStub = new Proxy({}, {
    get: (_target: AnyRecord, prop: string) => {
        if (prop === 'canvas') {
            return canvasStub;
        }
        return () => {};
    },
    set: () => true,
});
canvasStub.getContext = () => contextStub;

let rafCallback: ((time: number) => void) | null = null;
const g = globalThis as unknown as AnyRecord;
g.window = globalThis;
g.document = { querySelector: (selector: string) => (selector === '#game' ? canvasStub : null) };
g.addEventListener = () => {};
g.innerWidth = 1280;
g.innerHeight = 800;
g.devicePixelRatio = 1;
g.requestAnimationFrame = (callback: (time: number) => void) => {
    rafCallback = callback;
    return 0;
};

// ---- 断言工具 ----
let failures = 0;
function assert(condition: boolean, message: string): void {
    if (!condition) {
        failures++;
        console.error(`[FAIL] ${message}`);
    } else {
        console.info(`[ok] ${message}`);
    }
}

async function main(): Promise<void> {
    // 动态加载游戏，确保桩先于模块初始化生效
    await import('../src/main');
    const { director } = await import('../src/director');
    const { player } = await import('../src/player');
    const { entityManager } = await import('../src/entity');
    const { projectileManager } = await import('../src/projectile');
    const { inputManager } = await import('../src/input');
    const { skyStatus } = await import('../src/level');
    const { STAGES, ENEMY_DEFS, spawnEnemyWave } = await import('../src/stages');

    // 生成计数钩子
    const spawnCounts = { background: 0, front: 0, friendlyShots: 0 };
    const origSpawnEntity = entityManager.spawn.bind(entityManager);
    entityManager.spawn = (config: EntityConfig) => {
        if (config.background) {
            spawnCounts.background++;
        } else {
            spawnCounts.front++;
        }
        origSpawnEntity(config);
    };
    const origSpawnProjectile = projectileManager.spawn.bind(projectileManager);
    projectileManager.spawn = (config: ProjectileConfig) => {
        if (config.friendly) {
            spawnCounts.friendlyShots++;
        }
        origSpawnProjectile(config);
    };

    // 以 60fps 步进虚拟时钟
    let now = 0;
    function step(seconds: number): void {
        const frameTime = 1 / 60;
        let remaining = seconds;
        while (remaining > 1e-9) {
            const dt = Math.min(frameTime, remaining);
            now += dt * 1000;
            remaining -= dt;
            const callback = rafCallback;
            rafCallback = null;
            if (!callback) {
                throw new Error('主循环未运行');
            }
            callback(now);
        }
    }

    // 1. 启动演出 → 标题
    step(8);
    assert(director.state === 'title', `8 秒后进入标题画面（实际 ${director.state}）`);

    // 2. 任意键 → 教程（首次游戏）；教程期间保持免伤以保证时序确定
    inputManager.pressedCodes.add('Enter');
    step(1 / 60);
    assert(director.state === 'tutorial', '首次开始进入教程');
    player.invulnerable = true;

    // 3. 教程段3：14/18/22 秒各生成一根电线杆
    step(13.9);
    assert(spawnCounts.background === 0, '段3 文本出现 4 秒前无障碍生成');
    step(0.3);
    assert(spawnCounts.background === 1, '教程 14 秒生成第一根电线杆');
    step(4);
    assert(spawnCounts.background === 2, '教程 18 秒生成第二根电线杆');
    step(4);
    assert(spawnCounts.background === 3, '教程 22 秒生成第三根电线杆');

    // 4. 教程段4：26 秒起每 1.5 秒一只飞蛾，共 8 只
    step(4.1);
    assert(spawnCounts.front >= 1, '教程 26 秒起开始生成飞蛾');
    step(11);
    assert(spawnCounts.front === 8, `教程共生成 8 只飞蛾（实际 ${spawnCounts.front}）`);

    // 5. 教程结束进入红关，颜色条切换主题色（此后保持免伤直至死亡用例）
    step(5);
    assert(director.state === 'stage' && director.stageIndex === 0, '教程结束进入红色关');
    assert(player.colorBarColor === STAGES[0].themeColor, '颜色条呈现关卡主题色');

    // 6. 按住左键持续发射
    spawnCounts.friendlyShots = 0;
    inputManager.mouseLeftDown = true;
    step(2);
    inputManager.mouseLeftDown = false;
    assert(spawnCounts.friendlyShots >= 19 && spawnCounts.friendlyShots <= 21,
        `按住左键 2 秒发射约 20 发（实际 ${spawnCounts.friendlyShots}）`);

    // 7. 关卡双计时器生成与关键数值
    spawnCounts.background = 0;
    spawnCounts.front = 0;
    step(60);
    assert(spawnCounts.background > 5, `60 秒内障碍计时器持续生成（实际 ${spawnCounts.background}）`);
    assert(spawnCounts.front >= 10, `60 秒内敌怪计时器持续生成（实际 ${spawnCounts.front}）`);
    const obstacle = entityManager.entityList.find(entity => entity.background);
    assert(obstacle !== undefined && obstacle.hitPoints === 999, '障碍生命值为 999（不可击破）');
    // 敌怪提速后在场时间短，直接生成一波 0 号敌怪，取队尾实体做数值断言
    spawnEnemyWave(ENEMY_DEFS[0], 0);
    const enemy = entityManager.entityList[entityManager.entityList.length - 1];
    assert(enemy !== undefined && !enemy.background && Math.abs(enemy.colorReward - 1 / 50) < 1e-9, '敌怪击杀奖励随阶段取值（红关 1/50）');
    assert(enemy !== undefined && enemy.hitPoints === 3, `敌怪 HitPoints 在定版基础上 +1（实际 ${enemy?.hitPoints}）`);
    assert(entityManager.entityList.length < 60, `实体列表无泄漏（当前 ${entityManager.entityList.length}）`);

    // 8. 死亡与复活：生命低于 1 触发，阶段不变、分数减半、生命回满、颜色条清空
    player.invulnerable = false;
    player.invincibleTimer = 0;
    player.isDown = false;
    player.hitPoint = 1.5;
    player.score = 10;
    player.damage();
    assert(player.isDown, '生命值低于 1 时主角倒下');
    step(0.5);
    assert(entityManager.entityList.length === 0, `黑屏后清除场上敌怪与障碍（残留 ${entityManager.entityList.length}）`);
    assert(player.playerX === 640, `黑屏后独角兽横坐标重置至 640（实际 ${player.playerX}）`);
    step(4.5);
    assert(!player.isDown && director.state === 'stage' && director.stageIndex === 0, '复活后关卡阶段不变');
    assert(player.hitPoint === 3, `复活后生命值回满（上限 3，实际 ${player.hitPoint}）`);
    assert(player.score === 5, `死亡后分数减半（实际 ${player.score}）`);
    assert(player.colorPoint === 0, '复活后颜色条清空');

    // 9. 逐关推进直至终局（期间免伤保证时序确定）
    player.invulnerable = true;
    for (let i = 1; i < STAGES.length; i++) {
        player.colorPoint = 1;
        step(2.5);
        assert(director.state === 'stage' && director.stageIndex === i, `集满后进入第 ${i + 1} 关`);
        assert(player.colorBarColor === STAGES[i].themeColor, `第 ${i + 1} 关颜色条切换主题色`);
    }
    player.colorPoint = 1;
    step(2.5);
    assert(director.state === 'finale', '紫关完成后进入终局');
    assert(skyStatus.rainbow && player.invulnerable, '终局彩虹与免伤生效');

    // 9. 终局自由奔跑：不再生成任何实体
    spawnCounts.background = 0;
    spawnCounts.front = 0;
    step(10);
    assert(spawnCounts.background === 0 && spawnCounts.front === 0, '终局不再生成障碍与敌怪');

    // 10. 终局免伤状态下逐类直接生成 13 类敌怪，验证特殊入场与出界回收
    // 12 号右移蜻蜓自左侧入场，3 号纵列自上方入场
    spawnEnemyWave(ENEMY_DEFS[12], 0);
    step(0.2);
    assert(entityManager.entityList.some(entity => entity.vx > 0), '12 号敌怪自左侧入场向右移动');
    spawnEnemyWave(ENEMY_DEFS[3], 0);
    step(0.2);
    assert(entityManager.entityList.some(entity => entity.vy > 0 && entity.y < 0), '3 号敌怪纵列自屏幕上方入场');
    for (const def of ENEMY_DEFS) {
        spawnEnemyWave(def, 0);
    }
    step(40);
    assert(entityManager.entityList.length === 0, `全部 13 类敌怪均可出界回收（残留 ${entityManager.entityList.length}）`);

    if (failures > 0) {
        console.error(`\n冒烟测试失败：${failures} 项断言未通过`);
        process.exit(1);
    }
    console.info('\n冒烟测试全部通过');
}

main().catch((error) => {
    console.error('冒烟测试异常：', error);
    process.exit(1);
});
