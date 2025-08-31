const { spawn } = require("child_process");
const path = require("path");

async function runPythonScript(scriptPath, inputData) {
  return new Promise((resolve, reject) => {
    const python = spawn(process.env.PYTHON_PATH || "python3", [
      scriptPath,
      JSON.stringify(inputData),
    ]);

    let output = "";
    let error = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${error}`));
      } else {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${output}`));
        }
      }
    });

    python.on("error", (err) => {
      reject(err);
    });
  });
}

async function streamPythonScript(scriptPath, inputData, onData) {
  return new Promise((resolve, reject) => {
    const python = spawn(process.env.PYTHON_PATH || "python3", [
      scriptPath,
      JSON.stringify(inputData),
    ]);

    python.stdout.on("data", (data) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((line) => line.trim());
      lines.forEach((line) => {
        try {
          const parsed = JSON.parse(line);
          onData(parsed);
        } catch (e) {
          console.log("Python output:", line);
        }
      });
    });

    python.stderr.on("data", (data) => {
      console.error("Python error:", data.toString());
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  runPythonScript,
  streamPythonScript,
};
