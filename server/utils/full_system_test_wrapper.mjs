// server/utils/full_system_test_wrapper.mjs
import { exec } from "node:child_process";
import path from "node:path";

const tsFile = path.join("server", "utils", "full_system_test.ts");

console.log("🚀 Running full_system_test.ts via npx ts-node-esm...\n");

const child = exec(`npx ts-node-esm "${tsFile}"`, { shell: true }, (err, stdout, stderr) => {
  if (err) {
    console.error("❌ Test failed:", err.message);
  }
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
});

child.on("exit", (code) => {
  console.log(`\n✅ Full system test finished with code ${code}`);
});
