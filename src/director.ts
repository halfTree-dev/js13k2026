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
import { STAGES, rollObstacle, rollEnemy, spawnObstacleDef, spawnEnemyWave, spawnTutorialPole, spawnTutorialMoth } from './stages';

// 游戏状态
type GameState = 'intro' | 'title' | 'tutorial' | 'stage' | 'stageClear' | 'finale';

const INTRO_TEXT1_AT = 0.8;
const INTRO_FLASH1_AT = 4.0;
const INTRO_TEXT2_AT = 4.3;
const INTRO_FLASH2_AT = 7.5;

const TUTORIAL_SEG1 = 5;
const TUTORIAL_SEG2 = 5;
const TUTORIAL_SEG3 = 16;
const TUTORIAL_SEG4 = 16;

const TITLE_PULSE_PERIOD = 1.6;

// 被动颜色增长机制已移除，颜色条仅由击杀填充

// 生成计时器初值
const SPAWN_TIMER_INITIAL = 5;
// 开场文本首行延迟与行距
const INTRO_LINE_AT = 0.5;
const INTRO_LINE_STEP = 1.6;
// 关卡完成静场时长
const STAGE_CLEAR_HOLD = 1.5;

// 死亡序列时间轴：白光 → 突然变黑 → 浮字 → 白光复活
const DEFEAT_FLASH_TIME = 0.35;
const DEFEAT_BLACK_AT = 0.25;
const DEFEAT_TEXT_AT = 1.0;
const DEFEAT_REVIVE_AT = 4.2;
const DEFEAT_END_AT = 4.4;

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
    // 障碍/敌怪生成倒计时（归零生成并加上对应实体的定时时长）
    private timerObstacle: number = SPAWN_TIMER_INITIAL;
    private timerEnemy: number = SPAWN_TIMER_INITIAL;
    // 死亡序列计时（-1 表示未激活）
    private defeatTimer: number = -1;
    // 死亡序列期间冻结世界更新
    public worldFrozen: boolean = false;

    update(elapsedTime: number): void {
        if (this.defeatTimer >= 0) {
            this.updateDefeat(elapsedTime);
        } else {
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
                    // 终局谢幕文本：主文本浮现后补充致谢
                    if (this.stateTime >= 3) {
                        this.once('theEnd', () => {
                            captionManager.show({
                                text: 'The End, Thanks for playing!',
                                x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 + 90,
                                fadeIn: 0.6, hold: 6, fadeOut: 1, size: 26,
                            });
                        });
                    }
                    break;
            }
            // 主角倒下：进入死亡序列
            if (player.isDown) {
                this.beginDefeat();
            }
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

        // 死亡序列黑幕：白光闪烁后屏幕突然变黑（浮字与闪光绘制在黑幕之上）
        if (this.defeatTimer >= DEFEAT_BLACK_AT) {
            context.fillStyle = '#050505';
            context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
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
            // 颜色条清零并切换主题色，生成计时器重置
            this.stageIndex = stageIndex;
            player.colorPoint = 0;
            player.colorBarColor = STAGES[stageIndex].themeColor;
            this.timerObstacle = SPAWN_TIMER_INITIAL;
            this.timerEnemy = SPAWN_TIMER_INITIAL;
        } else if (state === 'finale') {
            // 终局：长闪光、彩虹、免伤自由奔跑
            screenFlash.trigger(1.0);
            skyStatus.rainbow = true;
            player.invulnerable = true;
            captionManager.show({ text: 'Chaos is yours.\n\nEnjoy', x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2, hold: 5, size: 34 });
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

        // 段3：躲避障碍，文本出现 4 秒后每 4 秒生成一根黑色电线杆，共 3 根
        if (t >= TUTORIAL_SEG1 + TUTORIAL_SEG2) {
            this.once('seg3', () => {
                captionManager.clear();
                captionManager.show({ text: 'Avoid black obstacles!', ...CAPTION_TOP_CENTER, hold: 15 });
            });
            for (let i = 0; i < 3; i++) {
                const spawnAt = TUTORIAL_SEG1 + TUTORIAL_SEG2 + 4 + i * 4;
                if (t >= spawnAt) {
                    this.once(`tutorialObstacle${i}`, () => spawnTutorialPole());
                }
            }
        }

        // 段4：射击教学，文本出现后每 1.5 秒生成一只半速正弦小飞蛾，共 8 只
        if (t >= TUTORIAL_SEG1 + TUTORIAL_SEG2 + TUTORIAL_SEG3) {
            this.once('seg4', () => {
                captionManager.clear();
                captionManager.show({ text: '[Left Click] to shoot', ...CAPTION_TOP_CENTER, hold: 15 });
            });
            for (let i = 0; i < 8; i++) {
                const spawnAt = TUTORIAL_SEG1 + TUTORIAL_SEG2 + TUTORIAL_SEG3 + i * 1.5;
                if (t >= spawnAt) {
                    this.once(`tutorialEnemy${i}`, () => spawnTutorialMoth());
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

    // 通用关卡更新：开场文本、被动颜色、双生成计时器、完成判定
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

        // 被动颜色增长已移除，颜色条仅由击杀填充

        // 障碍生成倒计时：归零时按难度抽取并生成障碍，随后累加其定时时长
        this.timerObstacle -= elapsedTime;
        while (this.timerObstacle <= 0) {
            const def = rollObstacle(config.obstacleMean);
            spawnObstacleDef(def);
            this.timerObstacle += def.timerAdd;
        }

        // 敌怪生成倒计时：归零时按难度抽取并生成敌怪波，随后累加其定时时长
        this.timerEnemy -= elapsedTime;
        while (this.timerEnemy <= 0) {
            const def = rollEnemy(config.enemyMean);
            spawnEnemyWave(def);
            this.timerEnemy += def.timerAdd;
        }

        // 颜色条集满：闪光、清场、恢复近景颜色，进入下一阶段
        if (player.colorPoint >= 1) {
            screenFlash.trigger(0.5);
            entityManager.clear();
            projectileManager.clear();
            captionManager.clear();
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

    // 进入死亡序列：白光闪起、冻结世界、分数减半
    private beginDefeat(): void {
        this.defeatTimer = 0;
        this.worldFrozen = true;
        screenFlash.trigger(DEFEAT_FLASH_TIME);
        player.score = Math.floor(player.score / 2);
    }

    // 死亡序列：变黑 → 浮字 → 白光复活（关卡阶段不变）
    private updateDefeat(elapsedTime: number): void {
        this.defeatTimer += elapsedTime;
        const t = this.defeatTimer;
        if (t >= DEFEAT_TEXT_AT) {
            this.once('defeatText', () => {
                captionManager.show({
                    text: 'Wake up\n\nYou still got a chance',
                    x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2,
                    fadeIn: 0.6, hold: 2.2, fadeOut: 0.4, size: 34,
                });
            });
        }
        if (t >= DEFEAT_REVIVE_AT) {
            this.once('defeatRevive', () => {
                screenFlash.trigger(DEFEAT_FLASH_TIME);
                player.revive();
                projectileManager.clear();
            });
        }
        if (t >= DEFEAT_END_AT) {
            this.defeatTimer = -1;
            this.worldFrozen = false;
            // 仅清除死亡序列标记，保留关卡内已触发的一次性标记
            this.firedKeys.delete('defeatText');
            this.firedKeys.delete('defeatRevive');
        }
    }
}

const director = new Director();
export { director };
