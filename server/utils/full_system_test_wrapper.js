// server/utils/full_system_test_wrapper.js
const { exec } = require("child_process");
const path = require("path");

const tsFile = path.join("server", "utils", "full_system_test.ts");

console.log("🚀 Running full_system_test.ts via npx ts-node-esm...\n");

const child = exec(`npx ts-node-esm "${tsFile}"`, { shell: true });

child.stdout.on("data", (data) => process.stdout.write(data));
child.stderr.on("data", (data) => process.stderr.write(data));

child.on("exit", (code) => {
  console.log(`\n✅ Full system test finished with code ${code}`);
});
