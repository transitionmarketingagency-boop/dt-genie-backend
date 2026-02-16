import { register } from "ts-node/esm";
import { pathToFileURL } from "node:url";

// register ts-node ESM loader
register({
  esm: true
});

// now load your TS file
await import(pathToFileURL("./test-end-to-end.ts").href);
