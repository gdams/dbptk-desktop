const { checkForUpdates } = require("./components/updater");
const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const Loading = require("./components/loading");
const ApplicationMenu = require("./components/application-menu");
const Dbvtk = require("./components/dbvtk");

let title = 'Database Visualization Toolkit';
let windowWidth = 1200;
let windowHeight = 800;
let mainWindow = null;
let serverProcess = null;
let otherInstanceOpen = !app.requestSingleInstanceLock();
let debug = process.env.TK_DEBUG;

if (otherInstanceOpen) {
    console.log("Already open...")
    app.quit();
    return;
}

app.on('ready', async function () {

    let loading = new Loading()
    loading.show();

    let server = new Dbvtk();

    if(!debug){
        try {
            server.getWarFile();
            await server.createProcess();
            serverProcess = server.process;
        } catch (error) {
            console.log(error);
            dialog.showErrorBox(
                'Oops! Something went wrong!',
                error.message
            )
            app.exit()
        }
    } else {
        server.appUrl = server.appUrl + ":" + server.port;
    }

    // Open window with app
    mainWindow = new BrowserWindow({
        title: title,
        frame: true,
        width: windowWidth,
        height: windowHeight,
        minHeight: 500,
        minWidth: 492,
        webPreferences: {
            nodeIntegration: true,
            preload: app.getAppPath() + '/app/helpers/preloader.js'
        }
    });

    checkForUpdates(mainWindow)

    mainWindow.loadURL(server.appUrl + "/?branding=false");
    mainWindow.webContents.once('dom-ready', () => {
        console.log('main loaded')
        mainWindow.show()
        loading.hide();
    })
    new ApplicationMenu().createMenu(mainWindow.webContents, debug);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    mainWindow.on('close', function (e) {
        if (serverProcess) {
            var choice = require('electron').dialog.showMessageBox(this, {
                type: 'question'
                , buttons: ['Yes', 'No']
                , title: 'Confirm'
                , message: 'Dou you really want to exit?'
            });
            if (choice == 1) {
                e.preventDefault();
            }
        }
    });

    // Register a shortcut listener.
    const ret = globalShortcut.register('CommandOrControl+Shift+`', () => {
        console.log('Bring to front shortcut triggered');
        if (mainWindow) {
            mainWindow.focus();
        }
    })
});

app.on('window-all-closed', function () {
    app.quit();
});

app.on('will-quit', (event) => {
    if (serverProcess != null) {
        event.preventDefault();

        // Unregister all shortcuts.
        globalShortcut.unregisterAll();

        console.log('Kill server process ' + serverProcess.pid);

        require('tree-kill')(serverProcess.pid, "SIGTERM", function (err) {
            console.log('Server process killed');
            serverProcess = null;
            app.quit();
        });
    }
});

app.on('second-instance', function (event, commandLine, workingDirectory) {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
    return true;
});