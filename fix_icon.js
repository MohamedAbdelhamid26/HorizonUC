const { app, nativeImage } = require('electron');
const fs = require('fs');

app.whenReady().then(() => {
    const img = nativeImage.createFromPath('icon.png');
    const pngBuf = img.toPNG();
    fs.writeFileSync('icon.png', pngBuf);
    
    // Also copy to build/icon.png
    if (fs.existsSync('build')) {
        fs.writeFileSync('build/icon.png', pngBuf);
    }
    
    console.log('Fixed icon.png to true PNG');
    app.quit();
});
