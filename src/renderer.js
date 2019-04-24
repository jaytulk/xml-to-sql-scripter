const { ipcRenderer, remote } = require("electron");
const mainProcess = remote.require("./main.js");

const importButton = document.querySelector("#importButton");
const fs = require("fs");

const typeMapper = {
  "xsd:string": "NVARCHAR(100)",
  "xsd:boolean": "BIT",
  "xsd:decimal": "DECIMAL(18, 0)"
};

document.addEventListener("DOMContentLoaded", () => {
  addEventListeners();
});

function addEventListeners() {
  importButton.addEventListener("click", () => {
    mainProcess.importXMLFiles();
  });
}

function parseXML(content) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(content, "text/xml");
  const schemaDefinition = xml.getElementsByTagName("xsd:schema")[0];

  let fieldDefinitions = [
    ...schemaDefinition.getElementsByTagName("xsd:attribute")
  ];

  let fields = [];

  fields = fieldDefinitions.map(x => {
    return {
      name: x.getAttribute("name"),
      type:
        x.getAttribute("type") ||
        x.getElementsByTagName("xsd:restriction")[0].getAttribute("base")
    };
  });

  const { data, tableName } = parseXMLStructure(xml);
  buildSQLScript(tableName, fields, data);
}

function parseXMLStructure(xml) {
  const xmlDOM = xml.getElementsByTagName("VFPData")[0];

  //remove schema
  const schema = xml.getElementsByTagName("xsd:schema")[0];
  xmlDOM.removeChild(schema);

  const serializer = new XMLSerializer();

  let data = "";
  xmlDOM.childNodes.forEach(x => {
    data += serializer.serializeToString(x);
  });

  return {
    data,
    tableName: xml.getElementsByTagName("VFPData")[0].childNodes[2].tagName
  };
}

function buildSQLScript(tableName, fields, values = []) {
  let outputScript = `CREATE TABLE ##${tableName}\n(`;

  let columnAccessorScript = "";

  fields.forEach((x, i) => {
    outputScript += `\t[${x.name}] ${typeMapper[x.type]}${
      i == fields.length - 1 ? "" : ","
    }\n`;
    columnAccessorScript += `\tTbl.Col.value('@${x.name}', '${
      typeMapper[x.type]
    }')${i == fields.length - 1 ? "" : ","}\n`;
  });

  outputScript += `)\nDECLARE @xml XML\nSET @xml='`;
  values = values.replace(/'/g, "''");

  outputScript += values;
  outputScript += `'\nINSERT INTO ##${tableName}\nSELECT\n`;
  outputScript += columnAccessorScript;
  outputScript += `FROM @xml.nodes('//${tableName}') Tbl(Col)`;

  outputScript += generateCreateScript(tableName, fields);

  writeFile(tableName, outputScript);
}

function generateCreateScript(tableName, fields) {
  let script = `\n\nCREATE TABLE dbo.[${tableName}]\n(`;
  fields.forEach((x, i) => {
    script += `\t[${x.name}] ${typeMapper[x.type]} NULL${
      i == fields.length - 1 ? "" : ","
    }\n`;
  });
  script += ")\n";
  script += `INSERT INTO [${tableName}]\nSELECT * FROM ##${tableName}`;
  script += `\nPRINT('${tableName} successfully created')`;

  return script;
}

ipcRenderer.on("file-imported", (event, filePath, content) => {
  parseXML(content);
});

function writeFile(tableName, content) {
  fs.writeFileSync(
    `${__dirname}/output/${tableName}-${Date.now()}.sql`,
    content
  );
}
