#!/usr/bin/env node
import("./index-dev.ts").then(mod => {
  if (mod.startApp) {
    mod.startApp().catch(console.error);
  }
}).catch(console.error);
