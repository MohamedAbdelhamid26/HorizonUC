const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'github_screenshots');

async function captureViews() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    await win.loadFile(path.join(__dirname, 'index.html'));
    win.show();
    await new Promise(r => setTimeout(r, 2000));

    // Screenshot 1: Capture Studio
    const img1 = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, 'real_capture_view.png'), img1.toPNG());
    console.log('Captured: Capture Studio');

    // Navigate to Settings
    await win.webContents.executeJavaScript(`
        document.querySelectorAll('.nav-links li').forEach(li => {
            if (li.dataset.target === 'view-settings') li.click();
        });
    `);
    await new Promise(r => setTimeout(r, 800));
    const img2 = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, 'real_settings_view.png'), img2.toPNG());
    console.log('Captured: Settings');

    // Activation removed from Free Version

    // Navigate to Library
    await win.webContents.executeJavaScript(`
        document.querySelectorAll('.nav-links li').forEach(li => {
            if (li.dataset.target === 'view-library') li.click();
        });
    `);
    await new Promise(r => setTimeout(r, 800));
    const img4 = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, 'real_library_view.png'), img4.toPNG());
    console.log('Captured: Library');

    // Navigate back to Capture for a clean shot
    await win.webContents.executeJavaScript(`
        document.querySelectorAll('.nav-links li').forEach(li => {
            if (li.dataset.target === 'view-capture') li.click();
        });
    `);
    await new Promise(r => setTimeout(r, 800));

    console.log('All screenshots captured!');
    app.quit();
}

app.whenReady().then(captureViews);
