// This module exports both Compartment and ModuleStaticRecord because they
// communicate through the moduleAnalyses private side-table.
/* eslint max-classes-per-file: ["error", 2] */

import * as babel from '@agoric/babel-standalone';
// We are using the above import form, and referring to its default export
// explicitly below like babel.default, because the proper construct causes a
// Rollup error.
// This form:
//   import babel from '@agoric/babel-standalone';
// And this variant:
//   import { default as babel } from '@agoric/babel-standalone';
// Both produce:
//   Error: 'default' is not exported by .../@agoric/babel-standalone/babel.js
import { makeModuleAnalyzer } from '@agoric/transform-module';
import { assign } from './commons.js';
import { createGlobalObject } from './global-object.js';
import { performEval } from './evaluate.js';
import { getCurrentRealmRec } from './realm-rec.js';
import { load, makeAlias } from './module-load.js';
import { link } from './module-link.js';
import { deferModule } from './module-proxy.js';

// q, for quoting strings.
const q = JSON.stringify;
const { entries } = Object;

const analyzeModule = makeModuleAnalyzer(babel.default);

// moduleAnalyses are the private data of a ModuleStaticRecord.
// We use moduleAnalyses in the loader/linker to look up
// the analysis corresponding to any ModuleStaticRecord constructed by an
// importHook.
const moduleAnalyses = new WeakMap();

/**
 * ModuleStaticRecord captures the effort of parsing and analyzing module text
 * so a cache of ModuleStaticRecords may be shared by multiple Compartments.
 */
export class ModuleStaticRecord {
  constructor(text) {
    const analysis = analyzeModule({ string: text });

    this.imports = Object.keys(analysis.imports).sort();

    Object.freeze(this);
    Object.freeze(this.imports);

    moduleAnalyses.set(this, analysis);
  }

  // eslint-disable-next-line class-methods-use-this
  toString() {
    return '[object ModuleStaticRecord]';
  }

  static toString() {
    return 'function ModuleStaticRecord() { [shim code] }';
  }
}

// privateFields captures the private state for each compartment.
const privateFields = new WeakMap();

// moduleAliases associates every public module exports namespace with its
// corresponding compartment and specifier so they can be used to link modules
// across compartments.
// The mechanism to thread an alias is to use the compartment.module function
// to obtain the exports namespace of a foreign module and pass it into another
// compartment's moduleMap constructor option.
const moduleAliases = new WeakMap();

// Compartments do not need an importHook or resolveHook to be useful
// as a vessel for evaluating programs.
// However, any method that operates the module system will throw an exception
// if these hooks are not available.
const assertModuleHooks = compartment => {
  const { importHook, resolveHook } = privateFields.get(compartment);
  if (typeof importHook !== 'function' || typeof resolveHook !== 'function') {
    throw new TypeError(
      `Compartment must be constructed with an importHook and a resolveHook for it to be able to load modules`,
    );
  }
};

// deferCompartmentModule gets the memoized {become, module} tuple
// for the given compartment and specifier.
const deferCompartmentModule = (compartment, specifier) =>
  deferModule(
    compartment,
    privateFields.get(compartment),
    moduleAliases,
    specifier,
  );

/**
 * Compartment()
 * The Compartment constructor is a global. A host that wants to execute
 * code in a context bound to a new global creates a new compartment.
 */
export class Compartment {
  constructor(endowments, modules, options = {}) {
    // Extract options, and shallow-clone transforms.
    const { transforms = [], resolveHook, importHook } = options;
    const globalTransforms = [...transforms];

    const realmRec = getCurrentRealmRec();
    const globalObject = createGlobalObject(realmRec, {
      globalTransforms,
    });

    assign(globalObject, endowments);

    // Map<FullSpecifier, ModuleCompartmentRecord>
    const moduleRecords = new Map();
    // Map<FullSpecifier, ModuleInstance>
    const instances = new Map();
    // Map<FullSpecifier, Alias{Compartment, FullSpecifier}>
    const aliases = new Map();
    // Map<FullSpecifier, {activate(LoadedModuleExportsNamespace), ModuleExportsNamespace}>
    const deferredModules = new Map();

    for (const [specifier, module] of entries(modules)) {
      if (typeof module === 'string') {
        // Aliases
        aliases.set(specifier, makeAlias(this, module));
      } else {
        const alias = moduleAliases.get(module);
        if (alias != null) {
          // Modules from other components.
          aliases.set(specifier, alias);
        } else {
          // TODO create and link a synthetic module instance from the given namespace object.
          throw ReferenceError(
            `Cannot link ${q(
              specifier,
            )} because it has no known compartment in this realm`,
          );
        }
      }
    }

    privateFields.set(this, {
      resolveHook,
      importHook,
      aliases,
      moduleRecords,
      deferredModules,
      instances,
      globalTransforms,
      globalObject,
    });
  }

  get global() {
    return privateFields.get(this).globalObject;
  }

  /**
   * The options are:
   * "x": the source text of a program to execute.
   */
  evaluate(x, options = {}) {
    // Perform this check first to avoid unecessary sanitizing.
    if (typeof x !== 'string') {
      throw new TypeError('first argument of evaluate() must be a string');
    }

    // Extract options, and shallow-clone transforms.
    const {
      endowments = {},
      transforms = [],
      sloppyGlobalsMode = false,
    } = options;
    const localTransforms = [...transforms];

    const { globalTransforms, globalObject } = privateFields.get(this);
    const realmRec = getCurrentRealmRec();
    return performEval(realmRec, x, globalObject, endowments, {
      globalTransforms,
      localTransforms,
      sloppyGlobalsMode,
    });
  }

  module(specifier) {
    if (typeof specifier !== 'string') {
      throw new TypeError('first argument of module() must be a string');
    }

    assertModuleHooks(this);

    return deferCompartmentModule(this, specifier).module;
  }

  async import(specifier) {
    if (typeof specifier !== 'string') {
      throw new TypeError('first argument of import() must be a string');
    }

    assertModuleHooks(this);

    await load(privateFields, moduleAnalyses, this, specifier);
    const module = this.importNow(specifier);
    // TODO consider revising the specification to use the term `module`
    // instead of `namespace` to be consistent with the `module` method,
    // since this establishes a precedent that the term `module` without any
    // further qualification denotes the module exports namespace.
    return { namespace: module };
  }

  importNow(specifier) {
    if (typeof specifier !== 'string') {
      throw new TypeError('first argument of importNow() must be a string');
    }

    assertModuleHooks(this);

    const deferred = deferCompartmentModule(this, specifier);
    const moduleInstance = link(this, privateFields, specifier);

    deferred.activate(moduleInstance.module);
    moduleInstance.execute();
    return deferred.module;
  }

  // eslint-disable-next-line class-methods-use-this
  toString() {
    return '[object Compartment]';
  }

  static toString() {
    return 'function Compartment() { [shim code] }';
  }
}
