import { VIEW_WIDTH, VIEW_HEIGHT } from './view';
import { inputManager } from './input';
import { player } from './player';
import { entityManager } from './entity';
import { projectileManager } from './projectile';
import { restorePropPalette } from './scenery';
import { skyStatus } from './level';
import { captionManager, screenFlash, drawText,
    CAPTION_TOP_CENTER, CAPTION_MID_TOP, CAPTION_MID_BOTTOM,
    CAPTION_LEFT_THIRD, CAPTION_RIGHT_THIRD, CAPTION_ABOVE_HP, CAPTION_ABOVE_COLOR } from './caption';
import { STAGES, StageConfig, SpawnRule, runSpawnRule, pickObstacleDef, spawnObstacleDef, spawnEasyObstacle, spawnTutorialBird } from './stages';

// 游戏状态
type GameState = 'intro' | 'title' | 'tutorial' | 'stage' | 'stageClear' | 'finale';

const INTRO_TEXT1_AT = 0.8;
const INTRO_FLASH1_AT = 4.0;
const INTRO_TEXT2_AT = 4.3;
const INTRO_FLASH2_AT = 7.5;

const TUTORIAL_SEG1 = 5;
const TUTORIAL_SEG2 = 5;
const TUTORIAL_SEG3 = 20;
const TUTORIAL_SEG4 = 20;

const TITLE_PULSE_PERIOD = 1.6;

// 被动颜色增速
const PASSIVE_COLOR_RATE = 1 / 400;
// 生成循环周期
const SPAWN_CYCLE = 5;
// 敌怪轮触发概率（其余为障碍轮）
const ENEMY_BURST_CHANCE = 0.6;
// 敌怪轮：执行次数与间隔
const ENEMY_BURST_COUNT = 5;
const ENEMY_BURST_INTERVAL = 1;
// 障碍轮：生成个数
const OBSTACLE_BURST_COUNT = 3;
// 难级障碍出现后，同轮内下一障碍的最小间隔
const HARD_OBSTACLE_GAP = 4;
// 开场文本首行延迟与行距
const INTRO_LINE_AT = 0.5;
const INTRO_LINE_STEP = 1.6;
// 关卡完成静场时长
const STAGE_CLEAR_HOLD = 1.5;

// 波次：一种生成规则连发多次；障碍轮由全局闸门控制节奏
interface Burst {
    kind: SpawnRule | 'obstacle';
    remaining: number;
    tickTimer: number;
    interval: number;
}

class Director {
    public state: GameState = 'intro';
    public stateTime: number = 0;
    // 当前关卡序号（0=红 ... 5=紫）
    public stageIndex: number = 0;
    // 游戏正式开始（标题之后）才显示 HUD 与接受输入
    public hudVisible: boolean = false;

    // intro 黑暗遮罩：0 全屏 / 1 下半屏 / 2 无
    private maskLevel: number = 0;
    // 状态内一次性事件标记
    private firedKeys: Set<string> = new Set();
    // 教程完成标记：仅存于脚本内存，刷新页面即重置
    private tutorialDone: boolean = false;
    // 关卡生成循环计时
    private cycleTimer: number = 0;
    // 活动波次
    private bursts: Burst[] = [];
    // 障碍全局闸门：下一障碍允许生成时刻 / 难级冷却到期时刻（stateTime 基准，跨波次生效）
    private obstacleWaitUntil: number = 0;
    private hardWaitUntil: number = 0;

    update(elapsedTime: number): void {
        this.stateTime += elapsedTime;
        switch (this.state) {
            case 'intro':
                this.updateIntro();
                break;
            case 'title':
                this.updateTitle();
                break;
            case 'tutorial':
                this.updateTutorial();
                break;
            case 'stage':
                this.updateStage(elapsedTime);
                break;
            case 'stageClear':
                if (this.stateTime >= STAGE_CLEAR_HOLD) {
                    if (this.stageIndex < STAGES.length - 1) {
                        this.setState('stage', this.stageIndex + 1);
                    } else {
                        this.setState('finale');
                    }
                }
                break;
            case 'finale':
                break;
        }
        captionManager.update(elapsedTime);
        screenFlash.update(elapsedTime);
    }

    render(context: CanvasRenderingContext2D): void {
        // intro 黑暗遮罩：浮字与闪光绘制在遮罩之上
        if (this.state === 'intro') {
            context.fillStyle = '#050505';
            if (this.maskLevel === 0) {
                context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
            } else if (this.maskLevel === 1) {
                context.fillRect(0, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT / 2);
            }
        }

        // 标题画面
        if (this.state === 'title') {
            drawText(context, 'Colorless City', VIEW_WIDTH / 2, VIEW_HEIGHT * 0.30, '#fffdf0', 1, 52);
            const pulse = 0.75 + 0.25 * Math.sin(this.stateTime * Math.PI * 2 / TITLE_PULSE_PERIOD);
            drawText(context, 'Press any key to start taking back colors', VIEW_WIDTH / 2, VIEW_HEIGHT * 0.40, '#bdbdbd', pulse, 24);
        }

        captionManager.render(context);
        screenFlash.render(context);
    }

    // 状态内一次性触发：key 已触发则跳过
    private once(key: string, action: () => void): void {
        if (this.firedKeys.has(key)) {
            return;
        }
        this.firedKeys.add(key);
        action();
    }

    private setState(state: GameState, stageIndex: number = 0): void {
        this.state = state;
        this.stateTime = 0;
        this.firedKeys.clear();
        if (state === 'title') {
            // 标题画面独角兽位于屏幕中央
            player.playerX = VIEW_WIDTH / 2;
            captionManager.clear();
        } else if (state === 'stage') {
            // 颜色条清零，波次与障碍闸门重置
            this.stageIndex = stageIndex;
            player.colorPoint = 0;
            this.cycleTimer = 0;
            this.bursts.length = 0;
            this.obstacleWaitUntil = 0;
            this.hardWaitUntil = 0;
        } else if (state === 'finale') {
            // 终局：长闪光、彩虹、免伤自由奔跑
            screenFlash.trigger(1.0);
            skyStatus.rainbow = true;
            player.invulnerable = true;
            captionManager.show({ text: 'The rainbow returns.\n\nThank you for playing.', ...CAPTION_TOP_CENTER, hold: 5, size: 32 });
        }
    }

    private updateIntro(): void {
        const t = this.stateTime;
        if (t >= INTRO_TEXT1_AT) {
            this.once('text1', () => {
                captionManager.show({
                    text: 'Woke up from the biting cold\n\nRealized the world lost its color',
                    x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2,
                    fadeIn: 0.6, hold: 2.0, fadeOut: 0.4, size: 30,
                });
            });
        }
        if (t >= INTRO_FLASH1_AT) {
            this.once('flash1', () => {
                screenFlash.trigger(0.35);
                this.maskLevel = 1;
            });
        }
        if (t >= INTRO_TEXT2_AT) {
            this.once('text2', () => {
                captionManager.show({
                    text: 'As a unicorn\n\nIt\'s time to take responsibility.',
                    x: VIEW_WIDTH / 2, y: VIEW_HEIGHT * 0.7,
                    fadeIn: 0.6, hold: 1.8, fadeOut: 0.4, size: 30,
                });
            });
        }
        if (t >= INTRO_FLASH2_AT) {
            this.once('flash2', () => {
                screenFlash.trigger(0.35);
                this.maskLevel = 2;
                this.setState('title');
            });
        }
    }

    private updateTitle(): void {
        const info = inputManager.getInfo();
        if (info.pressedCodes.size > 0 || info.releasedCodes.size > 0 || inputManager.isMouseLeftPressed()) {
            // 消费开场按键/点击，避免同帧误触发跳跃/射击
            inputManager.endFrame();
            this.hudVisible = true;
            this.setState(this.tutorialDone ? 'stage' : 'tutorial');
        }
    }

    private updateTutorial(): void {
        const t = this.stateTime;

        // 段1：键位提示
        this.once('seg1', () => {
            captionManager.show({ text: '[KeyW] to jump', ...CAPTION_MID_TOP, hold: 4 });
            captionManager.show({ text: '[KeyS] to accelerate falling', ...CAPTION_MID_BOTTOM, hold: 4 });
            captionManager.show({ text: '[KeyA] to move left', ...CAPTION_LEFT_THIRD, hold: 4 });
            captionManager.show({ text: '[KeyD] to move right', ...CAPTION_RIGHT_THIRD, hold: 4 });
        });

        // 段2：UI 说明
        if (t >= TUTORIAL_SEG1) {
            this.once('seg2', () => {
                captionManager.clear();
                captionManager.show({ text: 'This shows your \nhit points', ...CAPTION_ABOVE_HP, hold: 4 });
                captionManager.show({ text: 'This shows your progress\nin taking back colors', ...CAPTION_ABOVE_COLOR, hold: 4, size: 20 });
            });
        }

        // 段3：躲避障碍，5/10/15 秒各生成一个易级障碍物
        if (t >= TUTORIAL_SEG1 + TUTORIAL_SEG2) {
            this.once('seg3', () => {
                captionManager.clear();
                captionManager.show({ text: 'Avoid black obstacles!', ...CAPTION_TOP_CENTER, hold: 19 });
            });
            for (let i = 0; i < 3; i++) {
                const spawnAt = TUTORIAL_SEG1 + TUTORIAL_SEG2 + 5 + i * 5;
                if (t >= spawnAt) {
                    this.once(`tutorialObstacle${i}`, () => spawnEasyObstacle());
                }
            }
        }

        // 段4：射击教学，5/10/15 秒各生成一只仅向左移动的敌怪
        if (t >= TUTORIAL_SEG1 + TUTORIAL_SEG2 + TUTORIAL_SEG3) {
            this.once('seg4', () => {
                captionManager.clear();
                captionManager.show({ text: '[Mouse] to shoot', ...CAPTION_TOP_CENTER, hold: 19 });
            });
            for (let i = 0; i < 3; i++) {
                const spawnAt = TUTORIAL_SEG1 + TUTORIAL_SEG2 + TUTORIAL_SEG3 + 5 + i * 5;
                if (t >= spawnAt) {
                    this.once(`tutorialEnemy${i}`, () => spawnTutorialBird());
                }
            }
        }

        // 教程结束
        if (t >= TUTORIAL_SEG1 + TUTORIAL_SEG2 + TUTORIAL_SEG3 + TUTORIAL_SEG4) {
            this.once('done', () => {
                captionManager.clear();
                this.tutorialDone = true;
                this.setState('stage', 0);
            });
        }
    }

    // 通用关卡更新：开场文本、被动颜色、周期波次、完成判定
    private updateStage(elapsedTime: number): void {
        const config = STAGES[this.stageIndex];
        const t = this.stateTime;

        // 开场文本逐次浮现
        config.introLines.forEach((line, index) => {
            if (t >= INTRO_LINE_AT + index * INTRO_LINE_STEP) {
                this.once(`intro${index}`, () => {
                    captionManager.show({
                        text: line,
                        x: VIEW_WIDTH / 2, y: 200 + index * 60,
                        color: config.themeColor,
                        size: line.length > 36 ? 24 : 28,
                        hold: 2.4,
                    });
                });
            }
        });

        // 被动颜色增长
        player.addColor(PASSIVE_COLOR_RATE * elapsedTime);

        // 生成循环：每 SPAWN_CYCLE 秒随机开启一轮波次
        this.cycleTimer += elapsedTime;
        while (this.cycleTimer >= SPAWN_CYCLE) {
            this.cycleTimer -= SPAWN_CYCLE;
            this.startBurst(config);
        }

        // 推进波次
        for (const burst of this.bursts) {
            burst.tickTimer += elapsedTime;
            while (burst.tickTimer >= burst.interval && burst.remaining > 0) {
                // 障碍全局间隔闸门：未到允许时刻则延迟本次生成，不消耗剩余次数
                if (burst.kind === 'obstacle' && this.stateTime < this.obstacleWaitUntil) {
                    burst.tickTimer = this.obstacleWaitUntil - this.stateTime;
                    break;
                }
                burst.tickTimer -= burst.interval;
                burst.remaining--;
                if (burst.kind === 'obstacle') {
                    // 难级资格全局判定：冷却期内难级权重并入中级
                    const def = pickObstacleDef(config.obstacleTiers, this.stateTime >= this.hardWaitUntil);
                    spawnObstacleDef(def);
                    if (def.tier === 2) {
                        this.hardWaitUntil = this.stateTime + HARD_OBSTACLE_GAP;
                    }
                    this.obstacleWaitUntil = this.stateTime + Math.max(burst.interval, def.tier === 2 ? HARD_OBSTACLE_GAP : 0);
                } else {
                    runSpawnRule(burst.kind, config);
                }
            }
        }
        this.bursts = this.bursts.filter(burst => burst.remaining > 0);

        // 颜色条集满：闪光、清场、恢复近景颜色，进入下一阶段
        if (player.colorPoint >= 1) {
            screenFlash.trigger(0.5);
            entityManager.clear();
            projectileManager.clear();
            captionManager.clear();
            this.bursts.length = 0;
            if (config.restorePalette) {
                restorePropPalette(config.restorePalette);
            }
            // 蓝色关完成后天空色调回暖
            if (this.stageIndex === 3) {
                skyStatus.color = '#33333b';
            }
            this.setState('stageClear');
        }
    }

    // 开启一轮波次：敌怪轮（池内抽规则）或障碍轮
    private startBurst(config: StageConfig): void {
        if (Math.random() < ENEMY_BURST_CHANCE) {
            const rule = config.enemyPool[Math.floor(Math.random() * config.enemyPool.length)];
            this.bursts.push({ kind: rule, remaining: ENEMY_BURST_COUNT, tickTimer: ENEMY_BURST_INTERVAL, interval: ENEMY_BURST_INTERVAL });
        } else {
            this.bursts.push({ kind: 'obstacle', remaining: OBSTACLE_BURST_COUNT, tickTimer: config.obstacleInterval, interval: config.obstacleInterval });
        }
    }
}

const director = new Director();
export { director };
