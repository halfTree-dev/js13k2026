// input.ts
// 管理用户输入

import { screenToView } from './main';

export interface InputInfo {
    downCodes: ReadonlySet<string>;
    pressedCodes: ReadonlySet<string>;
    releasedCodes: ReadonlySet<string>;
}

class InputManager {
    downCodes: Set<string> = new Set();
    pressedCodes: Set<string> = new Set();
    releasedCodes: Set<string> = new Set();

    mouseX: number = 640;
    mouseY: number = 400;
    mouseLeftDown: boolean = false;
    mouseLeftPressed: boolean = false;

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
        addEventListener('mousedown', (e: MouseEvent) => {
            this.updateMousePosition(e);
            if (e.button === 0) {
                this.mouseLeftDown = true;
                this.mouseLeftPressed = true;
            }
        });
        addEventListener('mouseup', (e: MouseEvent) => {
            if (e.button === 0) {
                this.mouseLeftDown = false;
            }
        });
        addEventListener('mousemove', (e: MouseEvent) => {
            this.updateMousePosition(e);
        });
        addEventListener('blur', () => {
            this.downCodes.clear();
            this.mouseLeftDown = false;
        });
    }

    private updateMousePosition(e: MouseEvent): void {
        const position = screenToView(e.clientX, e.clientY);
        this.mouseX = position.x;
        this.mouseY = position.y;
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

    isMouseLeftDown(): boolean {
        return this.mouseLeftDown;
    }

    isMouseLeftPressed(): boolean {
        return this.mouseLeftPressed;
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
        this.mouseLeftPressed = false;
    }
}

const inputManager = new InputManager();
export { inputManager };
