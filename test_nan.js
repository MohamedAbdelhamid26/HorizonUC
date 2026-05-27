const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
    const win = new BrowserWindow({ show: false });
    try {
        win.setPosition(100.5, 50.5);
        console.log("float success");
    } catch (e) {
        console.log("float error:", e.toString());
    }
    app.quit();
});
