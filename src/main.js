const { app, dialog, BrowserWindow } = require("electron");
const fs = require("fs");

let mainWindow = null;

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    show: false,
    height: 150,
    width: 350,
    autoHideMenuBar: true
  });

  mainWindow.loadURL(`${__dirname}/index.html`);
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
});

exports.importXMLFiles = () => {
  const files = dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    title: "Select XML Files",
    filters: [{ name: "XML Files", extensions: ["xml"] }]
  });

  if (!files) {
    return;
  }

  files.forEach(x => {
    readFile(x);
  });
};

const readFile = filePath => {
  const content = fs.readFileSync(filePath).toString();
  mainWindow.webContents.send("file-imported", filePath, content);
};
