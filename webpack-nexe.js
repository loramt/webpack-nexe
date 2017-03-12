var nexe = require('../loramatt-nexe');
var path = require('path');
var os = require('os');
var analyzer = require('require-analyzer');

import fs from 'fs-extra';

function WebpackNexe(options) {

  this.apply = function(compiler) {

    const externals = compiler.options.externals;

    compiler.plugin('emit', function(compilation, callback) {

      // Replace module requirements for external dependencies
      // to prevent node from expecting modules as native
      Object.keys(compilation.assets).forEach(function(a) {

        let src = compilation.assets[a].source();


        externals.forEach(function(dep) {
          src = src.replace(
            `module.exports = require("${dep}");`,
            `module.exports = global.require("${dep}");`,
          );
        })

        compilation.assets[a] = {
          source: function() {
            return src;
          },
          size: function() {
            return src.length
          }
        };
      });

      callback();
    });

    compiler.plugin('done', function(compilation) {

      if (!options.nexe) options.nexe = {};

      const nodeTempDir = options.nexe.nodeTempDir ? options.nexe.nodeTempDir : path.resolve(options.output, '../nexe');
      let exeName = options.executableName || 'main';
      if (os.platform() === 'win32') exeName = exeName + '.exe';

      const settings = {
        input: options.entry, // where the input file is
        output: `${options.output}/${options.executableName || 'main'}`, // where to output the compiled binary
        nodeVersion: '6.3.0', // node version
        nodeTempDir: nodeTempDir, // where to store node source.
        nodeConfigureArgs: ['opt', 'val'], // for all your configure arg needs.
        nodeMakeArgs: ["-j", "4"], // when you want to control the make process.
        nodeVCBuildArgs: ["nosign", "x64"], // when you want to control the make process for windows.
                                            // By default "nosign" option will be specified
                                            // You can check all available options and its default values here:
                                            // https://github.com/nodejs/node/blob/master/vcbuild.bat
        // python: 'path/to/python', // for non-standard python setups. Or python 3.x forced ones.
        // resourceFiles: [ 'path/to/a/file' ], // array of files to embed.
        // resourceRoot: [ 'path/' ], // where to embed the resourceFiles.
        flags: true, // use this for applications that need command line flags.
        // jsFlags: "--use_strict", // v8 flags
        // startupSnapshot: 'path/to/snapshot.js', // when you want to specify a script to be
                                                // added to V8's startup snapshot. This V8
                                                // feature deserializes a heap to save startup time.
                                                // More information in this blog post:
                                                // http://v8project.blogspot.de/2015/09/custom-startup-snapshots.html
        framework: "node" // node, nodejs, or iojs
      };
      // Run nexe
      nexe.compile(settings, function(err) {
        if(err) {
          return console.log(err);
        }

        var copyDependencies = {};

        // Compilation finished without errors ? Copy dependencies
        Promise.all(externals.map(x =>
          new Promise((resolve, reject) => {
            const options = {
              target: path.resolve('.', `node_modules/${x}`), // e.g /Users/some-user/your-package
              reduce: true
            }
            analyzer.analyze(options, function(err, pkgs) {
              if (err) resolve({});
              else {
                const exts = pkgs;
                pkgs[x] = true; // Add target to dependencies
                resolve(exts);
              }
            });
          })
        )).then((res) => {
          // Copy external dependencies
          const deps = Object.keys(res.reduce((p, n) => ({...p, ...n}), {}));

          const nm = path.resolve(options.output, 'node_modules');
          if (deps.length > 0) {
            // Init node modules folder
            fs.emptyDirSync(nm);
          }
          deps.forEach(d => {
            const module = path.resolve('node_modules', d);
            const target = path.resolve(nm, d);
            fs.copySync(module, target);
          });
        })
      });
    });
  };
}

module.exports = WebpackNexe;