// 输入信息快照
export interface InputInfo {
    // 按住
    downCodes: ReadonlySet<string>;
    // 按下
    pressedCodes: ReadonlySet<string>;
    // 松开
    releasedCodes: ReadonlySet<string>;
}

class InputManager {
    downCodes: Set<string> = new Set();
    pressedCodes: Set<string> = new Set();
    releasedCodes: Set<string> = new Set();

    constructor() {
        addEventListener('keydown', (e: KeyboardEvent) => {
            // 禁止页面滚动
            if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
            if (!e.repeat) this.pressedCodes.add(e.code);
            this.downCodes.add(e.code);
        });
        addEventListener('keyup', (e: KeyboardEvent) => {
            this.downCodes.delete(e.code);
            this.releasedCodes.add(e.code);
        });
        addEventListener('blur', () => {
            this.downCodes.clear();
        });
    }

    isKeyDown(code: string): boolean {
        return this.downCodes.has(code);
    }

    isKeyJustPressed(code: string): boolean {
        return this.pressedCodes.has(code);
    }

    isKeyJustReleased(code: string): boolean {
        return this.releasedCodes.has(code);
    }

    getInfo(): InputInfo {
        return {
            downCodes: this.downCodes,
            pressedCodes: this.pressedCodes,
            releasedCodes: this.releasedCodes,
        };
    }

    endFrame(): void {
        this.pressedCodes.clear();
        this.releasedCodes.clear();
    }
}

const inputManager = new InputManager();
export { inputManager };
