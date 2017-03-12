'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var nexe = require('../loramatt-nexe');
var path = require('path');
var os = require('os');
var analyzer = require('require-analyzer');

function WebpackNexe(options) {

  this.apply = function (compiler) {

    var externals = compiler.options.externals;

    compiler.plugin('emit', function (compilation, callback) {
      // Create a header string for the generated file:
      // var filelist = 'In this build:\n\n';

      // Should replace
      // console.log(compiler);

      // Loop through all compiled assets,
      // adding a new line item for each filename.
      // for (var filename in compilation.assets) {
      //   filelist += ('- '+ filename +'\n');
      // }


      // Replace module requirements for external dependencies
      // to prevent node from expecting modules as native
      Object.keys(compilation.assets).forEach(function (a) {

        var src = compilation.assets[a].source();

        externals.forEach(function (dep) {
          src = src.replace('module.exports = require("' + dep + '");', 'module.exports = global.require("' + dep + '");');
        });

        compilation.assets[a] = {
          source: function source() {
            return src;
          },
          size: function size() {
            return src.length;
          }
        };
      });

      // console.log('\n\n');
      // console.log(options);
      // console.log('\n\n');

      // compilation.assets.forEach(x => {
      //   console.log(x.source());
      // })

      // Insert this list into the Webpack build as a new file asset:
      // compilation.assets['filelist.md'] = {
      //   source: function() {
      //     return filelist;
      //   },
      //   size: function() {
      //     return filelist.length;
      //   }
      // };

      callback();
    });

    compiler.plugin('done', function (compilation) {

      if (!options.nexe) options.nexe = {};

      var nodeTempDir = options.nexe.nodeTempDir ? options.nexe.nodeTempDir : path.resolve(options.output, '../nexe');
      var exeName = options.executableName || 'main';
      if (os.platform() === 'win32') exeName = exeName + '.exe';

      var settings = {
        input: options.entry, // where the input file is
        output: options.output + '/' + (options.executableName || 'main'), // where to output the compiled binary
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
      nexe.compile(settings, function (err) {
        console.log('FINISHED?');
        if (err) {
          return console.log(err);
        }

        var copyDependencies = {};

        // Compilation finished without errors ? Copy dependencies
        Promise.all(externals.map(function (x) {
          return new Promise(function (resolve, reject) {
            var options = {
              target: path.resolve('.', 'node_modules/' + x), // e.g /Users/some-user/your-package
              reduce: true
            };
            analyzer.analyze(options, function (err, pkgs) {
              if (err) resolve({});else resolve(pkgs);
            });
          });
        })).then(function (res) {
          // Copy external dependencies
          var exts = {};
          externals.forEach(function (e) {
            exts[e] = true;
          });
          var deps = Object.keys(res.reduce(function (p, n) {
            return _extends({}, p, n);
          }, exts));

          var nm = path.resolve(options.output, 'node_modules');
          if (deps.length > 0) {
            // Init node modules folder
            _fsExtra2.default.emptyDirSync(nm);
          }
          deps.forEach(function (d) {
            var module = path.resolve('node_modules', d);
            var target = path.resolve(nm, d);
            _fsExtra2.default.copySync(module, target);
          });
        });
      });
    });
  };
}

module.exports = WebpackNexe;
