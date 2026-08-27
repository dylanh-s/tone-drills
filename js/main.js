var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "node_modules/seedrandom/lib/alea.js"(exports, module) {
    (function(global, module2, define2) {
      function Alea(seed2) {
        var me = this, mash = Mash();
        me.next = function() {
          var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t - (me.c = t | 0);
        };
        me.c = 1;
        me.s0 = mash(" ");
        me.s1 = mash(" ");
        me.s2 = mash(" ");
        me.s0 -= mash(seed2);
        if (me.s0 < 0) {
          me.s0 += 1;
        }
        me.s1 -= mash(seed2);
        if (me.s1 < 0) {
          me.s1 += 1;
        }
        me.s2 -= mash(seed2);
        if (me.s2 < 0) {
          me.s2 += 1;
        }
        mash = null;
      }
      function copy(f, t) {
        t.c = f.c;
        t.s0 = f.s0;
        t.s1 = f.s1;
        t.s2 = f.s2;
        return t;
      }
      function impl(seed2, opts) {
        var xg = new Alea(seed2), state = opts && opts.state, prng = xg.next;
        prng.int32 = function() {
          return xg.next() * 4294967296 | 0;
        };
        prng.double = function() {
          return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
        };
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      function Mash() {
        var n = 4022871197;
        var mash = function(data) {
          data = String(data);
          for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
          }
          return (n >>> 0) * 23283064365386963e-26;
        };
        return mash;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.alea = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xor128.js
var require_xor128 = __commonJS({
  "node_modules/seedrandom/lib/xor128.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed2) {
        var me = this, strseed = "";
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.next = function() {
          var t = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
        };
        if (seed2 === (seed2 | 0)) {
          me.x = seed2;
        } else {
          strseed += seed2;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        return t;
      }
      function impl(seed2, opts) {
        var xg = new XorGen(seed2), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor128 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xorwow.js
var require_xorwow = __commonJS({
  "node_modules/seedrandom/lib/xorwow.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed2) {
        var me = this, strseed = "";
        me.next = function() {
          var t = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
        };
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.v = 0;
        if (seed2 === (seed2 | 0)) {
          me.x = seed2;
        } else {
          strseed += seed2;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          if (k == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        t.v = f.v;
        t.d = f.d;
        return t;
      }
      function impl(seed2, opts) {
        var xg = new XorGen(seed2), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorwow = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xorshift7.js
var require_xorshift7 = __commonJS({
  "node_modules/seedrandom/lib/xorshift7.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed2) {
        var me = this;
        me.next = function() {
          var X = me.x, i = me.i, t, v, w;
          t = X[i];
          t ^= t >>> 7;
          v = t ^ t << 24;
          t = X[i + 1 & 7];
          v ^= t ^ t >>> 10;
          t = X[i + 3 & 7];
          v ^= t ^ t >>> 3;
          t = X[i + 4 & 7];
          v ^= t ^ t << 7;
          t = X[i + 7 & 7];
          t = t ^ t << 13;
          v ^= t ^ t << 9;
          X[i] = v;
          me.i = i + 1 & 7;
          return v;
        };
        function init(me2, seed3) {
          var j, w, X = [];
          if (seed3 === (seed3 | 0)) {
            w = X[0] = seed3;
          } else {
            seed3 = "" + seed3;
            for (j = 0; j < seed3.length; ++j) {
              X[j & 7] = X[j & 7] << 15 ^ seed3.charCodeAt(j) + X[j + 1 & 7] << 13;
            }
          }
          while (X.length < 8) X.push(0);
          for (j = 0; j < 8 && X[j] === 0; ++j) ;
          if (j == 8) w = X[7] = -1;
          else w = X[j];
          me2.x = X;
          me2.i = 0;
          for (j = 256; j > 0; --j) {
            me2.next();
          }
        }
        init(me, seed2);
      }
      function copy(f, t) {
        t.x = f.x.slice();
        t.i = f.i;
        return t;
      }
      function impl(seed2, opts) {
        if (seed2 == null) seed2 = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed2), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.x) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorshift7 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xor4096.js
var require_xor4096 = __commonJS({
  "node_modules/seedrandom/lib/xor4096.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed2) {
        var me = this;
        me.next = function() {
          var w = me.w, X = me.X, i = me.i, t, v;
          me.w = w = w + 1640531527 | 0;
          v = X[i + 34 & 127];
          t = X[i = i + 1 & 127];
          v ^= v << 13;
          t ^= t << 17;
          v ^= v >>> 15;
          t ^= t >>> 12;
          v = X[i] = v ^ t;
          me.i = i;
          return v + (w ^ w >>> 16) | 0;
        };
        function init(me2, seed3) {
          var t, v, i, j, w, X = [], limit = 128;
          if (seed3 === (seed3 | 0)) {
            v = seed3;
            seed3 = null;
          } else {
            seed3 = seed3 + "\0";
            v = 0;
            limit = Math.max(limit, seed3.length);
          }
          for (i = 0, j = -32; j < limit; ++j) {
            if (seed3) v ^= seed3.charCodeAt((j + 32) % seed3.length);
            if (j === 0) w = v;
            v ^= v << 10;
            v ^= v >>> 15;
            v ^= v << 4;
            v ^= v >>> 13;
            if (j >= 0) {
              w = w + 1640531527 | 0;
              t = X[j & 127] ^= v + w;
              i = 0 == t ? i + 1 : 0;
            }
          }
          if (i >= 128) {
            X[(seed3 && seed3.length || 0) & 127] = -1;
          }
          i = 127;
          for (j = 4 * 128; j > 0; --j) {
            v = X[i + 34 & 127];
            t = X[i = i + 1 & 127];
            v ^= v << 13;
            t ^= t << 17;
            v ^= v >>> 15;
            t ^= t >>> 12;
            X[i] = v ^ t;
          }
          me2.w = w;
          me2.X = X;
          me2.i = i;
        }
        init(me, seed2);
      }
      function copy(f, t) {
        t.i = f.i;
        t.w = f.w;
        t.X = f.X.slice();
        return t;
      }
      ;
      function impl(seed2, opts) {
        if (seed2 == null) seed2 = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed2), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.X) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor4096 = impl;
      }
    })(
      exports,
      // window object or global
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/tychei.js
var require_tychei = __commonJS({
  "node_modules/seedrandom/lib/tychei.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed2) {
        var me = this, strseed = "";
        me.next = function() {
          var b = me.b, c = me.c, d = me.d, a = me.a;
          b = b << 25 ^ b >>> 7 ^ c;
          c = c - d | 0;
          d = d << 24 ^ d >>> 8 ^ a;
          a = a - b | 0;
          me.b = b = b << 20 ^ b >>> 12 ^ c;
          me.c = c = c - d | 0;
          me.d = d << 16 ^ c >>> 16 ^ a;
          return me.a = a - b | 0;
        };
        me.a = 0;
        me.b = 0;
        me.c = 2654435769 | 0;
        me.d = 1367130551;
        if (seed2 === Math.floor(seed2)) {
          me.a = seed2 / 4294967296 | 0;
          me.b = seed2 | 0;
        } else {
          strseed += seed2;
        }
        for (var k = 0; k < strseed.length + 20; k++) {
          me.b ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.a = f.a;
        t.b = f.b;
        t.c = f.c;
        t.d = f.d;
        return t;
      }
      ;
      function impl(seed2, opts) {
        var xg = new XorGen(seed2), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.tychei = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/seedrandom/seedrandom.js
var require_seedrandom = __commonJS({
  "node_modules/seedrandom/seedrandom.js"(exports, module) {
    (function(global, pool, math) {
      var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
      function seedrandom2(seed2, options, callback) {
        var key = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten(
          options.entropy ? [seed2, tostring(pool)] : seed2 == null ? autoseed() : seed2,
          3
        ), key);
        var arc4 = new ARC4(key);
        var prng = function() {
          var n = arc4.g(chunks), d = startdenom, x = 0;
          while (n < significance) {
            n = (n + x) * width;
            d *= width;
            x = arc4.g(1);
          }
          while (n >= overflow) {
            n /= 2;
            d /= 2;
            x >>>= 1;
          }
          return (n + x) / d;
        };
        prng.int32 = function() {
          return arc4.g(4) | 0;
        };
        prng.quick = function() {
          return arc4.g(4) / 4294967296;
        };
        prng.double = prng;
        mixkey(tostring(arc4.S), pool);
        return (options.pass || callback || function(prng2, seed3, is_math_call, state) {
          if (state) {
            if (state.S) {
              copy(state, arc4);
            }
            prng2.state = function() {
              return copy(arc4, {});
            };
          }
          if (is_math_call) {
            math[rngname] = prng2;
            return seed3;
          } else return prng2;
        })(
          prng,
          shortseed,
          "global" in options ? options.global : this == math,
          options.state
        );
      }
      function ARC4(key) {
        var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
        if (!keylen) {
          key = [keylen++];
        }
        while (i < width) {
          s[i] = i++;
        }
        for (i = 0; i < width; i++) {
          s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
          s[j] = t;
        }
        (me.g = function(count) {
          var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
          while (count--) {
            t2 = s2[i2 = mask & i2 + 1];
            r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t2]) + (s2[j2] = t2)];
          }
          me.i = i2;
          me.j = j2;
          return r;
        })(width);
      }
      function copy(f, t) {
        t.i = f.i;
        t.j = f.j;
        t.S = f.S.slice();
        return t;
      }
      ;
      function flatten(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten(obj[prop], depth - 1));
            } catch (e) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed2, key) {
        var stringseed = seed2 + "", smear, j = 0;
        while (j < stringseed.length) {
          key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
        }
        return tostring(key);
      }
      function autoseed() {
        try {
          var out;
          if (nodecrypto && (out = nodecrypto.randomBytes)) {
            out = out(width);
          } else {
            out = new Uint8Array(width);
            (global.crypto || global.msCrypto).getRandomValues(out);
          }
          return tostring(out);
        } catch (e) {
          var browser = global.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
        }
      }
      function tostring(a) {
        return String.fromCharCode.apply(0, a);
      }
      mixkey(math.random(), pool);
      if (typeof module == "object" && module.exports) {
        module.exports = seedrandom2;
        try {
          nodecrypto = require_crypto();
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom2;
        });
      } else {
        math["seed" + rngname] = seedrandom2;
      }
    })(
      // global: `self` in browsers (including strict mode and web workers),
      // otherwise `this` in Node and other environments
      typeof self !== "undefined" ? self : exports,
      [],
      // pool: entropy pool starts empty
      Math
      // math: package containing random, pow, and seedrandom
    );
  }
});

// node_modules/seedrandom/index.js
var require_seedrandom2 = __commonJS({
  "node_modules/seedrandom/index.js"(exports, module) {
    var alea = require_alea();
    var xor128 = require_xor128();
    var xorwow = require_xorwow();
    var xorshift7 = require_xorshift7();
    var xor4096 = require_xor4096();
    var tychei = require_tychei();
    var sr = require_seedrandom();
    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;
    module.exports = sr;
  }
});

// src/data.ts
var SONG = [
  ["\u82CF\u8F7C", "1-4"],
  ["\u82CF\u8F99", "1-2"],
  ["\u82CF\u9882", "1-4"],
  ["\u66FE\u5DE9", "1-3"],
  ["\u66FE\u5E03", "1-4"],
  ["\u79E6\u89C2", "2-1"],
  ["\u664F\u6B8A", "4-1"],
  ["\u5F20\u8012", "1-3"],
  ["\u5F20\u683B", "1-4"],
  ["\u5F20\u6D5A", "1-4"],
  ["\u8D3A\u94F8", "4-4"],
  ["\u674E\u7EB2", "3-1"],
  ["\u674E\u5149", "3-1"],
  ["\u674E\u6C86", "3-4"],
  ["\u674E\u8FEA", "3-2"],
  ["\u674E\u7118", "3-1"],
  ["\u5B97\u6CFD", "1-2"],
  ["\u97E9\u7426", "2-2"],
  ["\u5BC7\u51C6", "4-3"],
  ["\u4E01\u8C13", "1-4"],
  ["\u590F\u7AE6", "4-3"],
  ["\u5BCC\u5F3C", "4-4"],
  ["\u5218\u655E", "2-3"],
  ["\u738B\u73EA", "2-1"],
  ["\u8521\u786E", "4-4"],
  ["\u7AE0\u60C7", "1-1"],
  ["\u6731\u71B9", "1-1"],
  ["\u6731\u5F01", "1-4"],
  ["\u9646\u6E38", "4-2"],
  ["\u5C24\u88A4", "2-4"],
  ["\u9648\u4EAE", "2-4"],
  ["\u53F6\u9002", "4-4"],
  ["\u8D75\u9F0E", "4-3"],
  ["\u8D75\u8475", "4-2"],
  ["\u80E1\u94E8", "2-2"],
  ["\u6C6A\u85FB", "1-3"],
  ["\u5B59\u89CC", "1-2"],
  ["\u6D2A\u7693", "2-4"],
  ["\u738B\u575A", "2-1"],
  ["\u4F59\u73A0", "2-4"],
  ["\u5B5F\u73D9", "4-3"],
  ["\u675C\u6772", "4-3"],
  ["\u53F2\u6D69", "3-4"],
  ["\u8BB8\u7FF0", "3-4"],
  ["\u8463\u69D0", "3-2"]
];
var MING = [
  ["\u5218\u57FA", "2-1"],
  ["\u5218\u5409", "2-2"],
  ["\u5B8B\u6FC2", "4-2"],
  ["\u6C64\u548C", "1-2"],
  ["\u9093\u6108", "4-4"],
  ["\u51AF\u80DC", "2-4"],
  ["\u84DD\u7389", "2-4"],
  ["\u9F50\u6CF0", "2-4"],
  ["\u94C1\u94C9", "3-4"],
  ["\u76DB\u5EB8", "4-1"],
  ["\u89E3\u7F19", "4-4"],
  ["\u6768\u8363", "2-2"],
  ["\u6768\u6EA5", "2-3"],
  ["\u6768\u6D9F", "2-2"],
  ["\u4E8E\u8C26", "2-1"],
  ["\u77F3\u4EA8", "2-1"],
  ["\u674E\u8D24", "3-2"],
  ["\u5546\u8F82", "1-4"],
  ["\u5F6D\u65F6", "2-2"],
  ["\u4E18\u6FEC", "1-4"],
  ["\u738B\u6055", "2-4"],
  ["\u738B\u826E", "2-4"],
  ["\u6BDB\u7EAA", "2-4"],
  ["\u590F\u8A00", "4-2"],
  ["\u5F90\u9636", "2-1"],
  ["\u5F90\u6E2D", "2-4"],
  ["\u9AD8\u62F1", "1-3"],
  ["\u8042\u8C79", "4-4"],
  ["\u859B\u7444", "1-1"],
  ["\u6C88\u5EA6", "3-4"],
  ["\u9A6C\u6109", "3-2"]
];
var NAMES = [...SONG, ...MING];
var LUCIA_WORDS = {
  "1-1": ["\u4ECA\u5929", "\u5496\u5561", "\u98DE\u673A", "\u661F\u671F", "\u533B\u751F"],
  "1-2": ["\u4E2D\u56FD", "\u6B22\u8FCE", "\u751F\u6D3B", "\u5BB6\u5EAD", "\u82B1\u56ED"],
  "1-3": ["\u94C5\u7B14", "\u8EAB\u4F53", "\u5F00\u59CB", "\u65B9\u6CD5", "\u5DE5\u5382"],
  "1-4": ["\u5DE5\u4F5C", "\u5546\u5E97", "\u97F3\u4E50", "\u751F\u65E5", "\u8F66\u7AD9"],
  "2-1": ["\u65F6\u95F4", "\u623F\u95F4", "\u660E\u5929", "\u9633\u5149", "\u519C\u6751"],
  "2-2": ["\u94F6\u884C", "\u5B66\u4E60", "\u5B8C\u6210", "\u90AE\u5C40", "\u8DB3\u7403"],
  "2-3": ["\u5564\u9152", "\u725B\u5976", "\u767D\u9152", "\u82F9\u679C", "\u5934\u8111"],
  "2-4": ["\u5B66\u6821", "\u7ED3\u675F", "\u90AE\u7968", "\u56FE\u7247", "\u8282\u65E5"],
  "3-1": ["\u8001\u5E08", "\u5317\u4EAC", "\u706B\u8F66", "\u624B\u673A", "\u8D77\u98DE"],
  "3-2": ["\u7F8E\u56FD", "\u8BED\u8A00", "\u65C5\u884C", "\u8D77\u5E8A", "\u7956\u56FD"],
  "3-3": ["\u4F60\u597D", "\u6C34\u679C", "\u624B\u8868", "\u5E7F\u573A", "\u6D17\u6FA1"],
  "3-4": ["\u8003\u8BD5", "\u4F7F\u7528", "\u8DD1\u6B65", "\u773C\u955C", "\u8BF7\u5047"],
  "4-1": ["\u9762\u5305", "\u4E0A\u73ED", "\u6C7D\u8F66", "\u5927\u5BB6", "\u540E\u5929"],
  "4-2": ["\u590D\u4E60", "\u4E0A\u5B66", "\u9762\u6761", "\u5927\u5B66", "\u540E\u6765"],
  "4-3": ["\u7535\u8111", "\u8DF3\u821E", "\u62A5\u7EB8", "\u7535\u5F71", "\u6C49\u8BED"],
  "4-4": ["\u518D\u89C1", "\u7535\u8BDD", "\u6559\u5BA4", "\u4E0A\u8BFE", "\u5FEB\u4E50"],
  "1-5": ["\u4E1C\u897F", "\u8863\u670D", "\u684C\u5B50", "\u5173\u7CFB", "\u5148\u751F"],
  "2-5": ["\u89C9\u5F97", "\u65F6\u5019", "\u670B\u53CB", "\u540D\u5B57", "\u4EC0\u4E48"],
  "3-5": ["\u559C\u6B22", "\u6211\u4EEC", "\u773C\u775B", "\u6905\u5B50", "\u8033\u6735"],
  "4-5": ["\u6F02\u4EAE", "\u8BA4\u8BC6", "\u544A\u8BC9", "\u610F\u601D", "\u5BA2\u6C14"]
};
var ALL_PAIRS = Object.keys(LUCIA_WORDS);
var VOICES = [
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-XiaoyiNeural",
  "zh-CN-YunxiNeural",
  "zh-CN-YunjianNeural"
];
var MAX_VOICES = VOICES.length;
var COUNT = 20;
var SPEED_TAG = "+0";
var VOICES_DEFAULT = 1;
var LUCIA_OPTIONS = 4;
var LUCIA_DOUBLE_CHANCE = 0.25;

// src/audio.ts
var current = null;
function stopPlayback() {
  if (current) {
    current.pause();
    current.currentTime = 0;
    current = null;
  }
}
function play(path) {
  stopPlayback();
  const audio = new Audio(path);
  current = audio;
  audio.play().catch(() => {
  });
  return true;
}

// src/rng.ts
var import_seedrandom = __toESM(require_seedrandom2());
var Rng = class {
  constructor(seed2) {
    this.next = (0, import_seedrandom.default)(String(seed2));
  }
  /** Float in [0, 1). */
  random() {
    return this.next();
  }
  /** Integer in [0, n). */
  int(n) {
    return Math.floor(this.next() * n);
  }
  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** k distinct elements from `pool` (like random.sample). */
  sample(pool, k) {
    return this.shuffle([...pool]).slice(0, k);
  }
  /** One element from `pool`. */
  choice(pool) {
    return pool[this.int(pool.length)];
  }
};

// src/logic.ts
function toneDigits(pair) {
  return pair.replace(/\D/g, "");
}
function judge(answerPair, guessPair) {
  const a = toneDigits(answerPair);
  const g = toneDigits(guessPair);
  if (g === a) return "correct";
  if (a === "33" && g === "23") return "sandhi";
  return "wrong";
}
function pickVoice(word, numVoices, seed2) {
  const n = Math.max(1, Math.min(numVoices, VOICES.length));
  if (n === 1) return VOICES[0];
  return VOICES[new Rng(`${word}|${n}|${seed2}`).int(n)];
}
function questionClip(word, voice, frame = false) {
  const name = frame ? `${word}_frame.mp3` : `${word}.mp3`;
  return `questions/${SPEED_TAG}/${voice}/${encodeURIComponent(name)}`;
}
function pickItems(count, seed2) {
  const items = NAMES.map((p) => [p[0], p[1]]);
  new Rng(seed2).shuffle(items);
  return items.slice(0, count);
}
function buildQuestions(count, seed2) {
  return pickItems(count, seed2).map(([word, answer]) => ({
    word,
    answer,
    userAnswer: null,
    correct: null,
    options: []
  }));
}
function buildLuciaOptions(questions, seed2) {
  questions.forEach((q, idx) => {
    const rng = new Rng(`${seed2}-${idx}-lucia`);
    const answer = q.answer;
    const pool = LUCIA_WORDS[answer];
    if (!pool) {
      q.options = [];
      return;
    }
    const nCorrect = pool.length >= 2 && rng.random() < LUCIA_DOUBLE_CHANCE ? 2 : 1;
    const correctWords = rng.sample(pool, nCorrect);
    const distractPairs = rng.sample(
      ALL_PAIRS.filter((p) => p !== answer),
      LUCIA_OPTIONS - nCorrect
    );
    const opts = correctWords.map((w) => ({ pair: answer, word: w }));
    for (const p of distractPairs) {
      opts.push({ pair: p, word: rng.choice(LUCIA_WORDS[p]) });
    }
    rng.shuffle(opts);
    q.options = opts;
  });
}

// src/app.ts
var OPT_KEYS = ["a", "s", "d", "f"];
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== void 0) node.textContent = text;
  return node;
}
var DrillApp = class {
  constructor(seed2, count = COUNT) {
    this.idx = 0;
    this.lucia = false;
    this.showChars = true;
    this.showOptChars = false;
    this.showHelp = false;
    this.results = false;
    this.buffer = "";
    this.selected = null;
    this.flash = "";
    this.numVoices = VOICES_DEFAULT;
    this.seed = seed2;
    this.questions = buildQuestions(count, seed2);
    buildLuciaOptions(this.questions, seed2);
    this.root = document.getElementById("app");
  }
  start() {
    window.addEventListener("keydown", (e) => this.onKey(e));
    this.autoplayPrompt();
    this.renderAll();
  }
  // -- derived state ----------------------------------------------------
  get q() {
    return this.questions[this.idx];
  }
  get currentVoice() {
    return pickVoice(this.q.word, this.numVoices, this.seed);
  }
  get answered() {
    return this.questions.filter((x) => x.userAnswer !== null).length;
  }
  get score() {
    return this.questions.filter((x) => x.correct).length;
  }
  // -- rendering --------------------------------------------------------
  renderAll() {
    this.root.replaceChildren(
      this.renderHeader(),
      this.renderBody(),
      this.renderFooter()
    );
  }
  grid(rows) {
    const g = el("div", "grid");
    for (const [label, value] of rows) {
      const l = el("div", "glabel", label);
      const v = typeof value === "string" ? el("div", "gval", value) : value;
      if (typeof value !== "string") v.classList.add("gval");
      g.append(l, v);
    }
    return g;
  }
  renderHeader() {
    const header = el("div");
    header.id = "header";
    const total = this.questions.length;
    const item = this.results ? `${total + 1} / ${total}` : `${this.idx + 1} / ${total}`;
    const info = this.grid([
      ["Mode:", strong(this.lucia ? "lucia" : "classic")],
      ["Voice:", this.currentVoice],
      ["Speed:", "0%"],
      ["Voices:", `${this.numVoices} / ${MAX_VOICES}`],
      ["Seed:", String(this.seed)]
    ]);
    const stats = this.grid([
      ["Item:", strong(item)],
      ["Answered:", `${this.answered} / ${total}`],
      ["Score:", scoreVal(`${this.score} / ${this.answered || 0}`)]
    ]);
    header.append(info, stats);
    return header;
  }
  renderBody() {
    const body = el("div");
    body.id = "body";
    if (this.showHelp) {
      body.append(this.renderHelp());
    } else if (this.results) {
      body.append(this.renderResults());
    } else {
      body.append(this.renderQuestion());
    }
    return body;
  }
  panel(title, borderCls) {
    const p = el("div", `panel ${borderCls}`);
    p.append(el("div", "panel-title", title));
    return p;
  }
  renderQuestion() {
    const q = this.q;
    const answered = q.userAnswer !== null;
    const panel = this.panel("tone-drill", "b-accent");
    const inner = el("div", "panel-body");
    inner.append(el("div", "dim small", `Question ${this.idx + 1}`));
    if (this.showChars || answered) {
      inner.append(el("div", "hanzi", q.word));
    } else {
      const masked = [...q.word].map(() => "\uFF3F").join(" ");
      inner.append(el("div", "hanzi dim", masked));
    }
    if (this.lucia) {
      inner.append(...this.luciaView(q, answered));
    } else {
      inner.append(...this.classicView(q, answered));
    }
    inner.append(el("div", "warn flash", this.flash));
    panel.append(inner);
    return panel;
  }
  // -- classic answer view ---------------------------------------------
  classicView(q, answered) {
    if (answered) return this.verdictLines(q);
    const typed = el("div", "typed");
    typed.append(el("span", "dim", "Your tones  "));
    typed.append(el("span", "accent big", this.buffer || "\u2014"));
    const hint = el("div", "dim small", "type or tap two digits (e.g. 14), then Enter");
    const pad = el("div", "pad");
    for (const d of ["1", "2", "3", "4"]) {
      const b = el("button", "btn", d);
      b.onclick = () => this.pushDigit(d);
      pad.append(b);
    }
    const back = el("button", "btn", "\u232B");
    back.onclick = () => this.eraseDigit();
    const submit = el("button", "btn btn-go", "Submit");
    submit.onclick = () => this.submit();
    pad.append(back, submit);
    return [typed, hint, pad];
  }
  // -- lucia answer view -----------------------------------------------
  luciaView(q, answered) {
    if (q.options.length === 0) {
      return [el("div", "bad", "no options for this pair")];
    }
    const list = el("div", "options");
    q.options.forEach((opt, i) => {
      const key = OPT_KEYS[i];
      const row = el("div", "opt");
      const chip = el("span", "key", ` ${key} `);
      row.append(chip);
      if (!answered) {
        const shown = this.showOptChars ? opt.word : "\uFF3F \uFF3F";
        const label = el("button", "opt-label", shown);
        if (i === this.selected) label.classList.add("sel");
        label.onclick = () => this.selectOption(i);
        const sent = el("button", "opt-sentence", "\u25B6 \u53E5");
        sent.title = "play inside a sentence";
        sent.onclick = () => this.playOption(i, true);
        row.append(label, sent);
      } else {
        const verdict = judge(q.answer, opt.pair);
        const picked = i === q.selIdx;
        let mark = " ";
        let cls = "dim";
        if (verdict === "correct") {
          mark = "\u2713";
          cls = "ok";
        } else if (verdict === "sandhi") {
          mark = "\u2248";
          cls = "warn";
        } else if (picked) {
          mark = "\u2717";
          cls = "bad";
        }
        const content = el("div", "opt-result");
        content.append(
          el("span", `mark ${cls}`, mark),
          el("span", cls, opt.word),
          el("span", `${cls} dim-pair`, opt.pair)
        );
        const replay = el("button", "opt-sentence", "\u25B6");
        replay.onclick = () => this.playOption(i, false);
        row.append(content, replay);
      }
      list.append(row);
    });
    const out = [list];
    if (!answered) {
      const choose = el("button", "btn btn-go wide", "Choose");
      choose.onclick = () => this.submitLucia();
      out.push(choose);
    } else {
      out.push(...this.verdictLines(q));
    }
    return out;
  }
  // -- shared verdict / reveal -----------------------------------------
  verdictLines(q) {
    const lines = [];
    const result = q.result ?? (q.correct ? "correct" : "wrong");
    if (result === "correct") lines.push(el("div", "ok bold", "\u2713 correct"));
    else if (result === "sandhi") lines.push(el("div", "warn bold", "\u2248 sounds right, but not counted"));
    else lines.push(el("div", "bad bold", "\u2717 wrong"));
    const ya = el("div", "reveal");
    ya.append(
      el("span", "dim", "you: "),
      el("span", "", q.userAnswer ?? ""),
      el("span", "dim", "     answer: "),
      el("span", "ok bold", q.answer)
    );
    lines.push(ya);
    if (this.lucia && q.options.length) {
      const correct = q.options.filter((o) => judge(q.answer, o.pair) === "correct").map((o) => o.word);
      if (correct.length > 1) {
        lines.push(el("div", "dim", `both ${correct.join(" and ")} were correct`));
      }
    }
    if (toneDigits(q.answer) === "33") {
      lines.push(el("div", "warn small", "\u26A0 sandhi: 3-3 is pronounced 2-3. The underlying tones are 3-3,"));
      lines.push(el("div", "warn small", "so 2-3 sounds right by ear but is not counted as correct."));
    }
    const nav = el("div", "nav-hint dim small", this.idx === this.questions.length - 1 ? "Enter / \u2192 for results" : "Enter / \u2192 for the next question");
    lines.push(nav);
    return lines;
  }
  // -- results screen ---------------------------------------------------
  renderResults() {
    const total = this.questions.length;
    const correct = this.score;
    const sandhi = this.questions.filter((x) => x.result === "sandhi").length;
    const wrong = total - correct - sandhi;
    const pct = total ? correct / total * 100 : 0;
    const panel = this.panel("results", pct >= 80 ? "b-ok" : "b-accent");
    const inner = el("div", "panel-body");
    inner.append(
      el("div", "accent bold big2", "drill complete"),
      el("div", "ok bold huge", `${correct} / ${total}`),
      el("div", "dim", `${pct.toFixed(0)}%`)
    );
    const tally = el("div", "tally");
    tally.append(tallyRow(String(correct), "ok", "correct"));
    if (sandhi) tally.append(tallyRow(String(sandhi), "warn", "sounded right (sandhi, not counted)"));
    tally.append(tallyRow(String(wrong), "bad", "wrong"));
    inner.append(tally);
    const missed = this.questions.filter((x) => !x.correct);
    if (missed.length) {
      inner.append(el("div", "dim bold missed-title", "missed"));
      const mg = el("div", "missed");
      for (const x of missed) {
        const r = el("div", "miss-row");
        r.append(
          el("span", "", x.word),
          el("span", "bad right", x.userAnswer || "\u2014"),
          el("span", "dim", "\u2192"),
          el("span", "ok bold", x.answer)
        );
        mg.append(r);
      }
      inner.append(mg);
    }
    const actions = el("div", "pad");
    const restart = el("button", "btn btn-go", "\u21BB restart");
    restart.onclick = () => this.restart();
    const review = el("button", "btn", "\u2190 review");
    review.onclick = () => this.reviewLast();
    actions.append(restart, review);
    inner.append(actions);
    panel.append(inner);
    return panel;
  }
  restart() {
    this.seed = Math.floor(Math.random() * 1e6);
    this.questions = buildQuestions(this.questions.length, this.seed);
    buildLuciaOptions(this.questions, this.seed);
    this.results = false;
    this.idx = 0;
    this.buffer = "";
    this.selected = null;
    this.autoplayPrompt();
    this.renderAll();
  }
  reviewLast() {
    this.results = false;
    this.autoplayPrompt();
    this.renderAll();
  }
  // -- help overlay -----------------------------------------------------
  renderHelp() {
    const panel = this.panel("controls", "b-accent");
    const inner = el("div", "panel-body help");
    const sections = [
      ["Playback", [
        ["w", "play the word"],
        ["\u21E7 w", "play it inside a sentence"],
        ["a s d f", "play an option  (lucia)"],
        ["\u21E7 a/s/d/f", "play an option inside a sentence  (lucia)"]
      ]],
      ["Answering", [
        ["1 2 3 4", "type the two tones  (classic)"],
        ["\u232B", "erase a digit  (classic)"],
        ["\u21B5 / space", "submit / choose"],
        ["\u2190 / \u2192", "previous / next question"]
      ]],
      ["Display", [
        ["c", "show / hide the question characters"],
        ["v", "show / hide the option characters  (lucia)"]
      ]],
      ["Settings", [["[ / ]", "voices in play  (1-4)"]]],
      ["Modes", [["l", "switch classic / lucia"], ["?", "toggle these controls"]]]
    ];
    for (const [title, rows] of sections) {
      inner.append(el("div", "accent bold section-title", title));
      const g = el("div", "help-grid");
      for (const [key, desc] of rows) {
        g.append(el("div", "accent right", key), el("div", "", desc));
      }
      inner.append(g);
    }
    panel.append(inner);
    return panel;
  }
  // -- footer -----------------------------------------------------------
  renderFooter() {
    const footer = el("div");
    footer.id = "footer";
    let items;
    if (this.results) {
      items = [
        ["\u21BB", "restart", () => this.restart()],
        ["\u2190", "review", () => this.reviewLast()]
      ];
    } else if (this.lucia) {
      items = [
        ["w", "word", () => this.requestPlay(this.q.word, false)],
        ["\u21E7w", "sentence", () => this.requestPlay(this.q.word, true)],
        ["\u2190", "prev", () => this.step(-1)],
        ["\u2192", "next", () => this.step(1)],
        ["c", "chars", () => this.toggleChars()],
        ["v", "opt chars", () => this.toggleOptChars()],
        ["[", "\u2212voice", () => this.changeVoices(-1)],
        ["]", "+voice", () => this.changeVoices(1)],
        ["l", "classic", () => this.toggleMode()],
        ["?", "help", () => this.toggleHelp()]
      ];
    } else {
      items = [
        ["w", "word", () => this.requestPlay(this.q.word, false)],
        ["\u21E7w", "sentence", () => this.requestPlay(this.q.word, true)],
        ["\u2190", "prev", () => this.step(-1)],
        ["\u2192", "next", () => this.step(1)],
        ["c", "chars", () => this.toggleChars()],
        ["[", "\u2212voice", () => this.changeVoices(-1)],
        ["]", "+voice", () => this.changeVoices(1)],
        ["l", "lucia", () => this.toggleMode()],
        ["?", "help", () => this.toggleHelp()]
      ];
    }
    for (const [key, desc, fn] of items) {
      const b = el("button", "fbtn");
      b.append(el("span", "key", ` ${key} `), el("span", "fdesc", ` ${desc} `));
      b.onclick = fn;
      footer.append(b);
    }
    return footer;
  }
  // -- audio ------------------------------------------------------------
  requestPlay(word, frame) {
    const voice = pickVoice(word, this.numVoices, this.seed);
    play(questionClip(word, voice, frame));
    this.renderAll();
  }
  autoplayPrompt() {
    this.requestPlay(this.q.word, false);
  }
  changeVoices(delta) {
    const next = Math.max(1, Math.min(MAX_VOICES, this.numVoices + delta));
    if (next === this.numVoices) {
      this.flash = `voices at ${delta < 0 ? "min" : "max"} (${this.numVoices})`;
      this.renderAll();
      return;
    }
    this.numVoices = next;
    this.requestPlay(this.q.word, false);
  }
  // -- navigation -------------------------------------------------------
  step(dir) {
    const last = this.questions.length - 1;
    if (dir > 0 && this.idx === last) {
      if (this.q.result) {
        this.results = true;
        stopPlayback();
        this.renderAll();
      }
      return;
    }
    if (dir < 0 && this.idx === 0) return;
    this.idx += dir;
    this.buffer = "";
    this.selected = null;
    this.autoplayPrompt();
  }
  // -- toggles ----------------------------------------------------------
  toggleChars() {
    this.showChars = !this.showChars;
    this.renderAll();
  }
  toggleOptChars() {
    this.showOptChars = !this.showOptChars;
    this.renderAll();
  }
  toggleHelp() {
    this.showHelp = !this.showHelp;
    this.renderAll();
  }
  toggleMode() {
    this.lucia = !this.lucia;
    this.buffer = "";
    this.selected = null;
    this.renderAll();
  }
  // -- classic input ----------------------------------------------------
  pushDigit(d) {
    if (this.q.userAnswer !== null) return;
    if (this.buffer.length < 4) this.buffer += d;
    this.flash = "";
    this.renderAll();
  }
  eraseDigit() {
    if (this.q.userAnswer !== null) return;
    this.buffer = this.buffer.slice(0, -1);
    this.renderAll();
  }
  submit() {
    if (this.q.userAnswer !== null) return;
    if (!this.buffer) {
      this.flash = "type the tones first";
      this.renderAll();
      return;
    }
    const q = this.q;
    const result = judge(q.answer, this.buffer);
    q.userAnswer = this.buffer;
    q.result = result;
    q.correct = result === "correct";
    this.buffer = "";
    this.flash = "";
    this.renderAll();
  }
  // -- lucia input ------------------------------------------------------
  selectOption(i) {
    this.playOption(i, false, true);
  }
  playOption(i, frame, select = false) {
    const q = this.q;
    if (i >= q.options.length) return;
    if (select && q.userAnswer === null) this.selected = i;
    this.requestPlay(q.options[i].word, frame);
  }
  submitLucia() {
    const q = this.q;
    if (!q.options.length || q.userAnswer !== null) return;
    if (this.selected === null) {
      this.flash = "pick an option first";
      this.renderAll();
      return;
    }
    const opt = q.options[this.selected];
    const result = judge(q.answer, opt.pair);
    q.userAnswer = opt.pair;
    q.selIdx = this.selected;
    q.result = result;
    q.correct = result === "correct";
    this.selected = null;
    this.flash = "";
    this.renderAll();
  }
  // -- keyboard ---------------------------------------------------------
  onKey(e) {
    const key = e.key;
    this.flash = "";
    if (key === "?") {
      this.toggleHelp();
      e.preventDefault();
      return;
    }
    if (this.showHelp) {
      if (key === "Escape" || key === "?") this.toggleHelp();
      return;
    }
    if (this.results) {
      if (key === "r") this.restart();
      else if (key === "ArrowLeft") this.reviewLast();
      return;
    }
    if (key === "ArrowRight") {
      this.step(1);
      e.preventDefault();
      return;
    }
    if (key === "ArrowLeft") {
      this.step(-1);
      e.preventDefault();
      return;
    }
    if ((key === "Enter" || key === " ") && this.q.result) {
      this.step(1);
      e.preventDefault();
      return;
    }
    if (key === "w" || key === "W") {
      const frame = key === "W";
      this.requestPlay(this.q.word, frame);
      return;
    }
    if (key === "c") {
      this.toggleChars();
      return;
    }
    if (key === "l") {
      this.toggleMode();
      return;
    }
    if (key === "[") {
      this.changeVoices(-1);
      return;
    }
    if (key === "]") {
      this.changeVoices(1);
      return;
    }
    if (this.lucia) this.luciaKey(key, e);
    else this.classicKey(key, e);
  }
  luciaKey(key, e) {
    if (key === "v") {
      this.toggleOptChars();
      return;
    }
    const low = key.toLowerCase();
    if (OPT_KEYS.includes(low) && this.q.options.length) {
      const i = OPT_KEYS.indexOf(low);
      if (i >= this.q.options.length) return;
      const shifted = key !== low;
      this.playOption(i, shifted, true);
      return;
    }
    if (key === "Enter" || key === " ") {
      this.submitLucia();
      e.preventDefault();
    }
  }
  classicKey(key, e) {
    if (this.q.userAnswer !== null) return;
    if (["1", "2", "3", "4"].includes(key)) {
      this.pushDigit(key);
      return;
    }
    if (key === "Backspace") {
      this.eraseDigit();
      e.preventDefault();
      return;
    }
    if (key === "Enter" || key === " ") {
      this.submit();
      e.preventDefault();
    }
  }
};
function strong(text) {
  return el("span", "bold white", text);
}
function scoreVal(text) {
  return el("span", "ok bold", text);
}
function tallyRow(n, cls, label) {
  const r = el("div", "tally-row");
  r.append(el("span", `${cls} bold right`, n), el("span", "dim", label));
  return r;
}

// src/main.ts
var params = new URLSearchParams(location.search);
var raw = params.get("seed");
var seed = raw !== null && /^\d+$/.test(raw) ? parseInt(raw, 10) : Math.floor(Math.random() * 1e6);
new DrillApp(seed).start();
