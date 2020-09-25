"use strict";
const path = require("path");
const { default: Parcel, createWorkerFarm } = require("@parcel/core");
const defaultConfigContents = require("@parcel/config-default");
const { NodeFS, MemoryFS } = require("@parcel/fs");

const DIST_DIR = path.join(__dirname, "./dist");

let workerFarm;
module.exports = async function ({ entries, outputFormat, externalModules }) {
  let inputFS = new NodeFS();
  let outputFS = new MemoryFS(workerFarm);

  await outputFS.mkdirp(DIST_DIR);

  let includeNodeModules = {};
  if (externalModules) {
    for (let m of externalModules) {
      includeNodeModules[m] = false;
    }
  }

  try {
    let b = new Parcel({
      entries,
      defaultConfig: {
        bundler: "@parcel/bundler-default",
        transformers: {
          // "types:*.{ts,tsx}": ["@parcel/transformer-typescript-types"],
          // "bundle-text:*": ["@parcel/transformer-inline-string", "..."],
          "data-url:*": ["@parcel/transformer-inline-string", "..."],
          "*.{js,mjs,jsm,jsx,es6,cjs,ts,tsx}": [
            // "@parcel/transformer-react-refresh-babel",
            // "@parcel/transformer-babel",
            "@parcel/transformer-js",
            // "@parcel/transformer-react-refresh-wrap",
          ],
          "*.{json,json5}": ["@parcel/transformer-json"],
          // "*.jsonld": ["@parcel/transformer-jsonld"],
          // "*.toml": ["@parcel/transformer-toml"],
          // "*.yaml": ["@parcel/transformer-yaml"],
          // "*.{gql,graphql}": ["@parcel/transformer-graphql"],
          // "*.{styl,stylus}": ["@parcel/transformer-stylus"],
          // "*.{sass,scss}": ["@parcel/transformer-sass"],
          // "*.less": ["@parcel/transformer-less"],
          // "*.css": ["@parcel/transformer-postcss", "@parcel/transformer-css"],
          // "*.sss": ["@parcel/transformer-sugarss"],
          // "*.{htm,html}": [
          //   "@parcel/transformer-posthtml",
          //   "@parcel/transformer-html",
          // ],
          // "*.pug": ["@parcel/transformer-pug"],
          // "*.coffee": ["@parcel/transformer-coffeescript"],
          // "*.mdx": ["@parcel/transformer-mdx"],
          "url:*": ["@parcel/transformer-raw"],
        },
        namers: ["@parcel/namer-default"],
        runtimes: {
          browser: [
            "@parcel/runtime-js",
            // "@parcel/runtime-browser-hmr",
            // "@parcel/runtime-react-refresh",
          ],
          "service-worker": ["@parcel/runtime-js"],
          "web-worker": ["@parcel/runtime-js"],
          node: ["@parcel/runtime-js"],
        },
        optimizers: {
          // "data-url:*": ["...", "@parcel/optimizer-data-url"],
          // "*.css": ["@parcel/optimizer-cssnano"],
          // "*.js": ["@parcel/optimizer-terser"],
          // "*.html": ["@parcel/optimizer-htmlnano"],
        },
        packagers: {
          // "*.html": "@parcel/packager-html",
          // "*.css": "@parcel/packager-css",
          "*.js": "@parcel/packager-js",
          // "*.ts": "@parcel/packager-ts",
          // "*.jsonld": "@parcel/packager-raw-url",
          // "*": "@parcel/packager-raw",
        },
        resolvers: ["@parcel/resolver-default"],
        reporters: [
          // "@parcel/reporter-cli",
          // "@parcel/reporter-dev-server",
          // "@parcel/reporter-bundle-analyzer",
        ],
        filePath: require.resolve("@parcel/config-default"),
      },
      inputFS: inputFS,
      outputFS: outputFS,
      workerFarm,
      defaultEngines: {
        browsers: ["Chrome 80"],
        node: "14",
      },
      distDir: DIST_DIR,
      patchConsole: false,
      mode: "production",
      minify: false,
      targets: {
        default: {
          outputFormat,
          distDir: DIST_DIR,
          includeNodeModules,
          engines: {
            browsers: "Chrome 80",
          },
        },
      },
    });

    await b.run();

    let output = new Map();
    for (let file of await outputFS.readdir(DIST_DIR)) {
      if (file.endsWith(".map")) continue;
      output.set(
        path.join(DIST_DIR, file),
        await outputFS.readFile(path.join(DIST_DIR, file), "utf8")
      );
    }
    return { distDir: DIST_DIR, output };
  } catch (e) {
    throw e;
  }
};

module.exports.start = async function () {
  workerFarm = createWorkerFarm();
};

module.exports.stop = async function () {
  await workerFarm.end();
};
