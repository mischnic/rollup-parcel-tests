"use strict";
const assert = require("assert");
const path = require("path");
const chalk = require("chalk");
const fs = require("fs");

const runESM = require("./runESM.js");
const parcel = require("./parcel.js");

let config = {
  "chunking-form/samples/chunk-live-bindings": {
    skip: "Missing shared bundle between ESM entries",
    run(exports) {
      new exports[0].default();
      new exports[1].default();
    },
  },
  "chunking-form/samples/aliasing-extensions": {
    skip: "incompatible",
  },
  "chunking-form/samples/avoid-chunk-import-hoisting": {
    externalModules: {
      lib: () => ({
        default: 4,
      }),
    },
  },
  "chunking-form/samples/chunk-deshadowing-reassignment": {
    skip: "Missing shared bundle between ESM entries",
  },
  "chunking-form/samples/chunk-execution-order": {
    skip: "Missing shared bundle between ESM entries",
  },
  "chunking-form/samples/chunk-import-deshadowing": {
    skip: "Missing shared bundle between ESM entries",
  },
  "chunking-form/samples/chunking-compact": {
    externalModules: {
      external: (ctx) => ({
        fn: () => {
          ctx.console.log("external");
        },
      }),
    },
  },
  "chunking-form/samples/chunking-externals": {
    externalModules: {
      external: () => ({
        fn: () => {
          ctx.console.log("external");
        },
      }),
    },
  },
  "chunking-form/samples/chunking-reexport": {
    skip: "Missing shared bundle between ESM entries",
    externalModules: {
      external: () => ({
        asdf: 1,
      }),
    },
  },
  "chunking-form/samples/chunking-star-external": {
    skip: "Assertion fails",
    externalModules: {
      external1: () => ({ e: 2 }),
      external2: () => ({ e: 4 }),
      starexternal1: () => ({ a: 1, b: 2 }),
      starexternal2: () => ({ c: 3, d: 4 }),
    },
  },
  "chunking-form/samples/circular-entry-points": {
    skip: "Missing shared bundle between ESM entries",
  },
  "chunking-form/samples/deconflict-globals": {
    globals: () => ({
      x: 1,
    }),
  },
  "chunking-form/samples/deduplicate-synthetic-named-exports-and-default": {
    skip: "incompatible",
  },
};

async function test({ baseDir, testDir, entryFiles, external }) {
  const configTest = config[testDir];
  if (configTest?.skip) {
    console.log(chalk.yellow(`Skip: ${testDir} (${configTest.skip})`));
    return true;
  }

  entryFiles = entryFiles.map((f) => (!f.endsWith(".js") ? f + ".js" : f));

  let bundles;
  try {
    const externalModules = configTest?.externalModules;
    if (externalModules || (external && !externalModules)) {
      assert.deepEqual(
        Object.keys(externalModules || {}),
        external,
        "Missing definiton for externals"
      );
    }

    const srcDir = path.join(baseDir, testDir);
    const entries = entryFiles.map((f) => path.join(srcDir, f));
    let nativeOutput = [];
    let nativeExports;
    let bundledOutput = [];
    let bundledExports;
    {
      const { exports } = await runESM({
        entries,
        globals: {
          console: {
            log(...args) {
              nativeOutput.push(args);
            },
          },
          assert,
          ...(configTest?.globals ? configTest?.globals() : null),
        },
        externalModules,
      });
      nativeExports = exports;
      if (configTest?.run) configTest.run(exports);
    }

    {
      let { distDir, output } = await parcel({
        entries,
        outputFormat: "esmodule",
        externalModules: externalModules
          ? Object.keys(externalModules)
          : undefined,
      });
      bundles = output;
      let bundledEntries = entryFiles.map((f) => path.join(distDir, f));
      const { exports } = await runESM({
        entries: bundledEntries,
        globals: {
          console: {
            log(...args) {
              bundledOutput.push(args);
            },
          },
          assert,
          ...(configTest?.globals ? configTest?.globals() : null),
        },
        fs: {
          readFileSync(p) {
            return output.get(p);
          },
        },
        externalModules,
      });
      bundledExports = exports;
      if (configTest?.run) configTest.run(exports);
    }

    assert.deepEqual(bundledOutput, nativeOutput);
    assert.deepEqual(bundledExports, nativeExports);
    console.log(chalk.green(`Pass: ${testDir}`));
    return true;
  } catch (e) {
    console.log(chalk.red(`Fail: ${testDir}`));
    console.error(e);
    if (bundles) {
      for (let [file, content] of bundles) {
        console.log("---------", file, "---------");
        console.log(content);
      }
    }
    return false;
  }
}

let bail = process.argv.slice(2).includes("-b");

async function testDirectory(baseDir, subDir) {
  for (let d of fs.readdirSync(path.join(baseDir, subDir))) {
    const testDir = path.join(subDir, d);
    if (
      testDir === "chunking-form/samples/chunk-naming" ||
      testDir === "chunking-form/samples/deprecated"
    )
      continue;

    const configFile = path.join(baseDir, testDir, "_config.js");
    if (fs.existsSync(configFile)) {
      const { expectedWarnings, options } = require(configFile);
      const { input = ["main.js"], external } = options ?? {};
      if (expectedWarnings?.includes("CIRCULAR_DEPENDENCY")) continue;

      let result = await test({
        baseDir,
        testDir,
        entryFiles: [].concat(input),
        external,
      });
      if (bail && result === false) {
        return false;
      }
    } else {
      if ((await testDirectory(baseDir, testDir)) === false) {
        return false;
      }
    }
  }
}
async function run() {
  parcel.start();
  const baseDir = fs.realpathSync(path.join(__dirname, "../../../rollup/test"));
  const subDir = "chunking-form/samples";
  await testDirectory(baseDir, subDir);

  parcel.stop();
}

run().catch(console.error);
