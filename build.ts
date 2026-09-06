// 以 src/main.ts 为入口编译并打包资源为单一 main.js
// index.html，打包后的 main.js 与 assets/ 资产文件将被整理到 build/ 中
// dist/ 将包含上述文件打包后的压缩包

import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import compressing from 'compressing';

const workingRoot = process.cwd();
const entryPath = path.join(workingRoot, 'src', 'main.ts');
const assetsPath = path.join(workingRoot, 'assets');
const templatePath = path.join(workingRoot, 'index.template.html');
const buildPath = path.join(workingRoot, 'build');
const distPath = path.join(workingRoot, 'dist');

function ensurePathExists(targetPath: string, label: string) {
    if (!fs.existsSync(targetPath)) {
        throw new Error(`${label} 不存在: ${targetPath}`);
    }
    console.info(`${label} 路径存在: ${targetPath}`);
}

function resetDirectory(targetPath: string) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.mkdirSync(targetPath, { recursive: true });
    console.info(`重置目录: ${targetPath}`);
}

async function bundleScripts() {
    const outfile = path.join(buildPath, 'main.js');
    const result = await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        minify: true,
        format: 'iife',
        target: 'es2022',
        outfile,
        logLevel: 'silent',
    });

    if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
            console.warn(`esbuild 警告: ${warning.text}`);
        }
    }

    console.info(`已编译 main.js (${fs.statSync(outfile).size} 字节): ${outfile}`);
}

function placeIndexHtml() {
    fs.copyFileSync(templatePath, path.join(buildPath, 'index.html'));
    console.info('已复制 index.template.html -> build/index.html');
}

function copyAssets() {
    fs.cpSync(assetsPath, path.join(buildPath, 'assets'), { recursive: true });
    console.info('已复制 assets -> build/assets');
}

async function packageDist() {
    const packageName = JSON.parse(fs.readFileSync(path.join(workingRoot, 'package.json'), 'utf8')).name;
    const zipPath = path.join(distPath, `${packageName}.zip`);

    await compressing.zip.compressDir(buildPath, zipPath, { ignoreBase: true, compressionLevel: 9 });

    const sizeLimitBytes = 13 * 1024;
    const totalBytes = fs.statSync(zipPath).size;
    const ratio = ((totalBytes / sizeLimitBytes) * 100).toFixed(1);
    const report = `已打包 -> ${zipPath} (${totalBytes} 字节, 最多 ${sizeLimitBytes}, ${ratio}%)`;
    if (totalBytes > sizeLimitBytes) {
        console.warn(`${report} [超出限额！]`);
    } else {
        console.info(report);
    }
}

async function buildScripts() {
    ensurePathExists(entryPath, 'src/main.ts');
    ensurePathExists(assetsPath, 'assets');
    ensurePathExists(templatePath, 'index.template.html');
    resetDirectory(buildPath);
    resetDirectory(distPath);

    await bundleScripts();
    placeIndexHtml();
    copyAssets();
    await packageDist();
}

await buildScripts();
