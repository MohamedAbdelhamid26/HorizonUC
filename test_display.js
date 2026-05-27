const { app, screen } = require('electron');
app.whenReady().then(() => {
    console.log(screen.getPrimaryDisplay());
    app.quit();
});
