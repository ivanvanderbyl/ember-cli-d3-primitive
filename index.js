/* jshint node: true */
'use strict';

var Funnel = require('broccoli-funnel');
var mergeTrees = require('broccoli-merge-trees');
var path = require('path');
var rename = require('broccoli-stew').rename;
var AMDDefineFilter = require('./lib/amd-define-filter');
var lookupPackage = require('./lib/lookup-package-build');
var d3DepsForPackage = require('./lib/d3-deps-for-package');
var isD3Dependency = require('./lib/is-d3-dependency');
var pathToD3Source = require('./lib/path-to-d3-module-src');

module.exports = {
  isDevelopingAddon: function() {
    return false;
  },

  name: 'ember-cli-d3-shape',

  d3Modules: [
    // Imported from package.json
  ],

  /**
   * `import()` taken from ember-cli 2.7
   */
  import: function(asset, options) {
    var app = this.app;
    while (app.app) {
      app = app.app;
    }
    app.import(asset, options);
  },

  included: function(app) {
    this._super.included && this._super.included.apply(this, arguments);
    this.app = app;

    while (app.app) {
      app = app.app;
    }

    // Find all dependencies of `d3`
    var config = app.project.config(app.env) || {};
    var addonConfig = config[this.name] || {};
    this.d3Modules = this.getD3Modules(addonConfig);

    // This essentially means we'll skip importing this package twice, if it's
    // a dependency of another package.
    if (!app.import) {
      if (this.isDevelopingAddon()) {
        console.log('[ember-cli-d3-shape] skipping included hook for', app.name);
      }
      return;
    }

    var _this = this;
    this.d3Modules.forEach(function(packageName) {
      _this.import(path.join('vendor', packageName, packageName + '.js'));
    });
  },

  getD3Modules(config) {
    var onlyModules = config.only || [];
    return onlyModules.length ? this.getDefinedD3Modules(onlyModules) : this.getAllD3Modules();
  },

  getAllD3Modules() {
    return d3DepsForPackage('d3');
  },

  getDefinedD3Modules(only) {
    var modules = {};

    only.forEach(function(name) {
      if (isD3Dependency(name)) {
        modules[name] = true;
      }

      d3DepsForPackage(name).forEach(function(depName) {
        modules[depName] = true;
      });
    });

    return Object.keys(modules);
  },

  treeForVendor: function(tree) {
    var trees = [];

    if (tree) {
      trees.push(tree);
    }

    this.d3Modules.map(pathToD3Source).forEach(function(source) {
      if (!source) {
        return;
      }

      var tree = new Funnel(source.d3PathToSrc, {
        include: [source.packageBuildPath],
        destDir: '/' + source.packageName,
        annotation: 'Funnel: D3 Source [' + source.packageName + ']'
      });

      var srcTree = new AMDDefineFilter(tree, source.packageName);
      trees.push(rename(srcTree, function() {
        return '/' + source.packageName + '/' + source.packageName + '.js';
      }));
    });

    return mergeTrees(trees);
  }
};
