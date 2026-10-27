(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

  // 世界生成器_1.4.0.dev164_Windows/runtime/node_modules/polygon-clipping/dist/polygon-clipping.umd.js
  var require_polygon_clipping_umd = __commonJS({
    "\u4E16\u754C\u751F\u6210\u5668_1.4.0.dev164_Windows/runtime/node_modules/polygon-clipping/dist/polygon-clipping.umd.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.polygonClipping = factory());
      })(exports, (function() {
        "use strict";
        function __generator(thisArg, body) {
          var _ = {
            label: 0,
            sent: function() {
              if (t[0] & 1) throw t[1];
              return t[1];
            },
            trys: [],
            ops: []
          }, f, y, t, g;
          return g = {
            next: verb(0),
            "throw": verb(1),
            "return": verb(2)
          }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
            return this;
          }), g;
          function verb(n) {
            return function(v) {
              return step([n, v]);
            };
          }
          function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
              if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
              if (y = 0, t) op = [op[0] & 2, t.value];
              switch (op[0]) {
                case 0:
                case 1:
                  t = op;
                  break;
                case 4:
                  _.label++;
                  return {
                    value: op[1],
                    done: false
                  };
                case 5:
                  _.label++;
                  y = op[1];
                  op = [0];
                  continue;
                case 7:
                  op = _.ops.pop();
                  _.trys.pop();
                  continue;
                default:
                  if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                    _ = 0;
                    continue;
                  }
                  if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                    _.label = op[1];
                    break;
                  }
                  if (op[0] === 6 && _.label < t[1]) {
                    _.label = t[1];
                    t = op;
                    break;
                  }
                  if (t && _.label < t[2]) {
                    _.label = t[2];
                    _.ops.push(op);
                    break;
                  }
                  if (t[2]) _.ops.pop();
                  _.trys.pop();
                  continue;
              }
              op = body.call(thisArg, _);
            } catch (e) {
              op = [6, e];
              y = 0;
            } finally {
              f = t = 0;
            }
            if (op[0] & 5) throw op[1];
            return {
              value: op[0] ? op[1] : void 0,
              done: true
            };
          }
        }
        var Node = (
          /** @class */
          /* @__PURE__ */ (function() {
            function Node2(key, data) {
              this.next = null;
              this.key = key;
              this.data = data;
              this.left = null;
              this.right = null;
            }
            return Node2;
          })()
        );
        function DEFAULT_COMPARE(a, b) {
          return a > b ? 1 : a < b ? -1 : 0;
        }
        function splay(i, t, comparator) {
          var N = new Node(null, null);
          var l = N;
          var r = N;
          while (true) {
            var cmp2 = comparator(i, t.key);
            if (cmp2 < 0) {
              if (t.left === null) break;
              if (comparator(i, t.left.key) < 0) {
                var y = t.left;
                t.left = y.right;
                y.right = t;
                t = y;
                if (t.left === null) break;
              }
              r.left = t;
              r = t;
              t = t.left;
            } else if (cmp2 > 0) {
              if (t.right === null) break;
              if (comparator(i, t.right.key) > 0) {
                var y = t.right;
                t.right = y.left;
                y.left = t;
                t = y;
                if (t.right === null) break;
              }
              l.right = t;
              l = t;
              t = t.right;
            } else break;
          }
          l.right = t.left;
          r.left = t.right;
          t.left = N.right;
          t.right = N.left;
          return t;
        }
        function insert(i, data, t, comparator) {
          var node = new Node(i, data);
          if (t === null) {
            node.left = node.right = null;
            return node;
          }
          t = splay(i, t, comparator);
          var cmp2 = comparator(i, t.key);
          if (cmp2 < 0) {
            node.left = t.left;
            node.right = t;
            t.left = null;
          } else if (cmp2 >= 0) {
            node.right = t.right;
            node.left = t;
            t.right = null;
          }
          return node;
        }
        function split(key, v, comparator) {
          var left = null;
          var right = null;
          if (v) {
            v = splay(key, v, comparator);
            var cmp2 = comparator(v.key, key);
            if (cmp2 === 0) {
              left = v.left;
              right = v.right;
            } else if (cmp2 < 0) {
              right = v.right;
              v.right = null;
              left = v;
            } else {
              left = v.left;
              v.left = null;
              right = v;
            }
          }
          return {
            left,
            right
          };
        }
        function merge(left, right, comparator) {
          if (right === null) return left;
          if (left === null) return right;
          right = splay(left.key, right, comparator);
          right.left = left;
          return right;
        }
        function printRow(root, prefix, isTail, out, printNode) {
          if (root) {
            out("" + prefix + (isTail ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ") + printNode(root) + "\n");
            var indent = prefix + (isTail ? "    " : "\u2502   ");
            if (root.left) printRow(root.left, indent, false, out, printNode);
            if (root.right) printRow(root.right, indent, true, out, printNode);
          }
        }
        var Tree = (
          /** @class */
          (function() {
            function Tree2(comparator) {
              if (comparator === void 0) {
                comparator = DEFAULT_COMPARE;
              }
              this._root = null;
              this._size = 0;
              this._comparator = comparator;
            }
            Tree2.prototype.insert = function(key, data) {
              this._size++;
              return this._root = insert(key, data, this._root, this._comparator);
            };
            Tree2.prototype.add = function(key, data) {
              var node = new Node(key, data);
              if (this._root === null) {
                node.left = node.right = null;
                this._size++;
                this._root = node;
              }
              var comparator = this._comparator;
              var t = splay(key, this._root, comparator);
              var cmp2 = comparator(key, t.key);
              if (cmp2 === 0) this._root = t;
              else {
                if (cmp2 < 0) {
                  node.left = t.left;
                  node.right = t;
                  t.left = null;
                } else if (cmp2 > 0) {
                  node.right = t.right;
                  node.left = t;
                  t.right = null;
                }
                this._size++;
                this._root = node;
              }
              return this._root;
            };
            Tree2.prototype.remove = function(key) {
              this._root = this._remove(key, this._root, this._comparator);
            };
            Tree2.prototype._remove = function(i, t, comparator) {
              var x;
              if (t === null) return null;
              t = splay(i, t, comparator);
              var cmp2 = comparator(i, t.key);
              if (cmp2 === 0) {
                if (t.left === null) {
                  x = t.right;
                } else {
                  x = splay(i, t.left, comparator);
                  x.right = t.right;
                }
                this._size--;
                return x;
              }
              return t;
            };
            Tree2.prototype.pop = function() {
              var node = this._root;
              if (node) {
                while (node.left) node = node.left;
                this._root = splay(node.key, this._root, this._comparator);
                this._root = this._remove(node.key, this._root, this._comparator);
                return {
                  key: node.key,
                  data: node.data
                };
              }
              return null;
            };
            Tree2.prototype.findStatic = function(key) {
              var current = this._root;
              var compare2 = this._comparator;
              while (current) {
                var cmp2 = compare2(key, current.key);
                if (cmp2 === 0) return current;
                else if (cmp2 < 0) current = current.left;
                else current = current.right;
              }
              return null;
            };
            Tree2.prototype.find = function(key) {
              if (this._root) {
                this._root = splay(key, this._root, this._comparator);
                if (this._comparator(key, this._root.key) !== 0) return null;
              }
              return this._root;
            };
            Tree2.prototype.contains = function(key) {
              var current = this._root;
              var compare2 = this._comparator;
              while (current) {
                var cmp2 = compare2(key, current.key);
                if (cmp2 === 0) return true;
                else if (cmp2 < 0) current = current.left;
                else current = current.right;
              }
              return false;
            };
            Tree2.prototype.forEach = function(visitor, ctx) {
              var current = this._root;
              var Q = [];
              var done = false;
              while (!done) {
                if (current !== null) {
                  Q.push(current);
                  current = current.left;
                } else {
                  if (Q.length !== 0) {
                    current = Q.pop();
                    visitor.call(ctx, current);
                    current = current.right;
                  } else done = true;
                }
              }
              return this;
            };
            Tree2.prototype.range = function(low, high, fn, ctx) {
              var Q = [];
              var compare2 = this._comparator;
              var node = this._root;
              var cmp2;
              while (Q.length !== 0 || node) {
                if (node) {
                  Q.push(node);
                  node = node.left;
                } else {
                  node = Q.pop();
                  cmp2 = compare2(node.key, high);
                  if (cmp2 > 0) {
                    break;
                  } else if (compare2(node.key, low) >= 0) {
                    if (fn.call(ctx, node)) return this;
                  }
                  node = node.right;
                }
              }
              return this;
            };
            Tree2.prototype.keys = function() {
              var keys = [];
              this.forEach(function(_a) {
                var key = _a.key;
                return keys.push(key);
              });
              return keys;
            };
            Tree2.prototype.values = function() {
              var values = [];
              this.forEach(function(_a) {
                var data = _a.data;
                return values.push(data);
              });
              return values;
            };
            Tree2.prototype.min = function() {
              if (this._root) return this.minNode(this._root).key;
              return null;
            };
            Tree2.prototype.max = function() {
              if (this._root) return this.maxNode(this._root).key;
              return null;
            };
            Tree2.prototype.minNode = function(t) {
              if (t === void 0) {
                t = this._root;
              }
              if (t) while (t.left) t = t.left;
              return t;
            };
            Tree2.prototype.maxNode = function(t) {
              if (t === void 0) {
                t = this._root;
              }
              if (t) while (t.right) t = t.right;
              return t;
            };
            Tree2.prototype.at = function(index2) {
              var current = this._root;
              var done = false;
              var i = 0;
              var Q = [];
              while (!done) {
                if (current) {
                  Q.push(current);
                  current = current.left;
                } else {
                  if (Q.length > 0) {
                    current = Q.pop();
                    if (i === index2) return current;
                    i++;
                    current = current.right;
                  } else done = true;
                }
              }
              return null;
            };
            Tree2.prototype.next = function(d) {
              var root = this._root;
              var successor = null;
              if (d.right) {
                successor = d.right;
                while (successor.left) successor = successor.left;
                return successor;
              }
              var comparator = this._comparator;
              while (root) {
                var cmp2 = comparator(d.key, root.key);
                if (cmp2 === 0) break;
                else if (cmp2 < 0) {
                  successor = root;
                  root = root.left;
                } else root = root.right;
              }
              return successor;
            };
            Tree2.prototype.prev = function(d) {
              var root = this._root;
              var predecessor = null;
              if (d.left !== null) {
                predecessor = d.left;
                while (predecessor.right) predecessor = predecessor.right;
                return predecessor;
              }
              var comparator = this._comparator;
              while (root) {
                var cmp2 = comparator(d.key, root.key);
                if (cmp2 === 0) break;
                else if (cmp2 < 0) root = root.left;
                else {
                  predecessor = root;
                  root = root.right;
                }
              }
              return predecessor;
            };
            Tree2.prototype.clear = function() {
              this._root = null;
              this._size = 0;
              return this;
            };
            Tree2.prototype.toList = function() {
              return toList(this._root);
            };
            Tree2.prototype.load = function(keys, values, presort) {
              if (values === void 0) {
                values = [];
              }
              if (presort === void 0) {
                presort = false;
              }
              var size = keys.length;
              var comparator = this._comparator;
              if (presort) sort2(keys, values, 0, size - 1, comparator);
              if (this._root === null) {
                this._root = loadRecursive(keys, values, 0, size);
                this._size = size;
              } else {
                var mergedList = mergeLists(this.toList(), createList(keys, values), comparator);
                size = this._size + size;
                this._root = sortedListToBST({
                  head: mergedList
                }, 0, size);
              }
              return this;
            };
            Tree2.prototype.isEmpty = function() {
              return this._root === null;
            };
            Object.defineProperty(Tree2.prototype, "size", {
              get: function() {
                return this._size;
              },
              enumerable: true,
              configurable: true
            });
            Object.defineProperty(Tree2.prototype, "root", {
              get: function() {
                return this._root;
              },
              enumerable: true,
              configurable: true
            });
            Tree2.prototype.toString = function(printNode) {
              if (printNode === void 0) {
                printNode = function(n) {
                  return String(n.key);
                };
              }
              var out = [];
              printRow(this._root, "", true, function(v) {
                return out.push(v);
              }, printNode);
              return out.join("");
            };
            Tree2.prototype.update = function(key, newKey, newData) {
              var comparator = this._comparator;
              var _a = split(key, this._root, comparator), left = _a.left, right = _a.right;
              if (comparator(key, newKey) < 0) {
                right = insert(newKey, newData, right, comparator);
              } else {
                left = insert(newKey, newData, left, comparator);
              }
              this._root = merge(left, right, comparator);
            };
            Tree2.prototype.split = function(key) {
              return split(key, this._root, this._comparator);
            };
            Tree2.prototype[Symbol.iterator] = function() {
              var current, Q, done;
              return __generator(this, function(_a) {
                switch (_a.label) {
                  case 0:
                    current = this._root;
                    Q = [];
                    done = false;
                    _a.label = 1;
                  case 1:
                    if (!!done) return [3, 6];
                    if (!(current !== null)) return [3, 2];
                    Q.push(current);
                    current = current.left;
                    return [3, 5];
                  case 2:
                    if (!(Q.length !== 0)) return [3, 4];
                    current = Q.pop();
                    return [4, current];
                  case 3:
                    _a.sent();
                    current = current.right;
                    return [3, 5];
                  case 4:
                    done = true;
                    _a.label = 5;
                  case 5:
                    return [3, 1];
                  case 6:
                    return [
                      2
                      /*return*/
                    ];
                }
              });
            };
            return Tree2;
          })()
        );
        function loadRecursive(keys, values, start, end) {
          var size = end - start;
          if (size > 0) {
            var middle = start + Math.floor(size / 2);
            var key = keys[middle];
            var data = values[middle];
            var node = new Node(key, data);
            node.left = loadRecursive(keys, values, start, middle);
            node.right = loadRecursive(keys, values, middle + 1, end);
            return node;
          }
          return null;
        }
        function createList(keys, values) {
          var head = new Node(null, null);
          var p = head;
          for (var i = 0; i < keys.length; i++) {
            p = p.next = new Node(keys[i], values[i]);
          }
          p.next = null;
          return head.next;
        }
        function toList(root) {
          var current = root;
          var Q = [];
          var done = false;
          var head = new Node(null, null);
          var p = head;
          while (!done) {
            if (current) {
              Q.push(current);
              current = current.left;
            } else {
              if (Q.length > 0) {
                current = p = p.next = Q.pop();
                current = current.right;
              } else done = true;
            }
          }
          p.next = null;
          return head.next;
        }
        function sortedListToBST(list, start, end) {
          var size = end - start;
          if (size > 0) {
            var middle = start + Math.floor(size / 2);
            var left = sortedListToBST(list, start, middle);
            var root = list.head;
            root.left = left;
            list.head = list.head.next;
            root.right = sortedListToBST(list, middle + 1, end);
            return root;
          }
          return null;
        }
        function mergeLists(l1, l2, compare2) {
          var head = new Node(null, null);
          var p = head;
          var p1 = l1;
          var p2 = l2;
          while (p1 !== null && p2 !== null) {
            if (compare2(p1.key, p2.key) < 0) {
              p.next = p1;
              p1 = p1.next;
            } else {
              p.next = p2;
              p2 = p2.next;
            }
            p = p.next;
          }
          if (p1 !== null) {
            p.next = p1;
          } else if (p2 !== null) {
            p.next = p2;
          }
          return head.next;
        }
        function sort2(keys, values, left, right, compare2) {
          if (left >= right) return;
          var pivot = keys[left + right >> 1];
          var i = left - 1;
          var j = right + 1;
          while (true) {
            do
              i++;
            while (compare2(keys[i], pivot) < 0);
            do
              j--;
            while (compare2(keys[j], pivot) > 0);
            if (i >= j) break;
            var tmp = keys[i];
            keys[i] = keys[j];
            keys[j] = tmp;
            tmp = values[i];
            values[i] = values[j];
            values[j] = tmp;
          }
          sort2(keys, values, left, j, compare2);
          sort2(keys, values, j + 1, right, compare2);
        }
        const isInBbox2 = (bbox, point) => {
          return bbox.ll.x <= point.x && point.x <= bbox.ur.x && bbox.ll.y <= point.y && point.y <= bbox.ur.y;
        };
        const getBboxOverlap2 = (b1, b2) => {
          if (b2.ur.x < b1.ll.x || b1.ur.x < b2.ll.x || b2.ur.y < b1.ll.y || b1.ur.y < b2.ll.y) return null;
          const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
          const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;
          const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
          const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;
          return {
            ll: {
              x: lowerX,
              y: lowerY
            },
            ur: {
              x: upperX,
              y: upperY
            }
          };
        };
        let epsilon$1 = Number.EPSILON;
        if (epsilon$1 === void 0) epsilon$1 = Math.pow(2, -52);
        const EPSILON_SQ = epsilon$1 * epsilon$1;
        const cmp = (a, b) => {
          if (-epsilon$1 < a && a < epsilon$1) {
            if (-epsilon$1 < b && b < epsilon$1) {
              return 0;
            }
          }
          const ab = a - b;
          if (ab * ab < EPSILON_SQ * a * b) {
            return 0;
          }
          return a < b ? -1 : 1;
        };
        class PtRounder {
          constructor() {
            this.reset();
          }
          reset() {
            this.xRounder = new CoordRounder();
            this.yRounder = new CoordRounder();
          }
          round(x, y) {
            return {
              x: this.xRounder.round(x),
              y: this.yRounder.round(y)
            };
          }
        }
        class CoordRounder {
          constructor() {
            this.tree = new Tree();
            this.round(0);
          }
          // Note: this can rounds input values backwards or forwards.
          //       You might ask, why not restrict this to just rounding
          //       forwards? Wouldn't that allow left endpoints to always
          //       remain left endpoints during splitting (never change to
          //       right). No - it wouldn't, because we snap intersections
          //       to endpoints (to establish independence from the segment
          //       angle for t-intersections).
          round(coord) {
            const node = this.tree.add(coord);
            const prevNode = this.tree.prev(node);
            if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
              this.tree.remove(coord);
              return prevNode.key;
            }
            const nextNode = this.tree.next(node);
            if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
              this.tree.remove(coord);
              return nextNode.key;
            }
            return coord;
          }
        }
        const rounder = new PtRounder();
        const epsilon = 11102230246251565e-32;
        const splitter = 134217729;
        const resulterrbound = (3 + 8 * epsilon) * epsilon;
        function sum(elen, e, flen, f, h) {
          let Q, Qnew, hh, bvirt;
          let enow = e[0];
          let fnow = f[0];
          let eindex = 0;
          let findex = 0;
          if (fnow > enow === fnow > -enow) {
            Q = enow;
            enow = e[++eindex];
          } else {
            Q = fnow;
            fnow = f[++findex];
          }
          let hindex = 0;
          if (eindex < elen && findex < flen) {
            if (fnow > enow === fnow > -enow) {
              Qnew = enow + Q;
              hh = Q - (Qnew - enow);
              enow = e[++eindex];
            } else {
              Qnew = fnow + Q;
              hh = Q - (Qnew - fnow);
              fnow = f[++findex];
            }
            Q = Qnew;
            if (hh !== 0) {
              h[hindex++] = hh;
            }
            while (eindex < elen && findex < flen) {
              if (fnow > enow === fnow > -enow) {
                Qnew = Q + enow;
                bvirt = Qnew - Q;
                hh = Q - (Qnew - bvirt) + (enow - bvirt);
                enow = e[++eindex];
              } else {
                Qnew = Q + fnow;
                bvirt = Qnew - Q;
                hh = Q - (Qnew - bvirt) + (fnow - bvirt);
                fnow = f[++findex];
              }
              Q = Qnew;
              if (hh !== 0) {
                h[hindex++] = hh;
              }
            }
          }
          while (eindex < elen) {
            Qnew = Q + enow;
            bvirt = Qnew - Q;
            hh = Q - (Qnew - bvirt) + (enow - bvirt);
            enow = e[++eindex];
            Q = Qnew;
            if (hh !== 0) {
              h[hindex++] = hh;
            }
          }
          while (findex < flen) {
            Qnew = Q + fnow;
            bvirt = Qnew - Q;
            hh = Q - (Qnew - bvirt) + (fnow - bvirt);
            fnow = f[++findex];
            Q = Qnew;
            if (hh !== 0) {
              h[hindex++] = hh;
            }
          }
          if (Q !== 0 || hindex === 0) {
            h[hindex++] = Q;
          }
          return hindex;
        }
        function estimate(elen, e) {
          let Q = e[0];
          for (let i = 1; i < elen; i++) Q += e[i];
          return Q;
        }
        function vec(n) {
          return new Float64Array(n);
        }
        const ccwerrboundA = (3 + 16 * epsilon) * epsilon;
        const ccwerrboundB = (2 + 12 * epsilon) * epsilon;
        const ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
        const B = vec(4);
        const C1 = vec(8);
        const C2 = vec(12);
        const D = vec(16);
        const u = vec(4);
        function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
          let acxtail, acytail, bcxtail, bcytail;
          let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;
          const acx = ax - cx;
          const bcx = bx - cx;
          const acy = ay - cy;
          const bcy = by - cy;
          s1 = acx * bcy;
          c = splitter * acx;
          ahi = c - (c - acx);
          alo = acx - ahi;
          c = splitter * bcy;
          bhi = c - (c - bcy);
          blo = bcy - bhi;
          s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
          t1 = acy * bcx;
          c = splitter * acy;
          ahi = c - (c - acy);
          alo = acy - ahi;
          c = splitter * bcx;
          bhi = c - (c - bcx);
          blo = bcx - bhi;
          t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
          _i = s0 - t0;
          bvirt = s0 - _i;
          B[0] = s0 - (_i + bvirt) + (bvirt - t0);
          _j = s1 + _i;
          bvirt = _j - s1;
          _0 = s1 - (_j - bvirt) + (_i - bvirt);
          _i = _0 - t1;
          bvirt = _0 - _i;
          B[1] = _0 - (_i + bvirt) + (bvirt - t1);
          u3 = _j + _i;
          bvirt = u3 - _j;
          B[2] = _j - (u3 - bvirt) + (_i - bvirt);
          B[3] = u3;
          let det = estimate(4, B);
          let errbound = ccwerrboundB * detsum;
          if (det >= errbound || -det >= errbound) {
            return det;
          }
          bvirt = ax - acx;
          acxtail = ax - (acx + bvirt) + (bvirt - cx);
          bvirt = bx - bcx;
          bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
          bvirt = ay - acy;
          acytail = ay - (acy + bvirt) + (bvirt - cy);
          bvirt = by - bcy;
          bcytail = by - (bcy + bvirt) + (bvirt - cy);
          if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
            return det;
          }
          errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
          det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
          if (det >= errbound || -det >= errbound) return det;
          s1 = acxtail * bcy;
          c = splitter * acxtail;
          ahi = c - (c - acxtail);
          alo = acxtail - ahi;
          c = splitter * bcy;
          bhi = c - (c - bcy);
          blo = bcy - bhi;
          s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
          t1 = acytail * bcx;
          c = splitter * acytail;
          ahi = c - (c - acytail);
          alo = acytail - ahi;
          c = splitter * bcx;
          bhi = c - (c - bcx);
          blo = bcx - bhi;
          t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
          _i = s0 - t0;
          bvirt = s0 - _i;
          u[0] = s0 - (_i + bvirt) + (bvirt - t0);
          _j = s1 + _i;
          bvirt = _j - s1;
          _0 = s1 - (_j - bvirt) + (_i - bvirt);
          _i = _0 - t1;
          bvirt = _0 - _i;
          u[1] = _0 - (_i + bvirt) + (bvirt - t1);
          u3 = _j + _i;
          bvirt = u3 - _j;
          u[2] = _j - (u3 - bvirt) + (_i - bvirt);
          u[3] = u3;
          const C1len = sum(4, B, 4, u, C1);
          s1 = acx * bcytail;
          c = splitter * acx;
          ahi = c - (c - acx);
          alo = acx - ahi;
          c = splitter * bcytail;
          bhi = c - (c - bcytail);
          blo = bcytail - bhi;
          s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
          t1 = acy * bcxtail;
          c = splitter * acy;
          ahi = c - (c - acy);
          alo = acy - ahi;
          c = splitter * bcxtail;
          bhi = c - (c - bcxtail);
          blo = bcxtail - bhi;
          t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
          _i = s0 - t0;
          bvirt = s0 - _i;
          u[0] = s0 - (_i + bvirt) + (bvirt - t0);
          _j = s1 + _i;
          bvirt = _j - s1;
          _0 = s1 - (_j - bvirt) + (_i - bvirt);
          _i = _0 - t1;
          bvirt = _0 - _i;
          u[1] = _0 - (_i + bvirt) + (bvirt - t1);
          u3 = _j + _i;
          bvirt = u3 - _j;
          u[2] = _j - (u3 - bvirt) + (_i - bvirt);
          u[3] = u3;
          const C2len = sum(C1len, C1, 4, u, C2);
          s1 = acxtail * bcytail;
          c = splitter * acxtail;
          ahi = c - (c - acxtail);
          alo = acxtail - ahi;
          c = splitter * bcytail;
          bhi = c - (c - bcytail);
          blo = bcytail - bhi;
          s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
          t1 = acytail * bcxtail;
          c = splitter * acytail;
          ahi = c - (c - acytail);
          alo = acytail - ahi;
          c = splitter * bcxtail;
          bhi = c - (c - bcxtail);
          blo = bcxtail - bhi;
          t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
          _i = s0 - t0;
          bvirt = s0 - _i;
          u[0] = s0 - (_i + bvirt) + (bvirt - t0);
          _j = s1 + _i;
          bvirt = _j - s1;
          _0 = s1 - (_j - bvirt) + (_i - bvirt);
          _i = _0 - t1;
          bvirt = _0 - _i;
          u[1] = _0 - (_i + bvirt) + (bvirt - t1);
          u3 = _j + _i;
          bvirt = u3 - _j;
          u[2] = _j - (u3 - bvirt) + (_i - bvirt);
          u[3] = u3;
          const Dlen = sum(C2len, C2, 4, u, D);
          return D[Dlen - 1];
        }
        function orient2d(ax, ay, bx, by, cx, cy) {
          const detleft = (ay - cy) * (bx - cx);
          const detright = (ax - cx) * (by - cy);
          const det = detleft - detright;
          const detsum = Math.abs(detleft + detright);
          if (Math.abs(det) >= ccwerrboundA * detsum) return det;
          return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
        }
        const crossProduct2 = (a, b) => a.x * b.y - a.y * b.x;
        const dotProduct2 = (a, b) => a.x * b.x + a.y * b.y;
        const compareVectorAngles = (basePt, endPt1, endPt2) => {
          const res = orient2d(basePt.x, basePt.y, endPt1.x, endPt1.y, endPt2.x, endPt2.y);
          if (res > 0) return -1;
          if (res < 0) return 1;
          return 0;
        };
        const length2 = (v) => Math.sqrt(dotProduct2(v, v));
        const sineOfAngle2 = (pShared, pBase, pAngle) => {
          const vBase = {
            x: pBase.x - pShared.x,
            y: pBase.y - pShared.y
          };
          const vAngle = {
            x: pAngle.x - pShared.x,
            y: pAngle.y - pShared.y
          };
          return crossProduct2(vAngle, vBase) / length2(vAngle) / length2(vBase);
        };
        const cosineOfAngle2 = (pShared, pBase, pAngle) => {
          const vBase = {
            x: pBase.x - pShared.x,
            y: pBase.y - pShared.y
          };
          const vAngle = {
            x: pAngle.x - pShared.x,
            y: pAngle.y - pShared.y
          };
          return dotProduct2(vAngle, vBase) / length2(vAngle) / length2(vBase);
        };
        const horizontalIntersection2 = (pt, v, y) => {
          if (v.y === 0) return null;
          return {
            x: pt.x + v.x / v.y * (y - pt.y),
            y
          };
        };
        const verticalIntersection2 = (pt, v, x) => {
          if (v.x === 0) return null;
          return {
            x,
            y: pt.y + v.y / v.x * (x - pt.x)
          };
        };
        const intersection$1 = (pt1, v1, pt2, v2) => {
          if (v1.x === 0) return verticalIntersection2(pt2, v2, pt1.x);
          if (v2.x === 0) return verticalIntersection2(pt1, v1, pt2.x);
          if (v1.y === 0) return horizontalIntersection2(pt2, v2, pt1.y);
          if (v2.y === 0) return horizontalIntersection2(pt1, v1, pt2.y);
          const kross = crossProduct2(v1, v2);
          if (kross == 0) return null;
          const ve = {
            x: pt2.x - pt1.x,
            y: pt2.y - pt1.y
          };
          const d1 = crossProduct2(ve, v1) / kross;
          const d2 = crossProduct2(ve, v2) / kross;
          const x1 = pt1.x + d2 * v1.x, x2 = pt2.x + d1 * v2.x;
          const y1 = pt1.y + d2 * v1.y, y2 = pt2.y + d1 * v2.y;
          const x = (x1 + x2) / 2;
          const y = (y1 + y2) / 2;
          return {
            x,
            y
          };
        };
        class SweepEvent2 {
          // for ordering sweep events in the sweep event queue
          static compare(a, b) {
            const ptCmp = SweepEvent2.comparePoints(a.point, b.point);
            if (ptCmp !== 0) return ptCmp;
            if (a.point !== b.point) a.link(b);
            if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
            return Segment2.compare(a.segment, b.segment);
          }
          // for ordering points in sweep line order
          static comparePoints(aPt, bPt) {
            if (aPt.x < bPt.x) return -1;
            if (aPt.x > bPt.x) return 1;
            if (aPt.y < bPt.y) return -1;
            if (aPt.y > bPt.y) return 1;
            return 0;
          }
          // Warning: 'point' input will be modified and re-used (for performance)
          constructor(point, isLeft) {
            if (point.events === void 0) point.events = [this];
            else point.events.push(this);
            this.point = point;
            this.isLeft = isLeft;
          }
          link(other) {
            if (other.point === this.point) {
              throw new Error("Tried to link already linked events");
            }
            const otherEvents = other.point.events;
            for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
              const evt = otherEvents[i];
              this.point.events.push(evt);
              evt.point = this.point;
            }
            this.checkForConsuming();
          }
          /* Do a pass over our linked events and check to see if any pair
           * of segments match, and should be consumed. */
          checkForConsuming() {
            const numEvents = this.point.events.length;
            for (let i = 0; i < numEvents; i++) {
              const evt1 = this.point.events[i];
              if (evt1.segment.consumedBy !== void 0) continue;
              for (let j = i + 1; j < numEvents; j++) {
                const evt2 = this.point.events[j];
                if (evt2.consumedBy !== void 0) continue;
                if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
                evt1.segment.consume(evt2.segment);
              }
            }
          }
          getAvailableLinkedEvents() {
            const events = [];
            for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
              const evt = this.point.events[i];
              if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
                events.push(evt);
              }
            }
            return events;
          }
          /**
           * Returns a comparator function for sorting linked events that will
           * favor the event that will give us the smallest left-side angle.
           * All ring construction starts as low as possible heading to the right,
           * so by always turning left as sharp as possible we'll get polygons
           * without uncessary loops & holes.
           *
           * The comparator function has a compute cache such that it avoids
           * re-computing already-computed values.
           */
          getLeftmostComparator(baseEvent) {
            const cache = /* @__PURE__ */ new Map();
            const fillCache = (linkedEvent) => {
              const nextEvent = linkedEvent.otherSE;
              cache.set(linkedEvent, {
                sine: sineOfAngle2(this.point, baseEvent.point, nextEvent.point),
                cosine: cosineOfAngle2(this.point, baseEvent.point, nextEvent.point)
              });
            };
            return (a, b) => {
              if (!cache.has(a)) fillCache(a);
              if (!cache.has(b)) fillCache(b);
              const {
                sine: asine,
                cosine: acosine
              } = cache.get(a);
              const {
                sine: bsine,
                cosine: bcosine
              } = cache.get(b);
              if (asine >= 0 && bsine >= 0) {
                if (acosine < bcosine) return 1;
                if (acosine > bcosine) return -1;
                return 0;
              }
              if (asine < 0 && bsine < 0) {
                if (acosine < bcosine) return -1;
                if (acosine > bcosine) return 1;
                return 0;
              }
              if (bsine < asine) return -1;
              if (bsine > asine) return 1;
              return 0;
            };
          }
        }
        let segmentId2 = 0;
        class Segment2 {
          /* This compare() function is for ordering segments in the sweep
           * line tree, and does so according to the following criteria:
           *
           * Consider the vertical line that lies an infinestimal step to the
           * right of the right-more of the two left endpoints of the input
           * segments. Imagine slowly moving a point up from negative infinity
           * in the increasing y direction. Which of the two segments will that
           * point intersect first? That segment comes 'before' the other one.
           *
           * If neither segment would be intersected by such a line, (if one
           * or more of the segments are vertical) then the line to be considered
           * is directly on the right-more of the two left inputs.
           */
          static compare(a, b) {
            const alx = a.leftSE.point.x;
            const blx = b.leftSE.point.x;
            const arx = a.rightSE.point.x;
            const brx = b.rightSE.point.x;
            if (brx < alx) return 1;
            if (arx < blx) return -1;
            const aly = a.leftSE.point.y;
            const bly = b.leftSE.point.y;
            const ary = a.rightSE.point.y;
            const bry = b.rightSE.point.y;
            if (alx < blx) {
              if (bly < aly && bly < ary) return 1;
              if (bly > aly && bly > ary) return -1;
              const aCmpBLeft = a.comparePoint(b.leftSE.point);
              if (aCmpBLeft < 0) return 1;
              if (aCmpBLeft > 0) return -1;
              const bCmpARight = b.comparePoint(a.rightSE.point);
              if (bCmpARight !== 0) return bCmpARight;
              return -1;
            }
            if (alx > blx) {
              if (aly < bly && aly < bry) return -1;
              if (aly > bly && aly > bry) return 1;
              const bCmpALeft = b.comparePoint(a.leftSE.point);
              if (bCmpALeft !== 0) return bCmpALeft;
              const aCmpBRight = a.comparePoint(b.rightSE.point);
              if (aCmpBRight < 0) return 1;
              if (aCmpBRight > 0) return -1;
              return 1;
            }
            if (aly < bly) return -1;
            if (aly > bly) return 1;
            if (arx < brx) {
              const bCmpARight = b.comparePoint(a.rightSE.point);
              if (bCmpARight !== 0) return bCmpARight;
            }
            if (arx > brx) {
              const aCmpBRight = a.comparePoint(b.rightSE.point);
              if (aCmpBRight < 0) return 1;
              if (aCmpBRight > 0) return -1;
            }
            if (arx !== brx) {
              const ay = ary - aly;
              const ax = arx - alx;
              const by = bry - bly;
              const bx = brx - blx;
              if (ay > ax && by < bx) return 1;
              if (ay < ax && by > bx) return -1;
            }
            if (arx > brx) return 1;
            if (arx < brx) return -1;
            if (ary < bry) return -1;
            if (ary > bry) return 1;
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
          }
          /* Warning: a reference to ringWindings input will be stored,
           *  and possibly will be later modified */
          constructor(leftSE, rightSE, rings, windings) {
            this.id = ++segmentId2;
            this.leftSE = leftSE;
            leftSE.segment = this;
            leftSE.otherSE = rightSE;
            this.rightSE = rightSE;
            rightSE.segment = this;
            rightSE.otherSE = leftSE;
            this.rings = rings;
            this.windings = windings;
          }
          static fromRing(pt1, pt2, ring) {
            let leftPt, rightPt, winding;
            const cmpPts = SweepEvent2.comparePoints(pt1, pt2);
            if (cmpPts < 0) {
              leftPt = pt1;
              rightPt = pt2;
              winding = 1;
            } else if (cmpPts > 0) {
              leftPt = pt2;
              rightPt = pt1;
              winding = -1;
            } else throw new Error(`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`);
            const leftSE = new SweepEvent2(leftPt, true);
            const rightSE = new SweepEvent2(rightPt, false);
            return new Segment2(leftSE, rightSE, [ring], [winding]);
          }
          /* When a segment is split, the rightSE is replaced with a new sweep event */
          replaceRightSE(newRightSE) {
            this.rightSE = newRightSE;
            this.rightSE.segment = this;
            this.rightSE.otherSE = this.leftSE;
            this.leftSE.otherSE = this.rightSE;
          }
          bbox() {
            const y1 = this.leftSE.point.y;
            const y2 = this.rightSE.point.y;
            return {
              ll: {
                x: this.leftSE.point.x,
                y: y1 < y2 ? y1 : y2
              },
              ur: {
                x: this.rightSE.point.x,
                y: y1 > y2 ? y1 : y2
              }
            };
          }
          /* A vector from the left point to the right */
          vector() {
            return {
              x: this.rightSE.point.x - this.leftSE.point.x,
              y: this.rightSE.point.y - this.leftSE.point.y
            };
          }
          isAnEndpoint(pt) {
            return pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y || pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y;
          }
          /* Compare this segment with a point.
           *
           * A point P is considered to be colinear to a segment if there
           * exists a distance D such that if we travel along the segment
           * from one * endpoint towards the other a distance D, we find
           * ourselves at point P.
           *
           * Return value indicates:
           *
           *   1: point lies above the segment (to the left of vertical)
           *   0: point is colinear to segment
           *  -1: point lies below the segment (to the right of vertical)
           */
          comparePoint(point) {
            if (this.isAnEndpoint(point)) return 0;
            const lPt = this.leftSE.point;
            const rPt = this.rightSE.point;
            const v = this.vector();
            if (lPt.x === rPt.x) {
              if (point.x === lPt.x) return 0;
              return point.x < lPt.x ? 1 : -1;
            }
            const yDist = (point.y - lPt.y) / v.y;
            const xFromYDist = lPt.x + yDist * v.x;
            if (point.x === xFromYDist) return 0;
            const xDist = (point.x - lPt.x) / v.x;
            const yFromXDist = lPt.y + xDist * v.y;
            if (point.y === yFromXDist) return 0;
            return point.y < yFromXDist ? -1 : 1;
          }
          /**
           * Given another segment, returns the first non-trivial intersection
           * between the two segments (in terms of sweep line ordering), if it exists.
           *
           * A 'non-trivial' intersection is one that will cause one or both of the
           * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
           *
           *   * endpoint of segA with endpoint of segB --> trivial
           *   * endpoint of segA with point along segB --> non-trivial
           *   * endpoint of segB with point along segA --> non-trivial
           *   * point along segA with point along segB --> non-trivial
           *
           * If no non-trivial intersection exists, return null
           * Else, return null.
           */
          getIntersection(other) {
            const tBbox = this.bbox();
            const oBbox = other.bbox();
            const bboxOverlap = getBboxOverlap2(tBbox, oBbox);
            if (bboxOverlap === null) return null;
            const tlp = this.leftSE.point;
            const trp = this.rightSE.point;
            const olp = other.leftSE.point;
            const orp = other.rightSE.point;
            const touchesOtherLSE = isInBbox2(tBbox, olp) && this.comparePoint(olp) === 0;
            const touchesThisLSE = isInBbox2(oBbox, tlp) && other.comparePoint(tlp) === 0;
            const touchesOtherRSE = isInBbox2(tBbox, orp) && this.comparePoint(orp) === 0;
            const touchesThisRSE = isInBbox2(oBbox, trp) && other.comparePoint(trp) === 0;
            if (touchesThisLSE && touchesOtherLSE) {
              if (touchesThisRSE && !touchesOtherRSE) return trp;
              if (!touchesThisRSE && touchesOtherRSE) return orp;
              return null;
            }
            if (touchesThisLSE) {
              if (touchesOtherRSE) {
                if (tlp.x === orp.x && tlp.y === orp.y) return null;
              }
              return tlp;
            }
            if (touchesOtherLSE) {
              if (touchesThisRSE) {
                if (trp.x === olp.x && trp.y === olp.y) return null;
              }
              return olp;
            }
            if (touchesThisRSE && touchesOtherRSE) return null;
            if (touchesThisRSE) return trp;
            if (touchesOtherRSE) return orp;
            const pt = intersection$1(tlp, this.vector(), olp, other.vector());
            if (pt === null) return null;
            if (!isInBbox2(bboxOverlap, pt)) return null;
            return rounder.round(pt.x, pt.y);
          }
          /**
           * Split the given segment into multiple segments on the given points.
           *  * Each existing segment will retain its leftSE and a new rightSE will be
           *    generated for it.
           *  * A new segment will be generated which will adopt the original segment's
           *    rightSE, and a new leftSE will be generated for it.
           *  * If there are more than two points given to split on, new segments
           *    in the middle will be generated with new leftSE and rightSE's.
           *  * An array of the newly generated SweepEvents will be returned.
           *
           * Warning: input array of points is modified
           */
          split(point) {
            const newEvents = [];
            const alreadyLinked = point.events !== void 0;
            const newLeftSE = new SweepEvent2(point, true);
            const newRightSE = new SweepEvent2(point, false);
            const oldRightSE = this.rightSE;
            this.replaceRightSE(newRightSE);
            newEvents.push(newRightSE);
            newEvents.push(newLeftSE);
            const newSeg = new Segment2(newLeftSE, oldRightSE, this.rings.slice(), this.windings.slice());
            if (SweepEvent2.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
              newSeg.swapEvents();
            }
            if (SweepEvent2.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
              this.swapEvents();
            }
            if (alreadyLinked) {
              newLeftSE.checkForConsuming();
              newRightSE.checkForConsuming();
            }
            return newEvents;
          }
          /* Swap which event is left and right */
          swapEvents() {
            const tmpEvt = this.rightSE;
            this.rightSE = this.leftSE;
            this.leftSE = tmpEvt;
            this.leftSE.isLeft = true;
            this.rightSE.isLeft = false;
            for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
              this.windings[i] *= -1;
            }
          }
          /* Consume another segment. We take their rings under our wing
           * and mark them as consumed. Use for perfectly overlapping segments */
          consume(other) {
            let consumer = this;
            let consumee = other;
            while (consumer.consumedBy) consumer = consumer.consumedBy;
            while (consumee.consumedBy) consumee = consumee.consumedBy;
            const cmp2 = Segment2.compare(consumer, consumee);
            if (cmp2 === 0) return;
            if (cmp2 > 0) {
              const tmp = consumer;
              consumer = consumee;
              consumee = tmp;
            }
            if (consumer.prev === consumee) {
              const tmp = consumer;
              consumer = consumee;
              consumee = tmp;
            }
            for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
              const ring = consumee.rings[i];
              const winding = consumee.windings[i];
              const index2 = consumer.rings.indexOf(ring);
              if (index2 === -1) {
                consumer.rings.push(ring);
                consumer.windings.push(winding);
              } else consumer.windings[index2] += winding;
            }
            consumee.rings = null;
            consumee.windings = null;
            consumee.consumedBy = consumer;
            consumee.leftSE.consumedBy = consumer.leftSE;
            consumee.rightSE.consumedBy = consumer.rightSE;
          }
          /* The first segment previous segment chain that is in the result */
          prevInResult() {
            if (this._prevInResult !== void 0) return this._prevInResult;
            if (!this.prev) this._prevInResult = null;
            else if (this.prev.isInResult()) this._prevInResult = this.prev;
            else this._prevInResult = this.prev.prevInResult();
            return this._prevInResult;
          }
          beforeState() {
            if (this._beforeState !== void 0) return this._beforeState;
            if (!this.prev) this._beforeState = {
              rings: [],
              windings: [],
              multiPolys: []
            };
            else {
              const seg = this.prev.consumedBy || this.prev;
              this._beforeState = seg.afterState();
            }
            return this._beforeState;
          }
          afterState() {
            if (this._afterState !== void 0) return this._afterState;
            const beforeState = this.beforeState();
            this._afterState = {
              rings: beforeState.rings.slice(0),
              windings: beforeState.windings.slice(0),
              multiPolys: []
            };
            const ringsAfter = this._afterState.rings;
            const windingsAfter = this._afterState.windings;
            const mpsAfter = this._afterState.multiPolys;
            for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
              const ring = this.rings[i];
              const winding = this.windings[i];
              const index2 = ringsAfter.indexOf(ring);
              if (index2 === -1) {
                ringsAfter.push(ring);
                windingsAfter.push(winding);
              } else windingsAfter[index2] += winding;
            }
            const polysAfter = [];
            const polysExclude = [];
            for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
              if (windingsAfter[i] === 0) continue;
              const ring = ringsAfter[i];
              const poly = ring.poly;
              if (polysExclude.indexOf(poly) !== -1) continue;
              if (ring.isExterior) polysAfter.push(poly);
              else {
                if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
                const index2 = polysAfter.indexOf(ring.poly);
                if (index2 !== -1) polysAfter.splice(index2, 1);
              }
            }
            for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
              const mp = polysAfter[i].multiPoly;
              if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
            }
            return this._afterState;
          }
          /* Is this segment part of the final result? */
          isInResult() {
            if (this.consumedBy) return false;
            if (this._isInResult !== void 0) return this._isInResult;
            const mpsBefore = this.beforeState().multiPolys;
            const mpsAfter = this.afterState().multiPolys;
            switch (operation2.type) {
              case "union": {
                const noBefores = mpsBefore.length === 0;
                const noAfters = mpsAfter.length === 0;
                this._isInResult = noBefores !== noAfters;
                break;
              }
              case "intersection": {
                let least;
                let most;
                if (mpsBefore.length < mpsAfter.length) {
                  least = mpsBefore.length;
                  most = mpsAfter.length;
                } else {
                  least = mpsAfter.length;
                  most = mpsBefore.length;
                }
                this._isInResult = most === operation2.numMultiPolys && least < most;
                break;
              }
              case "xor": {
                const diff = Math.abs(mpsBefore.length - mpsAfter.length);
                this._isInResult = diff % 2 === 1;
                break;
              }
              case "difference": {
                const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
                this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
                break;
              }
              default:
                throw new Error(`Unrecognized operation type found ${operation2.type}`);
            }
            return this._isInResult;
          }
        }
        class RingIn2 {
          constructor(geomRing, poly, isExterior) {
            if (!Array.isArray(geomRing) || geomRing.length === 0) {
              throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
            }
            this.poly = poly;
            this.isExterior = isExterior;
            this.segments = [];
            if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
              throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
            }
            const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
            this.bbox = {
              ll: {
                x: firstPoint.x,
                y: firstPoint.y
              },
              ur: {
                x: firstPoint.x,
                y: firstPoint.y
              }
            };
            let prevPoint = firstPoint;
            for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
              if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
                throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
              }
              let point = rounder.round(geomRing[i][0], geomRing[i][1]);
              if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
              this.segments.push(Segment2.fromRing(prevPoint, point, this));
              if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
              if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
              if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
              if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
              prevPoint = point;
            }
            if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
              this.segments.push(Segment2.fromRing(prevPoint, firstPoint, this));
            }
          }
          getSweepEvents() {
            const sweepEvents = [];
            for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
              const segment = this.segments[i];
              sweepEvents.push(segment.leftSE);
              sweepEvents.push(segment.rightSE);
            }
            return sweepEvents;
          }
        }
        class PolyIn2 {
          constructor(geomPoly, multiPoly) {
            if (!Array.isArray(geomPoly)) {
              throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
            }
            this.exteriorRing = new RingIn2(geomPoly[0], this, true);
            this.bbox = {
              ll: {
                x: this.exteriorRing.bbox.ll.x,
                y: this.exteriorRing.bbox.ll.y
              },
              ur: {
                x: this.exteriorRing.bbox.ur.x,
                y: this.exteriorRing.bbox.ur.y
              }
            };
            this.interiorRings = [];
            for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
              const ring = new RingIn2(geomPoly[i], this, false);
              if (ring.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = ring.bbox.ll.x;
              if (ring.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = ring.bbox.ll.y;
              if (ring.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = ring.bbox.ur.x;
              if (ring.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = ring.bbox.ur.y;
              this.interiorRings.push(ring);
            }
            this.multiPoly = multiPoly;
          }
          getSweepEvents() {
            const sweepEvents = this.exteriorRing.getSweepEvents();
            for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
              const ringSweepEvents = this.interiorRings[i].getSweepEvents();
              for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
                sweepEvents.push(ringSweepEvents[j]);
              }
            }
            return sweepEvents;
          }
        }
        class MultiPolyIn2 {
          constructor(geom, isSubject) {
            if (!Array.isArray(geom)) {
              throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
            }
            try {
              if (typeof geom[0][0][0] === "number") geom = [geom];
            } catch (ex) {
            }
            this.polys = [];
            this.bbox = {
              ll: {
                x: Number.POSITIVE_INFINITY,
                y: Number.POSITIVE_INFINITY
              },
              ur: {
                x: Number.NEGATIVE_INFINITY,
                y: Number.NEGATIVE_INFINITY
              }
            };
            for (let i = 0, iMax = geom.length; i < iMax; i++) {
              const poly = new PolyIn2(geom[i], this);
              if (poly.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = poly.bbox.ll.x;
              if (poly.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = poly.bbox.ll.y;
              if (poly.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = poly.bbox.ur.x;
              if (poly.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = poly.bbox.ur.y;
              this.polys.push(poly);
            }
            this.isSubject = isSubject;
          }
          getSweepEvents() {
            const sweepEvents = [];
            for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
              const polySweepEvents = this.polys[i].getSweepEvents();
              for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
                sweepEvents.push(polySweepEvents[j]);
              }
            }
            return sweepEvents;
          }
        }
        class RingOut2 {
          /* Given the segments from the sweep line pass, compute & return a series
           * of closed rings from all the segments marked to be part of the result */
          static factory(allSegments) {
            const ringsOut = [];
            for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
              const segment = allSegments[i];
              if (!segment.isInResult() || segment.ringOut) continue;
              let prevEvent = null;
              let event = segment.leftSE;
              let nextEvent = segment.rightSE;
              const events = [event];
              const startingPoint = event.point;
              const intersectionLEs = [];
              while (true) {
                prevEvent = event;
                event = nextEvent;
                events.push(event);
                if (event.point === startingPoint) break;
                while (true) {
                  const availableLEs = event.getAvailableLinkedEvents();
                  if (availableLEs.length === 0) {
                    const firstPt = events[0].point;
                    const lastPt = events[events.length - 1].point;
                    throw new Error(`Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`);
                  }
                  if (availableLEs.length === 1) {
                    nextEvent = availableLEs[0].otherSE;
                    break;
                  }
                  let indexLE = null;
                  for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
                    if (intersectionLEs[j].point === event.point) {
                      indexLE = j;
                      break;
                    }
                  }
                  if (indexLE !== null) {
                    const intersectionLE = intersectionLEs.splice(indexLE)[0];
                    const ringEvents = events.splice(intersectionLE.index);
                    ringEvents.unshift(ringEvents[0].otherSE);
                    ringsOut.push(new RingOut2(ringEvents.reverse()));
                    continue;
                  }
                  intersectionLEs.push({
                    index: events.length,
                    point: event.point
                  });
                  const comparator = event.getLeftmostComparator(prevEvent);
                  nextEvent = availableLEs.sort(comparator)[0].otherSE;
                  break;
                }
              }
              ringsOut.push(new RingOut2(events));
            }
            return ringsOut;
          }
          constructor(events) {
            this.events = events;
            for (let i = 0, iMax = events.length; i < iMax; i++) {
              events[i].segment.ringOut = this;
            }
            this.poly = null;
          }
          getGeom() {
            let prevPt = this.events[0].point;
            const points = [prevPt];
            for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
              const pt2 = this.events[i].point;
              const nextPt2 = this.events[i + 1].point;
              if (compareVectorAngles(pt2, prevPt, nextPt2) === 0) continue;
              points.push(pt2);
              prevPt = pt2;
            }
            if (points.length === 1) return null;
            const pt = points[0];
            const nextPt = points[1];
            if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
            points.push(points[0]);
            const step = this.isExteriorRing() ? 1 : -1;
            const iStart = this.isExteriorRing() ? 0 : points.length - 1;
            const iEnd = this.isExteriorRing() ? points.length : -1;
            const orderedPoints = [];
            for (let i = iStart; i != iEnd; i += step) orderedPoints.push([points[i].x, points[i].y]);
            return orderedPoints;
          }
          isExteriorRing() {
            if (this._isExteriorRing === void 0) {
              const enclosing = this.enclosingRing();
              this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
            }
            return this._isExteriorRing;
          }
          enclosingRing() {
            if (this._enclosingRing === void 0) {
              this._enclosingRing = this._calcEnclosingRing();
            }
            return this._enclosingRing;
          }
          /* Returns the ring that encloses this one, if any */
          _calcEnclosingRing() {
            let leftMostEvt = this.events[0];
            for (let i = 1, iMax = this.events.length; i < iMax; i++) {
              const evt = this.events[i];
              if (SweepEvent2.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
            }
            let prevSeg = leftMostEvt.segment.prevInResult();
            let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
            while (true) {
              if (!prevSeg) return null;
              if (!prevPrevSeg) return prevSeg.ringOut;
              if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
                if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
                  return prevSeg.ringOut;
                } else return prevSeg.ringOut.enclosingRing();
              }
              prevSeg = prevPrevSeg.prevInResult();
              prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
            }
          }
        }
        class PolyOut2 {
          constructor(exteriorRing) {
            this.exteriorRing = exteriorRing;
            exteriorRing.poly = this;
            this.interiorRings = [];
          }
          addInterior(ring) {
            this.interiorRings.push(ring);
            ring.poly = this;
          }
          getGeom() {
            const geom = [this.exteriorRing.getGeom()];
            if (geom[0] === null) return null;
            for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
              const ringGeom = this.interiorRings[i].getGeom();
              if (ringGeom === null) continue;
              geom.push(ringGeom);
            }
            return geom;
          }
        }
        class MultiPolyOut2 {
          constructor(rings) {
            this.rings = rings;
            this.polys = this._composePolys(rings);
          }
          getGeom() {
            const geom = [];
            for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
              const polyGeom = this.polys[i].getGeom();
              if (polyGeom === null) continue;
              geom.push(polyGeom);
            }
            return geom;
          }
          _composePolys(rings) {
            const polys = [];
            for (let i = 0, iMax = rings.length; i < iMax; i++) {
              const ring = rings[i];
              if (ring.poly) continue;
              if (ring.isExteriorRing()) polys.push(new PolyOut2(ring));
              else {
                const enclosingRing = ring.enclosingRing();
                if (!enclosingRing.poly) polys.push(new PolyOut2(enclosingRing));
                enclosingRing.poly.addInterior(ring);
              }
            }
            return polys;
          }
        }
        class SweepLine2 {
          constructor(queue) {
            let comparator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Segment2.compare;
            this.queue = queue;
            this.tree = new Tree(comparator);
            this.segments = [];
          }
          process(event) {
            const segment = event.segment;
            const newEvents = [];
            if (event.consumedBy) {
              if (event.isLeft) this.queue.remove(event.otherSE);
              else this.tree.remove(segment);
              return newEvents;
            }
            const node = event.isLeft ? this.tree.add(segment) : this.tree.find(segment);
            if (!node) throw new Error(`Unable to find segment #${segment.id} [${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> [${segment.rightSE.point.x}, ${segment.rightSE.point.y}] in SweepLine tree.`);
            let prevNode = node;
            let nextNode = node;
            let prevSeg = void 0;
            let nextSeg = void 0;
            while (prevSeg === void 0) {
              prevNode = this.tree.prev(prevNode);
              if (prevNode === null) prevSeg = null;
              else if (prevNode.key.consumedBy === void 0) prevSeg = prevNode.key;
            }
            while (nextSeg === void 0) {
              nextNode = this.tree.next(nextNode);
              if (nextNode === null) nextSeg = null;
              else if (nextNode.key.consumedBy === void 0) nextSeg = nextNode.key;
            }
            if (event.isLeft) {
              let prevMySplitter = null;
              if (prevSeg) {
                const prevInter = prevSeg.getIntersection(segment);
                if (prevInter !== null) {
                  if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
                  if (!prevSeg.isAnEndpoint(prevInter)) {
                    const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
                    for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                      newEvents.push(newEventsFromSplit[i]);
                    }
                  }
                }
              }
              let nextMySplitter = null;
              if (nextSeg) {
                const nextInter = nextSeg.getIntersection(segment);
                if (nextInter !== null) {
                  if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
                  if (!nextSeg.isAnEndpoint(nextInter)) {
                    const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
                    for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                      newEvents.push(newEventsFromSplit[i]);
                    }
                  }
                }
              }
              if (prevMySplitter !== null || nextMySplitter !== null) {
                let mySplitter = null;
                if (prevMySplitter === null) mySplitter = nextMySplitter;
                else if (nextMySplitter === null) mySplitter = prevMySplitter;
                else {
                  const cmpSplitters = SweepEvent2.comparePoints(prevMySplitter, nextMySplitter);
                  mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
                }
                this.queue.remove(segment.rightSE);
                newEvents.push(segment.rightSE);
                const newEventsFromSplit = segment.split(mySplitter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
              if (newEvents.length > 0) {
                this.tree.remove(segment);
                newEvents.push(event);
              } else {
                this.segments.push(segment);
                segment.prev = prevSeg;
              }
            } else {
              if (prevSeg && nextSeg) {
                const inter = prevSeg.getIntersection(nextSeg);
                if (inter !== null) {
                  if (!prevSeg.isAnEndpoint(inter)) {
                    const newEventsFromSplit = this._splitSafely(prevSeg, inter);
                    for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                      newEvents.push(newEventsFromSplit[i]);
                    }
                  }
                  if (!nextSeg.isAnEndpoint(inter)) {
                    const newEventsFromSplit = this._splitSafely(nextSeg, inter);
                    for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                      newEvents.push(newEventsFromSplit[i]);
                    }
                  }
                }
              }
              this.tree.remove(segment);
            }
            return newEvents;
          }
          /* Safely split a segment that is currently in the datastructures
           * IE - a segment other than the one that is currently being processed. */
          _splitSafely(seg, pt) {
            this.tree.remove(seg);
            const rightSE = seg.rightSE;
            this.queue.remove(rightSE);
            const newEvents = seg.split(pt);
            newEvents.push(rightSE);
            if (seg.consumedBy === void 0) this.tree.add(seg);
            return newEvents;
          }
        }
        const POLYGON_CLIPPING_MAX_QUEUE_SIZE = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE || 1e6;
        const POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS || 1e6;
        class Operation2 {
          run(type, geom, moreGeoms) {
            operation2.type = type;
            rounder.reset();
            const multipolys = [new MultiPolyIn2(geom, true)];
            for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
              multipolys.push(new MultiPolyIn2(moreGeoms[i], false));
            }
            operation2.numMultiPolys = multipolys.length;
            if (operation2.type === "difference") {
              const subject = multipolys[0];
              let i = 1;
              while (i < multipolys.length) {
                if (getBboxOverlap2(multipolys[i].bbox, subject.bbox) !== null) i++;
                else multipolys.splice(i, 1);
              }
            }
            if (operation2.type === "intersection") {
              for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
                const mpA = multipolys[i];
                for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
                  if (getBboxOverlap2(mpA.bbox, multipolys[j].bbox) === null) return [];
                }
              }
            }
            const queue = new Tree(SweepEvent2.compare);
            for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
              const sweepEvents = multipolys[i].getSweepEvents();
              for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
                queue.insert(sweepEvents[j]);
                if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
                  throw new Error("Infinite loop when putting segment endpoints in a priority queue (queue size too big).");
                }
              }
            }
            const sweepLine = new SweepLine2(queue);
            let prevQueueSize = queue.size;
            let node = queue.pop();
            while (node) {
              const evt = node.key;
              if (queue.size === prevQueueSize) {
                const seg = evt.segment;
                throw new Error(`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent [${evt.point.x}, ${evt.point.y}] from segment #${seg.id} [${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> [${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`);
              }
              if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
                throw new Error("Infinite loop when passing sweep line over endpoints (queue size too big).");
              }
              if (sweepLine.segments.length > POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) {
                throw new Error("Infinite loop when passing sweep line over endpoints (too many sweep line segments).");
              }
              const newEvents = sweepLine.process(evt);
              for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
                const evt2 = newEvents[i];
                if (evt2.consumedBy === void 0) queue.insert(evt2);
              }
              prevQueueSize = queue.size;
              node = queue.pop();
            }
            rounder.reset();
            const ringsOut = RingOut2.factory(sweepLine.segments);
            const result = new MultiPolyOut2(ringsOut);
            return result.getGeom();
          }
        }
        const operation2 = new Operation2();
        const union2 = function(geom) {
          for (var _len = arguments.length, moreGeoms = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            moreGeoms[_key - 1] = arguments[_key];
          }
          return operation2.run("union", geom, moreGeoms);
        };
        const intersection2 = function(geom) {
          for (var _len2 = arguments.length, moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            moreGeoms[_key2 - 1] = arguments[_key2];
          }
          return operation2.run("intersection", geom, moreGeoms);
        };
        const xor = function(geom) {
          for (var _len3 = arguments.length, moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
            moreGeoms[_key3 - 1] = arguments[_key3];
          }
          return operation2.run("xor", geom, moreGeoms);
        };
        const difference = function(subjectGeom) {
          for (var _len4 = arguments.length, clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
            clippingGeoms[_key4 - 1] = arguments[_key4];
          }
          return operation2.run("difference", subjectGeom, clippingGeoms);
        };
        var index = {
          union: union2,
          intersection: intersection2,
          xor,
          difference
        };
        return index;
      }));
    }
  });

  // 世界生成器_1.4.0.dev164_Windows/runtime/node_modules/flatqueue/index.js
  var FlatQueue = class {
    /**
     * Creates an empty queue. If `capacity` is provided, the queue is backed by fixed-size typed
     * arrays for better performance and memory use, but can't grow beyond `capacity`. `values` uses
     * `ValuesArray` (default `Float64Array`) and `ids` uses `IdsArray` (default `Uint32Array`); pass
     * narrower constructors like `Uint16Array` if your values or ids are known to fit them.
     *
     * @param {number} [capacity]
     * @param {TypedArrayConstructor} [ValuesArray]
     * @param {TypedArrayConstructor} [IdsArray]
     */
    constructor(capacity = Infinity, ValuesArray = Float64Array, IdsArray = Uint32Array) {
      const fixed = capacity !== Infinity;
      this.ids = fixed ? (
        /** @type {T[]} */
        /** @type {unknown} */
        new IdsArray(capacity)
      ) : [];
      this.values = fixed ? (
        /** @type {number[]} */
        /** @type {unknown} */
        new ValuesArray(capacity)
      ) : [];
      this.capacity = capacity;
      this.length = 0;
    }
    /** Removes all items from the queue. */
    clear() {
      this.length = 0;
    }
    /**
     * Adds `item` to the queue with the specified `priority`.
     *
     * `priority` must be a number. Items are sorted and returned from low to high priority. Multiple items
     * with the same priority value can be added to the queue, but there is no guaranteed order between these items.
     *
     * For fixed-capacity queues, throws a `RangeError` if the queue is already full.
     *
     * @param {T} item
     * @param {number} priority
     */
    push(item, priority) {
      if (this.length === this.capacity) throw new RangeError("Queue is at capacity.");
      let pos = this.length++;
      while (pos > 0) {
        const parent = pos - 1 >> 1;
        const parentValue = this.values[parent];
        if (priority >= parentValue) break;
        this.ids[pos] = this.ids[parent];
        this.values[pos] = parentValue;
        pos = parent;
      }
      this.ids[pos] = item;
      this.values[pos] = priority;
    }
    /**
     * Removes and returns the item from the head of this queue, which is one of
     * the items with the lowest priority. If this queue is empty, returns `undefined`.
     */
    pop() {
      if (this.length === 0) return void 0;
      const ids = this.ids, values = this.values, top = ids[0], last = --this.length;
      if (last > 0) {
        const id = ids[last];
        const value = values[last];
        let pos = 0;
        const halfLen = last >> 1;
        while (pos < halfLen) {
          const left = (pos << 1) + 1;
          const right = left + 1;
          const child = left + (+(right < last) & +(values[right] < values[left]));
          if (values[child] >= value) break;
          ids[pos] = ids[child];
          values[pos] = values[child];
          pos = child;
        }
        ids[pos] = id;
        values[pos] = value;
      }
      return top;
    }
    /** Returns the item from the head of this queue without removing it. If this queue is empty, returns `undefined`. */
    peek() {
      return this.length > 0 ? this.ids[0] : void 0;
    }
    /**
     * Returns the priority value of the item at the head of this queue without
     * removing it. If this queue is empty, returns `undefined`.
     */
    peekValue() {
      return this.length > 0 ? this.values[0] : void 0;
    }
    /**
     * Shrinks the internal arrays to `this.length`. No-op for queues with fixed capacity.
     *
     * `pop()` and `clear()` calls don't free memory automatically to avoid unnecessary resize operations.
     * This also means that items that have been added to the queue can't be garbage collected until
     * a new item is pushed in their place, or this method is called.
     */
    shrink() {
      if (Array.isArray(this.ids)) this.ids.length = this.length;
      if (Array.isArray(this.values)) this.values.length = this.length;
    }
  };

  // 世界生成器_1.4.0.dev164_Windows/runtime/node_modules/flatbush/index.js
  var ARRAY_TYPES = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
  var VERSION = 3;
  var Flatbush = class _Flatbush {
    /**
     * Recreate a Flatbush index from raw `ArrayBuffer` or `SharedArrayBuffer` data.
     * @param {ArrayBufferLike} data
     * @param {number} [byteOffset=0] byte offset to the start of the Flatbush buffer in the referenced ArrayBuffer.
     * @returns {Flatbush} index
     */
    static from(data, byteOffset = 0) {
      if (byteOffset % 8 !== 0) {
        throw new Error("byteOffset must be 8-byte aligned.");
      }
      if (!data || data.byteLength === void 0 || "buffer" in data) {
        throw new Error("Data must be an instance of ArrayBuffer or SharedArrayBuffer.");
      }
      const [magic, versionAndType] = new Uint8Array(data, byteOffset + 0, 2);
      if (magic !== 251) {
        throw new Error("Data does not appear to be in a Flatbush format.");
      }
      const version = versionAndType >> 4;
      if (version !== VERSION) {
        throw new Error(`Got v${version} data when expected v${VERSION}.`);
      }
      const ArrayType = ARRAY_TYPES[versionAndType & 15];
      if (!ArrayType) {
        throw new Error("Unrecognized array type.");
      }
      const [nodeSize] = new Uint16Array(data, byteOffset + 2, 1);
      const [numItems] = new Uint32Array(data, byteOffset + 4, 1);
      return new _Flatbush(numItems, nodeSize, ArrayType, void 0, data, byteOffset);
    }
    /**
     * Create a Flatbush index that will hold a given number of items.
     * @param {number} numItems
     * @param {number} [nodeSize=16] Size of the tree node (16 by default).
     * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
     * @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used to store data (`ArrayBuffer` by default).
     * @param {ArrayBufferLike} [data] (Only used internally)
     * @param {number} [byteOffset=0] (Only used internally)
     */
    constructor(numItems, nodeSize = 16, ArrayType = Float64Array, ArrayBufferType = ArrayBuffer, data, byteOffset = 0) {
      if (numItems === void 0) throw new Error("Missing required argument: numItems.");
      if (isNaN(numItems) || numItems <= 0) throw new Error(`Unexpected numItems value: ${numItems}.`);
      this.numItems = +numItems;
      this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
      this.byteOffset = byteOffset;
      let n = numItems;
      let numNodes = n;
      this._levelBounds = [n * 4];
      do {
        n = Math.ceil(n / this.nodeSize);
        numNodes += n;
        this._levelBounds.push(numNodes * 4);
      } while (n !== 1);
      this.ArrayType = ArrayType;
      this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;
      const arrayTypeIndex = ARRAY_TYPES.indexOf(ArrayType);
      const nodesByteSize = numNodes * 4 * ArrayType.BYTES_PER_ELEMENT;
      if (arrayTypeIndex < 0) {
        throw new Error(`Unexpected typed array class: ${ArrayType}.`);
      }
      const BoxCtor = ArrayType;
      const IdxCtor = this.IndexArrayType;
      if (data) {
        this.data = data;
        this._boxes = new BoxCtor(data, byteOffset + 8, numNodes * 4);
        this._indices = new IdxCtor(data, byteOffset + 8 + nodesByteSize, numNodes);
        this._pos = numNodes * 4;
        this.minX = this._boxes[this._pos - 4];
        this.minY = this._boxes[this._pos - 3];
        this.maxX = this._boxes[this._pos - 2];
        this.maxY = this._boxes[this._pos - 1];
      } else {
        const data2 = this.data = new ArrayBufferType(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
        this._boxes = new BoxCtor(data2, 8, numNodes * 4);
        this._indices = new IdxCtor(data2, 8 + nodesByteSize, numNodes);
        this._pos = 0;
        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;
        new Uint8Array(data2, 0, 2).set([251, (VERSION << 4) + arrayTypeIndex]);
        new Uint16Array(data2, 2, 1)[0] = nodeSize;
        new Uint32Array(data2, 4, 1)[0] = numItems;
      }
      this._queue = new FlatQueue();
    }
    /**
     * Add a given rectangle to the index.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @returns {number} A zero-based, incremental number that represents the newly added rectangle.
     */
    add(minX, minY, maxX = minX, maxY = minY) {
      const pos = this._pos;
      const index = pos >> 2;
      const boxes = this._boxes;
      this._indices[index] = index;
      boxes[pos] = minX;
      boxes[pos + 1] = minY;
      boxes[pos + 2] = maxX;
      boxes[pos + 3] = maxY;
      this._pos = pos + 4;
      if (minX < this.minX) this.minX = minX;
      if (minY < this.minY) this.minY = minY;
      if (maxX > this.maxX) this.maxX = maxX;
      if (maxY > this.maxY) this.maxY = maxY;
      return index;
    }
    /** Perform indexing of the added rectangles. */
    finish() {
      if (this._pos >> 2 !== this.numItems) {
        throw new Error(`Added ${this._pos >> 2} items when expected ${this.numItems}.`);
      }
      const boxes = this._boxes;
      if (this.numItems <= this.nodeSize) {
        boxes[this._pos++] = this.minX;
        boxes[this._pos++] = this.minY;
        boxes[this._pos++] = this.maxX;
        boxes[this._pos++] = this.maxY;
        return;
      }
      const { numItems, minX, minY, nodeSize, _indices: indices, _levelBounds: levelBounds } = this;
      const width = this.maxX - minX || 1;
      const height = this.maxY - minY || 1;
      const hilbertValues = new Int32Array(numItems);
      const hilbertMax = (1 << 16) - 1;
      const sx = hilbertMax / width;
      const sy = hilbertMax / height;
      for (let i = 0, pos2 = 0; i < numItems; i++) {
        const itemMinX = boxes[pos2++];
        const itemMinY = boxes[pos2++];
        const itemMaxX = boxes[pos2++];
        const itemMaxY = boxes[pos2++];
        const x = sx * ((itemMinX + itemMaxX) / 2 - minX) | 0;
        const y = sy * ((itemMinY + itemMaxY) / 2 - minY) | 0;
        hilbertValues[i] = hilbert(x, y);
      }
      sort(hilbertValues, boxes, indices, 0, numItems - 1, nodeSize);
      let pos = numItems * 4;
      for (let i = 0, readPos = 0; i < levelBounds.length - 1; i++) {
        const end = levelBounds[i];
        while (readPos < end) {
          const nodeIndex = readPos;
          let nodeMinX = boxes[readPos++];
          let nodeMinY = boxes[readPos++];
          let nodeMaxX = boxes[readPos++];
          let nodeMaxY = boxes[readPos++];
          for (let j = 1; j < nodeSize && readPos < end; j++) {
            nodeMinX = Math.min(nodeMinX, boxes[readPos++]);
            nodeMinY = Math.min(nodeMinY, boxes[readPos++]);
            nodeMaxX = Math.max(nodeMaxX, boxes[readPos++]);
            nodeMaxY = Math.max(nodeMaxY, boxes[readPos++]);
          }
          indices[pos >> 2] = nodeIndex;
          boxes[pos++] = nodeMinX;
          boxes[pos++] = nodeMinY;
          boxes[pos++] = nodeMaxX;
          boxes[pos++] = nodeMaxY;
        }
      }
      this._pos = pos;
    }
    /**
     * Search the index by a bounding box.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @param {(index: number, x0: number, y0: number, x1: number, y1: number) => boolean} [filterFn] An optional function that is called on every found item; if supplied, only items for which this function returns true will be included in the results array.
     * @returns {number[]} An array of indices of items intersecting or touching the given bounding box.
     */
    search(minX, minY, maxX, maxY, filterFn) {
      if (this._pos !== this._boxes.length) {
        throw new Error("Data not yet indexed - call index.finish().");
      }
      const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, nodeSize } = this;
      const numItems4 = this.numItems * 4;
      let nodeIndex = boxes.length - 4;
      let level = levelBounds.length - 1;
      const q = [];
      const results = [];
      let contained = false;
      while (nodeIndex !== void 0) {
        const end = Math.min(nodeIndex + nodeSize * 4, levelBounds[level]);
        const isNode = nodeIndex >= numItems4;
        if (contained) {
          this._collectContained(nodeIndex, end, level, numItems4, results, filterFn);
        } else {
          for (let pos = nodeIndex; pos < end; pos += 4) {
            const x0 = boxes[pos];
            if (maxX < x0) continue;
            const y0 = boxes[pos + 1];
            if (maxY < y0) continue;
            const x1 = boxes[pos + 2];
            if (minX > x1) continue;
            const y1 = boxes[pos + 3];
            if (minY > y1) continue;
            const index = indices[pos >> 2] | 0;
            if (isNode) {
              const c = +(minX <= x0 && minY <= y0 && maxX >= x1 && maxY >= y1);
              q.push(index | c, level - 1);
            } else if (filterFn === void 0 || filterFn(index, x0, y0, x1, y1)) {
              results.push(index);
            }
          }
        }
        level = /** @type {number} */
        q.pop();
        nodeIndex = q.pop();
        if (nodeIndex !== void 0) {
          contained = (nodeIndex & 1) === 1;
          nodeIndex &= ~1;
        }
      }
      return results;
    }
    /**
     * Collect all leaves of a subtree that's fully inside the query, skipping intersection tests.
     * Because the tree is packed bottom-up, those leaves occupy one contiguous block of the leaf
     * level, so we skip traversal entirely: descend to the first leaf, then sweep the flat range.
     * @param {number} nodeIndex
     * @param {number} end
     * @param {number} level
     * @param {number} numItems4
     * @param {number[]} results
     * @param {((index: number, x0: number, y0: number, x1: number, y1: number) => boolean) | undefined} filterFn
     */
    _collectContained(nodeIndex, end, level, numItems4, results, filterFn) {
      const boxes = this._boxes;
      const indices = this._indices;
      let pos = nodeIndex;
      for (let l = level; l > 0; l--) pos = indices[pos >> 2];
      const leafEnd = Math.min(pos + (end - nodeIndex) * this.nodeSize ** level, numItems4);
      if (filterFn === void 0) {
        for (; pos < leafEnd; pos += 4) results.push(indices[pos >> 2] | 0);
      } else {
        for (; pos < leafEnd; pos += 4) {
          const index = indices[pos >> 2] | 0;
          if (filterFn(index, boxes[pos], boxes[pos + 1], boxes[pos + 2], boxes[pos + 3])) results.push(index);
        }
      }
    }
    /**
     * Search items in order of distance from the given point.
     * @param {number} x
     * @param {number} y
     * @param {number} [maxResults=Infinity]
     * @param {number} [maxDistance=Infinity]
     * @param {(index: number) => boolean} [filterFn] An optional function for filtering the results.
     * @returns {number[]} An array of indices of items found.
     */
    neighbors(x, y, maxResults = Infinity, maxDistance = Infinity, filterFn) {
      if (this._pos !== this._boxes.length) {
        throw new Error("Data not yet indexed - call index.finish().");
      }
      const { _boxes: boxes, _levelBounds: levelBounds, _indices: indices, _queue: q, nodeSize } = this;
      const numItems4 = this.numItems * 4;
      const nodeSize4 = nodeSize * 4;
      const results = [];
      const maxDistSquared = maxDistance * maxDistance;
      const trackNearest = maxResults === 1;
      let bound = maxDistSquared;
      q.push(boxes.length - 4 << 1, 0);
      while (q.length) {
        const top = q.ids[0];
        if (top & 1) {
          q.pop();
          results.push(top >> 1);
          if (results.length === maxResults) break;
          continue;
        }
        q.pop();
        const nodeIndex = top >> 1;
        const isLeafLevel = nodeIndex < numItems4;
        const end = Math.min(nodeIndex + nodeSize4, upperBound(nodeIndex, levelBounds));
        for (let pos = nodeIndex; pos < end; pos += 4) {
          const minX = boxes[pos];
          const minY = boxes[pos + 1];
          const maxX = boxes[pos + 2];
          const maxY = boxes[pos + 3];
          const dx = Math.max(Math.max(minX - x, x - maxX), 0);
          const dy = Math.max(Math.max(minY - y, y - maxY), 0);
          const dist = dx * dx + dy * dy;
          if (dist > bound) continue;
          const childIndex = indices[pos >> 2] | 0;
          if (isLeafLevel) {
            if (filterFn === void 0 || filterFn(childIndex)) {
              q.push(childIndex << 1 | 1, dist);
              if (trackNearest && dist < bound) bound = dist;
            }
          } else {
            q.push(childIndex << 1, dist);
          }
        }
      }
      q.clear();
      return results;
    }
  };
  function upperBound(value, arr) {
    let i = 0;
    let j = arr.length - 1;
    while (i < j) {
      const m = i + j >> 1;
      if (arr[m] > value) {
        j = m;
      } else {
        i = m + 1;
      }
    }
    return arr[i];
  }
  function sort(values, boxes, indices, left, right, nodeSize) {
    const stack = [left, right];
    while (stack.length) {
      const r = stack.pop() || 0;
      const l = stack.pop() || 0;
      if (r - l <= nodeSize && Math.floor(l / nodeSize) >= Math.floor(r / nodeSize)) continue;
      const a = values[l];
      const b = values[l + r >> 1];
      const c = values[r];
      const pivot = a > b !== a > c ? a : b < a !== b < c ? b : c;
      let i = l - 1;
      let j = r + 1;
      while (true) {
        do
          i++;
        while (values[i] < pivot);
        do
          j--;
        while (values[j] > pivot);
        if (i >= j) break;
        swap(values, boxes, indices, i, j);
      }
      stack.push(l, j, j + 1, r);
    }
  }
  function swap(values, boxes, indices, i, j) {
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;
    const k = 4 * i;
    const m = 4 * j;
    const a = boxes[k];
    const b = boxes[k + 1];
    const c = boxes[k + 2];
    const d = boxes[k + 3];
    boxes[k] = boxes[m];
    boxes[k + 1] = boxes[m + 1];
    boxes[k + 2] = boxes[m + 2];
    boxes[k + 3] = boxes[m + 3];
    boxes[m] = a;
    boxes[m + 1] = b;
    boxes[m + 2] = c;
    boxes[m + 3] = d;
    const e = indices[i];
    indices[i] = indices[j];
    indices[j] = e;
  }
  function hilbert(x, y) {
    let a = x ^ y;
    let b = 65535 ^ a;
    let c = 65535 ^ (x | y);
    let d = x & (y ^ 65535);
    let A = a | b >> 1;
    let B = a >> 1 ^ a;
    let C = c ^ (c >> 1 ^ b & d >> 1);
    let D = d ^ (a & c >> 1 ^ d >> 1);
    a = A & A >> 2 ^ B & B >> 2;
    b = A & B >> 2 ^ B & (A ^ B) >> 2;
    c = C ^ (A & C >> 2 ^ B & D >> 2);
    d = D ^ (B & C >> 2 ^ (A ^ B) & D >> 2);
    A = a & a >> 4 ^ b & b >> 4;
    B = a & b >> 4 ^ b & (a ^ b) >> 4;
    C = c ^ (a & c >> 4 ^ b & d >> 4);
    D = d ^ (b & c >> 4 ^ (a ^ b) & d >> 4);
    c = C ^ (A & C >> 8 ^ B & D >> 8);
    d = D ^ (B & C >> 8 ^ (A ^ B) & D >> 8);
    c ^= c >> 1;
    d ^= d >> 1;
    a = x ^ y;
    b = d | 65535 ^ (a | c);
    a = (a | a << 8) & 16711935;
    a = (a | a << 4) & 252645135;
    a = (a | a << 2) & 858993459;
    a = (a | a << 1) & 1431655765;
    b = (b | b << 8) & 16711935;
    b = (b | b << 4) & 252645135;
    b = (b | b << 2) & 858993459;
    b = (b | b << 1) & 1431655765;
    return ((b << 1 | a) >>> 0) - 2147483648;
  }

  // .work/city-portable-20261026/source/src/world_atlas/core/web/city-site-entry.js
  var import_polygon_clipping = __toESM(require_polygon_clipping_umd());

  // 世界生成器_1.4.0.dev164_Windows/runtime/node_modules/bignumber.js/bignumber.mjs
  var isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  var mathceil = Math.ceil;
  var mathfloor = Math.floor;
  var bignumberError = "[BigNumber Error] ";
  var tooManyDigits = bignumberError + "Number primitive has more than 15 significant digits: ";
  var BASE = 1e14;
  var LOG_BASE = 14;
  var MAX_SAFE_INTEGER = 9007199254740991;
  var POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13];
  var SQRT_BASE = 1e7;
  var MAX = 1e9;
  function clone(configObject) {
    var div, convertBase, parseNumeric, P = BigNumber2.prototype = { constructor: BigNumber2, toString: null, valueOf: null }, ONE = new BigNumber2(1), DECIMAL_PLACES = 20, ROUNDING_MODE = 4, TO_EXP_NEG = -7, TO_EXP_POS = 21, MIN_EXP = -1e7, MAX_EXP = 1e7, CRYPTO = false, MODULO_MODE = 1, POW_PRECISION = 0, FORMAT = {
      prefix: "",
      groupSize: 3,
      secondaryGroupSize: 0,
      groupSeparator: ",",
      decimalSeparator: ".",
      fractionGroupSize: 0,
      fractionGroupSeparator: "\xA0",
      // non-breaking space
      suffix: ""
    }, ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz", alphabetHasNormalDecimalDigits = true;
    function BigNumber2(v, b) {
      var alphabet, c, caseChanged, e, i, isNum, len, str, x = this;
      if (!(x instanceof BigNumber2)) return new BigNumber2(v, b);
      if (b == null) {
        if (v && v._isBigNumber === true) {
          x.s = v.s;
          if (!v.c || v.e > MAX_EXP) {
            x.c = x.e = null;
          } else if (v.e < MIN_EXP) {
            x.c = [x.e = 0];
          } else {
            x.e = v.e;
            x.c = v.c.slice();
          }
          return;
        }
        if ((isNum = typeof v == "number") && v * 0 == 0) {
          x.s = 1 / v < 0 ? (v = -v, -1) : 1;
          if (v === ~~v) {
            for (e = 0, i = v; i >= 10; i /= 10, e++) ;
            if (e > MAX_EXP) {
              x.c = x.e = null;
            } else {
              x.e = e;
              x.c = [v];
            }
            return;
          }
          str = String(v);
        } else {
          if (!isNumeric.test(str = String(v))) return parseNumeric(x, str, isNum);
          x.s = str.charCodeAt(0) == 45 ? (str = str.slice(1), -1) : 1;
        }
        if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
        if ((i = str.search(/e/i)) > 0) {
          if (e < 0) e = i;
          e += +str.slice(i + 1);
          str = str.substring(0, i);
        } else if (e < 0) {
          e = str.length;
        }
      } else {
        intCheck(b, 2, ALPHABET.length, "Base");
        if (b == 10 && alphabetHasNormalDecimalDigits) {
          x = new BigNumber2(v);
          return round(x, DECIMAL_PLACES + x.e + 1, ROUNDING_MODE);
        }
        str = String(v);
        if (isNum = typeof v == "number") {
          if (v * 0 != 0) return parseNumeric(x, str, isNum, b);
          x.s = 1 / v < 0 ? (str = str.slice(1), -1) : 1;
          if (BigNumber2.DEBUG && str.replace(/^0\.0*|\./, "").length > 15) {
            throw Error(tooManyDigits + v);
          }
        } else {
          x.s = str.charCodeAt(0) === 45 ? (str = str.slice(1), -1) : 1;
        }
        alphabet = ALPHABET.slice(0, b);
        e = i = 0;
        for (len = str.length; i < len; i++) {
          if (alphabet.indexOf(c = str.charAt(i)) < 0) {
            if (c == ".") {
              if (i > e) {
                e = len;
                continue;
              }
            } else if (!caseChanged) {
              if (str == str.toUpperCase() && (str = str.toLowerCase()) || str == str.toLowerCase() && (str = str.toUpperCase())) {
                caseChanged = true;
                i = -1;
                e = 0;
                continue;
              }
            }
            return parseNumeric(x, String(v), isNum, b);
          }
        }
        isNum = false;
        str = convertBase(str, b, 10, x.s);
        if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
        else e = str.length;
      }
      for (i = 0; str.charCodeAt(i) === 48; i++) ;
      for (len = str.length; str.charCodeAt(--len) === 48; ) ;
      if (str = str.slice(i, ++len)) {
        len -= i;
        if (isNum && BigNumber2.DEBUG && len > 15 && (v > MAX_SAFE_INTEGER || v !== mathfloor(v))) {
          throw Error(tooManyDigits + x.s * v);
        }
        if ((e = e - i - 1) > MAX_EXP) {
          x.c = x.e = null;
        } else if (e < MIN_EXP) {
          x.c = [x.e = 0];
        } else {
          x.e = e;
          x.c = [];
          i = (e + 1) % LOG_BASE;
          if (e < 0) i += LOG_BASE;
          if (i < len) {
            if (i) x.c.push(+str.slice(0, i));
            for (len -= LOG_BASE; i < len; ) {
              x.c.push(+str.slice(i, i += LOG_BASE));
            }
            i = LOG_BASE - (str = str.slice(i)).length;
          } else {
            i -= len;
          }
          for (; i--; str += "0") ;
          x.c.push(+str);
        }
      } else {
        x.c = [x.e = 0];
      }
    }
    BigNumber2.clone = clone;
    BigNumber2.ROUND_UP = 0;
    BigNumber2.ROUND_DOWN = 1;
    BigNumber2.ROUND_CEIL = 2;
    BigNumber2.ROUND_FLOOR = 3;
    BigNumber2.ROUND_HALF_UP = 4;
    BigNumber2.ROUND_HALF_DOWN = 5;
    BigNumber2.ROUND_HALF_EVEN = 6;
    BigNumber2.ROUND_HALF_CEIL = 7;
    BigNumber2.ROUND_HALF_FLOOR = 8;
    BigNumber2.EUCLID = 9;
    BigNumber2.config = BigNumber2.set = function(obj) {
      var p, v;
      if (obj != null) {
        if (typeof obj == "object") {
          if (obj.hasOwnProperty(p = "DECIMAL_PLACES")) {
            v = obj[p];
            intCheck(v, 0, MAX, p);
            DECIMAL_PLACES = v;
          }
          if (obj.hasOwnProperty(p = "ROUNDING_MODE")) {
            v = obj[p];
            intCheck(v, 0, 8, p);
            ROUNDING_MODE = v;
          }
          if (obj.hasOwnProperty(p = "EXPONENTIAL_AT")) {
            v = obj[p];
            if (v && v.pop) {
              intCheck(v[0], -MAX, 0, p);
              intCheck(v[1], 0, MAX, p);
              TO_EXP_NEG = v[0];
              TO_EXP_POS = v[1];
            } else {
              intCheck(v, -MAX, MAX, p);
              TO_EXP_NEG = -(TO_EXP_POS = v < 0 ? -v : v);
            }
          }
          if (obj.hasOwnProperty(p = "RANGE")) {
            v = obj[p];
            if (v && v.pop) {
              intCheck(v[0], -MAX, -1, p);
              intCheck(v[1], 1, MAX, p);
              MIN_EXP = v[0];
              MAX_EXP = v[1];
            } else {
              intCheck(v, -MAX, MAX, p);
              if (v) {
                MIN_EXP = -(MAX_EXP = v < 0 ? -v : v);
              } else {
                throw Error(bignumberError + p + " cannot be zero: " + v);
              }
            }
          }
          if (obj.hasOwnProperty(p = "CRYPTO")) {
            v = obj[p];
            if (v === !!v) {
              if (v) {
                if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
                  CRYPTO = v;
                } else {
                  CRYPTO = !v;
                  throw Error(bignumberError + "crypto unavailable");
                }
              } else {
                CRYPTO = v;
              }
            } else {
              throw Error(bignumberError + p + " not true or false: " + v);
            }
          }
          if (obj.hasOwnProperty(p = "MODULO_MODE")) {
            v = obj[p];
            intCheck(v, 0, 9, p);
            MODULO_MODE = v;
          }
          if (obj.hasOwnProperty(p = "POW_PRECISION")) {
            v = obj[p];
            intCheck(v, 0, MAX, p);
            POW_PRECISION = v;
          }
          if (obj.hasOwnProperty(p = "FORMAT")) {
            v = obj[p];
            if (typeof v == "object") FORMAT = v;
            else throw Error(bignumberError + p + " not an object: " + v);
          }
          if (obj.hasOwnProperty(p = "ALPHABET")) {
            v = obj[p];
            if (typeof v == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(v)) {
              alphabetHasNormalDecimalDigits = v.slice(0, 10) == "0123456789";
              ALPHABET = v;
            } else {
              throw Error(bignumberError + p + " invalid: " + v);
            }
          }
        } else {
          throw Error(bignumberError + "Object expected: " + obj);
        }
      }
      return {
        DECIMAL_PLACES,
        ROUNDING_MODE,
        EXPONENTIAL_AT: [TO_EXP_NEG, TO_EXP_POS],
        RANGE: [MIN_EXP, MAX_EXP],
        CRYPTO,
        MODULO_MODE,
        POW_PRECISION,
        FORMAT,
        ALPHABET
      };
    };
    BigNumber2.isBigNumber = function(v) {
      if (!v || v._isBigNumber !== true) return false;
      if (!BigNumber2.DEBUG) return true;
      var i, n, c = v.c, e = v.e, s = v.s;
      out: if ({}.toString.call(c) == "[object Array]") {
        if ((s === 1 || s === -1) && e >= -MAX && e <= MAX && e === mathfloor(e)) {
          if (c[0] === 0) {
            if (e === 0 && c.length === 1) return true;
            break out;
          }
          i = (e + 1) % LOG_BASE;
          if (i < 1) i += LOG_BASE;
          if (String(c[0]).length == i) {
            for (i = 0; i < c.length; i++) {
              n = c[i];
              if (n < 0 || n >= BASE || n !== mathfloor(n)) break out;
            }
            if (n !== 0) return true;
          }
        }
      } else if (c === null && e === null && (s === null || s === 1 || s === -1)) {
        return true;
      }
      throw Error(bignumberError + "Invalid BigNumber: " + v);
    };
    BigNumber2.maximum = BigNumber2.max = function() {
      return maxOrMin(arguments, -1);
    };
    BigNumber2.minimum = BigNumber2.min = function() {
      return maxOrMin(arguments, 1);
    };
    BigNumber2.random = (function() {
      var pow2_53 = 9007199254740992;
      var random53bitInt = Math.random() * pow2_53 & 2097151 ? function() {
        return mathfloor(Math.random() * pow2_53);
      } : function() {
        return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
      };
      return function(dp) {
        var a, b, e, k, v, i = 0, c = [], rand = new BigNumber2(ONE);
        if (dp == null) dp = DECIMAL_PLACES;
        else intCheck(dp, 0, MAX);
        k = mathceil(dp / LOG_BASE);
        if (CRYPTO) {
          if (crypto.getRandomValues) {
            a = crypto.getRandomValues(new Uint32Array(k *= 2));
            for (; i < k; ) {
              v = a[i] * 131072 + (a[i + 1] >>> 11);
              if (v >= 9e15) {
                b = crypto.getRandomValues(new Uint32Array(2));
                a[i] = b[0];
                a[i + 1] = b[1];
              } else {
                c.push(v % 1e14);
                i += 2;
              }
            }
            i = k / 2;
          } else if (crypto.randomBytes) {
            a = crypto.randomBytes(k *= 7);
            for (; i < k; ) {
              v = (a[i] & 31) * 281474976710656 + a[i + 1] * 1099511627776 + a[i + 2] * 4294967296 + a[i + 3] * 16777216 + (a[i + 4] << 16) + (a[i + 5] << 8) + a[i + 6];
              if (v >= 9e15) {
                crypto.randomBytes(7).copy(a, i);
              } else {
                c.push(v % 1e14);
                i += 7;
              }
            }
            i = k / 7;
          } else {
            CRYPTO = false;
            throw Error(bignumberError + "crypto unavailable");
          }
        }
        if (!CRYPTO) {
          for (; i < k; ) {
            v = random53bitInt();
            if (v < 9e15) c[i++] = v % 1e14;
          }
        }
        k = c[--i];
        dp %= LOG_BASE;
        if (k && dp) {
          v = POWS_TEN[LOG_BASE - dp];
          c[i] = mathfloor(k / v) * v;
        }
        for (; c[i] === 0; c.pop(), i--) ;
        if (i < 0) {
          c = [e = 0];
        } else {
          for (e = -1; c[0] === 0; c.splice(0, 1), e -= LOG_BASE) ;
          for (i = 1, v = c[0]; v >= 10; v /= 10, i++) ;
          if (i < LOG_BASE) e -= LOG_BASE - i;
        }
        rand.e = e;
        rand.c = c;
        return rand;
      };
    })();
    BigNumber2.sum = function() {
      var i = 1, args = arguments, sum = new BigNumber2(args[0]);
      for (; i < args.length; ) sum = sum.plus(args[i++]);
      return sum;
    };
    convertBase = /* @__PURE__ */ (function() {
      var decimal = "0123456789";
      function toBaseOut(str, baseIn, baseOut, alphabet) {
        var j, arr = [0], arrL, i = 0, len = str.length;
        for (; i < len; ) {
          for (arrL = arr.length; arrL--; arr[arrL] *= baseIn) ;
          arr[0] += alphabet.indexOf(str.charAt(i++));
          for (j = 0; j < arr.length; j++) {
            if (arr[j] > baseOut - 1) {
              if (arr[j + 1] == null) arr[j + 1] = 0;
              arr[j + 1] += arr[j] / baseOut | 0;
              arr[j] %= baseOut;
            }
          }
        }
        return arr.reverse();
      }
      return function(str, baseIn, baseOut, sign, callerIsToString) {
        var alphabet, d, e, k, r, x, xc, y, i = str.indexOf("."), dp = DECIMAL_PLACES, rm = ROUNDING_MODE;
        if (i >= 0) {
          k = POW_PRECISION;
          POW_PRECISION = 0;
          str = str.replace(".", "");
          y = new BigNumber2(baseIn);
          x = y.pow(str.length - i);
          POW_PRECISION = k;
          y.c = toBaseOut(
            toFixedPoint(coeffToString(x.c), x.e, "0"),
            10,
            baseOut,
            decimal
          );
          y.e = y.c.length;
        }
        xc = toBaseOut(str, baseIn, baseOut, callerIsToString ? (alphabet = ALPHABET, decimal) : (alphabet = decimal, ALPHABET));
        e = k = xc.length;
        for (; xc[--k] == 0; xc.pop()) ;
        if (!xc[0]) return alphabet.charAt(0);
        if (i < 0) {
          --e;
        } else {
          x.c = xc;
          x.e = e;
          x.s = sign;
          x = div(x, y, dp, rm, baseOut);
          xc = x.c;
          r = x.r;
          e = x.e;
        }
        d = e + dp + 1;
        i = xc[d];
        k = baseOut / 2;
        r = r || d < 0 || xc[d + 1] != null;
        r = rm < 4 ? (i != null || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : i > k || i == k && (rm == 4 || r || rm == 6 && xc[d - 1] & 1 || rm == (x.s < 0 ? 8 : 7));
        if (d < 1 || !xc[0]) {
          str = r ? toFixedPoint(alphabet.charAt(1), -dp, alphabet.charAt(0)) : alphabet.charAt(0);
        } else {
          xc.length = d;
          if (r) {
            for (--baseOut; ++xc[--d] > baseOut; ) {
              xc[d] = 0;
              if (!d) {
                ++e;
                xc = [1].concat(xc);
              }
            }
          }
          for (k = xc.length; !xc[--k]; ) ;
          for (i = 0, str = ""; i <= k; str += alphabet.charAt(xc[i++])) ;
          str = toFixedPoint(str, e, alphabet.charAt(0));
        }
        return str;
      };
    })();
    div = /* @__PURE__ */ (function() {
      function multiply(x, k, base) {
        var m, temp, xlo, xhi, carry = 0, i = x.length, klo = k % SQRT_BASE, khi = k / SQRT_BASE | 0;
        for (x = x.slice(); i--; ) {
          xlo = x[i] % SQRT_BASE;
          xhi = x[i] / SQRT_BASE | 0;
          m = khi * xlo + xhi * klo;
          temp = klo * xlo + m % SQRT_BASE * SQRT_BASE + carry;
          carry = (temp / base | 0) + (m / SQRT_BASE | 0) + khi * xhi;
          x[i] = temp % base;
        }
        if (carry) x = [carry].concat(x);
        return x;
      }
      function compare2(a, b, aL, bL) {
        var i, cmp;
        if (aL != bL) {
          cmp = aL > bL ? 1 : -1;
        } else {
          for (i = cmp = 0; i < aL; i++) {
            if (a[i] != b[i]) {
              cmp = a[i] > b[i] ? 1 : -1;
              break;
            }
          }
        }
        return cmp;
      }
      function subtract(a, b, aL, base) {
        var i = 0;
        for (; aL--; ) {
          a[aL] -= i;
          i = a[aL] < b[aL] ? 1 : 0;
          a[aL] = i * base + a[aL] - b[aL];
        }
        for (; !a[0] && a.length > 1; a.splice(0, 1)) ;
      }
      return function(x, y, dp, rm, base) {
        var cmp, e, i, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0, yL, yz, s = x.s == y.s ? 1 : -1, xc = x.c, yc = y.c;
        if (!xc || !xc[0] || !yc || !yc[0]) {
          return new BigNumber2(
            // Return NaN if either NaN, or both Infinity or 0.
            !x.s || !y.s || (xc ? yc && xc[0] == yc[0] : !yc) ? NaN : (
              // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
              xc && xc[0] == 0 || !yc ? s * 0 : s / 0
            )
          );
        }
        q = new BigNumber2(s);
        qc = q.c = [];
        e = x.e - y.e;
        s = dp + e + 1;
        if (!base) {
          base = BASE;
          e = bitFloor(x.e / LOG_BASE) - bitFloor(y.e / LOG_BASE);
          s = s / LOG_BASE | 0;
        }
        for (i = 0; yc[i] == (xc[i] || 0); i++) ;
        if (yc[i] > (xc[i] || 0)) e--;
        if (s < 0) {
          qc.push(1);
          more = true;
        } else {
          xL = xc.length;
          yL = yc.length;
          i = 0;
          s += 2;
          n = mathfloor(base / (yc[0] + 1));
          if (n > 1) {
            yc = multiply(yc, n, base);
            xc = multiply(xc, n, base);
            yL = yc.length;
            xL = xc.length;
          }
          xi = yL;
          rem = xc.slice(0, yL);
          remL = rem.length;
          for (; remL < yL; rem[remL++] = 0) ;
          yz = yc.slice();
          yz = [0].concat(yz);
          yc0 = yc[0];
          if (yc[1] >= base / 2) yc0++;
          do {
            n = 0;
            cmp = compare2(yc, rem, yL, remL);
            if (cmp < 0) {
              rem0 = rem[0];
              if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
              n = mathfloor(rem0 / yc0);
              if (n > 1) {
                if (n >= base) n = base - 1;
                prod = multiply(yc, n, base);
                prodL = prod.length;
                remL = rem.length;
                while (compare2(prod, rem, prodL, remL) == 1) {
                  n--;
                  subtract(prod, yL < prodL ? yz : yc, prodL, base);
                  prodL = prod.length;
                  cmp = 1;
                }
              } else {
                if (n == 0) {
                  cmp = n = 1;
                }
                prod = yc.slice();
                prodL = prod.length;
              }
              if (prodL < remL) prod = [0].concat(prod);
              subtract(rem, prod, remL, base);
              remL = rem.length;
              if (cmp == -1) {
                while (compare2(yc, rem, yL, remL) < 1) {
                  n++;
                  subtract(rem, yL < remL ? yz : yc, remL, base);
                  remL = rem.length;
                }
              }
            } else if (cmp === 0) {
              n++;
              rem = [0];
            }
            qc[i++] = n;
            if (rem[0]) {
              rem[remL++] = xc[xi] || 0;
            } else {
              rem = [xc[xi]];
              remL = 1;
            }
          } while ((xi++ < xL || rem[0] != null) && s--);
          more = rem[0] != null;
          if (!qc[0]) qc.splice(0, 1);
        }
        if (base == BASE) {
          for (i = 1, s = qc[0]; s >= 10; s /= 10, i++) ;
          round(q, dp + (q.e = i + e * LOG_BASE - 1) + 1, rm, more);
        } else {
          q.e = e;
          q.r = +more;
        }
        return q;
      };
    })();
    function format(n, i, rm, id) {
      var c0, e, ne, len, str;
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      if (!n.c) return n.toString();
      c0 = n.c[0];
      ne = n.e;
      if (i == null) {
        str = coeffToString(n.c);
        str = id == 1 || id == 2 && (ne <= TO_EXP_NEG || ne >= TO_EXP_POS) ? toExponential(str, ne) : toFixedPoint(str, ne, "0");
      } else {
        n = round(new BigNumber2(n), i, rm);
        e = n.e;
        str = coeffToString(n.c);
        len = str.length;
        if (id == 1 || id == 2 && (i <= e || e <= TO_EXP_NEG)) {
          for (; len < i; str += "0", len++) ;
          str = toExponential(str, e);
        } else {
          i -= ne + (id === 2 && e > ne);
          str = toFixedPoint(str, e, "0");
          if (e + 1 > len) {
            if (--i > 0) for (str += "."; i--; str += "0") ;
          } else {
            i += e - len;
            if (i > 0) {
              if (e + 1 == len) str += ".";
              for (; i--; str += "0") ;
            }
          }
        }
      }
      return n.s < 0 && c0 ? "-" + str : str;
    }
    function maxOrMin(args, n) {
      var k, y, i = 1, x = new BigNumber2(args[0]);
      for (; i < args.length; i++) {
        y = new BigNumber2(args[i]);
        if (!y.s || (k = compare(x, y)) === n || k === 0 && x.s === n) {
          x = y;
        }
      }
      return x;
    }
    function normalise(n, c, e) {
      var i = 1, j = c.length;
      for (; !c[--j]; c.pop()) ;
      for (j = c[0]; j >= 10; j /= 10, i++) ;
      if ((e = i + e * LOG_BASE - 1) > MAX_EXP) {
        n.c = n.e = null;
      } else if (e < MIN_EXP) {
        n.c = [n.e = 0];
      } else {
        n.e = e;
        n.c = c;
      }
      return n;
    }
    parseNumeric = /* @__PURE__ */ (function() {
      var basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i, dotAfter = /^([^.]+)\.$/, dotBefore = /^\.([^.]+)$/, isInfinityOrNaN = /^-?(Infinity|NaN)$/, whitespaceOrPlus = /^\s*\+(?=[\w.])|^\s+|\s+$/g;
      return function(x, str, isNum, b) {
        var base, s = isNum ? str : str.replace(whitespaceOrPlus, "");
        if (isInfinityOrNaN.test(s)) {
          x.s = isNaN(s) ? null : s < 0 ? -1 : 1;
        } else {
          if (!isNum) {
            s = s.replace(basePrefix, function(m, p1, p2) {
              base = (p2 = p2.toLowerCase()) == "x" ? 16 : p2 == "b" ? 2 : 8;
              return !b || b == base ? p1 : m;
            });
            if (b) {
              base = b;
              s = s.replace(dotAfter, "$1").replace(dotBefore, "0.$1");
            }
            if (str != s) return new BigNumber2(s, base);
          }
          if (BigNumber2.DEBUG) {
            throw Error(bignumberError + "Not a" + (b ? " base " + b : "") + " number: " + str);
          }
          x.s = null;
        }
        x.c = x.e = null;
      };
    })();
    function round(x, sd, rm, r) {
      var d, i, j, k, n, ni, rd, xc = x.c, pows10 = POWS_TEN;
      if (xc) {
        out: {
          for (d = 1, k = xc[0]; k >= 10; k /= 10, d++) ;
          i = sd - d;
          if (i < 0) {
            i += LOG_BASE;
            j = sd;
            n = xc[ni = 0];
            rd = mathfloor(n / pows10[d - j - 1] % 10);
          } else {
            ni = mathceil((i + 1) / LOG_BASE);
            if (ni >= xc.length) {
              if (r) {
                for (; xc.length <= ni; xc.push(0)) ;
                n = rd = 0;
                d = 1;
                i %= LOG_BASE;
                j = i - LOG_BASE + 1;
              } else {
                break out;
              }
            } else {
              n = k = xc[ni];
              for (d = 1; k >= 10; k /= 10, d++) ;
              i %= LOG_BASE;
              j = i - LOG_BASE + d;
              rd = j < 0 ? 0 : mathfloor(n / pows10[d - j - 1] % 10);
            }
          }
          r = r || sd < 0 || // Are there any non-zero digits after the rounding digit?
          // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
          // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
          xc[ni + 1] != null || (j < 0 ? n : n % pows10[d - j - 1]);
          r = rm < 4 ? (rd || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || r || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
          (i > 0 ? j > 0 ? n / pows10[d - j] : 0 : xc[ni - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
          if (sd < 1 || !xc[0]) {
            xc.length = 0;
            if (r) {
              sd -= x.e + 1;
              xc[0] = pows10[(LOG_BASE - sd % LOG_BASE) % LOG_BASE];
              x.e = -sd || 0;
            } else {
              xc[0] = x.e = 0;
            }
            return x;
          }
          if (i == 0) {
            xc.length = ni;
            k = 1;
            ni--;
          } else {
            xc.length = ni + 1;
            k = pows10[LOG_BASE - i];
            xc[ni] = j > 0 ? mathfloor(n / pows10[d - j] % pows10[j]) * k : 0;
          }
          if (r) {
            for (; ; ) {
              if (ni == 0) {
                for (i = 1, j = xc[0]; j >= 10; j /= 10, i++) ;
                j = xc[0] += k;
                for (k = 1; j >= 10; j /= 10, k++) ;
                if (i != k) {
                  x.e++;
                  if (xc[0] == BASE) xc[0] = 1;
                }
                break;
              } else {
                xc[ni] += k;
                if (xc[ni] != BASE) break;
                xc[ni--] = 0;
                k = 1;
              }
            }
          }
          for (i = xc.length; xc[--i] === 0; xc.pop()) ;
        }
        if (x.e > MAX_EXP) {
          x.c = x.e = null;
        } else if (x.e < MIN_EXP) {
          x.c = [x.e = 0];
        }
      }
      return x;
    }
    function valueOf(n) {
      var str, e = n.e;
      if (e === null) return n.toString();
      str = coeffToString(n.c);
      str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(str, e) : toFixedPoint(str, e, "0");
      return n.s < 0 ? "-" + str : str;
    }
    P.absoluteValue = P.abs = function() {
      var x = new BigNumber2(this);
      if (x.s < 0) x.s = 1;
      return x;
    };
    P.comparedTo = function(y, b) {
      return compare(this, new BigNumber2(y, b));
    };
    P.decimalPlaces = P.dp = function(dp, rm) {
      var c, n, v, x = this;
      if (dp != null) {
        intCheck(dp, 0, MAX);
        if (rm == null) rm = ROUNDING_MODE;
        else intCheck(rm, 0, 8);
        return round(new BigNumber2(x), dp + x.e + 1, rm);
      }
      if (!(c = x.c)) return null;
      n = ((v = c.length - 1) - bitFloor(this.e / LOG_BASE)) * LOG_BASE;
      if (v = c[v]) for (; v % 10 == 0; v /= 10, n--) ;
      if (n < 0) n = 0;
      return n;
    };
    P.dividedBy = P.div = function(y, b) {
      return div(this, new BigNumber2(y, b), DECIMAL_PLACES, ROUNDING_MODE);
    };
    P.dividedToIntegerBy = P.idiv = function(y, b) {
      return div(this, new BigNumber2(y, b), 0, 1);
    };
    P.exponentiatedBy = P.pow = function(n, m) {
      var half, isModExp, i, k, more, nIsBig, nIsNeg, nIsOdd, y, x = this;
      n = new BigNumber2(n);
      if (n.c && !n.isInteger()) {
        throw Error(bignumberError + "Exponent not an integer: " + valueOf(n));
      }
      if (m != null) m = new BigNumber2(m);
      nIsBig = n.e > 14;
      if (!x.c || !x.c[0] || x.c[0] == 1 && !x.e && x.c.length == 1 || !n.c || !n.c[0]) {
        y = new BigNumber2(Math.pow(+valueOf(x), nIsBig ? n.s * (2 - isOdd(n)) : +valueOf(n)));
        return m ? y.mod(m) : y;
      }
      nIsNeg = n.s < 0;
      if (m) {
        if (m.c ? !m.c[0] : !m.s) return new BigNumber2(NaN);
        isModExp = !nIsNeg && x.isInteger() && m.isInteger();
        if (isModExp) x = x.mod(m);
      } else if (n.e > 9 && (x.e > 0 || x.e < -1 || (x.e == 0 ? x.c[0] > 1 || nIsBig && x.c[1] >= 24e7 : x.c[0] < 8e13 || nIsBig && x.c[0] <= 9999975e7))) {
        k = x.s < 0 && isOdd(n) ? -0 : 0;
        if (x.e > -1) k = 1 / k;
        return new BigNumber2(nIsNeg ? 1 / k : k);
      } else if (POW_PRECISION) {
        k = mathceil(POW_PRECISION / LOG_BASE + 2);
      }
      if (nIsBig) {
        half = new BigNumber2(0.5);
        if (nIsNeg) n.s = 1;
        nIsOdd = isOdd(n);
      } else {
        i = Math.abs(+valueOf(n));
        nIsOdd = i % 2;
      }
      y = new BigNumber2(ONE);
      for (; ; ) {
        if (nIsOdd) {
          y = y.times(x);
          if (!y.c) break;
          if (k) {
            if (y.c.length > k) y.c.length = k;
          } else if (isModExp) {
            y = y.mod(m);
          }
        }
        if (i) {
          i = mathfloor(i / 2);
          if (i === 0) break;
          nIsOdd = i % 2;
        } else {
          n = n.times(half);
          round(n, n.e + 1, 1);
          if (n.e > 14) {
            nIsOdd = isOdd(n);
          } else {
            i = +valueOf(n);
            if (i === 0) break;
            nIsOdd = i % 2;
          }
        }
        x = x.times(x);
        if (k) {
          if (x.c && x.c.length > k) x.c.length = k;
        } else if (isModExp) {
          x = x.mod(m);
        }
      }
      if (isModExp) return y;
      if (nIsNeg) y = ONE.div(y);
      return m ? y.mod(m) : k ? round(y, POW_PRECISION, ROUNDING_MODE, more) : y;
    };
    P.integerValue = function(rm) {
      var n = new BigNumber2(this);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      return round(n, n.e + 1, rm);
    };
    P.isEqualTo = P.eq = function(y, b) {
      return compare(this, new BigNumber2(y, b)) === 0;
    };
    P.isFinite = function() {
      return !!this.c;
    };
    P.isGreaterThan = P.gt = function(y, b) {
      return compare(this, new BigNumber2(y, b)) > 0;
    };
    P.isGreaterThanOrEqualTo = P.gte = function(y, b) {
      return (b = compare(this, new BigNumber2(y, b))) === 1 || b === 0;
    };
    P.isInteger = function() {
      return !!this.c && bitFloor(this.e / LOG_BASE) > this.c.length - 2;
    };
    P.isLessThan = P.lt = function(y, b) {
      return compare(this, new BigNumber2(y, b)) < 0;
    };
    P.isLessThanOrEqualTo = P.lte = function(y, b) {
      return (b = compare(this, new BigNumber2(y, b))) === -1 || b === 0;
    };
    P.isNaN = function() {
      return !this.s;
    };
    P.isNegative = function() {
      return this.s < 0;
    };
    P.isPositive = function() {
      return this.s > 0;
    };
    P.isZero = function() {
      return !!this.c && this.c[0] == 0;
    };
    P.minus = function(y, b) {
      var i, j, t, xLTy, x = this, a = x.s;
      y = new BigNumber2(y, b);
      b = y.s;
      if (!a || !b) return new BigNumber2(NaN);
      if (a != b) {
        y.s = -b;
        return x.plus(y);
      }
      var xe = x.e / LOG_BASE, ye = y.e / LOG_BASE, xc = x.c, yc = y.c;
      if (!xe || !ye) {
        if (!xc || !yc) return xc ? (y.s = -b, y) : new BigNumber2(yc ? x : NaN);
        if (!xc[0] || !yc[0]) {
          return yc[0] ? (y.s = -b, y) : new BigNumber2(xc[0] ? x : (
            // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
            ROUNDING_MODE == 3 ? -0 : 0
          ));
        }
      }
      xe = bitFloor(xe);
      ye = bitFloor(ye);
      xc = xc.slice();
      if (a = xe - ye) {
        if (xLTy = a < 0) {
          a = -a;
          t = xc;
        } else {
          ye = xe;
          t = yc;
        }
        t.reverse();
        for (b = a; b--; t.push(0)) ;
        t.reverse();
      } else {
        j = (xLTy = (a = xc.length) < (b = yc.length)) ? a : b;
        for (a = b = 0; b < j; b++) {
          if (xc[b] != yc[b]) {
            xLTy = xc[b] < yc[b];
            break;
          }
        }
      }
      if (xLTy) {
        t = xc;
        xc = yc;
        yc = t;
        y.s = -y.s;
      }
      b = (j = yc.length) - (i = xc.length);
      if (b > 0) for (; b--; xc[i++] = 0) ;
      b = BASE - 1;
      for (; j > a; ) {
        if (xc[--j] < yc[j]) {
          for (i = j; i && !xc[--i]; xc[i] = b) ;
          --xc[i];
          xc[j] += BASE;
        }
        xc[j] -= yc[j];
      }
      for (; xc[0] == 0; xc.splice(0, 1), --ye) ;
      if (!xc[0]) {
        y.s = ROUNDING_MODE == 3 ? -1 : 1;
        y.c = [y.e = 0];
        return y;
      }
      return normalise(y, xc, ye);
    };
    P.modulo = P.mod = function(y, b) {
      var q, s, x = this;
      y = new BigNumber2(y, b);
      if (!x.c || !y.s || y.c && !y.c[0]) {
        return new BigNumber2(NaN);
      } else if (!y.c || x.c && !x.c[0]) {
        return new BigNumber2(x);
      }
      if (MODULO_MODE == 9) {
        s = y.s;
        y.s = 1;
        q = div(x, y, 0, 3);
        y.s = s;
        q.s *= s;
      } else {
        q = div(x, y, 0, MODULO_MODE);
      }
      y = x.minus(q.times(y));
      if (!y.c[0] && MODULO_MODE == 1) y.s = x.s;
      return y;
    };
    P.multipliedBy = P.times = function(y, b) {
      var c, e, i, j, k, m, xcL, xlo, xhi, ycL, ylo, yhi, zc, base, sqrtBase, x = this, xc = x.c, yc = (y = new BigNumber2(y, b)).c;
      if (!xc || !yc || !xc[0] || !yc[0]) {
        if (!x.s || !y.s || xc && !xc[0] && !yc || yc && !yc[0] && !xc) {
          y.c = y.e = y.s = null;
        } else {
          y.s *= x.s;
          if (!xc || !yc) {
            y.c = y.e = null;
          } else {
            y.c = [0];
            y.e = 0;
          }
        }
        return y;
      }
      e = bitFloor(x.e / LOG_BASE) + bitFloor(y.e / LOG_BASE);
      y.s *= x.s;
      xcL = xc.length;
      ycL = yc.length;
      if (xcL < ycL) {
        zc = xc;
        xc = yc;
        yc = zc;
        i = xcL;
        xcL = ycL;
        ycL = i;
      }
      for (i = xcL + ycL, zc = []; i--; zc.push(0)) ;
      base = BASE;
      sqrtBase = SQRT_BASE;
      for (i = ycL; --i >= 0; ) {
        c = 0;
        ylo = yc[i] % sqrtBase;
        yhi = yc[i] / sqrtBase | 0;
        for (k = xcL, j = i + k; j > i; ) {
          xlo = xc[--k] % sqrtBase;
          xhi = xc[k] / sqrtBase | 0;
          m = yhi * xlo + xhi * ylo;
          xlo = ylo * xlo + m % sqrtBase * sqrtBase + zc[j] + c;
          c = (xlo / base | 0) + (m / sqrtBase | 0) + yhi * xhi;
          zc[j--] = xlo % base;
        }
        zc[j] = c;
      }
      if (c) {
        ++e;
      } else {
        zc.splice(0, 1);
      }
      return normalise(y, zc, e);
    };
    P.negated = function() {
      var x = new BigNumber2(this);
      x.s = -x.s || null;
      return x;
    };
    P.plus = function(y, b) {
      var t, x = this, a = x.s;
      y = new BigNumber2(y, b);
      b = y.s;
      if (!a || !b) return new BigNumber2(NaN);
      if (a != b) {
        y.s = -b;
        return x.minus(y);
      }
      var xe = x.e / LOG_BASE, ye = y.e / LOG_BASE, xc = x.c, yc = y.c;
      if (!xe || !ye) {
        if (!xc || !yc) return new BigNumber2(a / 0);
        if (!xc[0] || !yc[0]) return yc[0] ? y : new BigNumber2(xc[0] ? x : a * 0);
      }
      xe = bitFloor(xe);
      ye = bitFloor(ye);
      xc = xc.slice();
      if (a = xe - ye) {
        if (a > 0) {
          ye = xe;
          t = yc;
        } else {
          a = -a;
          t = xc;
        }
        t.reverse();
        for (; a--; t.push(0)) ;
        t.reverse();
      }
      a = xc.length;
      b = yc.length;
      if (a - b < 0) {
        t = yc;
        yc = xc;
        xc = t;
        b = a;
      }
      for (a = 0; b; ) {
        a = (xc[--b] = xc[b] + yc[b] + a) / BASE | 0;
        xc[b] = BASE === xc[b] ? 0 : xc[b] % BASE;
      }
      if (a) {
        xc = [a].concat(xc);
        ++ye;
      }
      return normalise(y, xc, ye);
    };
    P.precision = P.sd = function(sd, rm) {
      var c, n, v, x = this;
      if (sd != null && sd !== !!sd) {
        intCheck(sd, 1, MAX);
        if (rm == null) rm = ROUNDING_MODE;
        else intCheck(rm, 0, 8);
        return round(new BigNumber2(x), sd, rm);
      }
      if (!(c = x.c)) return null;
      v = c.length - 1;
      n = v * LOG_BASE + 1;
      if (v = c[v]) {
        for (; v % 10 == 0; v /= 10, n--) ;
        for (v = c[0]; v >= 10; v /= 10, n++) ;
      }
      if (sd && x.e + 1 > n) n = x.e + 1;
      return n;
    };
    P.shiftedBy = function(k) {
      intCheck(k, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER);
      return this.times("1e" + k);
    };
    P.squareRoot = P.sqrt = function() {
      var m, n, r, rep, t, x = this, c = x.c, s = x.s, e = x.e, dp = DECIMAL_PLACES + 4, half = new BigNumber2("0.5");
      if (s !== 1 || !c || !c[0]) {
        return new BigNumber2(!s || s < 0 && (!c || c[0]) ? NaN : c ? x : 1 / 0);
      }
      s = Math.sqrt(+valueOf(x));
      if (s == 0 || s == 1 / 0) {
        n = coeffToString(c);
        if ((n.length + e) % 2 == 0) n += "0";
        s = Math.sqrt(+n);
        e = bitFloor((e + 1) / 2) - (e < 0 || e % 2);
        if (s == 1 / 0) {
          n = "5e" + e;
        } else {
          n = s.toExponential();
          n = n.slice(0, n.indexOf("e") + 1) + e;
        }
        r = new BigNumber2(n);
      } else {
        r = new BigNumber2(s + "");
      }
      if (r.c[0]) {
        e = r.e;
        s = e + dp;
        if (s < 3) s = 0;
        for (; ; ) {
          t = r;
          r = half.times(t.plus(div(x, t, dp, 1)));
          if (coeffToString(t.c).slice(0, s) === (n = coeffToString(r.c)).slice(0, s)) {
            if (r.e < e) --s;
            n = n.slice(s - 3, s + 1);
            if (n == "9999" || !rep && n == "4999") {
              if (!rep) {
                round(t, t.e + DECIMAL_PLACES + 2, 0);
                if (t.times(t).eq(x)) {
                  r = t;
                  break;
                }
              }
              dp += 4;
              s += 4;
              rep = 1;
            } else {
              if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
                round(r, r.e + DECIMAL_PLACES + 2, 1);
                m = !r.times(r).eq(x);
              }
              break;
            }
          }
        }
      }
      return round(r, r.e + DECIMAL_PLACES + 1, ROUNDING_MODE, m);
    };
    P.toExponential = function(dp, rm) {
      if (dp != null) {
        intCheck(dp, 0, MAX);
        dp++;
      }
      return format(this, dp, rm, 1);
    };
    P.toFixed = function(dp, rm) {
      if (dp != null) {
        intCheck(dp, 0, MAX);
        dp = dp + this.e + 1;
      }
      return format(this, dp, rm);
    };
    P.toFormat = function(dp, rm, format2) {
      var str, x = this;
      if (format2 == null) {
        if (dp != null && rm && typeof rm == "object") {
          format2 = rm;
          rm = null;
        } else if (dp && typeof dp == "object") {
          format2 = dp;
          dp = rm = null;
        } else {
          format2 = FORMAT;
        }
      } else if (typeof format2 != "object") {
        throw Error(bignumberError + "Argument not an object: " + format2);
      }
      str = x.toFixed(dp, rm);
      if (x.c) {
        var i, arr = str.split("."), g1 = +format2.groupSize, g2 = +format2.secondaryGroupSize, groupSeparator = format2.groupSeparator || "", intPart = arr[0], fractionPart = arr[1], isNeg = x.s < 0, intDigits = isNeg ? intPart.slice(1) : intPart, len = intDigits.length;
        if (g2) {
          i = g1;
          g1 = g2;
          g2 = i;
          len -= i;
        }
        if (g1 > 0 && len > 0) {
          i = len % g1 || g1;
          intPart = intDigits.substr(0, i);
          for (; i < len; i += g1) intPart += groupSeparator + intDigits.substr(i, g1);
          if (g2 > 0) intPart += groupSeparator + intDigits.slice(i);
          if (isNeg) intPart = "-" + intPart;
        }
        str = fractionPart ? intPart + (format2.decimalSeparator || "") + ((g2 = +format2.fractionGroupSize) ? fractionPart.replace(
          new RegExp("\\d{" + g2 + "}\\B", "g"),
          "$&" + (format2.fractionGroupSeparator || "")
        ) : fractionPart) : intPart;
      }
      return (format2.prefix || "") + str + (format2.suffix || "");
    };
    P.toFraction = function(md) {
      var d, d0, d1, d2, e, exp, n, n0, n1, q, r, s, x = this, xc = x.c;
      if (md != null) {
        n = new BigNumber2(md);
        if (!n.isInteger() && (n.c || n.s !== 1) || n.lt(ONE)) {
          throw Error(bignumberError + "Argument " + (n.isInteger() ? "out of range: " : "not an integer: ") + valueOf(n));
        }
      }
      if (!xc) return new BigNumber2(x);
      d = new BigNumber2(ONE);
      n1 = d0 = new BigNumber2(ONE);
      d1 = n0 = new BigNumber2(ONE);
      s = coeffToString(xc);
      e = d.e = s.length - x.e - 1;
      d.c[0] = POWS_TEN[(exp = e % LOG_BASE) < 0 ? LOG_BASE + exp : exp];
      md = !md || n.comparedTo(d) > 0 ? e > 0 ? d : n1 : n;
      exp = MAX_EXP;
      MAX_EXP = 1 / 0;
      n = new BigNumber2(s);
      n0.c[0] = 0;
      for (; ; ) {
        q = div(n, d, 0, 1);
        d2 = d0.plus(q.times(d1));
        if (d2.comparedTo(md) == 1) break;
        d0 = d1;
        d1 = d2;
        n1 = n0.plus(q.times(d2 = n1));
        n0 = d2;
        d = n.minus(q.times(d2 = d));
        n = d2;
      }
      d2 = div(md.minus(d0), d1, 0, 1);
      n0 = n0.plus(d2.times(n1));
      d0 = d0.plus(d2.times(d1));
      n0.s = n1.s = x.s;
      e = e * 2;
      r = div(n1, d1, e, ROUNDING_MODE).minus(x).abs().comparedTo(
        div(n0, d0, e, ROUNDING_MODE).minus(x).abs()
      ) < 1 ? [n1, d1] : [n0, d0];
      MAX_EXP = exp;
      return r;
    };
    P.toNumber = function() {
      return +valueOf(this);
    };
    P.toPrecision = function(sd, rm) {
      if (sd != null) intCheck(sd, 1, MAX);
      return format(this, sd, rm, 2);
    };
    P.toString = function(b) {
      var str, n = this, s = n.s, e = n.e;
      if (e === null) {
        if (s) {
          str = "Infinity";
          if (s < 0) str = "-" + str;
        } else {
          str = "NaN";
        }
      } else {
        if (b == null) {
          str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(coeffToString(n.c), e) : toFixedPoint(coeffToString(n.c), e, "0");
        } else if (b === 10 && alphabetHasNormalDecimalDigits) {
          n = round(new BigNumber2(n), DECIMAL_PLACES + e + 1, ROUNDING_MODE);
          str = toFixedPoint(coeffToString(n.c), n.e, "0");
        } else {
          intCheck(b, 2, ALPHABET.length, "Base");
          str = convertBase(toFixedPoint(coeffToString(n.c), e, "0"), 10, b, s, true);
        }
        if (s < 0 && n.c[0]) str = "-" + str;
      }
      return str;
    };
    P.valueOf = P.toJSON = function() {
      return valueOf(this);
    };
    P._isBigNumber = true;
    P[Symbol.toStringTag] = "BigNumber";
    P[Symbol.for("nodejs.util.inspect.custom")] = P.valueOf;
    if (configObject != null) BigNumber2.set(configObject);
    return BigNumber2;
  }
  function bitFloor(n) {
    var i = n | 0;
    return n > 0 || n === i ? i : i - 1;
  }
  function coeffToString(a) {
    var s, z, i = 1, j = a.length, r = a[0] + "";
    for (; i < j; ) {
      s = a[i++] + "";
      z = LOG_BASE - s.length;
      for (; z--; s = "0" + s) ;
      r += s;
    }
    for (j = r.length; r.charCodeAt(--j) === 48; ) ;
    return r.slice(0, j + 1 || 1);
  }
  function compare(x, y) {
    var a, b, xc = x.c, yc = y.c, i = x.s, j = y.s, k = x.e, l = y.e;
    if (!i || !j) return null;
    a = xc && !xc[0];
    b = yc && !yc[0];
    if (a || b) return a ? b ? 0 : -j : i;
    if (i != j) return i;
    a = i < 0;
    b = k == l;
    if (!xc || !yc) return b ? 0 : !xc ^ a ? 1 : -1;
    if (!b) return k > l ^ a ? 1 : -1;
    j = (k = xc.length) < (l = yc.length) ? k : l;
    for (i = 0; i < j; i++) if (xc[i] != yc[i]) return xc[i] > yc[i] ^ a ? 1 : -1;
    return k == l ? 0 : k > l ^ a ? 1 : -1;
  }
  function intCheck(n, min, max, name) {
    if (n < min || n > max || n !== mathfloor(n)) {
      throw Error(bignumberError + (name || "Argument") + (typeof n == "number" ? n < min || n > max ? " out of range: " : " not an integer: " : " not a primitive number: ") + String(n));
    }
  }
  function isOdd(n) {
    var k = n.c.length - 1;
    return bitFloor(n.e / LOG_BASE) == k && n.c[k] % 2 != 0;
  }
  function toExponential(str, e) {
    return (str.length > 1 ? str.charAt(0) + "." + str.slice(1) : str) + (e < 0 ? "e" : "e+") + e;
  }
  function toFixedPoint(str, e, z) {
    var len, zs;
    if (e < 0) {
      for (zs = z + "."; ++e; zs += z) ;
      str = zs + str;
    } else {
      len = str.length;
      if (++e > len) {
        for (zs = z, e -= len; --e; zs += z) ;
        str += zs;
      } else if (e < len) {
        str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    return str;
  }
  var BigNumber = clone();
  var bignumber_default = BigNumber;

  // 世界生成器_1.4.0.dev164_Windows/runtime/node_modules/splaytree-ts/dist/esm/index.js
  var SplayTreeNode = class {
    key;
    left = null;
    right = null;
    constructor(key) {
      this.key = key;
    }
  };
  var SplayTreeSetNode = class extends SplayTreeNode {
    constructor(key) {
      super(key);
    }
  };
  var SplayTree = class {
    size = 0;
    modificationCount = 0;
    splayCount = 0;
    splay(key) {
      const root = this.root;
      if (root == null) {
        this.compare(key, key);
        return -1;
      }
      let right = null;
      let newTreeRight = null;
      let left = null;
      let newTreeLeft = null;
      let current = root;
      const compare2 = this.compare;
      let comp;
      while (true) {
        comp = compare2(current.key, key);
        if (comp > 0) {
          let currentLeft = current.left;
          if (currentLeft == null) break;
          comp = compare2(currentLeft.key, key);
          if (comp > 0) {
            current.left = currentLeft.right;
            currentLeft.right = current;
            current = currentLeft;
            currentLeft = current.left;
            if (currentLeft == null) break;
          }
          if (right == null) {
            newTreeRight = current;
          } else {
            right.left = current;
          }
          right = current;
          current = currentLeft;
        } else if (comp < 0) {
          let currentRight = current.right;
          if (currentRight == null) break;
          comp = compare2(currentRight.key, key);
          if (comp < 0) {
            current.right = currentRight.left;
            currentRight.left = current;
            current = currentRight;
            currentRight = current.right;
            if (currentRight == null) break;
          }
          if (left == null) {
            newTreeLeft = current;
          } else {
            left.right = current;
          }
          left = current;
          current = currentRight;
        } else {
          break;
        }
      }
      if (left != null) {
        left.right = current.left;
        current.left = newTreeLeft;
      }
      if (right != null) {
        right.left = current.right;
        current.right = newTreeRight;
      }
      if (this.root !== current) {
        this.root = current;
        this.splayCount++;
      }
      return comp;
    }
    splayMin(node) {
      let current = node;
      let nextLeft = current.left;
      while (nextLeft != null) {
        const left = nextLeft;
        current.left = left.right;
        left.right = current;
        current = left;
        nextLeft = current.left;
      }
      return current;
    }
    splayMax(node) {
      let current = node;
      let nextRight = current.right;
      while (nextRight != null) {
        const right = nextRight;
        current.right = right.left;
        right.left = current;
        current = right;
        nextRight = current.right;
      }
      return current;
    }
    _delete(key) {
      if (this.root == null) return null;
      const comp = this.splay(key);
      if (comp != 0) return null;
      let root = this.root;
      const result = root;
      const left = root.left;
      this.size--;
      if (left == null) {
        this.root = root.right;
      } else {
        const right = root.right;
        root = this.splayMax(left);
        root.right = right;
        this.root = root;
      }
      this.modificationCount++;
      return result;
    }
    addNewRoot(node, comp) {
      this.size++;
      this.modificationCount++;
      const root = this.root;
      if (root == null) {
        this.root = node;
        return;
      }
      if (comp < 0) {
        node.left = root;
        node.right = root.right;
        root.right = null;
      } else {
        node.right = root;
        node.left = root.left;
        root.left = null;
      }
      this.root = node;
    }
    _first() {
      const root = this.root;
      if (root == null) return null;
      this.root = this.splayMin(root);
      return this.root;
    }
    _last() {
      const root = this.root;
      if (root == null) return null;
      this.root = this.splayMax(root);
      return this.root;
    }
    clear() {
      this.root = null;
      this.size = 0;
      this.modificationCount++;
    }
    has(key) {
      return this.validKey(key) && this.splay(key) == 0;
    }
    defaultCompare() {
      return (a, b) => a < b ? -1 : a > b ? 1 : 0;
    }
    wrap() {
      return {
        getRoot: () => {
          return this.root;
        },
        setRoot: (root) => {
          this.root = root;
        },
        getSize: () => {
          return this.size;
        },
        getModificationCount: () => {
          return this.modificationCount;
        },
        getSplayCount: () => {
          return this.splayCount;
        },
        setSplayCount: (count) => {
          this.splayCount = count;
        },
        splay: (key) => {
          return this.splay(key);
        },
        has: (key) => {
          return this.has(key);
        }
      };
    }
  };
  var SplayTreeSet = class _SplayTreeSet extends SplayTree {
    root = null;
    compare;
    validKey;
    constructor(compare2, isValidKey) {
      super();
      this.compare = compare2 ?? this.defaultCompare();
      this.validKey = isValidKey ?? ((v) => v != null && v != void 0);
    }
    delete(element) {
      if (!this.validKey(element)) return false;
      return this._delete(element) != null;
    }
    deleteAll(elements) {
      for (const element of elements) {
        this.delete(element);
      }
    }
    forEach(f) {
      const nodes = this[Symbol.iterator]();
      let result;
      while (result = nodes.next(), !result.done) {
        f(result.value, result.value, this);
      }
    }
    add(element) {
      const compare2 = this.splay(element);
      if (compare2 != 0) this.addNewRoot(new SplayTreeSetNode(element), compare2);
      return this;
    }
    addAndReturn(element) {
      const compare2 = this.splay(element);
      if (compare2 != 0) this.addNewRoot(new SplayTreeSetNode(element), compare2);
      return this.root.key;
    }
    addAll(elements) {
      for (const element of elements) {
        this.add(element);
      }
    }
    isEmpty() {
      return this.root == null;
    }
    isNotEmpty() {
      return this.root != null;
    }
    single() {
      if (this.size == 0) throw "Bad state: No element";
      if (this.size > 1) throw "Bad state: Too many element";
      return this.root.key;
    }
    first() {
      if (this.size == 0) throw "Bad state: No element";
      return this._first().key;
    }
    last() {
      if (this.size == 0) throw "Bad state: No element";
      return this._last().key;
    }
    lastBefore(element) {
      if (element == null) throw "Invalid arguments(s)";
      if (this.root == null) return null;
      const comp = this.splay(element);
      if (comp < 0) return this.root.key;
      let node = this.root.left;
      if (node == null) return null;
      let nodeRight = node.right;
      while (nodeRight != null) {
        node = nodeRight;
        nodeRight = node.right;
      }
      return node.key;
    }
    firstAfter(element) {
      if (element == null) throw "Invalid arguments(s)";
      if (this.root == null) return null;
      const comp = this.splay(element);
      if (comp > 0) return this.root.key;
      let node = this.root.right;
      if (node == null) return null;
      let nodeLeft = node.left;
      while (nodeLeft != null) {
        node = nodeLeft;
        nodeLeft = node.left;
      }
      return node.key;
    }
    retainAll(elements) {
      const retainSet = new _SplayTreeSet(this.compare, this.validKey);
      const modificationCount = this.modificationCount;
      for (const object of elements) {
        if (modificationCount != this.modificationCount) {
          throw "Concurrent modification during iteration.";
        }
        if (this.validKey(object) && this.splay(object) == 0) {
          retainSet.add(this.root.key);
        }
      }
      if (retainSet.size != this.size) {
        this.root = retainSet.root;
        this.size = retainSet.size;
        this.modificationCount++;
      }
    }
    lookup(object) {
      if (!this.validKey(object)) return null;
      const comp = this.splay(object);
      if (comp != 0) return null;
      return this.root.key;
    }
    intersection(other) {
      const result = new _SplayTreeSet(this.compare, this.validKey);
      for (const element of this) {
        if (other.has(element)) result.add(element);
      }
      return result;
    }
    difference(other) {
      const result = new _SplayTreeSet(this.compare, this.validKey);
      for (const element of this) {
        if (!other.has(element)) result.add(element);
      }
      return result;
    }
    union(other) {
      const u = this.clone();
      u.addAll(other);
      return u;
    }
    clone() {
      const set2 = new _SplayTreeSet(this.compare, this.validKey);
      set2.size = this.size;
      set2.root = this.copyNode(this.root);
      return set2;
    }
    copyNode(node) {
      if (node == null) return null;
      function copyChildren(node2, dest) {
        let left;
        let right;
        do {
          left = node2.left;
          right = node2.right;
          if (left != null) {
            const newLeft = new SplayTreeSetNode(left.key);
            dest.left = newLeft;
            copyChildren(left, newLeft);
          }
          if (right != null) {
            const newRight = new SplayTreeSetNode(right.key);
            dest.right = newRight;
            node2 = right;
            dest = newRight;
          }
        } while (right != null);
      }
      const result = new SplayTreeSetNode(node.key);
      copyChildren(node, result);
      return result;
    }
    toSet() {
      return this.clone();
    }
    entries() {
      return new SplayTreeSetEntryIterableIterator(this.wrap());
    }
    keys() {
      return this[Symbol.iterator]();
    }
    values() {
      return this[Symbol.iterator]();
    }
    [Symbol.iterator]() {
      return new SplayTreeKeyIterableIterator(this.wrap());
    }
    [Symbol.toStringTag] = "[object Set]";
  };
  var SplayTreeIterableIterator = class {
    tree;
    path = new Array();
    modificationCount = null;
    splayCount;
    constructor(tree) {
      this.tree = tree;
      this.splayCount = tree.getSplayCount();
    }
    [Symbol.iterator]() {
      return this;
    }
    next() {
      if (this.moveNext()) return { done: false, value: this.current() };
      return { done: true, value: null };
    }
    current() {
      if (!this.path.length) return null;
      const node = this.path[this.path.length - 1];
      return this.getValue(node);
    }
    rebuildPath(key) {
      this.path.splice(0, this.path.length);
      this.tree.splay(key);
      this.path.push(this.tree.getRoot());
      this.splayCount = this.tree.getSplayCount();
    }
    findLeftMostDescendent(node) {
      while (node != null) {
        this.path.push(node);
        node = node.left;
      }
    }
    moveNext() {
      if (this.modificationCount != this.tree.getModificationCount()) {
        if (this.modificationCount == null) {
          this.modificationCount = this.tree.getModificationCount();
          let node2 = this.tree.getRoot();
          while (node2 != null) {
            this.path.push(node2);
            node2 = node2.left;
          }
          return this.path.length > 0;
        }
        throw "Concurrent modification during iteration.";
      }
      if (!this.path.length) return false;
      if (this.splayCount != this.tree.getSplayCount()) {
        this.rebuildPath(this.path[this.path.length - 1].key);
      }
      let node = this.path[this.path.length - 1];
      let next = node.right;
      if (next != null) {
        while (next != null) {
          this.path.push(next);
          next = next.left;
        }
        return true;
      }
      this.path.pop();
      while (this.path.length && this.path[this.path.length - 1].right === node) {
        node = this.path.pop();
      }
      return this.path.length > 0;
    }
  };
  var SplayTreeKeyIterableIterator = class extends SplayTreeIterableIterator {
    getValue(node) {
      return node.key;
    }
  };
  var SplayTreeSetEntryIterableIterator = class extends SplayTreeIterableIterator {
    getValue(node) {
      return [node.key, node.key];
    }
  };

  // 世界生成器_1.4.0.dev164_Windows/runtime/node_modules/polyclip-ts/dist/esm/index.js
  var constant_default = (x) => {
    return () => {
      return x;
    };
  };
  var compare_default = (eps) => {
    const almostEqual = eps ? (a, b) => b.minus(a).abs().isLessThanOrEqualTo(eps) : constant_default(false);
    return (a, b) => {
      if (almostEqual(a, b)) return 0;
      return a.comparedTo(b);
    };
  };
  function orient_default(eps) {
    const almostCollinear = eps ? (area2, ax, ay, cx, cy) => area2.exponentiatedBy(2).isLessThanOrEqualTo(
      cx.minus(ax).exponentiatedBy(2).plus(cy.minus(ay).exponentiatedBy(2)).times(eps)
    ) : constant_default(false);
    return (a, b, c) => {
      const ax = a.x, ay = a.y, cx = c.x, cy = c.y;
      const area2 = ay.minus(cy).times(b.x.minus(cx)).minus(ax.minus(cx).times(b.y.minus(cy)));
      if (almostCollinear(area2, ax, ay, cx, cy)) return 0;
      return area2.comparedTo(0);
    };
  }
  var identity_default = (x) => {
    return x;
  };
  var snap_default = (eps) => {
    if (eps) {
      const xTree = new SplayTreeSet(compare_default(eps));
      const yTree = new SplayTreeSet(compare_default(eps));
      const snapCoord = (coord, tree) => {
        return tree.addAndReturn(coord);
      };
      const snap = (v) => {
        return {
          x: snapCoord(v.x, xTree),
          y: snapCoord(v.y, yTree)
        };
      };
      snap({ x: new bignumber_default(0), y: new bignumber_default(0) });
      return snap;
    }
    return identity_default;
  };
  var set = (eps) => {
    return {
      set: (eps2) => {
        precision = set(eps2);
      },
      reset: () => set(eps),
      compare: compare_default(eps),
      snap: snap_default(eps),
      orient: orient_default(eps)
    };
  };
  var precision = set();
  var isInBbox = (bbox, point) => {
    return bbox.ll.x.isLessThanOrEqualTo(point.x) && point.x.isLessThanOrEqualTo(bbox.ur.x) && bbox.ll.y.isLessThanOrEqualTo(point.y) && point.y.isLessThanOrEqualTo(bbox.ur.y);
  };
  var getBboxOverlap = (b1, b2) => {
    if (b2.ur.x.isLessThan(b1.ll.x) || b1.ur.x.isLessThan(b2.ll.x) || b2.ur.y.isLessThan(b1.ll.y) || b1.ur.y.isLessThan(b2.ll.y))
      return null;
    const lowerX = b1.ll.x.isLessThan(b2.ll.x) ? b2.ll.x : b1.ll.x;
    const upperX = b1.ur.x.isLessThan(b2.ur.x) ? b1.ur.x : b2.ur.x;
    const lowerY = b1.ll.y.isLessThan(b2.ll.y) ? b2.ll.y : b1.ll.y;
    const upperY = b1.ur.y.isLessThan(b2.ur.y) ? b1.ur.y : b2.ur.y;
    return { ll: { x: lowerX, y: lowerY }, ur: { x: upperX, y: upperY } };
  };
  var crossProduct = (a, b) => a.x.times(b.y).minus(a.y.times(b.x));
  var dotProduct = (a, b) => a.x.times(b.x).plus(a.y.times(b.y));
  var length = (v) => dotProduct(v, v).sqrt();
  var sineOfAngle = (pShared, pBase, pAngle) => {
    const vBase = { x: pBase.x.minus(pShared.x), y: pBase.y.minus(pShared.y) };
    const vAngle = { x: pAngle.x.minus(pShared.x), y: pAngle.y.minus(pShared.y) };
    return crossProduct(vAngle, vBase).div(length(vAngle)).div(length(vBase));
  };
  var cosineOfAngle = (pShared, pBase, pAngle) => {
    const vBase = { x: pBase.x.minus(pShared.x), y: pBase.y.minus(pShared.y) };
    const vAngle = { x: pAngle.x.minus(pShared.x), y: pAngle.y.minus(pShared.y) };
    return dotProduct(vAngle, vBase).div(length(vAngle)).div(length(vBase));
  };
  var horizontalIntersection = (pt, v, y) => {
    if (v.y.isZero()) return null;
    return { x: pt.x.plus(v.x.div(v.y).times(y.minus(pt.y))), y };
  };
  var verticalIntersection = (pt, v, x) => {
    if (v.x.isZero()) return null;
    return { x, y: pt.y.plus(v.y.div(v.x).times(x.minus(pt.x))) };
  };
  var intersection = (pt1, v1, pt2, v2) => {
    if (v1.x.isZero()) return verticalIntersection(pt2, v2, pt1.x);
    if (v2.x.isZero()) return verticalIntersection(pt1, v1, pt2.x);
    if (v1.y.isZero()) return horizontalIntersection(pt2, v2, pt1.y);
    if (v2.y.isZero()) return horizontalIntersection(pt1, v1, pt2.y);
    const kross = crossProduct(v1, v2);
    if (kross.isZero()) return null;
    const ve = { x: pt2.x.minus(pt1.x), y: pt2.y.minus(pt1.y) };
    const d1 = crossProduct(ve, v1).div(kross);
    const d2 = crossProduct(ve, v2).div(kross);
    const x1 = pt1.x.plus(d2.times(v1.x)), x2 = pt2.x.plus(d1.times(v2.x));
    const y1 = pt1.y.plus(d2.times(v1.y)), y2 = pt2.y.plus(d1.times(v2.y));
    const x = x1.plus(x2).div(2);
    const y = y1.plus(y2).div(2);
    return { x, y };
  };
  var SweepEvent = class _SweepEvent {
    point;
    isLeft;
    segment;
    otherSE;
    consumedBy;
    // for ordering sweep events in the sweep event queue
    static compare(a, b) {
      const ptCmp = _SweepEvent.comparePoints(a.point, b.point);
      if (ptCmp !== 0) return ptCmp;
      if (a.point !== b.point) a.link(b);
      if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
      return Segment.compare(a.segment, b.segment);
    }
    // for ordering points in sweep line order
    static comparePoints(aPt, bPt) {
      if (aPt.x.isLessThan(bPt.x)) return -1;
      if (aPt.x.isGreaterThan(bPt.x)) return 1;
      if (aPt.y.isLessThan(bPt.y)) return -1;
      if (aPt.y.isGreaterThan(bPt.y)) return 1;
      return 0;
    }
    // Warning: 'point' input will be modified and re-used (for performance)
    constructor(point, isLeft) {
      if (point.events === void 0) point.events = [this];
      else point.events.push(this);
      this.point = point;
      this.isLeft = isLeft;
    }
    link(other) {
      if (other.point === this.point) {
        throw new Error("Tried to link already linked events");
      }
      const otherEvents = other.point.events;
      for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
        const evt = otherEvents[i];
        this.point.events.push(evt);
        evt.point = this.point;
      }
      this.checkForConsuming();
    }
    /* Do a pass over our linked events and check to see if any pair
     * of segments match, and should be consumed. */
    checkForConsuming() {
      const numEvents = this.point.events.length;
      for (let i = 0; i < numEvents; i++) {
        const evt1 = this.point.events[i];
        if (evt1.segment.consumedBy !== void 0) continue;
        for (let j = i + 1; j < numEvents; j++) {
          const evt2 = this.point.events[j];
          if (evt2.consumedBy !== void 0) continue;
          if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
          evt1.segment.consume(evt2.segment);
        }
      }
    }
    getAvailableLinkedEvents() {
      const events = [];
      for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
        const evt = this.point.events[i];
        if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
          events.push(evt);
        }
      }
      return events;
    }
    /**
     * Returns a comparator function for sorting linked events that will
     * favor the event that will give us the smallest left-side angle.
     * All ring construction starts as low as possible heading to the right,
     * so by always turning left as sharp as possible we'll get polygons
     * without uncessary loops & holes.
     *
     * The comparator function has a compute cache such that it avoids
     * re-computing already-computed values.
     */
    getLeftmostComparator(baseEvent) {
      const cache = /* @__PURE__ */ new Map();
      const fillCache = (linkedEvent) => {
        const nextEvent = linkedEvent.otherSE;
        cache.set(linkedEvent, {
          sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
          cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
        });
      };
      return (a, b) => {
        if (!cache.has(a)) fillCache(a);
        if (!cache.has(b)) fillCache(b);
        const { sine: asine, cosine: acosine } = cache.get(a);
        const { sine: bsine, cosine: bcosine } = cache.get(b);
        if (asine.isGreaterThanOrEqualTo(0) && bsine.isGreaterThanOrEqualTo(0)) {
          if (acosine.isLessThan(bcosine)) return 1;
          if (acosine.isGreaterThan(bcosine)) return -1;
          return 0;
        }
        if (asine.isLessThan(0) && bsine.isLessThan(0)) {
          if (acosine.isLessThan(bcosine)) return -1;
          if (acosine.isGreaterThan(bcosine)) return 1;
          return 0;
        }
        if (bsine.isLessThan(asine)) return -1;
        if (bsine.isGreaterThan(asine)) return 1;
        return 0;
      };
    }
  };
  var RingOut = class _RingOut {
    events;
    poly;
    _isExteriorRing;
    _enclosingRing;
    /* Given the segments from the sweep line pass, compute & return a series
     * of closed rings from all the segments marked to be part of the result */
    static factory(allSegments) {
      const ringsOut = [];
      for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
        const segment = allSegments[i];
        if (!segment.isInResult() || segment.ringOut) continue;
        let prevEvent = null;
        let event = segment.leftSE;
        let nextEvent = segment.rightSE;
        const events = [event];
        const startingPoint = event.point;
        const intersectionLEs = [];
        while (true) {
          prevEvent = event;
          event = nextEvent;
          events.push(event);
          if (event.point === startingPoint) break;
          while (true) {
            const availableLEs = event.getAvailableLinkedEvents();
            if (availableLEs.length === 0) {
              const firstPt = events[0].point;
              const lastPt = events[events.length - 1].point;
              throw new Error(
                `Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`
              );
            }
            if (availableLEs.length === 1) {
              nextEvent = availableLEs[0].otherSE;
              break;
            }
            let indexLE = null;
            for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
              if (intersectionLEs[j].point === event.point) {
                indexLE = j;
                break;
              }
            }
            if (indexLE !== null) {
              const intersectionLE = intersectionLEs.splice(indexLE)[0];
              const ringEvents = events.splice(intersectionLE.index);
              ringEvents.unshift(ringEvents[0].otherSE);
              ringsOut.push(new _RingOut(ringEvents.reverse()));
              continue;
            }
            intersectionLEs.push({
              index: events.length,
              point: event.point
            });
            const comparator = event.getLeftmostComparator(prevEvent);
            nextEvent = availableLEs.sort(comparator)[0].otherSE;
            break;
          }
        }
        ringsOut.push(new _RingOut(events));
      }
      return ringsOut;
    }
    constructor(events) {
      this.events = events;
      for (let i = 0, iMax = events.length; i < iMax; i++) {
        events[i].segment.ringOut = this;
      }
      this.poly = null;
    }
    getGeom() {
      let prevPt = this.events[0].point;
      const points = [prevPt];
      for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
        const pt2 = this.events[i].point;
        const nextPt2 = this.events[i + 1].point;
        if (precision.orient(pt2, prevPt, nextPt2) === 0) continue;
        points.push(pt2);
        prevPt = pt2;
      }
      if (points.length === 1) return null;
      const pt = points[0];
      const nextPt = points[1];
      if (precision.orient(pt, prevPt, nextPt) === 0) points.shift();
      points.push(points[0]);
      const step = this.isExteriorRing() ? 1 : -1;
      const iStart = this.isExteriorRing() ? 0 : points.length - 1;
      const iEnd = this.isExteriorRing() ? points.length : -1;
      const orderedPoints = [];
      for (let i = iStart; i != iEnd; i += step)
        orderedPoints.push([points[i].x.toNumber(), points[i].y.toNumber()]);
      return orderedPoints;
    }
    isExteriorRing() {
      if (this._isExteriorRing === void 0) {
        const enclosing = this.enclosingRing();
        this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
      }
      return this._isExteriorRing;
    }
    enclosingRing() {
      if (this._enclosingRing === void 0) {
        this._enclosingRing = this._calcEnclosingRing();
      }
      return this._enclosingRing;
    }
    /* Returns the ring that encloses this one, if any */
    _calcEnclosingRing() {
      let leftMostEvt = this.events[0];
      for (let i = 1, iMax = this.events.length; i < iMax; i++) {
        const evt = this.events[i];
        if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
      }
      let prevSeg = leftMostEvt.segment.prevInResult();
      let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
      while (true) {
        if (!prevSeg) return null;
        if (!prevPrevSeg) return prevSeg.ringOut;
        if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
          if (prevPrevSeg.ringOut?.enclosingRing() !== prevSeg.ringOut) {
            return prevSeg.ringOut;
          } else return prevSeg.ringOut?.enclosingRing();
        }
        prevSeg = prevPrevSeg.prevInResult();
        prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
      }
    }
  };
  var PolyOut = class {
    exteriorRing;
    interiorRings;
    constructor(exteriorRing) {
      this.exteriorRing = exteriorRing;
      exteriorRing.poly = this;
      this.interiorRings = [];
    }
    addInterior(ring) {
      this.interiorRings.push(ring);
      ring.poly = this;
    }
    getGeom() {
      const geom0 = this.exteriorRing.getGeom();
      if (geom0 === null) return null;
      const geom = [geom0];
      for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
        const ringGeom = this.interiorRings[i].getGeom();
        if (ringGeom === null) continue;
        geom.push(ringGeom);
      }
      return geom;
    }
  };
  var MultiPolyOut = class {
    rings;
    polys;
    constructor(rings) {
      this.rings = rings;
      this.polys = this._composePolys(rings);
    }
    getGeom() {
      const geom = [];
      for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
        const polyGeom = this.polys[i].getGeom();
        if (polyGeom === null) continue;
        geom.push(polyGeom);
      }
      return geom;
    }
    _composePolys(rings) {
      const polys = [];
      for (let i = 0, iMax = rings.length; i < iMax; i++) {
        const ring = rings[i];
        if (ring.poly) continue;
        if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
        else {
          const enclosingRing = ring.enclosingRing();
          if (!enclosingRing?.poly) polys.push(new PolyOut(enclosingRing));
          enclosingRing?.poly?.addInterior(ring);
        }
      }
      return polys;
    }
  };
  var SweepLine = class {
    queue;
    tree;
    segments;
    constructor(queue, comparator = Segment.compare) {
      this.queue = queue;
      this.tree = new SplayTreeSet(comparator);
      this.segments = [];
    }
    process(event) {
      const segment = event.segment;
      const newEvents = [];
      if (event.consumedBy) {
        if (event.isLeft) this.queue.delete(event.otherSE);
        else this.tree.delete(segment);
        return newEvents;
      }
      if (event.isLeft) this.tree.add(segment);
      let prevSeg = segment;
      let nextSeg = segment;
      do {
        prevSeg = this.tree.lastBefore(prevSeg);
      } while (prevSeg != null && prevSeg.consumedBy != void 0);
      do {
        nextSeg = this.tree.firstAfter(nextSeg);
      } while (nextSeg != null && nextSeg.consumedBy != void 0);
      if (event.isLeft) {
        let prevMySplitter = null;
        if (prevSeg) {
          const prevInter = prevSeg.getIntersection(segment);
          if (prevInter !== null) {
            if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
            if (!prevSeg.isAnEndpoint(prevInter)) {
              const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
              for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                newEvents.push(newEventsFromSplit[i]);
              }
            }
          }
        }
        let nextMySplitter = null;
        if (nextSeg) {
          const nextInter = nextSeg.getIntersection(segment);
          if (nextInter !== null) {
            if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
            if (!nextSeg.isAnEndpoint(nextInter)) {
              const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
              for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                newEvents.push(newEventsFromSplit[i]);
              }
            }
          }
        }
        if (prevMySplitter !== null || nextMySplitter !== null) {
          let mySplitter = null;
          if (prevMySplitter === null) mySplitter = nextMySplitter;
          else if (nextMySplitter === null) mySplitter = prevMySplitter;
          else {
            const cmpSplitters = SweepEvent.comparePoints(
              prevMySplitter,
              nextMySplitter
            );
            mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
          }
          this.queue.delete(segment.rightSE);
          newEvents.push(segment.rightSE);
          const newEventsFromSplit = segment.split(mySplitter);
          for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
            newEvents.push(newEventsFromSplit[i]);
          }
        }
        if (newEvents.length > 0) {
          this.tree.delete(segment);
          newEvents.push(event);
        } else {
          this.segments.push(segment);
          segment.prev = prevSeg;
        }
      } else {
        if (prevSeg && nextSeg) {
          const inter = prevSeg.getIntersection(nextSeg);
          if (inter !== null) {
            if (!prevSeg.isAnEndpoint(inter)) {
              const newEventsFromSplit = this._splitSafely(prevSeg, inter);
              for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                newEvents.push(newEventsFromSplit[i]);
              }
            }
            if (!nextSeg.isAnEndpoint(inter)) {
              const newEventsFromSplit = this._splitSafely(nextSeg, inter);
              for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                newEvents.push(newEventsFromSplit[i]);
              }
            }
          }
        }
        this.tree.delete(segment);
      }
      return newEvents;
    }
    /* Safely split a segment that is currently in the datastructures
     * IE - a segment other than the one that is currently being processed. */
    _splitSafely(seg, pt) {
      this.tree.delete(seg);
      const rightSE = seg.rightSE;
      this.queue.delete(rightSE);
      const newEvents = seg.split(pt);
      newEvents.push(rightSE);
      if (seg.consumedBy === void 0) this.tree.add(seg);
      return newEvents;
    }
  };
  var Operation = class {
    type;
    numMultiPolys;
    run(type, geom, moreGeoms) {
      operation.type = type;
      const multipolys = [new MultiPolyIn(geom, true)];
      for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
        multipolys.push(new MultiPolyIn(moreGeoms[i], false));
      }
      operation.numMultiPolys = multipolys.length;
      if (operation.type === "difference") {
        const subject = multipolys[0];
        let i = 1;
        while (i < multipolys.length) {
          if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;
          else multipolys.splice(i, 1);
        }
      }
      if (operation.type === "intersection") {
        for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
          const mpA = multipolys[i];
          for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
            if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
          }
        }
      }
      const queue = new SplayTreeSet(SweepEvent.compare);
      for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
        const sweepEvents = multipolys[i].getSweepEvents();
        for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
          queue.add(sweepEvents[j]);
        }
      }
      const sweepLine = new SweepLine(queue);
      let evt = null;
      if (queue.size != 0) {
        evt = queue.first();
        queue.delete(evt);
      }
      while (evt) {
        const newEvents = sweepLine.process(evt);
        for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
          const evt2 = newEvents[i];
          if (evt2.consumedBy === void 0) queue.add(evt2);
        }
        if (queue.size != 0) {
          evt = queue.first();
          queue.delete(evt);
        } else {
          evt = null;
        }
      }
      precision.reset();
      const ringsOut = RingOut.factory(sweepLine.segments);
      const result = new MultiPolyOut(ringsOut);
      return result.getGeom();
    }
  };
  var operation = new Operation();
  var operation_default = operation;
  var segmentId = 0;
  var Segment = class _Segment {
    id;
    leftSE;
    rightSE;
    rings;
    windings;
    ringOut;
    consumedBy;
    prev;
    _prevInResult;
    _beforeState;
    _afterState;
    _isInResult;
    /* This compare() function is for ordering segments in the sweep
     * line tree, and does so according to the following criteria:
     *
     * Consider the vertical line that lies an infinestimal step to the
     * right of the right-more of the two left endpoints of the input
     * segments. Imagine slowly moving a point up from negative infinity
     * in the increasing y direction. Which of the two segments will that
     * point intersect first? That segment comes 'before' the other one.
     *
     * If neither segment would be intersected by such a line, (if one
     * or more of the segments are vertical) then the line to be considered
     * is directly on the right-more of the two left inputs.
     */
    static compare(a, b) {
      const alx = a.leftSE.point.x;
      const blx = b.leftSE.point.x;
      const arx = a.rightSE.point.x;
      const brx = b.rightSE.point.x;
      if (brx.isLessThan(alx)) return 1;
      if (arx.isLessThan(blx)) return -1;
      const aly = a.leftSE.point.y;
      const bly = b.leftSE.point.y;
      const ary = a.rightSE.point.y;
      const bry = b.rightSE.point.y;
      if (alx.isLessThan(blx)) {
        if (bly.isLessThan(aly) && bly.isLessThan(ary)) return 1;
        if (bly.isGreaterThan(aly) && bly.isGreaterThan(ary)) return -1;
        const aCmpBLeft = a.comparePoint(b.leftSE.point);
        if (aCmpBLeft < 0) return 1;
        if (aCmpBLeft > 0) return -1;
        const bCmpARight = b.comparePoint(a.rightSE.point);
        if (bCmpARight !== 0) return bCmpARight;
        return -1;
      }
      if (alx.isGreaterThan(blx)) {
        if (aly.isLessThan(bly) && aly.isLessThan(bry)) return -1;
        if (aly.isGreaterThan(bly) && aly.isGreaterThan(bry)) return 1;
        const bCmpALeft = b.comparePoint(a.leftSE.point);
        if (bCmpALeft !== 0) return bCmpALeft;
        const aCmpBRight = a.comparePoint(b.rightSE.point);
        if (aCmpBRight < 0) return 1;
        if (aCmpBRight > 0) return -1;
        return 1;
      }
      if (aly.isLessThan(bly)) return -1;
      if (aly.isGreaterThan(bly)) return 1;
      if (arx.isLessThan(brx)) {
        const bCmpARight = b.comparePoint(a.rightSE.point);
        if (bCmpARight !== 0) return bCmpARight;
      }
      if (arx.isGreaterThan(brx)) {
        const aCmpBRight = a.comparePoint(b.rightSE.point);
        if (aCmpBRight < 0) return 1;
        if (aCmpBRight > 0) return -1;
      }
      if (!arx.eq(brx)) {
        const ay = ary.minus(aly);
        const ax = arx.minus(alx);
        const by = bry.minus(bly);
        const bx = brx.minus(blx);
        if (ay.isGreaterThan(ax) && by.isLessThan(bx)) return 1;
        if (ay.isLessThan(ax) && by.isGreaterThan(bx)) return -1;
      }
      if (arx.isGreaterThan(brx)) return 1;
      if (arx.isLessThan(brx)) return -1;
      if (ary.isLessThan(bry)) return -1;
      if (ary.isGreaterThan(bry)) return 1;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    }
    /* Warning: a reference to ringWindings input will be stored,
     *  and possibly will be later modified */
    constructor(leftSE, rightSE, rings, windings) {
      this.id = ++segmentId;
      this.leftSE = leftSE;
      leftSE.segment = this;
      leftSE.otherSE = rightSE;
      this.rightSE = rightSE;
      rightSE.segment = this;
      rightSE.otherSE = leftSE;
      this.rings = rings;
      this.windings = windings;
    }
    static fromRing(pt1, pt2, ring) {
      let leftPt, rightPt, winding;
      const cmpPts = SweepEvent.comparePoints(pt1, pt2);
      if (cmpPts < 0) {
        leftPt = pt1;
        rightPt = pt2;
        winding = 1;
      } else if (cmpPts > 0) {
        leftPt = pt2;
        rightPt = pt1;
        winding = -1;
      } else
        throw new Error(
          `Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`
        );
      const leftSE = new SweepEvent(leftPt, true);
      const rightSE = new SweepEvent(rightPt, false);
      return new _Segment(leftSE, rightSE, [ring], [winding]);
    }
    /* When a segment is split, the rightSE is replaced with a new sweep event */
    replaceRightSE(newRightSE) {
      this.rightSE = newRightSE;
      this.rightSE.segment = this;
      this.rightSE.otherSE = this.leftSE;
      this.leftSE.otherSE = this.rightSE;
    }
    bbox() {
      const y1 = this.leftSE.point.y;
      const y2 = this.rightSE.point.y;
      return {
        ll: { x: this.leftSE.point.x, y: y1.isLessThan(y2) ? y1 : y2 },
        ur: { x: this.rightSE.point.x, y: y1.isGreaterThan(y2) ? y1 : y2 }
      };
    }
    /* A vector from the left point to the right */
    vector() {
      return {
        x: this.rightSE.point.x.minus(this.leftSE.point.x),
        y: this.rightSE.point.y.minus(this.leftSE.point.y)
      };
    }
    isAnEndpoint(pt) {
      return pt.x.eq(this.leftSE.point.x) && pt.y.eq(this.leftSE.point.y) || pt.x.eq(this.rightSE.point.x) && pt.y.eq(this.rightSE.point.y);
    }
    /* Compare this segment with a point.
     *
     * A point P is considered to be colinear to a segment if there
     * exists a distance D such that if we travel along the segment
     * from one * endpoint towards the other a distance D, we find
     * ourselves at point P.
     *
     * Return value indicates:
     *
     *   1: point lies above the segment (to the left of vertical)
     *   0: point is colinear to segment
     *  -1: point lies below the segment (to the right of vertical)
     */
    comparePoint(point) {
      return precision.orient(this.leftSE.point, point, this.rightSE.point);
    }
    /**
     * Given another segment, returns the first non-trivial intersection
     * between the two segments (in terms of sweep line ordering), if it exists.
     *
     * A 'non-trivial' intersection is one that will cause one or both of the
     * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
     *
     *   * endpoint of segA with endpoint of segB --> trivial
     *   * endpoint of segA with point along segB --> non-trivial
     *   * endpoint of segB with point along segA --> non-trivial
     *   * point along segA with point along segB --> non-trivial
     *
     * If no non-trivial intersection exists, return null
     * Else, return null.
     */
    getIntersection(other) {
      const tBbox = this.bbox();
      const oBbox = other.bbox();
      const bboxOverlap = getBboxOverlap(tBbox, oBbox);
      if (bboxOverlap === null) return null;
      const tlp = this.leftSE.point;
      const trp = this.rightSE.point;
      const olp = other.leftSE.point;
      const orp = other.rightSE.point;
      const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
      const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
      const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
      const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
      if (touchesThisLSE && touchesOtherLSE) {
        if (touchesThisRSE && !touchesOtherRSE) return trp;
        if (!touchesThisRSE && touchesOtherRSE) return orp;
        return null;
      }
      if (touchesThisLSE) {
        if (touchesOtherRSE) {
          if (tlp.x.eq(orp.x) && tlp.y.eq(orp.y)) return null;
        }
        return tlp;
      }
      if (touchesOtherLSE) {
        if (touchesThisRSE) {
          if (trp.x.eq(olp.x) && trp.y.eq(olp.y)) return null;
        }
        return olp;
      }
      if (touchesThisRSE && touchesOtherRSE) return null;
      if (touchesThisRSE) return trp;
      if (touchesOtherRSE) return orp;
      const pt = intersection(tlp, this.vector(), olp, other.vector());
      if (pt === null) return null;
      if (!isInBbox(bboxOverlap, pt)) return null;
      return precision.snap(pt);
    }
    /**
     * Split the given segment into multiple segments on the given points.
     *  * Each existing segment will retain its leftSE and a new rightSE will be
     *    generated for it.
     *  * A new segment will be generated which will adopt the original segment's
     *    rightSE, and a new leftSE will be generated for it.
     *  * If there are more than two points given to split on, new segments
     *    in the middle will be generated with new leftSE and rightSE's.
     *  * An array of the newly generated SweepEvents will be returned.
     *
     * Warning: input array of points is modified
     */
    split(point) {
      const newEvents = [];
      const alreadyLinked = point.events !== void 0;
      const newLeftSE = new SweepEvent(point, true);
      const newRightSE = new SweepEvent(point, false);
      const oldRightSE = this.rightSE;
      this.replaceRightSE(newRightSE);
      newEvents.push(newRightSE);
      newEvents.push(newLeftSE);
      const newSeg = new _Segment(
        newLeftSE,
        oldRightSE,
        this.rings.slice(),
        this.windings.slice()
      );
      if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
        newSeg.swapEvents();
      }
      if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
        this.swapEvents();
      }
      if (alreadyLinked) {
        newLeftSE.checkForConsuming();
        newRightSE.checkForConsuming();
      }
      return newEvents;
    }
    /* Swap which event is left and right */
    swapEvents() {
      const tmpEvt = this.rightSE;
      this.rightSE = this.leftSE;
      this.leftSE = tmpEvt;
      this.leftSE.isLeft = true;
      this.rightSE.isLeft = false;
      for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
        this.windings[i] *= -1;
      }
    }
    /* Consume another segment. We take their rings under our wing
     * and mark them as consumed. Use for perfectly overlapping segments */
    consume(other) {
      let consumer = this;
      let consumee = other;
      while (consumer.consumedBy) consumer = consumer.consumedBy;
      while (consumee.consumedBy) consumee = consumee.consumedBy;
      const cmp = _Segment.compare(consumer, consumee);
      if (cmp === 0) return;
      if (cmp > 0) {
        const tmp = consumer;
        consumer = consumee;
        consumee = tmp;
      }
      if (consumer.prev === consumee) {
        const tmp = consumer;
        consumer = consumee;
        consumee = tmp;
      }
      for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
        const ring = consumee.rings[i];
        const winding = consumee.windings[i];
        const index = consumer.rings.indexOf(ring);
        if (index === -1) {
          consumer.rings.push(ring);
          consumer.windings.push(winding);
        } else consumer.windings[index] += winding;
      }
      consumee.rings = null;
      consumee.windings = null;
      consumee.consumedBy = consumer;
      consumee.leftSE.consumedBy = consumer.leftSE;
      consumee.rightSE.consumedBy = consumer.rightSE;
    }
    /* The first segment previous segment chain that is in the result */
    prevInResult() {
      if (this._prevInResult !== void 0) return this._prevInResult;
      if (!this.prev) this._prevInResult = null;
      else if (this.prev.isInResult()) this._prevInResult = this.prev;
      else this._prevInResult = this.prev.prevInResult();
      return this._prevInResult;
    }
    beforeState() {
      if (this._beforeState !== void 0) return this._beforeState;
      if (!this.prev)
        this._beforeState = {
          rings: [],
          windings: [],
          multiPolys: []
        };
      else {
        const seg = this.prev.consumedBy || this.prev;
        this._beforeState = seg.afterState();
      }
      return this._beforeState;
    }
    afterState() {
      if (this._afterState !== void 0) return this._afterState;
      const beforeState = this.beforeState();
      this._afterState = {
        rings: beforeState.rings.slice(0),
        windings: beforeState.windings.slice(0),
        multiPolys: []
      };
      const ringsAfter = this._afterState.rings;
      const windingsAfter = this._afterState.windings;
      const mpsAfter = this._afterState.multiPolys;
      for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
        const ring = this.rings[i];
        const winding = this.windings[i];
        const index = ringsAfter.indexOf(ring);
        if (index === -1) {
          ringsAfter.push(ring);
          windingsAfter.push(winding);
        } else windingsAfter[index] += winding;
      }
      const polysAfter = [];
      const polysExclude = [];
      for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
        if (windingsAfter[i] === 0) continue;
        const ring = ringsAfter[i];
        const poly = ring.poly;
        if (polysExclude.indexOf(poly) !== -1) continue;
        if (ring.isExterior) polysAfter.push(poly);
        else {
          if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
          const index = polysAfter.indexOf(ring.poly);
          if (index !== -1) polysAfter.splice(index, 1);
        }
      }
      for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
        const mp = polysAfter[i].multiPoly;
        if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
      }
      return this._afterState;
    }
    /* Is this segment part of the final result? */
    isInResult() {
      if (this.consumedBy) return false;
      if (this._isInResult !== void 0) return this._isInResult;
      const mpsBefore = this.beforeState().multiPolys;
      const mpsAfter = this.afterState().multiPolys;
      switch (operation_default.type) {
        case "union": {
          const noBefores = mpsBefore.length === 0;
          const noAfters = mpsAfter.length === 0;
          this._isInResult = noBefores !== noAfters;
          break;
        }
        case "intersection": {
          let least;
          let most;
          if (mpsBefore.length < mpsAfter.length) {
            least = mpsBefore.length;
            most = mpsAfter.length;
          } else {
            least = mpsAfter.length;
            most = mpsBefore.length;
          }
          this._isInResult = most === operation_default.numMultiPolys && least < most;
          break;
        }
        case "xor": {
          const diff = Math.abs(mpsBefore.length - mpsAfter.length);
          this._isInResult = diff % 2 === 1;
          break;
        }
        case "difference": {
          const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
          this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
          break;
        }
      }
      return this._isInResult;
    }
  };
  var RingIn = class {
    poly;
    isExterior;
    segments;
    bbox;
    constructor(geomRing, poly, isExterior) {
      if (!Array.isArray(geomRing) || geomRing.length === 0) {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      this.poly = poly;
      this.isExterior = isExterior;
      this.segments = [];
      if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      const firstPoint = precision.snap({ x: new bignumber_default(geomRing[0][0]), y: new bignumber_default(geomRing[0][1]) });
      this.bbox = {
        ll: { x: firstPoint.x, y: firstPoint.y },
        ur: { x: firstPoint.x, y: firstPoint.y }
      };
      let prevPoint = firstPoint;
      for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
        if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        const point = precision.snap({ x: new bignumber_default(geomRing[i][0]), y: new bignumber_default(geomRing[i][1]) });
        if (point.x.eq(prevPoint.x) && point.y.eq(prevPoint.y)) continue;
        this.segments.push(Segment.fromRing(prevPoint, point, this));
        if (point.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = point.x;
        if (point.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = point.y;
        if (point.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = point.x;
        if (point.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = point.y;
        prevPoint = point;
      }
      if (!firstPoint.x.eq(prevPoint.x) || !firstPoint.y.eq(prevPoint.y)) {
        this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
      }
    }
    getSweepEvents() {
      const sweepEvents = [];
      for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
        const segment = this.segments[i];
        sweepEvents.push(segment.leftSE);
        sweepEvents.push(segment.rightSE);
      }
      return sweepEvents;
    }
  };
  var PolyIn = class {
    multiPoly;
    exteriorRing;
    interiorRings;
    bbox;
    constructor(geomPoly, multiPoly) {
      if (!Array.isArray(geomPoly)) {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      this.exteriorRing = new RingIn(geomPoly[0], this, true);
      this.bbox = {
        ll: { x: this.exteriorRing.bbox.ll.x, y: this.exteriorRing.bbox.ll.y },
        ur: { x: this.exteriorRing.bbox.ur.x, y: this.exteriorRing.bbox.ur.y }
      };
      this.interiorRings = [];
      for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
        const ring = new RingIn(geomPoly[i], this, false);
        if (ring.bbox.ll.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = ring.bbox.ll.x;
        if (ring.bbox.ll.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = ring.bbox.ll.y;
        if (ring.bbox.ur.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = ring.bbox.ur.x;
        if (ring.bbox.ur.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = ring.bbox.ur.y;
        this.interiorRings.push(ring);
      }
      this.multiPoly = multiPoly;
    }
    getSweepEvents() {
      const sweepEvents = this.exteriorRing.getSweepEvents();
      for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
        const ringSweepEvents = this.interiorRings[i].getSweepEvents();
        for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
          sweepEvents.push(ringSweepEvents[j]);
        }
      }
      return sweepEvents;
    }
  };
  var MultiPolyIn = class {
    isSubject;
    polys;
    bbox;
    constructor(geom, isSubject) {
      if (!Array.isArray(geom)) {
        throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
      }
      try {
        if (typeof geom[0][0][0] === "number") geom = [geom];
      } catch (ex) {
      }
      this.polys = [];
      this.bbox = {
        ll: { x: new bignumber_default(Number.POSITIVE_INFINITY), y: new bignumber_default(Number.POSITIVE_INFINITY) },
        ur: { x: new bignumber_default(Number.NEGATIVE_INFINITY), y: new bignumber_default(Number.NEGATIVE_INFINITY) }
      };
      for (let i = 0, iMax = geom.length; i < iMax; i++) {
        const poly = new PolyIn(geom[i], this);
        if (poly.bbox.ll.x.isLessThan(this.bbox.ll.x)) this.bbox.ll.x = poly.bbox.ll.x;
        if (poly.bbox.ll.y.isLessThan(this.bbox.ll.y)) this.bbox.ll.y = poly.bbox.ll.y;
        if (poly.bbox.ur.x.isGreaterThan(this.bbox.ur.x)) this.bbox.ur.x = poly.bbox.ur.x;
        if (poly.bbox.ur.y.isGreaterThan(this.bbox.ur.y)) this.bbox.ur.y = poly.bbox.ur.y;
        this.polys.push(poly);
      }
      this.isSubject = isSubject;
    }
    getSweepEvents() {
      const sweepEvents = [];
      for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
        const polySweepEvents = this.polys[i].getSweepEvents();
        for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
          sweepEvents.push(polySweepEvents[j]);
        }
      }
      return sweepEvents;
    }
  };
  var union = (geom, ...moreGeoms) => operation_default.run("union", geom, moreGeoms);
  var setPrecision = precision.set;

  // .work/city-portable-20261026/source/src/world_atlas/core/web/city-site-entry.js
  (() => {
    "use strict";
    const M = Math;
    setPrecision(1e-30);
    const clamp = (value, low, high) => M.max(low, M.min(high, value));
    const round = (value) => M.round(value * 1e7) / 1e7;
    function polygonBounds(points, tolerance = 0) {
      const columns = points.map((p) => p.column), rows = points.map((p) => p.row), west = M.min(...columns), east = M.max(...columns), north = M.min(...rows), south = M.max(...rows), xMargin = (east - west) * tolerance + 1e-12, yMargin = (south - north) * tolerance + 1e-12;
      return { west: west - xMargin, east: east + xMargin, north: north - yMargin, south: south + yMargin };
    }
    function boundsCandidates(boxes) {
      if (!boxes.length) return () => [];
      const index = new Flatbush(boxes.length);
      for (const box of boxes) index.add(box.west, box.north, box.east, box.south);
      index.finish();
      return (box) => index.search(box.west, box.north, box.east, box.south).sort((a, b) => a - b);
    }
    function unionPolygons(paths) {
      if (!paths.length) return [];
      let merged = [];
      for (let start = 0; start < paths.length; start += 512) {
        const batch = paths.slice(start, start + 512).map((points) => {
          const ring = [...points, [...points[0]]];
          return [ring];
        });
        merged.push(import_polygon_clipping.default.union(...batch));
      }
      while (merged.length > 1) {
        const next = [];
        for (let i = 0; i < merged.length; i += 2) next.push(i + 1 < merged.length ? import_polygon_clipping.default.union(merged[i], merged[i + 1]) : merged[i]);
        merged = next;
      }
      return merged[0];
    }
    function unionWallBuffers(paths) {
      if (!paths.length) return [];
      return union(...paths.map((points) => [[...points, points[0]]]));
    }
    function dryGroundPath(paths) {
      return unionPolygons(paths).map((polygon) => polygon.map((ring) => "M" + ring.slice(0, -1).map((p) => p.join(" ")).join("L") + "Z").join("")).join("");
    }
    const random = (seed, salt) => {
      let value = (seed ^ M.imul(salt + 1, 2654435769)) >>> 0;
      value = M.imul(value ^ value >>> 16, 569420461);
      value = M.imul(value ^ value >>> 15, 1935289751);
      return ((value ^ value >>> 15) >>> 0) / 4294967296;
    };
    const geographicEndings = /(?:低地河谷|低地谷地|内海|海峡|山脉|群岛|平原|高原|盆地|沙漠|湿地|河谷|深谷|山麓|陡坡|雪山|半岛|地峡|旱岭|丘陵|谷地|山|岭|峰|河|江|溪|湖|海|湾|岛|林|岬)$/;
    function nameFromPool(pools, category, { seed = 0, salt = 0, used = /* @__PURE__ */ new Set(), suffix = "", libraryId = "\u672A\u6807\u660E" } = {}) {
      const supplied = pools?.[category];
      if (!Array.isArray(supplied) || !supplied.length || supplied.some((name) => typeof name !== "string" || !name.trim()))
        throw new RangeError("\u6587\u5316\u5E93 " + libraryId + " \u540D\u79F0\u6C60\u4E3A\u7A7A: category=" + category + ", capacity=0");
      const names = Array.from(new Set(supplied.map((name) => {
        if (!suffix) return name;
        return geographicEndings.test(name) ? name : name + suffix;
      }))), start = M.floor(random(seed, salt) * names.length);
      for (let i = 0; i < names.length; i++) {
        const candidate = names[(start + i) % names.length];
        if (!used.has(candidate)) {
          used.add(candidate);
          return candidate;
        }
      }
      throw new RangeError("\u6587\u5316\u5E93 " + libraryId + " \u5B8C\u6574\u540D\u79F0\u4E0D\u8DB3\uFF0C\u8BF7\u8865\u5145\u5BF9\u5E94\u5206\u7C7B\u540D\u5355: category=" + category + ", capacity=" + names.length);
    }
    const worldAdminEndings = ["\u7279\u522B\u884C\u653F\u533A", "\u81EA\u6CBB\u533A", "\u81EA\u6CBB\u5DDE", "\u81EA\u6CBB\u53BF", "\u81EA\u6CBB\u65D7", "\u6C11\u65CF\u4E61", "\u5E02\u8F96\u533A", "\u884C\u653F\u533A", "\u5F00\u53D1\u533A", "\u7ECF\u6D4E\u7279\u533A", "\u9AD8\u65B0\u533A", "\u65B0\u533A", "\u8857\u9053\u529E\u4E8B\u5904", "\u8857\u9053", "\u81EA\u7136\u6751", "\u884C\u653F\u6751", "\u6751\u5E84", "\u5730\u533A", "\u4E13\u533A", "\u884C\u7701", "\u5927\u533A", "\u7701", "\u5E02", "\u53BF", "\u533A", "\u6751", "\u9547", "\u4E61"].sort((a, b) => b.length - a.length), worldForbiddenTerms = ["\u81EA\u6CBB", "\u5F00\u53D1\u533A", "\u7ECF\u6D4E\u7279\u533A", "\u5E02\u8F96", "\u7279\u522B\u884C\u653F", "\u8857\u9053\u529E\u4E8B\u5904"], stateEndings = ["\u57CE\u90A6\u5171\u548C\u56FD", "\u5171\u548C\u56FD", "\u5E1D\u56FD", "\u738B\u56FD", "\u738B\u671D", "\u82CF\u4E39\u56FD", "\u6C57\u56FD", "\u5927\u6C57\u56FD", "\u57C3\u7C73\u5C14\u56FD", "\u516C\u56FD", "\u90E8\u65CF\u8054\u76DF", "\u90A6\u8054", "\u56FD", "\u603B\u7763\u5E9C", "\u6B96\u6C11\u5730"].sort((a, b) => b.length - a.length), provinceEndings = ["\u5DDE", "\u90E1", "\u5E9C", "\u9886", "\u9053", "\u7701", "\u884C\u7701", "\u5927\u533A", "\u8DEF"], geographicClassifiers = ["\u5C71\u8109", "\u5C71", "\u5CAD", "\u5CF0", "\u6CB3", "\u6C5F", "\u6E56", "\u5185\u6D77", "\u6D77", "\u6E7E", "\u6D77\u5CE1", "\u7FA4\u5C9B", "\u5C9B", "\u5E73\u539F", "\u9AD8\u539F", "\u76C6\u5730", "\u6C99\u6F20", "\u8352\u6F20", "\u6E7F\u5730", "\u6CB3\u8C37", "\u6DF1\u8C37", "\u5C71\u9E93", "\u9661\u5761", "\u96EA\u5C71", "\u5CAC", "\u534A\u5C9B", "\u5730\u5CE1", "\u65F1\u5CAD", "\u4E18\u9675", "\u8C37\u5730", "\u706B\u5C71", "\u6D2A\u6CDB\u5E73\u539F", "\u4E09\u89D2\u6D32", "\u6D77\u5CB8", "\u6CBF\u5CB8", "\u9AD8\u5730", "\u4F4E\u5730", "\u5C71\u5730", "\u706B\u5C71\u5730", "\u9698\u5730", "\u5CE1\u5730", "\u53F0\u5730", "\u8349\u539F", "\u8352\u539F", "\u51BB\u539F", "\u82D4\u539F", "\u51B0\u539F", "\u96EA\u539F", "\u6797\u5730", "\u6797\u539F", "\u6D41\u57DF", "\u6C34\u7F51", "\u6CFD\u56FD", "\u6C99\u539F", "\u5E73\u91CE", "\u65F7\u91CE", "\u8352\u91CE", "\u65F7\u539F", "\u6E7F\u539F", "\u6C34\u4E61", "\u7530\u539F", "\u6CBC\u5730", "\u53F0\u539F", "\u7267\u91CE", "\u65F1\u539F", "\u7EFF\u6D32", "\u6208\u58C1", "\u76D0\u539F", "\u5C9B\u539F", "\u73AF\u7901", "\u5CE1\u8C37", "\u4E18\u539F", "\u5CAC\u5730", "\u6D77\u9685", "\u77F3\u539F", "\u6E56\u533A", "\u5729\u533A", "\u6CFD\u533A", "\u6B21\u5927\u9646", "\u6D77\u6E7E", "\u5CE1\u6E7E", "\u7FA4\u5CF0", "\u7FA4\u5C71", "\u5C71\u7CFB", "\u5C71\u7FA4", "\u6797", "\u6EAA"], geographicPoolEndings = { rivers: ["\u6C34", "\u5DDD", "\u6EAA", "\u6DA7", "\u6C9F", "\u6CFE", "\u6E20"], lakes: ["\u6C60", "\u6DD6", "\u9519", "\u6F6D", "\u6CFD", "\u6CCA", "\u6DC0", "\u9642", "\u6CBC", "\u6C34\u5E93"], mountains: ["\u5CB3"], seas: ["\u6D0B", "\u6E2F", "\u6FB3", "\u6D66", "\u6EE9", "\u6C34\u9053", "\u6FD1\u6237"] }, geographicSameType = { \u6CB3: ["\u6CB3", "\u6C5F", "\u6C34", "\u5DDD", "\u6EAA", "\u6DA7", "\u6C9F", "\u6CFE"], \u6E56: ["\u6E56", "\u6D77", "\u6C60", "\u6DD6", "\u9519", "\u6F6D", "\u6CFD", "\u6CCA", "\u6DC0", "\u9642", "\u6CBC"], \u5C71: ["\u5C71", "\u5CF0", "\u5CB3"], \u5C71\u8109: ["\u5C71\u8109", "\u5C71\u7CFB", "\u7FA4\u5C71", "\u7FA4\u5CF0", "\u5C71\u7FA4", "\u5CAD"], \u6D77: ["\u6D77", "\u6D0B"], \u6E7E: ["\u6E7E", "\u6D77\u6E7E", "\u5CE1\u6E7E"], \u6D77\u5CE1: ["\u6D77\u5CE1", "\u6C34\u9053", "\u6FD1\u6237"] }, geographicCategories = ["mountains", "rivers", "lakes", "seas", "regions"];
    function removeNameEnding(name, endings) {
      const ending = [...endings].sort((a, b) => b.length - a.length).find((ending2) => name.length > ending2.length && name.endsWith(ending2));
      return ending ? name.slice(0, -ending.length) : name;
    }
    function namingCore(name, category, classifier = "") {
      if (["cities", "provinces", "states"].includes(category)) name = normalizeWorldToponym(name, category) || "";
      if (!name) return "";
      if (classifier && name.length > classifier.length && name.endsWith(classifier)) return name.slice(0, -classifier.length);
      if (geographicCategories.includes(category)) return removeNameEnding(name, [...geographicClassifiers, ...Object.values(geographicPoolEndings).flat()]);
      return removeNameEnding(name, ["cities", "provinces", "states"].includes(category) ? ["\u57CE", ...provinceEndings, ...stateEndings] : []);
    }
    function geographicName(name, category, suffix) {
      const core = namingCore(name, category), ending = name.slice(core.length);
      if ((geographicSameType[suffix] || [suffix]).includes(ending)) return name;
      if (core.endsWith(suffix)) return core;
      return core.at(-1) === suffix[0] ? null : core + suffix;
    }
    function normalizeWorldToponym(value, category) {
      let name = value.trim(), title = "";
      if (name.includes("\u81EA\u6CBB") && name.includes("\u65CF")) return null;
      if (category === "states") {
        title = stateEndings.find((ending) => name.length > ending.length && name.endsWith(ending)) || "";
        if (title) name = name.slice(0, -title.length);
      }
      while (!(category === "provinces" && (name.endsWith("\u7701") || name.endsWith("\u5927\u533A")))) {
        const ending = worldAdminEndings.find((ending2) => name.length > ending2.length && name.endsWith(ending2));
        if (!ending) break;
        name = name.slice(0, -ending.length);
      }
      return !name || worldAdminEndings.includes(name) || worldForbiddenTerms.some((term) => name.includes(term)) ? null : name + title;
    }
    function nameFromComposition(pools, category, { composition, seed = 0, salt = 0, used = /* @__PURE__ */ new Set(), suffix = "", libraryId = "\u672A\u6807\u660E" } = {}) {
      const supplied = pools?.[category];
      if (!["states", "provinces", "cities", ...geographicCategories].includes(category) || !Array.isArray(supplied) || !supplied.length || supplied.some((name) => typeof name !== "string" || !name.trim()))
        throw new RangeError("\u6587\u5316\u5E93 " + libraryId + " \u5730\u540D\u5206\u7C7B\u65E0\u6548: category=" + category);
      if (!composition || !["roots", "prefixes", "suffixes"].every((key) => Array.isArray(composition[key]) && composition[key].every((value) => typeof value === "string" && value.trim())) || !composition.roots.length)
        throw new RangeError("\u6587\u5316\u5E93 " + libraryId + " \u7EC4\u5408\u5730\u540D\u9700\u8981\u6838\u5FC3\u524D\u8BCD");
      const composed = Array.from(/* @__PURE__ */ new Set([
        ...composition.roots,
        ...composition.prefixes.flatMap((prefix) => composition.roots.filter((root) => root !== prefix && prefix.at(-1) !== root[0]).map((root) => prefix + root)),
        ...composition.roots.flatMap((root) => composition.suffixes.filter((ending) => ending !== root && root.at(-1) !== ending[0]).map((ending) => root + ending))
      ])), geographic = geographicCategories.includes(category), candidates = geographic ? [
        ...supplied.map((name) => {
          const complete = suffix ? geographicName(name, category, suffix) : name;
          return complete ? { name: complete, core: namingCore(complete, category, suffix) } : null;
        }).filter(Boolean),
        ...composed.filter((core) => !suffix || !core.endsWith(suffix) && core.at(-1) !== suffix[0]).map((core) => ({ name: core + suffix, core }))
      ] : [...supplied, ...composed].map((name) => normalizeWorldToponym(name, category)).filter(Boolean).map((name) => ({ name, core: namingCore(name, category) })), names = Array.from(new Map(candidates.map((item) => [item.name, item])).values()), start = M.floor(random(seed, salt) * names.length);
      for (let i = 0; i < names.length; i++) {
        const { name: base, core } = names[(start + i) % names.length], candidate = geographic ? base : base + suffix;
        if (!used.has(core) && !used.has(base) && !used.has(candidate)) {
          used.add(core);
          used.add(base);
          used.add(candidate);
          return candidate;
        }
      }
      throw new RangeError("\u6587\u5316\u5E93 " + libraryId + " \u5730\u540D\u4E0D\u8DB3\uFF0C\u8BF7\u8865\u5145\u5B8C\u6574\u540D\u6216\u7EC4\u5408\u8BCD: category=" + category + ", capacity=" + names.length);
    }
    function sample(values, rows, columns, bounds, row, column) {
      const x = clamp((column - bounds.west) / (bounds.east - bounds.west) * (columns - 1), 0, columns - 1);
      const y = clamp((row - bounds.north) / (bounds.south - bounds.north) * (rows - 1), 0, rows - 1);
      const x0 = M.floor(x), y0 = M.floor(y), x1 = M.min(columns - 1, x0 + 1), y1 = M.min(rows - 1, y0 + 1);
      const fx = x - x0, fy = y - y0;
      return (values[y0 * columns + x0] * (1 - fx) + values[y0 * columns + x1] * fx) * (1 - fy) + (values[y1 * columns + x0] * (1 - fx) + values[y1 * columns + x1] * fx) * fy;
    }
    function nearest(values, rows, columns, bounds, point) {
      const x = clamp(M.round((point.column - bounds.west) / (bounds.east - bounds.west) * (columns - 1)), 0, columns - 1);
      const y = clamp(M.round((point.row - bounds.north) / (bounds.south - bounds.north) * (rows - 1)), 0, rows - 1);
      return values[y * columns + x];
    }
    const lineCache = /* @__PURE__ */ new WeakMap();
    function distanceToLine(point, points, metric) {
      let cached = lineCache.get(points);
      if (!cached || cached.rowMetric !== metric.row || cached.columnMetric !== metric.column) {
        const lines2 = points.slice(1).map((b, i) => {
          const a = points[i], dx = (b.column - a.column) * metric.column, dy = (b.row - a.row) * metric.row;
          return { a, b, dx, dy, length: dx * dx + dy * dy || 1, minDx: M.min(0, dx), maxDx: M.max(0, dx), minDy: M.min(0, dy), maxDy: M.max(0, dy) };
        });
        const origin2 = points[0];
        let index2 = null;
        if (lines2.length >= 64) {
          index2 = new Flatbush(lines2.length);
          for (const { a, b } of lines2) {
            const x0 = (a.column - origin2.column) * metric.column, x1 = (b.column - origin2.column) * metric.column, y0 = (a.row - origin2.row) * metric.row, y1 = (b.row - origin2.row) * metric.row;
            index2.add(M.min(x0, x1), M.min(y0, y1), M.max(x0, x1), M.max(y0, y1));
          }
          index2.finish();
        }
        cached = { lines: lines2, index: index2, origin: origin2, last: 0, rowMetric: metric.row, columnMetric: metric.column };
        lineCache.set(points, cached);
      }
      const { lines, index, origin } = cached;
      if (!lines.length) return { distance: Infinity, elevation: 0, widthMetres: 0 };
      const first = lines[cached.last], firstX = (point.column - first.a.column) * metric.column, firstY = (point.row - first.a.row) * metric.row, firstT = clamp((firstX * first.dx + firstY * first.dy) / first.length, 0, 1), firstDx = firstX - first.dx * firstT, firstDy = firstY - first.dy * firstT;
      let best = firstDx * firstDx + firstDy * firstDy, height = 0, widthMetres = 0, bestIndex = cached.last, bestT = firstT, candidates = null;
      if (index) {
        const x = (point.column - origin.column) * metric.column, y = (point.row - origin.row) * metric.row, radius = M.hypot(firstDx, firstDy) + 1e-9;
        candidates = index.search(x - radius, y - radius, x + radius, y + radius);
      }
      for (let i = 0; i < (candidates ? candidates.length : lines.length); i++) {
        const sourceIndex = candidates ? candidates[i] : i, { a, b, dx, dy, length: length2, minDx, maxDx, minDy, maxDy } = lines[sourceIndex];
        const px = (point.column - a.column) * metric.column, py = (point.row - a.row) * metric.row;
        const bx = px < minDx ? minDx - px : px > maxDx ? px - maxDx : 0, by = py < minDy ? minDy - py : py > maxDy ? py - maxDy : 0;
        const bound = bx * bx + by * by;
        if (bound > best || bound === best && sourceIndex > bestIndex) continue;
        const t = clamp((px * dx + py * dy) / length2, 0, 1), x = px - dx * t, y = py - dy * t, d = x * x + y * y;
        if (d < best || d === best && sourceIndex < bestIndex) {
          best = d;
          bestIndex = sourceIndex;
          bestT = t;
        }
      }
      if (Number.isFinite(bestIndex)) {
        const { a, b } = lines[bestIndex], t = bestT;
        height = (a.elevationMetres || 0) * (1 - t) + (b.elevationMetres || 0) * t;
        widthMetres = (a.widthMetres || 0) * (1 - t) + (b.widthMetres || 0) * t;
        cached.last = bestIndex;
      }
      return { distance: M.sqrt(best), elevation: height, widthMetres };
    }
    function elevationAt(surface, point, values = surface.elevationMetres) {
      if (surface.lakeTerrain && (values === surface.elevationMetres || values === surface.lakeDepths)) {
        let depth = -1e3;
        for (const field of surface.lakeTerrain) {
          const b2 = field.bounds;
          if (point.column < b2.west || point.column > b2.east || point.row < b2.north || point.row > b2.south) continue;
          if (values === surface.elevationMetres) return elevationAt(field, point);
          depth = M.max(depth, elevationAt(field, point, field.lakeDepths));
        }
        if (values === surface.lakeDepths) return depth;
      }
      const b = surface.bounds, n = surface.columns, m = surface.rows, x = clamp((point.column - b.west) / (b.east - b.west) * (n - 1), 0, n - 1), y = clamp((point.row - b.north) / (b.south - b.north) * (m - 1), 0, m - 1), i = M.min(n - 2, M.floor(x)), j = M.min(m - 2, M.floor(y)), u = x - i, v = y - j, k = j * n + i, z = values;
      return u >= v ? z[k] * (1 - u) + z[k + 1] * (u - v) + z[k + n + 1] * v : z[k] * (1 - v) + z[k + n] * (v - u) + z[k + n + 1] * u;
    }
    const waterDomainCache = /* @__PURE__ */ new WeakMap();
    function waterBodyAt(domain, point) {
      let polygons = waterDomainCache.get(domain);
      if (!polygons) {
        polygons = domain.waterBodies.flatMap((body) => (body.geometry.type === "Polygon" ? [body.geometry.coordinates] : body.geometry.coordinates).map((rings) => ({
          body,
          rings,
          west: M.min(...rings[0].map((p) => p[0])),
          east: M.max(...rings[0].map((p) => p[0])),
          north: M.min(...rings[0].map((p) => p[1])),
          south: M.max(...rings[0].map((p) => p[1]))
        })));
        waterDomainCache.set(domain, polygons);
      }
      const inside = (ring) => {
        let yes = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[j], b = ring[i], x = point.column, y = point.row;
          if ((x - a[0]) * (b[1] - a[1]) === (y - a[1]) * (b[0] - a[0]) && x >= M.min(a[0], b[0]) && x <= M.max(a[0], b[0]) && y >= M.min(a[1], b[1]) && y <= M.max(a[1], b[1])) {
            const frame = a[0] === b[0] && (x === domain.bounds.west || x === domain.bounds.east) || a[1] === b[1] && (y === domain.bounds.north || y === domain.bounds.south);
            return frame && sample(domain.shorelineClearanceNativeCells, domain.rows, domain.columns, domain.bounds, y, x) < 0;
          }
          if (a[1] > y !== b[1] > y && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
        }
        return yes;
      };
      return polygons.find((p) => point.column >= p.west && point.column <= p.east && point.row >= p.north && point.row <= p.south && inside(p.rings[0]) && !p.rings.slice(1).some(inside))?.body || null;
    }
    function baseDry(surface, point) {
      return !waterBodyAt(surface.waterDomain, point);
    }
    function waterOverlaps(surface, points) {
      const domain = surface.waterDomain;
      if (!domain.waterBodies.length) return false;
      if (!waterDomainCache.has(domain)) waterBodyAt(domain, points[0]);
      const box = polygonBounds(points), ring = points.map((p) => [p.column, p.row]);
      ring.push(ring[0]);
      return waterDomainCache.get(domain).some((p) => box.east > p.west && box.west < p.east && box.south > p.north && box.north < p.south && waterPolygonOverlap(p, box, ring));
    }
    // Exact shortcut: when no water edge comes near the footprint, the
    // footprint lies wholly inside or wholly outside that water polygon.
    function waterPolygonOverlap(p, box, ring) {
      if (!p.edgeIndex) {
        const size = M.max(p.east - p.west, p.south - p.north) / 64 || 1, bins = new Map();
        for (const r of p.rings) for (let i = 1; i < r.length; i++) {
          const a = r[i - 1], b = r[i], e = { west: M.min(a[0], b[0]), east: M.max(a[0], b[0]), north: M.min(a[1], b[1]), south: M.max(a[1], b[1]) };
          for (let y = M.floor((e.north - p.north) / size); y <= M.floor((e.south - p.north) / size); y++) for (let x = M.floor((e.west - p.west) / size); x <= M.floor((e.east - p.west) / size); x++) {
            const key = x + "," + y;
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key).push(e);
          }
        }
        p.edgeIndex = { size, bins };
      }
      const { size, bins } = p.edgeIndex, pad = (box.east - box.west + box.south - box.north) * 0.01 + 1e-9;
      let near = false;
      for (let y = M.floor((box.north - pad - p.north) / size); y <= M.floor((box.south + pad - p.north) / size) && !near; y++) for (let x = M.floor((box.west - pad - p.west) / size); x <= M.floor((box.east + pad - p.west) / size) && !near; x++) {
        for (const e of bins.get(x + "," + y) || []) if (e.east >= box.west - pad && e.west <= box.east + pad && e.south >= box.north - pad && e.north <= box.south + pad) { near = true; break; }
      }
      if (near) return import_polygon_clipping.default.intersection([ring], p.rings).length > 0;
      const cx = (box.west + box.east) / 2, cy = (box.north + box.south) / 2, inside = (r) => {
        let hit = false;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const [xi, yi] = r[i], [xj, yj] = r[j];
          if (yi > cy !== yj > cy && cx < (xj - xi) * (cy - yi) / (yj - yi) + xi) hit = !hit;
        }
        return hit;
      };
      return inside(p.rings[0]) && !p.rings.slice(1).some(inside);
    }
    function shorelineClearanceAt(surface, point) {
      const d = surface.waterDomain, v = sample(d.shorelineClearanceNativeCells, d.rows, d.columns, d.bounds, point.row, point.column);
      return baseDry(surface, point) ? M.abs(v) : -M.abs(v);
    }
    function isDry(surface, point) {
      return baseDry(surface, point) && (!surface.lakeDepths || elevationAt(surface, point, surface.lakeDepths) < 0);
    }
    const meshShoreClearance = /* @__PURE__ */ new WeakMap();
    function* surfaceTriangles(surface, box = surface.bounds) {
      const b = surface.bounds, n = surface.columns, m = surface.rows, dx = (b.east - b.west) / (n - 1), dy = (b.south - b.north) / (m - 1), x0 = clamp(M.floor((box.west - b.west) / dx), 0, n - 2), x1 = clamp(M.floor((box.east - b.west) / dx), 0, n - 2), y0 = clamp(M.floor((box.north - b.north) / dy), 0, m - 2), y1 = clamp(M.floor((box.south - b.north) / dy), 0, m - 2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const field = surface.lakeTerrain?.find((f) => x >= f.nativeBounds.west && x < f.nativeBounds.east && y >= f.nativeBounds.north && y < f.nativeBounds.south), grid = field || surface, s = field ? field.subdivisions : 1, firstX = field ? (x - field.nativeBounds.west) * s : x, firstY = field ? (y - field.nativeBounds.north) * s : y, gx = (grid.bounds.east - grid.bounds.west) / (grid.columns - 1), gy = (grid.bounds.south - grid.bounds.north) / (grid.rows - 1), at = (i) => {
          const point = { column: grid.bounds.west + i % grid.columns * gx, row: grid.bounds.north + M.floor(i / grid.columns) * gy };
          let cached = meshShoreClearance.get(grid);
          if (!cached) {
            cached = new Float64Array(grid.rows * grid.columns).fill(NaN);
            meshShoreClearance.set(grid, cached);
          }
          if (Number.isNaN(cached[i])) cached[i] = shorelineClearanceAt(surface, point);
          return { ...point, height: grid.elevationMetres[i], clearance: cached[i], depth: field ? elevationAt(surface, point, surface.lakeDepths) : surface.lakeDepths?.[i] ?? -1e3 };
        };
        const startX = M.max(firstX, M.floor((box.west - grid.bounds.west) / gx)), endX = M.min(firstX + s - 1, M.floor((box.east - grid.bounds.west) / gx)), startY = M.max(firstY, M.floor((box.north - grid.bounds.north) / gy)), endY = M.min(firstY + s - 1, M.floor((box.south - grid.bounds.north) / gy));
        for (let row = startY; row <= endY; row++) for (let column = startX; column <= endX; column++) {
          const i = row * grid.columns + column;
          yield [i, i + 1, i + grid.columns + 1].map(at);
          yield [i, i + grid.columns + 1, i + grid.columns].map(at);
        }
      }
    }
    function generate(recipe, context, { seed } = {}) {
      if (!context || context.schema !== "city-site-context-v2" || !Number.isSafeInteger(seed)) {
        throw new TypeError("City terrain needs its saved metre context and a generation seed");
      }
      const count = context.rows * context.columns;
      if (!Array.isArray(context.elevationMetres) || context.elevationMetres.length !== count || !context.elevationMetres.every(Number.isFinite) || !Array.isArray(context.water) || context.water.length !== count || !Array.isArray(context.shorelineClearanceNativeCells) || context.shorelineClearanceNativeCells.length !== count || !context.shorelineClearanceNativeCells.every(Number.isFinite) || !Array.isArray(context.waterBodies)) {
        throw new TypeError("Invalid saved city terrain samples");
      }
      seed >>>= 0;
      const character = window.WorldAtlasCityCharacter.profile(recipe);
      if (character.settlementRadiusKm) {
        const ratio = character.settlementRadiusKm / recipe.urban.radiusKm;
        recipe = { ...recipe, urban: {
          ...recipe.urban,
          radiusKm: character.settlementRadiusKm,
          radiusRows: recipe.urban.radiusRows * ratio,
          radiusColumns: recipe.urban.radiusColumns * ratio,
          coreZones: (recipe.urban.coreZones || []).map((zone) => ({
            ...zone,
            row: recipe.location.row + (zone.row - recipe.location.row) * ratio,
            column: recipe.location.column + (zone.column - recipe.location.column) * ratio,
            radiusKm: zone.radiusKm * ratio
          })),
          streetWidthsMetres: character.small ? {
            arterial: M.min(4.5, recipe.urban.streetWidthsMetres?.arterial || 4.5),
            collector: M.min(3, recipe.urban.streetWidthsMetres?.collector || 3),
            local: M.min(1.8, recipe.urban.streetWidthsMetres?.local || 1.8)
          } : recipe.urban.streetWidthsMetres
        } };
      }
      recipe = { ...recipe, seed };
      const SIZE = recipe.harbor || context.source.kind === "river" && context.source.referenceWidthMetres >= 18 || context.radiusKm / M.max(0.15, recipe.urban.radiusKm) > 10 ? 129 : 65;
      const bounds = { ...context.bounds }, metric = context.gridCellKilometres;
      const waterDomain = {
        bounds,
        rows: context.rows,
        columns: context.columns,
        shorelineClearanceNativeCells: context.shorelineClearanceNativeCells,
        waterBodies: context.waterBodies
      };
      const center = recipe.location, radiusKm = context.radiusKm;
      let cityRadius = recipe.urban.radiusKm;
      let form = landform(recipe, context);
      const widthKm = (bounds.east - bounds.west) * metric.column;
      const heightKm = (bounds.south - bounds.north) * metric.row;
      const stepKm = M.max(widthKm, heightKm) / (SIZE - 1);
      const elevation = [], parent = [], land = [], coordinates = [];
      const phase = random(seed, 17) * M.PI * 2;
      const parentRange = M.max(...context.elevationMetres) - M.min(...context.elevationMetres);
      const amplitude = clamp(8 + parentRange * 0.12, 8, 90);
      for (let row = 0; row < SIZE; row++) for (let column = 0; column < SIZE; column++) {
        const u = column / (SIZE - 1), v = row / (SIZE - 1);
        const point = { row: bounds.north + v * (bounds.south - bounds.north), column: bounds.west + u * (bounds.east - bounds.west) };
        const original = sample(context.elevationMetres, context.rows, context.columns, bounds, point.row, point.column);
        const dry = baseDry({ waterDomain }, point);
        const envelope = M.sin(M.PI * u) ** 2 * M.sin(M.PI * v) ** 2;
        let detail = amplitude * envelope * (M.sin(u * 7.2 + phase) * M.cos(v * 5.4 - phase) * 0.65 + M.sin(u * 13.1 + v * 9.5 + phase * 2) * 0.22 + M.sin(u * 26.3 - phase) * M.cos(v * 22.7 + phase) * 0.09 + M.sin(u * 42.4 + v * 33.5 - phase) * 0.04);
        const x = (point.column - center.column) * metric.column, y = (point.row - center.row) * metric.row, across = -M.sin(form.axisRadians) * x + M.cos(form.axisRadians) * y;
        if (form.kind === "valley") detail += envelope * M.min(90, parentRange * 0.22) * (1 - M.exp(-((across / M.max(0.25, cityRadius * 0.38)) ** 2)));
        if (form.kind === "ridge") detail += envelope * M.min(60, parentRange * 0.12) * M.exp(-((across / M.max(0.3, cityRadius * 0.42)) ** 2));
        const clearance = sample(context.shorelineClearanceNativeCells, context.rows, context.columns, bounds, point.row, point.column) * M.min(metric.row, metric.column) * 1e3;
        elevation.push(dry ? original + detail * M.min(1, M.abs(clearance) / 35) : original);
        parent.push(original);
        land.push(dry);
        coordinates.push(point);
      }
      if (!land.some(Boolean)) throw new RangeError("\u5DF2\u4FDD\u5B58\u7684\u57CE\u5E02\u8303\u56F4\u6CA1\u6709\u53EF\u7528\u9646\u5730\uFF0C\u8BF7\u6838\u5BF9\u771F\u5B9E\u57CE\u5E02\u951A\u70B9\u4E0E\u6C34\u57DF\u8303\u56F4");
      const coastal = { refined: false, setting: recipe.harbor?.setting || "open-coast", islands: [] };
      const source = context.source;
      const groundwater = source.kind === "groundwater";
      const riverMode = !groundwater && recipe.siteType === "river-city" && recipe.population?.estimate >= 3e3 && ["plain", "hills", "valley"].includes(form.kind) && random(seed, 403) > 0.32 ? "through" : "edge";
      const channels = [], confluences = [];
      let lakes = [], lakeTerrain = [], waterMask = new Array(SIZE * SIZE).fill(0), lakeDepths = new Array(SIZE * SIZE).fill(-1e3);
      if (!groundwater) {
        let dx = (source.location.column - center.column) * metric.column;
        let dy = (source.location.row - center.row) * metric.row;
        if (M.hypot(dx, dy) < 1e-3) {
          dx = sample(elevation, SIZE, SIZE, bounds, center.row, bounds.west) - sample(elevation, SIZE, SIZE, bounds, center.row, bounds.east);
          dy = sample(elevation, SIZE, SIZE, bounds, bounds.north, center.column) - sample(elevation, SIZE, SIZE, bounds, bounds.south, center.column);
        }
        const length2 = M.hypot(dx, dy) || 1;
        if (M.hypot(dx, dy) < 1e-3) {
          dx = M.cos(phase);
          dy = M.sin(phase);
        } else {
          dx /= length2;
          dy /= length2;
        }
        if (form.kind === "valley") {
          dx = M.cos(form.axisRadians);
          dy = M.sin(form.axisRadians);
        }
        const extent = M.hypot(widthKm, heightKm);
        const roadSide = (recipe.transport.corridors || []).filter((route) => route.kind === "road").reduce((sum, route) => sum + route.points.reduce((total, p) => total + (p.column - center.column) * metric.column * dy - (p.row - center.row) * metric.row * dx, 0), 0);
        const bank = roadSide > 0 ? -1 : 1;
        const terrain = { rows: SIZE, columns: SIZE, bounds, elevationMetres: elevation, waterDomain };
        const points = riverCourse(terrain, metric, center, {
          dx,
          dy,
          extent,
          stepKm,
          cityRadius,
          form,
          riverMode,
          bank,
          harbor: recipe.harbor,
          referenceWidthMetres: source.referenceWidthMetres || 0.5 * M.sqrt(radiusKm * radiusKm * 0.6),
          phase
        });
        const runs = landRuns(points, terrain, metric, stepKm);
        for (let run of runs) {
          if (Number.isFinite(run[0].mouthHeadMetres) && Number.isFinite(run.at(-1).mouthHeadMetres)) {
            const summit = run.reduce((best, p, i) => p.elevationMetres > run[best].elevationMetres ? i : best, 0);
            const left = run.slice(0, summit + 1).reverse(), right = run.slice(summit);
            run = distanceToLine(center, left, metric).distance < distanceToLine(center, right, metric).distance ? left : right;
          } else if (run[0].elevationMetres < run.at(-1).elevationMetres) run.reverse();
          if (run.length < 2) continue;
          let previous = Infinity;
          const reference = M.max(2, source.referenceWidthMetres || 0.5 * M.sqrt(radiusKm * radiusKm * 0.6));
          for (let i = 0; i < run.length; i++) {
            const p = run[i], t = i / (run.length - 1), z = elevationAt(terrain, p), ahead = run[M.min(run.length - 1, i + 1)], behind = run[M.max(0, i - 1)], reach = M.hypot((ahead.column - behind.column) * metric.column, (ahead.row - behind.row) * metric.row), grade = M.abs(ahead.elevationMetres - behind.elevationMetres) / M.max(1, reach * 1e3), confinement = clamp(1 - grade * 2.5, 0.55, 1.12), mouth = Number.isFinite(run.at(-1).mouthHeadMetres) ? 1 + M.exp(-(((1 - t) / 0.1) ** 2)) * 0.6 : 1;
            p.widthMetres = reference * (0.8 + 0.24 * t) * confinement * mouth * (1 + 0.1 * M.sin(t * 12 + phase) + 0.035 * M.sin(t * 29 - phase));
            p.elevationMetres = Number.isFinite(p.mouthHeadMetres) ? p.mouthHeadMetres : M.min(z - M.min(4, M.abs(z) * 0.12), previous);
            previous = p.elevationMetres;
          }
          channels.push({
            points: run,
            widthMetres: M.max(...run.map((p) => p.widthMetres)),
            kind: source.kind === "river" ? "river" : "stream",
            widthModel: "catchment-reference-with-local-confinement",
            mouth: Number.isFinite(run.at(-1).mouthHeadMetres)
          });
        }
        if (source.kind === "river" && recipe.population?.estimate >= 3e3 && random(seed, 2318) > 0.42) {
          const junction = tributary(channels, elevation, SIZE, bounds, metric, center, cityRadius, seed, waterDomain);
          if (junction) confluences.push(junction);
        }
        const reservoirs = basinLakes(elevation, SIZE, bounds, metric, channels, center, cityRadius, waterDomain), reservoirSurface = { rows: SIZE, columns: SIZE, bounds, elevationMetres: elevation, waterDomain, lakeDepths: reservoirs.lakeDepths, lakeTerrain: reservoirs.lakeTerrain };
        for (const channel of channels) {
          for (const lake of reservoirs.lakes) for (const p of channel.points) if (elevationAt(reservoirSurface, p, reservoirs.lakeDepths) > 0 && M.hypot((p.column - lake.anchor.column) * metric.column, (p.row - lake.anchor.row) * metric.row) < M.sqrt(lake.areaKm2) * 2)
            p.elevationMetres = M.max(p.elevationMetres, lake.spillElevationMetres);
          for (let i = channel.points.length - 2; i >= 0; i--) channel.points[i].elevationMetres = M.max(channel.points[i].elevationMetres, channel.points[i + 1].elevationMetres);
        }
        const drainage = channels.flatMap((ch) => ch.points);
        const valleyWidthKm = M.max(0.09, cityRadius * 0.18);
        for (let index = 0; index < elevation.length; index++) {
          if (!land[index] || waterMask[index] || !drainage.length) continue;
          const point = coordinates[index], near = channels.map((ch) => distanceToLine(point, ch.points, metric)).reduce((a, b) => a.distance < b.distance ? a : b);
          const u = (point.column - bounds.west) / (bounds.east - bounds.west), v = (point.row - bounds.north) / (bounds.south - bounds.north);
          const envelope = M.sin(M.PI * u) ** 2 * M.sin(M.PI * v) ** 2;
          const valley = M.exp(-((near.distance / valleyWidthKm) ** 2)) * M.min(1, envelope * 4);
          elevation[index] = elevation[index] - M.max(0, elevation[index] - near.elevation) * valley;
        }
        terrain.elevationMetres = elevation.map((z) => M.round(z * 100) / 100);
        const clipped = channels.flatMap((ch, sourceIndex) => landRuns(ch.points, terrain, metric, stepKm).map((run) => ({ sourceIndex, channel: { ...ch, points: run, mouth: Number.isFinite(run.at(-1).mouthHeadMetres) } }))), bindings = [];
        for (const junction of confluences) {
          const tributaryChannel = clipped.findIndex((part) => part.sourceIndex === junction.tributaryChannel && M.hypot(
            (part.channel.points.at(-1).column - junction.anchor.column) * metric.column,
            (part.channel.points.at(-1).row - junction.anchor.row) * metric.row
          ) < 1e-6);
          if (tributaryChannel < 0) continue;
          const anchor = clipped[tributaryChannel].channel.points.at(-1), mainChannel = clipped.findIndex((part) => part.sourceIndex === junction.mainChannel && distanceToLine(anchor, part.channel.points, metric).distance < 1e-6);
          if (mainChannel >= 0) bindings.push({ anchor: { ...anchor }, mainChannel, tributaryChannel });
        }
        channels.splice(0, channels.length, ...clipped.map((part) => part.channel));
        confluences.splice(0, confluences.length, ...bindings);
        ({ lakes, waterMask, lakeDepths, lakeTerrain } = basinLakes(terrain.elevationMetres, SIZE, bounds, metric, channels, center, cityRadius, waterDomain));
      }
      const buildable = [], slopes = [], roadBuildable = [];
      for (let row = 0; row < SIZE; row++) for (let column = 0; column < SIZE; column++) {
        const index = row * SIZE + column;
        const gradientX = (elevation[row * SIZE + M.min(SIZE - 1, column + 1)] - elevation[row * SIZE + M.max(0, column - 1)]) / (widthKm / (SIZE - 1) * 2e3);
        const gradientY = (elevation[M.min(SIZE - 1, row + 1) * SIZE + column] - elevation[M.max(0, row - 1) * SIZE + column]) / (heightKm / (SIZE - 1) * 2e3);
        const slope = M.hypot(gradientX, gradientY);
        const floodplain = channels.some((channel) => {
          const near = distanceToLine(coordinates[index], channel.points, metric);
          return near.distance < M.max(near.widthMetres / 1e3 * 1.5, stepKm * 0.72);
        });
        land[index] = land[index] && !waterMask[index];
        slopes.push(slope);
        buildable.push(Number(land[index] && slope < 0.2 && !floodplain));
        roadBuildable.push(Number(land[index] && slope < 0.65));
      }
      const surface = { rows: SIZE, columns: SIZE, bounds, waterDomain, elevationMetres: elevation.map((value) => M.round(value * 100) / 100), slopes, buildable, roadBuildable, waterMask, lakeDepths, lakeTerrain };
      form = settlementLandform(form, surface, recipe, metric);
      if (channels.length && ["hillside", "valley", "ridge"].includes(form.kind)) {
        const ch = channels.reduce((a2, b) => a2.points.length > b.points.length ? a2 : b), a = ch.points[0], z = ch.points.at(-1);
        form.kind = "valley";
        form.axisRadians = M.atan2((z.row - a.row) * metric.row, (z.column - a.column) * metric.column);
        form.crossScale = 0.27;
        form.alongScale = 1.75;
        form.label = "\u6CBF\u6CB3\u8C37\u4E0E\u6CB3\u5CB8\u53F0\u5730";
      } else if (channels.length && !recipe.harbor && !["fortress", "pass", "oasis"].includes(recipe.siteType)) {
        const ch = channels.reduce((a2, b) => a2.points.length > b.points.length ? a2 : b), a = ch.points[0], z = ch.points.at(-1);
        form.axisRadians = M.atan2((z.row - a.row) * metric.row, (z.column - a.column) * metric.column);
        form.label = "\u6CB3\u5CB8" + (form.kind === "plain" ? "\u5E73\u539F" : "\u7F13\u5761\u53F0\u5730");
      }
      let settlementCapacity = null;
      if (!character.mobile && recipe.citySettings?.streetPattern !== "grid" && character.settlementRadiusKm) {
        settlementCapacity = inhabitedExtent(recipe, surface, channels, form, metric, character);
        if (settlementCapacity.radiusKm !== cityRadius) {
          const ratio = settlementCapacity.radiusKm / cityRadius;
          recipe = { ...recipe, urban: {
            ...recipe.urban,
            radiusKm: settlementCapacity.radiusKm,
            radiusRows: recipe.urban.radiusRows * ratio,
            radiusColumns: recipe.urban.radiusColumns * ratio,
            coreZones: (recipe.urban.coreZones || []).map((zone) => ({
              ...zone,
              row: center.row + (zone.row - center.row) * ratio,
              column: center.column + (zone.column - center.column) * ratio,
              radiusKm: zone.radiusKm * ratio
            }))
          } };
          cityRadius = settlementCapacity.radiusKm;
        }
      }
      if (recipe.harbor) {
        const saved = recipe.harbor, n = saved.outward, at = (d) => ({ column: saved.shore.column + n.x * d / metric.column, row: saved.shore.row + n.y * d / metric.row }), z = (d) => isDry(surface, at(d));
        let low = -M.max(0.6, stepKm * 2, saved.distanceKm * 0.8), high = M.max(0.6, stepKm * 2);
        if (z(low) && !z(high)) {
          for (let k = 0; k < 24; k++) {
            const mid = (low + high) / 2;
            if (z(mid)) low = mid;
            else high = mid;
          }
          const shift = (low + high) / 2, shore = at(shift);
          let outward = n, closest = Infinity;
          if (saved.kind === "sea") for (const body of surface.waterDomain.waterBodies) {
            if (body.kind !== "sea") continue;
            const polygons = body.geometry.type === "Polygon" ? [body.geometry.coordinates] : body.geometry.coordinates;
            for (const rings of polygons) for (const ring of rings) for (let i = 1; i < ring.length; i++) {
              const a = ring[i - 1], b = ring[i], dx = (b[0] - a[0]) * metric.column, dy = (b[1] - a[1]) * metric.row, length2 = M.hypot(dx, dy);
              if (length2 < 1e-10) continue;
              const x = (shore.column - a[0]) * metric.column, y = (shore.row - a[1]) * metric.row, u = clamp((x * dx + y * dy) / (length2 * length2), 0, 1), distance = M.hypot(x - dx * u, y - dy * u);
              if (distance >= closest) continue;
              const probe = {
                column: a[0] + dx * u / metric.column - dy / length2 * 1e-3 / metric.column,
                row: a[1] + dy * u / metric.row + dx / length2 * 1e-3 / metric.row
              };
              closest = distance;
              const sign = baseDry(surface, probe) ? -1 : 1;
              outward = { x: -dy / length2 * sign, y: dx / length2 * sign };
            }
          }
          const fromShore = (d) => ({ column: shore.column + outward.x * d / metric.column, row: shore.row + outward.y * d / metric.row }), landPoint = fromShore(-0.07), seaPoint = fromShore(0.12), harbor = {
            ...saved,
            shore,
            outward,
            landPoint,
            seaPoint,
            setting: coastal.setting,
            access: [center, landPoint]
          };
          if (saved.sailing?.length) {
            const a = seaPoint, z2 = saved.sailing[0], wet = Array.from({ length: 33 }, (_, i) => interpolate(a, z2, i / 32)).every((p) => !isDry(surface, p));
            harbor.sailing = wet ? [seaPoint, ...saved.sailing] : [];
          }
          recipe = { ...recipe, harbor, transport: { ...recipe.transport, corridors: recipe.transport.corridors.map((route) => route.id === recipe.id + "-harbor-access" ? { ...route, points: harbor.access } : route) } };
        }
      }
      if (!recipe.harbor && source.kind === "river" && recipe.population?.estimate >= 3e3) {
        const harbor = inlandHarbor(recipe, surface, channels, confluences, metric);
        if (harbor) recipe = { ...recipe, harbor, transport: { ...recipe.transport, corridors: [
          ...recipe.transport.corridors,
          { id: recipe.id + "-harbor-access", kind: "road", points: harbor.access }
        ] } };
      }
      if (recipe.harbor) {
        const h = recipe.harbor, n = h.outward, t = { x: -n.y, y: n.x }, factor = clamp(M.sqrt(recipe.population.estimate / 22e3), 0.34, 1.8), capacity = M.max(1, M.min(7, M.round(M.sqrt(recipe.population.estimate / 1600)))), span = recipe.population.estimate < 1800 ? 0.1 : 0.22 + capacity * 0.016, at = (x, y) => ({ column: h.shore.column + (t.x * x + n.x * y) * factor / metric.column, row: h.shore.row + (t.y * x + n.y * y) * factor / metric.row });
        const half = span + 0.05;
        let landward = -0.08, seaward = 0.012;
        if (h.kind === "sea") for (let i = 0; i <= 16; i++) {
          const x = (i / 8 - 1) * half, reach = M.max(0.3, half * 2);
          let low = -reach, high = reach;
          if (!isDry(surface, at(x, low)) || isDry(surface, at(x, high))) continue;
          for (let k = 0; k < 22; k++) {
            const y = (low + high) / 2;
            if (isDry(surface, at(x, y))) low = y;
            else high = y;
          }
          landward = M.min(landward, low - 0.08);
          seaward = M.max(seaward, high + 0.012);
        }
        recipe = { ...recipe, harbor: {
          ...h,
          berthLayout: { scale: factor, capacity, span },
          reservedLand: [[-half, landward], [-half, seaward], [half, seaward], [half, landward]].map(([x, y]) => at(x, y))
        } };
      }
      const relief = contourPaths(elevation, land, surface);
      const waterSource = groundwater ? { kind: "groundwater", label: recipe.siteType === "oasis" ? "\u7EFF\u6D32\u4E95\u6CC9" : "\u5C71\u6CC9\u4E0E\u4E95\u6C34", location: { ...center } } : {
        kind: source.kind === "lake" ? "lake" : source.kind === "river" ? "tributary" : "spring-fed-stream",
        label: source.kind === "lake" ? "\u6E56\u6CCA\u4E0E\u6EAA\u6D41\u4F9B\u6C34" : source.kind === "river" ? "\u6CB3\u8C37\u652F\u6D41\u4F9B\u6C34" : "\u5C71\u6CC9\u6EAA\u6D41\u4F9B\u6C34",
        location: channels.length ? channels[0].points[M.floor(channels[0].points.length / 2)] : { ...center }
      };
      if (riverMode === "through" && channels.length) {
        const line = channels[0].points, a = line[0], b = line.at(-1), dx = (b.column - a.column) * metric.column, dy = (b.row - a.row) * metric.row, len = M.hypot(dx, dy), across = { x: -dy / len, y: dx / len };
        const points = [-1, 1].map((sign) => ({
          column: center.column + across.x * cityRadius * 1.4 * sign / metric.column,
          row: center.row + across.y * cityRadius * 1.4 * sign / metric.row
        }));
        recipe = { ...recipe, transport: { ...recipe.transport, corridors: [...recipe.transport.corridors, { id: "urban-river-spine", kind: "road", points }] } };
      }
      const bridges = crossings(recipe, surface, context, channels);
      let streetPlan = window.WorldAtlasCities.streetNetwork({
        ...recipe,
        localSite: { schema: "city-local-site-v1", form, riverMode, surface, channels, bridges, settlementCapacity }
      });
      if (settlementCapacity) {
        const cross = (a, b) => (a.column - center.column) * metric.column * (b.row - center.row) * metric.row - (b.column - center.column) * metric.column * (a.row - center.row) * metric.row, area = (plan) => plan.wallSpans.length ? M.abs(plan.wallSpans.reduce((sum, [a, b]) => sum + cross(a, b), 0)) / 2 : plan.districts.reduce((sum, polygon) => sum + M.abs(polygon.reduce((value, p, i) => value + cross(p, polygon[(i + 1) % polygon.length]), 0)) / 2, 0);
        for (let attempt = 0; attempt < 2; attempt++) {
          const usable = area(streetPlan);
          if (usable >= settlementCapacity.requiredAreaKm2 - 1e-9 || cityRadius >= settlementCapacity.maximumRadiusKm) break;
          const fitted = M.min(settlementCapacity.maximumRadiusKm, usable > 0 ? cityRadius * M.sqrt(settlementCapacity.requiredAreaKm2 / usable) : settlementCapacity.maximumRadiusKm), ratio = fitted / cityRadius;
          recipe = { ...recipe, urban: {
            ...recipe.urban,
            radiusKm: fitted,
            radiusRows: recipe.urban.radiusRows * ratio,
            radiusColumns: recipe.urban.radiusColumns * ratio,
            coreZones: (recipe.urban.coreZones || []).map((zone) => ({
              ...zone,
              row: center.row + (zone.row - center.row) * ratio,
              column: center.column + (zone.column - center.column) * ratio,
              radiusKm: zone.radiusKm * ratio
            }))
          } };
          cityRadius = fitted;
          streetPlan = window.WorldAtlasCities.streetNetwork({
            ...recipe,
            localSite: { schema: "city-local-site-v1", form, riverMode, surface, channels, bridges, settlementCapacity }
          });
        }
        const usableAreaKm2 = area(streetPlan);
        settlementCapacity = {
          ...settlementCapacity,
          radiusKm: cityRadius,
          estimatedUsableAreaKm2: settlementCapacity.usableAreaKm2,
          usableAreaKm2,
          capacityAtTargetDensity: M.floor(usableAreaKm2 * settlementCapacity.inhabitedDensityPeoplePerKm2 + 1e-6),
          limited: usableAreaKm2 < settlementCapacity.requiredAreaKm2 - 1e-9
        };
      }
      const network = ruralNetwork(recipe, surface, slopes, channels, metric, seed, bridges, streetPlan, form), ruralRoads = network.ruralRoads;
      const approaches = [...network.corridors, ...ruralRoads].filter((route) => route.kind === "road");
      const usedGates = new Set(streetPlan.gates.filter((gate) => gate.layer === "inner" || approaches.some((route) => distanceToLine(gate.center, route.points, metric).distance <= gate.widthKm)).map((gate) => gate.id));
      streetPlan.gates = streetPlan.gates.filter((gate) => usedGates.has(gate.id));
      streetPlan.gateStreets = streetPlan.gateStreets.filter((street) => usedGates.has(street.id));
      recipe = { ...recipe, transport: { ...recipe.transport, corridors: network.corridors } };
      if (recipe.harbor) {
        const route = network.corridors.find((r) => (r.sourceId || r.id) === recipe.id + "-harbor-access");
        recipe = { ...recipe, harbor: { ...recipe.harbor, access: route?.points || [] } };
      }
      const roadRecipe = { ...recipe, localSite: {
        form,
        ruralSettlements: network.ruralSettlements,
        railwayStations: network.railwayStations,
        urbanEnclosures: character.small && recipe.citySettings?.streetPattern !== "grid" ? [] : streetPlan.enclosures,
        domesticLanes: streetPlan.streets.filter((street) => street.village)
      }, transport: { ...recipe.transport, corridors: [...network.corridors, ...ruralRoads] } };
      const farmland = network.farmland;
      const localSite = {
        schema: "city-local-site-v1",
        bounds,
        radiusKm,
        form,
        riverMode,
        ...relief,
        coastal,
        channels,
        lakes,
        confluences,
        waterSource,
        surface,
        ...settlementCapacity ? { settlementCapacity } : {},
        gateStreets: streetPlan.gateStreets,
        gates: streetPlan.gates,
        enclosures: streetPlan.enclosures,
        wallSpans: streetPlan.wallSpans,
        innerEnclosures: streetPlan.innerEnclosures,
        innerWallSpans: streetPlan.innerWallSpans,
        reservedCompounds: streetPlan.reservedCompounds,
        latitudeDegrees: context.latitudeDegrees,
        railwayStations: network.railwayStations,
        railwayStatus: network.railwayStatus,
        farmland,
        ruralRoads,
        ruralSettlements: network.ruralSettlements,
        bridges,
        ...landscape(roadRecipe, surface, slopes, coordinates, land, seed, farmland, channels),
        model: { kind: "generated-local-refinement", parent: "saved-world-metre-terrain", boundaryBlended: true, coastlinePreserved: !coastal.refined }
      };
      localSite.annotations = geographicNames(recipe, context, localSite, metric);
      return { ...recipe, seed, localSite };
    }
    function interpolate(a, b, t) {
      return {
        row: a.row + (b.row - a.row) * t,
        column: a.column + (b.column - a.column) * t,
        elevationMetres: (a.elevationMetres || 0) + (b.elevationMetres - a.elevationMetres || 0) * t,
        widthMetres: (a.widthMetres || 0) + ((b.widthMetres || 0) - (a.widthMetres || 0)) * t
      };
    }
    function inhabitedExtent(recipe, surface, channels, form, metric, character) {
      const planning = window.WorldAtlasCityCharacter.profile({ ...recipe, localSite: { ...recipe.localSite, form } });
      const c = recipe.location, cos = M.cos(form.axisRadians), sin = M.sin(form.axisRadians), samples = [], household = character.small && !character.mobile && recipe.citySettings?.streetPattern !== "grid", rectangular = planning.rectangular, envelope = household || planning.regular ? 1 : 0.78, along = form.alongScale * envelope, across = form.crossScale * envelope, areaScale = (rectangular ? 4 : M.PI) * along * across, xReach = M.abs(cos) * form.alongScale + M.abs(sin) * form.crossScale, yReach = M.abs(sin) * form.alongScale + M.abs(cos) * form.crossScale, maximum = M.min(
        (c.column - surface.bounds.west) * metric.column / xReach,
        (surface.bounds.east - c.column) * metric.column / xReach,
        (c.row - surface.bounds.north) * metric.row / yReach,
        (surface.bounds.south - c.row) * metric.row / yReach
      ), minimum = M.min(recipe.urban.radiusKm, maximum), inhabitedDensityPeoplePerKm2 = household ? 5e3 : character.eraPlan?.industrial ? 17e3 : character.inhabitedDensity || 1e4, required = recipe.population.estimate / inhabitedDensityPeoplePerKm2;
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
        const u = (x + 0.5) / 24 - 1, v = (y + 0.5) / 24 - 1;
        if (rectangular || u * u + v * v <= 1) samples.push([u * along, v * across]);
      }
      const available = (radius) => areaScale * radius * radius * samples.filter(([x, y]) => {
        const p = { column: c.column + (cos * x - sin * y) * radius / metric.column, row: c.row + (sin * x + cos * y) * radius / metric.row };
        return isDry(surface, p) && sample(surface.slopes, surface.rows, surface.columns, surface.bounds, p.row, p.column) < 0.2 && !channels.some((channel) => {
          const near = distanceToLine(p, channel.points, metric);
          return near.distance < near.widthMetres / 2e3 + 3e-3;
        });
      }).length / samples.length;
      let fitted = minimum;
      if (available(minimum) < required) {
        if (available(maximum) < required) fitted = maximum;
        else {
          let low = minimum, high = maximum;
          for (let i = 0; i < 8; i++) {
            const mid = (low + high) / 2;
            if (available(mid) < required) low = mid;
            else high = mid;
          }
          fitted = high;
        }
      }
      const usableAreaKm2 = available(fitted);
      return {
        radiusKm: fitted,
        requiredAreaKm2: required,
        usableAreaKm2,
        maximumRadiusKm: maximum,
        inhabitedDensityPeoplePerKm2,
        capacityAtTargetDensity: M.floor(usableAreaKm2 * inhabitedDensityPeoplePerKm2 + 1e-6),
        limited: usableAreaKm2 < required
      };
    }
    function inlandHarbor(recipe, surface, channels, confluences, metric) {
      const distance = (a, b) => M.hypot((a.column - b.column) * metric.column, (a.row - b.row) * metric.row), target = confluences[0]?.anchor || recipe.location;
      const candidates = channels.flatMap((channel) => channel.points.slice(1, -1).map((p, i) => ({ p, i: i + 1, channel }))).filter((c) => c.p.widthMetres >= 25).sort((a, b) => distance(a.p, target) - distance(b.p, target));
      for (const { p, i, channel } of candidates.slice(0, 24)) {
        if (distance(p, recipe.location) > recipe.urban.radiusKm * 1.7) continue;
        const a = channel.points[i - 1], z = channel.points[i + 1], dx = (z.column - a.column) * metric.column, dy = (z.row - a.row) * metric.row, len = M.hypot(dx, dy), half = p.widthMetres / 2e3;
        if (!len) continue;
        const bankSigns = [-1, 1].sort((first, last) => {
          const score = (sign) => distance({ column: p.column - dy / len * sign * (half + 0.035) / metric.column, row: p.row + dx / len * sign * (half + 0.035) / metric.row }, recipe.location);
          return score(first) - score(last);
        });
        for (const sign of bankSigns) {
          const outward = { x: dy / len * sign, y: -dx / len * sign }, at = (d) => ({ column: p.column - outward.x * d / metric.column, row: p.row - outward.y * d / metric.row }), shore = at(half), landPoint = at(half + 0.035), seaPoint = at(half * 0.25);
          if (!isDry(surface, landPoint) || channels.some((ch) => {
            const q = distanceToLine(landPoint, ch.points, metric);
            return q.distance < q.widthMetres / 2e3 + 0.015;
          })) continue;
          return {
            kind: "river",
            name: recipe.name.endsWith("\u57E0") ? recipe.name : recipe.name + "\u57E0",
            shore,
            landPoint,
            seaPoint,
            outward,
            setting: confluences.length ? "confluence" : "riverbank",
            shelter: 0.8,
            channelWidthMetres: p.widthMetres,
            distanceKm: distance(shore, recipe.location),
            access: [recipe.location, landPoint],
            sailing: []
          };
        }
      }
      return null;
    }
    function priorityQueue() {
      const heap = [];
      return { get length() {
        return heap.length;
      }, put(index, cost) {
        let i = heap.length;
        heap.push([index, cost]);
        while (i) {
          const p = i - 1 >> 1;
          if (heap[p][1] <= cost) break;
          heap[i] = heap[p];
          i = p;
        }
        heap[i] = [index, cost];
      }, take() {
        const first = heap[0], last = heap.pop();
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let j = i * 2 + 1;
            if (j + 1 < heap.length && heap[j + 1][1] < heap[j][1]) j++;
            if (heap[j][1] >= last[1]) break;
            heap[i] = heap[j];
            i = j;
          }
          heap[i] = last;
        }
        return first;
      } };
    }
    function basinLakes(elevation, n, bounds, metric, channels, center, radius, waterDomain) {
      const fill = new Float64Array(n * n).fill(Infinity), queue = priorityQueue(), visited = new Uint8Array(n * n), waterMask = new Array(n * n).fill(0), lakeDepths = new Array(n * n).fill(-1e3), lakes = [];
      const dx = (bounds.east - bounds.west) * metric.column / (n - 1), dy = (bounds.south - bounds.north) * metric.row / (n - 1), at = (i) => ({ column: bounds.west + i % n / (n - 1) * (bounds.east - bounds.west), row: bounds.north + M.floor(i / n) / (n - 1) * (bounds.south - bounds.north) });
      const dry = (i) => baseDry({ waterDomain }, at(i));
      for (let i = 0; i < n * n; i++) if (i % n === 0 || i % n === n - 1 || i < n || i >= n * (n - 1) || !dry(i)) {
        fill[i] = elevation[i];
        queue.put(i, fill[i]);
      }
      while (queue.length) {
        const [i, h] = queue.take();
        if (h !== fill[i]) continue;
        const x = i % n, y = M.floor(i / n);
        for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          if (x + sx < 0 || x + sx >= n || y + sy < 0 || y + sy >= n) continue;
          const j = i + sy * n + sx, next = M.max(h, elevation[j]);
          if (next < fill[j]) {
            fill[j] = next;
            queue.put(j, next);
          }
        }
      }
      const candidates = Array.from({ length: n * n }, (_, i) => i).filter((i) => fill[i] - elevation[i] > 2.5 && dry(i)).sort((a, b) => fill[b] - elevation[b] - (fill[a] - elevation[a]));
      for (const seed of candidates) {
        if (visited[seed] || lakes.length >= 3) continue;
        const level = fill[seed] - 0.05, component = [seed];
        visited[seed] = 1;
        for (let k = 0; k < component.length; k++) {
          const i = component[k], x = i % n, y = M.floor(i / n);
          for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (x + sx <= 0 || x + sx >= n - 1 || y + sy <= 0 || y + sy >= n - 1) continue;
            const j = i + sy * n + sx;
            if (!visited[j] && dry(j) && elevation[j] < level) {
              visited[j] = 1;
              component.push(j);
            }
          }
        }
        const area = component.length * dx * dy, anchor = at(seed), distance = M.hypot((anchor.column - center.column) * metric.column, (anchor.row - center.row) * metric.row);
        if (area < 0.02 || area > 4 || distance < radius * 0.8 || distance > radius * 4.5 || !channels.some((ch) => distanceToLine(anchor, ch.points, metric).distance < M.max(dx, dy) * 2 + ch.widthMetres / 1e3)) continue;
        const cells = new Set(component);
        const spill = component.flatMap((i) => {
          const x = i % n, y = M.floor(i / n);
          return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([sx, sy]) => x + sx >= 0 && x + sx < n && y + sy >= 0 && y + sy < n).map(([sx, sy]) => i + sy * n + sx);
        }).filter((i) => !cells.has(i)).sort((a, b) => elevation[a] - elevation[b])[0];
        lakes.push({
          anchor,
          waterLevelMetres: level,
          spillElevationMetres: fill[seed],
          outlet: at(spill),
          areaKm2: area,
          maximumDepthMetres: level - elevation[seed],
          kind: "basin-lake",
          component,
          seed
        });
      }
      let lakeTerrain = refineLakeTerrain(elevation, n, bounds, lakes, waterDomain);
      const acceptedWater = new Map(lakeTerrain.map((field) => [field, new Uint8Array(field.rows * field.columns)]));
      for (const lake of lakes) {
        const field = lakeTerrain.find((f) => lake.seed % n >= f.nativeBounds.west && lake.seed % n <= f.nativeBounds.east && M.floor(lake.seed / n) >= f.nativeBounds.north && M.floor(lake.seed / n) <= f.nativeBounds.south), { columns, rows } = field, s = field.subdivisions, first = (M.floor(lake.seed / n) - field.nativeBounds.north) * s * columns + (lake.seed % n - field.nativeBounds.west) * s, level = M.min(lake.waterLevelMetres, field.spillHeights[first] - 0.05), wet = new Uint8Array(rows * columns), component = [first];
        wet[first] = 1;
        if (acceptedWater.get(field)[first] || level <= field.elevationMetres[first] + 2.5) {
          delete lake.component;
          delete lake.seed;
          continue;
        }
        for (let k = 0; k < component.length; k++) {
          const i = component[k], x = i % columns, y = M.floor(i / columns);
          for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (x + sx < 0 || x + sx >= columns || y + sy < 0 || y + sy >= rows) continue;
            const j = i + sy * columns + sx, z = field.elevationMetres[j];
            const point = { column: field.bounds.west + j % columns / (columns - 1) * (field.bounds.east - field.bounds.west), row: field.bounds.north + M.floor(j / columns) / (rows - 1) * (field.bounds.south - field.bounds.north) };
            if (!wet[j] && baseDry({ waterDomain }, point) && z < level) {
              wet[j] = 1;
              component.push(j);
            }
          }
        }
        const tiles = new Set(component.flatMap((i) => [i, i - 1, i - columns, i - columns - 1])), patches = [], depths = /* @__PURE__ */ new Map(), atFine = (i) => ({
          column: field.bounds.west + i % columns / (columns - 1) * (field.bounds.east - field.bounds.west),
          row: field.bounds.north + M.floor(i / columns) / (rows - 1) * (field.bounds.south - field.bounds.north)
        });
        let areaKm2 = 0, maximumDepthMetres = 0;
        for (const i of tiles) {
          if (i < 0 || i >= columns * (rows - 1) || i % columns === columns - 1) continue;
          for (const tri of [[i, i + 1, i + columns + 1], [i, i + columns + 1, i + columns]]) {
            const vertices = tri.map((j) => ({ ...atFine(j), value: wet[j] ? level - field.elevationMetres[j] : -M.max(1e-9, M.abs(field.elevationMetres[j] - level)) })), poly = [];
            for (let k = 0; k < 3; k++) {
              depths.set(tri[k], vertices[k].value);
              maximumDepthMetres = M.max(maximumDepthMetres, vertices[k].value);
              const a = vertices[k], b = vertices[(k + 1) % 3];
              if (a.value > 0) poly.push(a);
              if (a.value > 0 !== b.value > 0) poly.push(interpolate(a, b, a.value / (a.value - b.value)));
            }
            if (poly.length >= 3) {
              patches.push(poly);
              const p = poly[0];
              areaKm2 += M.abs(poly.reduce((sum, a, k) => {
                const b = poly[(k + 1) % poly.length];
                return sum + (a.column - p.column) * (b.row - p.row) - (b.column - p.column) * (a.row - p.row);
              }, 0)) * metric.column * metric.row / 2;
            }
          }
        }
        delete lake.component;
        delete lake.seed;
        if (areaKm2 < 0.02 || areaKm2 > 4) continue;
        for (const [i, depth] of depths) field.lakeDepths[i] = M.max(field.lakeDepths[i], depth);
        const covered = acceptedWater.get(field);
        for (const i of component) covered[i] = 1;
        lake.patches = patches;
        lake.areaKm2 = areaKm2;
        lake.maximumDepthMetres = maximumDepthMetres;
        lake.waterLevelMetres = level;
        lake.spillElevationMetres = level + 0.05;
      }
      lakeTerrain = lakeTerrain.filter((field) => field.lakeDepths.some((depth) => depth > 0));
      for (const field of lakeTerrain) {
        delete field.spillHeights;
        const b = field.nativeBounds, s = field.subdivisions;
        for (let y = b.north; y <= b.south; y++) for (let x = b.west; x <= b.east; x++) {
          const i = y * n + x, j = (y - b.north) * s * field.columns + (x - b.west) * s;
          lakeDepths[i] = M.max(lakeDepths[i], field.lakeDepths[j]);
          waterMask[i] = Number(lakeDepths[i] > 0);
        }
      }
      return { lakes: lakes.filter((lake) => lake.patches), waterMask, lakeDepths, lakeTerrain };
    }
    function refineLakeTerrain(elevation, n, bounds, lakes, waterDomain) {
      const regions = lakes.map((lake) => ({
        west: M.max(0, M.min(...lake.component.map((i) => i % n)) - 2),
        east: M.min(n - 1, M.max(...lake.component.map((i) => i % n)) + 2),
        north: M.max(0, M.min(...lake.component.map((i) => M.floor(i / n))) - 2),
        south: M.min(n - 1, M.max(...lake.component.map((i) => M.floor(i / n))) + 2)
      }));
      for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i], b = regions[j];
        if (a.east < b.west || b.east < a.west || a.south < b.north || b.south < a.north) continue;
        regions[i] = { west: M.min(a.west, b.west), east: M.max(a.east, b.east), north: M.min(a.north, b.north), south: M.max(a.south, b.south) };
        regions.splice(j, 1);
        i = -1;
        break;
      }
      const native = { columns: n, rows: n, bounds, elevationMetres: elevation }, at = (x, y) => ({ column: bounds.west + x / (n - 1) * (bounds.east - bounds.west), row: bounds.north + y / (n - 1) * (bounds.south - bounds.north) }), node = (x, y) => elevation[clamp(y, 0, n - 1) * n + clamp(x, 0, n - 1)], cubic = (a, b, c, d, t) => {
        const slope = (u, v2) => u * v2 <= 0 ? 0 : 2 * u * v2 / (u + v2), v = c - b, m0 = slope(b - a, v), m1 = slope(v, d - c), t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * c + (t3 - t2) * m1;
      };
      return regions.map((region) => {
        const subdivisions = 8, columns = (region.east - region.west) * subdivisions + 1, rows = (region.south - region.north) * subdivisions + 1, lo = at(region.west, region.north), hi = at(region.east, region.south), field = {
          columns,
          rows,
          subdivisions,
          nativeBounds: region,
          bounds: { west: lo.column, east: hi.column, north: lo.row, south: hi.row },
          elevationMetres: [],
          waterDomain,
          lakeDepths: new Array(rows * columns).fill(-1e3)
        };
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
          const x = region.west + column / subdivisions, y = region.north + row / subdivisions, i = M.floor(x), j = M.floor(y), u = x - i, v = y - j, z = cubic(...[-1, 0, 1, 2].map((d) => cubic(node(i - 1, j + d), node(i, j + d), node(i + 1, j + d), node(i + 2, j + d), u)), v), nativeHeight = elevationAt(native, at(x, y)), blend = clamp(M.min(x - region.west, region.east - x, y - region.north, region.south - y), 0, 1);
          field.elevationMetres.push(nativeHeight + (z - nativeHeight) * blend);
        }
        const heights = new Float64Array(rows * columns).fill(Infinity), queue = priorityQueue();
        for (let i = 0; i < heights.length; i++) if (i % columns === 0 || i % columns === columns - 1 || i < columns || i >= columns * (rows - 1) || !baseDry(field, { column: field.bounds.west + i % columns / (columns - 1) * (field.bounds.east - field.bounds.west), row: field.bounds.north + M.floor(i / columns) / (rows - 1) * (field.bounds.south - field.bounds.north) })) {
          heights[i] = field.elevationMetres[i];
          queue.put(i, heights[i]);
        }
        while (queue.length) {
          const [i, h] = queue.take();
          if (h !== heights[i]) continue;
          const x = i % columns, y = M.floor(i / columns);
          for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            if (x + sx < 0 || x + sx >= columns || y + sy < 0 || y + sy >= rows) continue;
            const j = i + sy * columns + sx, cost = M.max(h, field.elevationMetres[j]);
            if (cost < heights[j]) {
              heights[j] = cost;
              queue.put(j, cost);
            }
          }
        }
        field.spillHeights = heights;
        return field;
      });
    }
    function riverCourse(surface, metric, center, { dx, dy, extent, stepKm, cityRadius, form, riverMode, bank, harbor, referenceWidthMetres, phase }) {
      const widthKm = M.max(2e-3, referenceWidthMetres / 1e3), wavelength = M.max(6.5 * (widthKm * 3280.84) ** 1.1 / 3280.84, stepKm * 8), edge = form.kind === "plain" ? harbor ? 1.42 : 0.8 : M.max(0.36, form.crossScale * 1.35), baseline = bank * cityRadius * (riverMode === "through" ? 0.26 : edge), available = cityRadius * form.crossScale * ({ plain: 0.8, hills: 0.7, valley: 0.6, ridge: 0.25, hillside: 0.2, "coastal-slope": 0.2 }[form.kind] || 0.2), maximum = M.min(widthKm * 2.2, available, cityRadius * (riverMode === "through" ? 0.38 : edge * 0.42)), count = M.max(128, M.ceil(extent * 2 / M.min(stepKm * 0.6, wavelength / 40))), points = [], at = (along, side) => ({ row: center.row + (dy * along + dx * side) / metric.row, column: center.column + (dx * along - dy * side) / metric.column }), height = (along, side) => elevationAt(surface, at(along, side)), probe = M.max(widthKm * 2, stepKm * 2);
      // Natural meanders: integrate a Kinoshita heading along arc length.
      // Wavelength and bend angle drift slowly, bends lean downstream, and a
      // weak restoring term keeps the meander belt on its valley baseline.
      const hash = (k) => { const v = M.sin(phase * 12.9898 + k * 78.233) * 43758.5453; return v - M.floor(v); };
      const drift = (s, k, scale) => 0.5 + 0.32 * M.sin(s / (wavelength * scale) * M.PI * 2 + hash(k) * 6.283) + 0.18 * M.sin(s / (wavelength * scale * 0.43) * M.PI * 2 + hash(k + 1) * 6.283);
      const baseAngle = 0.82 + hash(9) * 0.42, skew = 0.05 + hash(10) * 0.06, flat = hash(11) * 0.04;
      const ds = M.max(1e-3, M.min(stepKm * 0.5, wavelength / 48));
      let x = -extent, y = 0, s = 0, phaseAcc = hash(12) * M.PI * 2, guard = 0;
      while (x <= extent + ds && guard++ < 200000) {
        const side = baseline + y, z = height(x, side), rise = M.max(0, height(x, side - probe) - z, height(x, side + probe) - z), grade = M.abs(height(x - probe, side) - height(x + probe, side)) / (probe * 2e3), freedom = 1 / (1 + rise / 25 + grade * 20);
        const point = at(x, side);
        point.elevationMetres = elevationAt(surface, point);
        points.push(point);
        // Towns sit on a straighter, regulated reach; meanders resume beyond.
        const reach = M.max(0, M.min(1, (M.abs(x) - cityRadius * 0.9) / M.max(1e-6, cityRadius * 1.3))), town = reach * reach * (3 - 2 * reach);
        const lambda = wavelength * (0.72 + 0.56 * drift(s, 20, 3.3)), amplitude = (0.12 + 0.88 * town) * baseAngle * (0.45 + 0.75 * drift(s, 30, 2.6)) * M.min(1, freedom * 1.15) * M.min(1, maximum / M.max(1e-6, widthKm * 1.2));
        phaseAcc += ds / lambda * M.PI * 2;
        let theta = amplitude * M.sin(phaseAcc) + amplitude ** 3 * (skew * M.cos(3 * phaseAcc) - flat * M.sin(3 * phaseAcc));
        // Valley walls: pull back toward the baseline, harder past the belt.
        theta -= y / M.max(1e-6, lambda) * (0.9 + 2.5 * (1 - town));
        if (M.abs(y) > maximum) theta -= M.sign(y) * M.min(1.1, (M.abs(y) - maximum) / M.max(1e-6, lambda * 0.15));
        theta = M.max(-1.3, M.min(1.3, theta));
        x += M.cos(theta) * ds;
        y += M.sin(theta) * ds;
        s += ds;
      }
      const simplified = simplifyChannel(points, metric, 0.0012);
      points.length = 0;
      points.push(...simplified);
      return points;
    }
    // Douglas-Peucker in kilometres; keeps endpoints and every attribute.
    function simplifyChannel(points, metric, tolerance) {
      if (points.length < 3) return points.slice();
      const keep = new Uint8Array(points.length), stack = [[0, points.length - 1]];
      keep[0] = keep[points.length - 1] = 1;
      while (stack.length) {
        const [first, last] = stack.pop(), a = points[first], b = points[last];
        const dx = (b.column - a.column) * metric.column, dy = (b.row - a.row) * metric.row, l2 = dx * dx + dy * dy || 1e-18;
        let worst = -1, index = -1;
        for (let i = first + 1; i < last; i++) {
          const px = (points[i].column - a.column) * metric.column, py = (points[i].row - a.row) * metric.row, t = M.max(0, M.min(1, (px * dx + py * dy) / l2)), d = M.hypot(px - dx * t, py - dy * t);
          if (d > worst) { worst = d; index = i; }
        }
        if (worst > tolerance && index > 0) { keep[index] = 1; stack.push([first, index], [index, last]); }
      }
      return points.filter((_, i) => keep[i]);
    }
    // Smooth a grid-routed tributary and give it small natural meanders.
    // Every displaced vertex must stay on dry ground away from the main river.
    function naturalizeTributary(points, surface, metric, main, join, seed, center = null, radius = 0) {
      if (points.length < 3) return points;
      const distance = (a, b) => M.hypot((a.column - b.column) * metric.column, (a.row - b.row) * metric.row);
      const lerp = (a, b, t) => ({ column: a.column + (b.column - a.column) * t, row: a.row + (b.row - a.row) * t, widthMetres: (a.widthMetres || 0) + ((b.widthMetres || 0) - (a.widthMetres || 0)) * t });
      let line = points.map((p) => ({ column: p.column, row: p.row, widthMetres: p.widthMetres || join.widthMetres * 0.2 }));
      for (let pass = 0; pass < 4; pass++) {
        const next = [line[0]];
        for (let i = 0; i < line.length - 1; i++) next.push(lerp(line[i], line[i + 1], 0.25), lerp(line[i], line[i + 1], 0.75));
        next.push(line.at(-1));
        line = next;
      }
      const step = 0.012, sampled = [line[0]];
      let carry = 0;
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i], length = distance(a, b);
        let t = step - carry;
        while (t < length) { sampled.push(lerp(a, b, t / length)); t += step; }
        carry = length - (t - step);
      }
      if (distance(sampled.at(-1), line.at(-1)) > 1e-9) sampled.push(line.at(-1));
      const total = sampled.reduce((sum, p, i) => sum + (i ? distance(sampled[i - 1], p) : 0), 0), out = [];
      const h = (k) => random(seed, 4100 + k), phase0 = h(1) * M.PI * 2;
      let s = 0, phase = phase0;
      for (let i = 0; i < sampled.length; i++) {
        if (i) s += distance(sampled[i - 1], sampled[i]);
        const p = sampled[i], a = sampled[M.max(0, i - 1)], z = sampled[M.min(sampled.length - 1, i + 1)];
        const dx = (z.column - a.column) * metric.column, dy = (z.row - a.row) * metric.row, len = M.hypot(dx, dy) || 1;
        const widthKm = M.max(3, p.widthMetres) / 1e3, lambda = M.max(0.2, widthKm * 30) * (0.7 + 0.3 * M.sin(s / 0.9 + h(2) * 6) + 0.25 * M.sin(s / 0.37 + h(4) * 6)),
          amp = M.min(lambda * 0.3, 0.075) * (0.35 + 0.65 * (0.5 + 0.5 * M.sin(s / 0.7 + h(3) * 6)));
        if (i) phase += distance(sampled[i - 1], p) / lambda * M.PI * 2;
        // Inside the town the brook is a straight, banked mill race.
        const cityReach = center && radius ? M.max(0, M.min(1, (distance(p, center) - radius * 1.1) / M.max(1e-6, radius * 1.2))) : 1;
        const taper = M.min(1, s / 0.15, (total - s) / 0.2) * cityReach * cityReach * (3 - 2 * cityReach), offset = amp * taper * (M.sin(phase) + 0.18 * M.cos(3 * phase));
        const q = { ...p, column: p.column - dy / len * offset / metric.column, row: p.row + dx / len * offset / metric.row };
        const nearMain = distanceToLine(q, main.points, metric).distance, ok = baseDry(surface, q) && (distance(q, join) < 0.2 || nearMain > join.widthMetres / 2e3 + 0.04);
        out.push(ok ? q : { ...p });
      }
      out[out.length - 1] = { ...join, widthMetres: out.at(-1).widthMetres };
      const kept = simplifyChannel(out, metric, 0.0015);
      out.length = 0; out.push(...kept);
      let previous = Infinity;
      for (const p of out) { p.elevationMetres = M.min(previous, elevationAt(surface, p)); previous = p.elevationMetres; }
      out[out.length - 1].elevationMetres = M.min(previous, join.elevationMetres);
      return out;
    }
    function refineTributary(points, surface, metric, main, join) {
      const distance = (a, b2) => M.hypot((a.column - b2.column) * metric.column, (a.row - b2.row) * metric.row), stepKm = M.max(
        (surface.bounds.east - surface.bounds.west) * metric.column,
        (surface.bounds.south - surface.bounds.north) * metric.row
      ) / (surface.columns - 1), corridor = points.map((p) => ({ ...p, elevationMetres: elevationAt(surface, p) })), terminal = M.max(0.25, join.widthMetres / 1e3 * 1.1), b = surface.bounds;
      let travelled = 0;
      const source = points.map((p, i) => {
        if (i) travelled += distance(points[i - 1], p);
        return { ...p, alongKm: travelled };
      }), safe = (p) => {
        if (p.column < b.west - 1e-10 || p.column > b.east + 1e-10 || p.row < b.north - 1e-10 || p.row > b.south + 1e-10) return false;
        const z = elevationAt(surface, p), near = distanceToLine(p, corridor, metric);
        if (!baseDry(surface, p) || z < join.elevationMetres - 1e-8 || near.distance > stepKm * 0.85 || z > near.elevation + M.max(4, stepKm * 8)) return false;
        return distance(p, join) <= terminal || distanceToLine(p, main.points, metric).distance >= join.widthMetres / 2e3 + 0.05;
      }, safeSegment = (a, z) => {
        const count = M.max(1, M.ceil(distance(a, z) / (stepKm * 0.25)));
        for (let i = 1; i < count; i++) if (!safe(interpolate(a, z, i / count))) return false;
        return true;
      }, separation = (p, a, z) => {
        const dx = (z.column - a.column) * metric.column, dy = (z.row - a.row) * metric.row, px = (p.column - a.column) * metric.column, py = (p.row - a.row) * metric.row, t = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1), 0, 1);
        return M.hypot(px - dx * t, py - dy * t);
      }, knots = [source[0]];
      function simplify(first, last) {
        if (last - first === 1) {
          knots.push(source[last]);
          return;
        }
        let split = first + 1, deviation = -1;
        for (let i = first + 1; i < last; i++) {
          const d = separation(source[i], source[first], source[last]);
          if (d > deviation) {
            deviation = d;
            split = i;
          }
        }
        if (deviation <= stepKm * 0.6 && safeSegment(source[first], source[last])) knots.push(source[last]);
        else {
          if (deviation < 1e-9) split = M.floor((first + last) / 2);
          simplify(first, split);
          simplify(split, last);
        }
      }
      simplify(0, source.length - 1);
      const out = [knots[0]], lerp = (a, z, t) => ({ ...interpolate(a, z, t), alongKm: a.alongKm + (z.alongKm - a.alongKm) * t });
      for (let i = 1; i < knots.length - 1; i++) {
        const a = knots[i - 1], p = knots[i], z = knots[i + 1], before = distance(a, p), after = distance(p, z);
        let cut = M.min(before * 0.3, after * 0.3, M.max(stepKm * 2, p.widthMetres / 1e3 * 5)), arc = null;
        for (let attempt = 0; attempt < 5 && cut > stepKm * 0.025; attempt++, cut *= 0.5) {
          const entry = lerp(a, p, 1 - cut / before), exit = lerp(p, z, cut / after), samples = M.max(6, M.ceil(cut * 2 / (stepKm * 0.3))), candidate = [];
          for (let k = 0; k <= samples; k++) {
            const t = k / samples, q = 1 - t;
            candidate.push({
              ...lerp(entry, exit, t),
              column: q * q * entry.column + 2 * q * t * p.column + t * t * exit.column,
              row: q * q * entry.row + 2 * q * t * p.row + t * t * exit.row
            });
          }
          if (candidate.every(safe) && safeSegment(out.at(-1), entry) && candidate.slice(1).every((q, k) => safeSegment(candidate[k], q))) {
            arc = candidate;
            break;
          }
        }
        if (arc) out.push(...arc);
        else out.push(p);
      }
      out.push(source.at(-1));
      const refined = [out[0]];
      for (let i = 1; i < out.length; i++) {
        const a = out[i - 1], z = out[i], count = M.max(1, M.ceil(distance(a, z) / (stepKm * 0.4)));
        for (let k = 1; k <= count; k++) refined.push(lerp(a, z, k / count));
      }
      let segment = 1, previous = points[0].elevationMetres;
      return refined.map((p, i) => {
        if (i === 0) return { ...points[0] };
        if (i === refined.length - 1) return { ...points.at(-1) };
        while (segment < source.length - 1 && source[segment].alongKm < p.alongKm) segment++;
        const a = source[segment - 1], z = source[segment], t = clamp((p.alongKm - a.alongKm) / (z.alongKm - a.alongKm || 1), 0, 1), profile = interpolate(a, z, t), height = M.max(join.elevationMetres, M.min(previous, profile.elevationMetres, elevationAt(surface, p)));
        previous = height;
        return { column: p.column, row: p.row, elevationMetres: height, widthMetres: profile.widthMetres };
      });
    }
    function tributary(channels, elevation, n, bounds, metric, center, radius, seed, waterDomain) {
      if (!channels.length) return null;
      const main = channels.reduce((a, b) => a.points.length > b.points.length ? a : b), distance = (a, b) => M.hypot((a.column - b.column) * metric.column, (a.row - b.row) * metric.row), join = main.points.slice(2, -2).sort((a, b) => distance(a, center) - distance(b, center))[0];
      if (!join || join.widthMetres < 18) return null;
      const at = (i) => ({ column: bounds.west + i % n / (n - 1) * (bounds.east - bounds.west), row: bounds.north + M.floor(i / n) / (n - 1) * (bounds.south - bounds.north) }), index = (p) => clamp(M.round((p.row - bounds.north) / (bounds.south - bounds.north) * (n - 1)), 0, n - 1) * n + clamp(M.round((p.column - bounds.west) / (bounds.east - bounds.west) * (n - 1)), 0, n - 1), start = index(join), cost = new Float64Array(n * n).fill(Infinity), parent = new Int32Array(n * n).fill(-1), queue = priorityQueue(), coordinates = Array.from({ length: n * n }, (_, i) => at(i)), mainDistance = new Float64Array(n * n);
      const dry = (i) => baseDry({ waterDomain }, coordinates[i]);
      for (let i = 0; i < n * n; i++) mainDistance[i] = dry(i) ? distanceToLine(coordinates[i], main.points, metric).distance : Infinity;
      cost[start] = 0;
      queue.put(start, 0);
      while (queue.length) {
        const [i, d] = queue.take();
        if (d !== cost[i]) continue;
        const x = i % n, y = M.floor(i / n), p = coordinates[i];
        for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          if (x + sx < 0 || x + sx >= n || y + sy < 0 || y + sy >= n) continue;
          const j = i + sy * n + sx, q = coordinates[j], length2 = distance(p, q);
          if (!dry(j) || elevation[j] < join.elevationMetres || distance(q, join) > 0.25 && mainDistance[j] < join.widthMetres / 2e3 + 0.05) continue;
          const descent = M.max(0, elevation[i] - elevation[j]), next = d + length2 * (1 + descent / 8 + (M.abs(elevation[j] - elevation[i]) / (length2 * 1e3)) ** 2 * 5);
          if (next < cost[j]) {
            cost[j] = next;
            parent[j] = i;
            queue.put(j, next);
          }
        }
      }
      let best = -1, score = -Infinity;
      for (let i = 0; i < n * n; i++) {
        const x = i % n, y = M.floor(i / n);
        if (x !== 0 && x !== n - 1 && y !== 0 && y !== n - 1) continue;
        if (!Number.isFinite(cost[i]) || !dry(i) || elevation[i] < M.max(elevation[start], join.elevationMetres) + 5) continue;
        const value = (elevation[i] - elevation[start]) / (cost[i] + 0.5) * (1 + random(seed, i + 2870) * 0.1);
        if (value > score) {
          score = value;
          best = i;
        }
      }
      if (best < 0) return null;
      const points = [];
      for (let i = best; i >= 0 && i !== start; i = parent[i]) points.push({ ...at(i), elevationMetres: elevation[i] });
      points.push({ ...join });
      if (points.length < 4) return null;
      let previous = Infinity;
      for (let i = 0; i < points.length; i++) {
        points[i].elevationMetres = M.min(previous, points[i].elevationMetres);
        previous = points[i].elevationMetres;
        points[i].widthMetres = M.max(3, join.widthMetres * (0.12 + 0.25 * i / (points.length - 1)));
      }
      const refined = naturalizeTributary(refineTributary(points, { rows: n, columns: n, bounds, elevationMetres: elevation, waterDomain }, metric, main, join),
        { rows: n, columns: n, bounds, elevationMetres: elevation, waterDomain }, metric, main, join, seed, center, radius);
      channels.push({ points: refined, widthMetres: refined.at(-1).widthMetres, kind: "river", widthModel: "tributary-catchment", mouth: false });
      return { anchor: { ...join }, mainChannel: channels.indexOf(main), tributaryChannel: channels.length - 1 };
    }
    function landRuns(points, surface, metric, stepKm) {
      const runs = [];
      let run = [];
      const flush = () => {
        if (run.length > 1) runs.push(run);
        run = [];
      };
      for (let i = 1; i < points.length; i++) {
        const edge = clipEdge(points[i - 1], points[i], surface.bounds);
        if (!edge) {
          flush();
          continue;
        }
        const [a, b] = edge, len = M.hypot((b.column - a.column) * metric.column, (b.row - a.row) * metric.row), count = M.max(1, M.ceil(len / (stepKm * 0.4)));
        for (let j = 1; j <= count; j++) {
          const p = interpolate(a, b, (j - 1) / count), q = interpolate(a, b, j / count), zp = baseDry(surface, p), zq = baseDry(surface, q);
          if (!zp && !zq) {
            flush();
            continue;
          }
          if (zp !== zq) {
            let low = 0, high = 1;
            for (let k = 0; k < 22; k++) {
              const t = (low + high) / 2;
              if (baseDry(surface, interpolate(p, q, t)) === zp) low = t;
              else high = t;
            }
            const mouth = interpolate(p, q, (low + high) / 2), body = waterBodyAt(surface.waterDomain, zp ? q : p);
            mouth.mouthHeadMetres = body.headMetres;
            mouth.elevationMetres = body.headMetres;
            if (zp) {
              if (!run.length) run.push(p);
              run.push(mouth);
              flush();
            } else {
              flush();
              run.push(mouth, q);
            }
          } else {
            if (!run.length) run.push(p);
            run.push(q);
          }
        }
      }
      flush();
      return runs;
    }
    function clipEdge(a, b, bounds) {
      let low = 0, high = 1;
      const dx = b.column - a.column, dy = b.row - a.row;
      for (const [p, q] of [[-dx, a.column - bounds.west], [dx, bounds.east - a.column], [-dy, a.row - bounds.north], [dy, bounds.south - a.row]]) {
        if (M.abs(p) < 1e-12) {
          if (q < 0) return null;
          continue;
        }
        const t = q / p;
        if (p < 0) low = M.max(low, t);
        else high = M.min(high, t);
        if (low > high) return null;
      }
      return [interpolate(a, b, low), interpolate(a, b, high)];
    }
    function roadWaterClearance(surface, channels, metric, bridges) {
      const origin = { column: surface.bounds.west, row: surface.bounds.north }, local = (p) => ({ column: (p.column - origin.column) * metric.column, row: (p.row - origin.row) * metric.row }), coordinate = (p) => [(p[0] - origin.column) * metric.column, (p[1] - origin.row) * metric.row], paths = channels.map((channel) => {
        const banks = [[], []];
        for (let i = 0; i < channel.points.length; i++) {
          const p = channel.points[i], a = channel.points[M.max(0, i - 1)], z = channel.points[M.min(channel.points.length - 1, i + 1)], dx = (z.column - a.column) * metric.column, dy = (z.row - a.row) * metric.row, length2 = M.hypot(dx, dy) || 1, half = p.widthMetres / 2e3, q = local(p);
          for (const [bank, sign] of [[0, -1], [1, 1]]) banks[bank].push([q.column - dy / length2 * half * sign, q.row + dx / length2 * half * sign]);
        }
        return banks[0].concat(banks[1].reverse());
      });
      if (surface.lakeTerrain?.length) for (const triangle of surfaceTriangles(surface)) {
        if (triangle.every((p) => p.depth < 0)) continue;
        const wet = [];
        for (let i = 0; i < triangle.length; i++) {
          const a = triangle[i], z = triangle[(i + 1) % triangle.length];
          if (a.depth >= 0) wet.push(local(a));
          if (a.depth >= 0 !== z.depth >= 0) wet.push(local(interpolate(a, z, a.depth / (a.depth - z.depth))));
        }
        if (wet.length >= 3) paths.push(wet.map((p) => [p.column, p.row]));
      }
      const sources = surface.waterDomain.waterBodies.flatMap((body) => (body.geometry.type === "Polygon" ? [body.geometry.coordinates] : body.geometry.coordinates).map((polygon) => polygon.map((ring) => ring.map(coordinate)))), channelWater = unionPolygons(paths);
      if (channelWater.length) sources.push(channelWater);
      const water = sources.length ? import_polygon_clipping.default.union(...sources) : [], profiles = /* @__PURE__ */ new Map(), decks = bridges.filter((bridge) => bridge.kind === "road").map((bridge) => {
        const [a, z] = bridge.points.map(local), length2 = M.hypot(z.column - a.column, z.row - a.row), half = bridge.widthMetres / 2e3, nx = -(z.row - a.row) / length2 * half, ny = (z.column - a.column) / length2 * half;
        return { width: bridge.widthMetres, polygon: [[
          [a.column + nx, a.row + ny],
          [a.column - nx, a.row - ny],
          [z.column - nx, z.row - ny],
          [z.column + nx, z.row + ny]
        ]] };
      }), pointDistance = (p, a, z) => {
        const dx = z.column - a.column, dy = z.row - a.row, squared = dx * dx + dy * dy, t = squared ? clamp(((p.column - a.column) * dx + (p.row - a.row) * dy) / squared, 0, 1) : 0;
        return M.hypot(p.column - a.column - t * dx, p.row - a.row - t * dy);
      };
      return (first, last, width) => {
        if (!water.length) return true;
        const permitted = decks.filter((deck) => deck.width >= width), key = permitted.map((deck) => decks.indexOf(deck)).join(","), half = width / 2e3;
        if (!profiles.has(key)) {
          const wet = permitted.length ? import_polygon_clipping.default.difference(water, ...permitted.map((deck) => deck.polygon)) : water, edges2 = wet.flatMap((polygon) => polygon.flatMap((ring) => ring.slice(1).map((p, i) => ({
            a: { column: ring[i][0], row: ring[i][1] },
            z: { column: p[0], row: p[1] }
          })))), candidates2 = boundsCandidates(edges2.map((edge) => polygonBounds([edge.a, edge.z]))), east2 = edges2.length ? M.max(...edges2.flatMap((edge) => [edge.a.column, edge.z.column])) : 0;
          profiles.set(key, { edges: edges2, candidates: candidates2, east: east2 });
        }
        const { edges, candidates, east } = profiles.get(key), a = local(first), z = local(last);
        let inside = false;
        for (const i of candidates({ west: a.column, east: M.max(a.column, east), north: a.row, south: a.row })) {
          const { a: p, z: q } = edges[i];
          if (p.row > a.row !== q.row > a.row && a.column < (q.column - p.column) * (a.row - p.row) / (q.row - p.row) + p.column) inside = !inside;
        }
        if (inside) return false;
        const bounds = {
          west: M.min(a.column, z.column) - half,
          east: M.max(a.column, z.column) + half,
          north: M.min(a.row, z.row) - half,
          south: M.max(a.row, z.row) + half
        };
        return !candidates(bounds).some((i) => {
          const { a: p, z: q } = edges[i], dx = z.column - a.column, dy = z.row - a.row, sx = q.column - p.column, sy = q.row - p.row, den = dx * sy - dy * sx, cx = p.column - a.column, cy = p.row - a.row;
          if (den !== 0) {
            const t = (cx * sy - cy * sx) / den, u = (cx * dy - cy * dx) / den;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
          }
          return M.min(pointDistance(a, p, q), pointDistance(z, p, q), pointDistance(p, a, z), pointDistance(q, a, z)) < half;
        });
      };
    }
    function ruralNetwork(recipe, surface, slopes, channels, metric, seed, bridges, streetPlan, form) {
      const b = surface.bounds, n = surface.columns, c = recipe.location, r = recipe.urban.radiusKm;
      const { streets: urbanStreets, gateStreets, enclosures, wallSpans, reservedCompounds, masonryClearance } = streetPlan, portals = gateStreets.filter((street) => street.layer === "outer"), fortified = wallSpans.length > 0, nominalWidths = recipe.urban.streetWidthsMetres;
      const inPolygon = (p, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i], z = polygon[j];
          if (a.row > p.row !== z.row > p.row && p.column < (z.column - a.column) * (p.row - a.row) / (z.row - a.row) + a.column) inside = !inside;
        }
        return inside;
      };
      const compoundBounds = reservedCompounds.map((compound) => polygonBounds(compound.points, 1e-8)), enclosureBounds = enclosures.map((polygon) => polygonBounds(polygon)), contains = (bounds, p) => p.column >= bounds.west && p.column <= bounds.east && p.row >= bounds.north && p.row <= bounds.south, overlaps = (a, z) => a.east >= z.west && a.west <= z.east && a.south >= z.north && a.north <= z.south, edgeBounds = (a, z) => {
        const dx2 = M.abs(z.column - a.column) * 1e-8 + 1e-12, dy2 = M.abs(z.row - a.row) * 1e-8 + 1e-12;
        return {
          west: M.min(a.column, z.column) - dx2,
          east: M.max(a.column, z.column) + dx2,
          north: M.min(a.row, z.row) - dy2,
          south: M.max(a.row, z.row) + dy2
        };
      }, occupied = (p) => reservedCompounds.some((compound, i) => contains(compoundBounds[i], p) && inPolygon(p, compound.points)), insideCity = (p) => {
        if (!fortified) return enclosures.some((polygon, i) => contains(enclosureBounds[i], p) && inPolygon(p, polygon));
        let inside = false;
        for (const [a, z] of wallSpans) if (a.row > p.row !== z.row > p.row && p.column < (z.column - a.column) * (p.row - a.row) / (z.row - a.row) + a.column) inside = !inside;
        return inside;
      };
      const index = (p) => clamp(M.round((p.row - b.north) / (b.south - b.north) * (n - 1)), 0, n - 1) * n + clamp(M.round((p.column - b.west) / (b.east - b.west) * (n - 1)), 0, n - 1);
      const nodes = Array.from({ length: n * n }, (_, i) => ({ row: b.north + M.floor(i / n) / (n - 1) * (b.south - b.north), column: b.west + i % n / (n - 1) * (b.east - b.west) }));
      const point = (i) => nodes[i];
      const distance = (a, b2) => M.hypot((a.column - b2.column) * metric.column, (a.row - b2.row) * metric.row);
      const roadWidth = (route) => nominalWidths[!route.local || recipe.harbor && route.points.some((p) => distance(p, recipe.harbor.landPoint) < 1e-8) ? "arterial" : "collector"];
      let cost, parent, anchors, heap, allowed, routeWidthMetres = nominalWidths.collector;
      const put = (i, d) => {
        heap.push([i, d]);
        let k = heap.length - 1;
        while (k) {
          const p = k - 1 >> 1;
          if (heap[p][1] <= d) break;
          heap[k] = heap[p];
          k = p;
        }
        heap[k] = [i, d];
      };
      const take = () => {
        const first = heap[0], last = heap.pop();
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let j = i * 2 + 1;
            if (j + 1 < heap.length && heap[j + 1][1] < heap[j][1]) j++;
            if (heap[j][1] >= last[1]) break;
            heap[i] = heap[j];
            i = j;
          }
          heap[i] = last;
        }
        return first;
      };
      const baseAllowed = Array.from({ length: n * n }, (_, i) => surface.roadBuildable[i] === 1 && !occupied(point(i)) && (!fortified || !insideCity(point(i))) && !channels.some((ch) => {
        const near = distanceToLine(point(i), ch.points, metric);
        return near.distance < near.widthMetres / 2e3 + 0.025;
      }));
      let links, bridgeEdges;
      const waterEdges = channels.flatMap((ch) => ch.points.slice(1).map((z, i) => ({ a: ch.points[i], z })));
      const waterBins = /* @__PURE__ */ new Map(), binX = (p) => clamp(M.floor((p.column - b.west) / (b.east - b.west) * (n - 1)), 0, n - 1), binY = (p) => clamp(M.floor((p.row - b.north) / (b.south - b.north) * (n - 1)), 0, n - 1);
      const bins = (a, z) => {
        const keys = [];
        for (let y = M.min(binY(a), binY(z)); y <= M.max(binY(a), binY(z)); y++) for (let x = M.min(binX(a), binX(z)); x <= M.max(binX(a), binX(z)); x++) keys.push(y * n + x);
        return keys;
      };
      for (const edge of waterEdges) for (const key2 of bins(edge.a, edge.z)) {
        if (!waterBins.has(key2)) waterBins.set(key2, []);
        waterBins.get(key2).push(edge);
      }
      const crossesWater = (a, z) => bins(a, z).some((key2) => (waterBins.get(key2) || []).some(({ a: c2, z: d }) => {
        if (M.max(a.column, z.column) < M.min(c2.column, d.column) || M.min(a.column, z.column) > M.max(c2.column, d.column) || M.max(a.row, z.row) < M.min(c2.row, d.row) || M.min(a.row, z.row) > M.max(c2.row, d.row)) return false;
        const dx2 = z.column - a.column, dy2 = z.row - a.row, sx = d.column - c2.column, sy = d.row - c2.row, den = dx2 * sy - dy2 * sx;
        if (M.abs(den) < 1e-14) return false;
        const t = ((c2.column - a.column) * sy - (c2.row - a.row) * sx) / den, u = ((c2.column - a.column) * dy2 - (c2.row - a.row) * dx2) / den;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
      }));
      const bankNodes = (p, opposite) => {
        const candidates2 = [];
        for (let i = 0; i < n * n; i++) if (allowed[i]) {
          const q = point(i);
          if (opposite) {
            const mx = (p.column + opposite.column) / 2, my = (p.row + opposite.row) / 2;
            if ((q.column - mx) * (p.column - mx) * metric.column ** 2 + (q.row - my) * (p.row - my) * metric.row ** 2 <= 0) continue;
          }
          candidates2.push({ i, d: distance(q, p) });
        }
        candidates2.sort((a, z) => a.d - z.d || a.i - z.i);
        return candidates2.slice(0, 32).filter((candidate) => safeAccess(p, point(candidate.i))).map((candidate) => candidate.i);
      }, bankNode = (p, opposite, reachable = false) => bankNodes(p, opposite).find((i) => !reachable || Number.isFinite(cost[i])) ?? -1;
      const dx = (b.east - b.west) * metric.column / (n - 1), dy = (b.south - b.north) * metric.row / (n - 1);
      const crossing = (a, z, p, q) => {
        const x = z.column - a.column, y = z.row - a.row, sx = q.column - p.column, sy = q.row - p.row, den = x * sy - y * sx;
        if (M.abs(den) < 1e-14) return null;
        const t = ((p.column - a.column) * sy - (p.row - a.row) * sx) / den, u = ((p.column - a.column) * y - (p.row - a.row) * x) / den;
        return t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8 ? interpolate(a, z, clamp(t, 0, 1)) : null;
      };
      const crossesCompoundBoundary = (a, z) => {
        const bounds = edgeBounds(a, z);
        return reservedCompounds.some((compound, i) => overlaps(bounds, compoundBounds[i]) && compound.points.some((p, j) => crossing(a, z, p, compound.points[(j + 1) % compound.points.length])));
      }, crossesReserved = (a, z) => occupied(a) || occupied(z) || crossesCompoundBoundary(a, z);
      const blockedByMasonry = (a, z, width = routeWidthMetres) => fortified && !masonryClearance.clearAccess([a, z], width), waterClear = roadWaterClearance(surface, channels, metric, bridges);
      const blockedBridgeByMasonry = (bridge) => {
        if (!fortified) return false;
        const [a, z] = bridge.points, length2 = distance(a, z), half = bridge.widthMetres / 2e3;
        if (length2 < 1e-12) return true;
        const nx = -(z.row - a.row) * metric.row / length2 * half / metric.column, ny = (z.column - a.column) * metric.column / length2 * half / metric.row;
        return masonryClearance.intersects([
          { column: a.column + nx, row: a.row + ny },
          { column: a.column - nx, row: a.row - ny },
          { column: z.column - nx, row: z.row - ny },
          { column: z.column + nx, row: z.row + ny }
        ]);
      };
      const safeAccess = (a, z, width = routeWidthMetres) => {
        if (crossesWater(a, z) || crossesReserved(a, z) || blockedByMasonry(a, z, width) || !waterClear(a, z, width)) return false;
        const length2 = distance(a, z), steps = M.max(4, M.ceil(length2 / 0.025));
        let previous = elevationAt(surface, a);
        for (let k = 0; k <= steps; k++) {
          const p = interpolate(a, z, k / steps), height = elevationAt(surface, p);
          if (!isDry(surface, p) || k && M.abs(height - previous) / (M.max(length2 / steps, 1e-4) * 1e3) > 0.12 || channels.some((ch) => {
            const near = distanceToLine(p, ch.points, metric);
            return near.distance < near.widthMetres / 2e3 + 4e-3;
          })) return false;
          previous = height;
        }
        return true;
      };
      const streetFrontage = (end, maximumDistance, viaPort = true) => {
        let frontage = null;
        const portTarget = recipe.harbor && distance(end, recipe.harbor.landPoint) < 1e-7;
        if (fortified && portTarget) {
          const yard = recipe.harbor.reservedLand, center = { column: yard.reduce((sum, p) => sum + p.column / yard.length, 0), row: yard.reduce((sum, p) => sum + p.row / yard.length, 0) }, corners = [yard[0], yard.at(-1)].map((p) => interpolate(p, center, 0.18));
          for (const gate of portals) {
            const outside = gate.points.at(-1);
            for (const via of [[], [corners[0]], [corners[1]], corners, corners.slice().reverse()]) {
              const arm = [outside, ...via, end];
              if (!arm.slice(1).every((p, i) => safeAccess(arm[i], p))) continue;
              const length2 = arm.slice(1).reduce((sum, p, i) => sum + distance(arm[i], p), 0);
              if (length2 <= maximumDistance && (!frontage || length2 < frontage.distance)) frontage = {
                point: arm.at(-2),
                distance: length2,
                segment: gate.points.slice(-2),
                access: [...gate.points, ...via]
              };
            }
          }
          return frontage;
        }
        for (const street of urbanStreets) for (let k = 1; k < street.points.length; k++) {
          const a = street.points[k - 1], z = street.points[k], sx = (z.column - a.column) * metric.column, sy = (z.row - a.row) * metric.row, squared = sx * sx + sy * sy, t = clamp(((end.column - a.column) * metric.column * sx + (end.row - a.row) * metric.row * sy) / (squared || 1), 0, 1), q = interpolate(a, z, t), d = distance(q, end);
          if (fortified && !insideCity(q) && !street.gateCenter) continue;
          if (d <= maximumDistance && (!frontage || d < frontage.distance) && safeAccess(q, end)) frontage = {
            point: q,
            distance: d,
            segment: [a, z],
            access: street.gateCenter ? [...street.points.slice(0, k), q] : [q]
          };
        }
        const landing = recipe.harbor?.landPoint;
        if (viaPort && landing && distance(landing, end) > 1e-7 && distance(landing, end) < maximumDistance && safeAccess(landing, end)) {
          const source = streetFrontage(landing, maximumDistance, false), length2 = source && source.distance + distance(landing, end);
          if (source && length2 < maximumDistance && (!frontage || length2 < frontage.distance))
            frontage = { ...source, point: landing, distance: length2, access: [...source.access, landing] };
        }
        return frontage;
      };
      const connectBridges = () => {
        for (const bridge of bridges) {
          if (bridge.kind === "rail" || bridge.widthMetres < routeWidthMetres) continue;
          if (crossesReserved(...bridge.points) || blockedBridgeByMasonry(bridge)) continue;
          const banks = bridge.points.map((bank, k) => bankNodes(bank, bridge.points[1 - k]));
          for (let k = 0; k < 2; k++) {
            const other = bridge.points[1 - k], frontage = streetFrontage(other, r * 0.7);
            if (!frontage) continue;
            for (const node of banks[k]) {
              const length2 = frontage.distance + distance(...bridge.points) + distance(bridge.points[k], point(node));
              if (length2 < cost[node]) {
                cost[node] = length2;
                anchors.set(node, [...frontage.access, other, bridge.points[k]]);
                put(node, length2);
              }
            }
          }
          for (const a of banks[0]) for (const z of banks[1]) {
            if (a === z) continue;
            if (!links.has(a)) links.set(a, []);
            if (!links.has(z)) links.set(z, []);
            links.get(a).push(z);
            links.get(z).push(a);
            bridgeEdges.set(a + ":" + z, bridge.points);
            bridgeEdges.set(z + ":" + a, bridge.points.slice().reverse());
          }
        }
      };
      const routingProfiles = /* @__PURE__ */ new Map();
      const useRoadWidth = (width) => {
        routeWidthMetres = width;
        const cached = routingProfiles.get(width);
        if (cached) {
          ({ cost, parent, anchors, allowed, links, bridgeEdges } = cached);
          return;
        }
        cost = new Float64Array(n * n).fill(Infinity);
        parent = new Int32Array(n * n).fill(-1);
        anchors = /* @__PURE__ */ new Map();
        heap = [];
        links = /* @__PURE__ */ new Map();
        bridgeEdges = /* @__PURE__ */ new Map();
        allowed = baseAllowed.map((value, i) => value && (!fortified || masonryClearance.clearAccess([point(i), point(i)], width)));
        connectBridges();
        const sources = fortified ? portals : urbanStreets;
        for (const street of sources) {
          if (fortified) {
            const q = street.points.at(-1), outward = street.outward, candidates2 = [];
            for (let y = M.max(0, M.floor(index(q) / n) - 2); y <= M.min(n - 1, M.floor(index(q) / n) + 2); y++)
              for (let x = M.max(0, index(q) % n - 2); x <= M.min(n - 1, index(q) % n + 2); x++) {
                const i = y * n + x, p = point(i), d = distance(q, p), along = (p.column - q.column) * metric.column * outward.x + (p.row - q.row) * metric.row * outward.y;
                if (!allowed[i] || d > M.hypot(dx, dy) * 1.8 || along < 4e-3 || !safeAccess(q, p)) continue;
                candidates2.push({ i, d, score: d + (d - along) * 0.6 });
              }
            candidates2.sort((a, z) => a.score - z.score || a.i - z.i);
            const chosen = candidates2[0];
            if (chosen && chosen.d < cost[chosen.i]) {
              cost[chosen.i] = chosen.d;
              anchors.set(chosen.i, street.points.slice());
              put(chosen.i, chosen.d);
            }
            continue;
          }
          for (let k = 1; k < street.points.length; k++) {
            const a = street.points[k - 1], z = street.points[k], sx = (z.column - a.column) * metric.column, sy = (z.row - a.row) * metric.row, squared = sx * sx + sy * sy;
            const minX = M.max(0, M.min(index(a) % n, index(z) % n) - 1), maxX = M.min(n - 1, M.max(index(a) % n, index(z) % n) + 1), minY = M.max(0, M.min(M.floor(index(a) / n), M.floor(index(z) / n)) - 1), maxY = M.min(n - 1, M.max(M.floor(index(a) / n), M.floor(index(z) / n)) + 1);
            for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
              const i = y * n + x;
              if (!allowed[i]) continue;
              const p = point(i), t = clamp(((p.column - a.column) * metric.column * sx + (p.row - a.row) * metric.row * sy) / (squared || 1), 0, 1), q = fortified ? z : interpolate(a, z, t), d = distance(p, q);
              if (d > M.hypot(dx, dy) * 0.8 || d >= cost[i] || !safeAccess(q, p)) continue;
              cost[i] = d;
              anchors.set(i, [q]);
              put(i, d);
            }
          }
        }
        while (heap.length) {
          const [i, d] = take();
          if (d !== cost[i]) continue;
          const x = i % n, y = M.floor(i / n);
          for (const j of links.get(i) || []) {
            const bridge = bridgeEdges.get(i + ":" + j), next = d + distance(point(i), bridge[0]) + distance(...bridge) + distance(bridge[1], point(j));
            if (!allowed[j] || blockedByMasonry(point(i), bridge[0]) || blockedByMasonry(bridge[1], point(j))) continue;
            if (next < cost[j]) {
              cost[j] = next;
              parent[j] = i;
              put(j, next);
            }
          }
          for (const [sx, sy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
            [1, 2],
            [-1, 2],
            [1, -2],
            [-1, -2],
            [2, 1],
            [-2, 1],
            [2, -1],
            [-2, -1]
          ]) {
            if (x + sx < 0 || x + sx >= n || y + sy < 0 || y + sy >= n) continue;
            const j = i + sy * n + sx;
            if (!allowed[j] || sx && sy && (!allowed[i + sx] || !allowed[i + sy * n])) continue;
            if (crossesWater(point(i), point(j)) || crossesCompoundBoundary(point(i), point(j)) || blockedByMasonry(point(i), point(j)) || !waterClear(point(i), point(j), routeWidthMetres)) continue;
            const length2 = M.hypot(sx * dx, sy * dy), grade = M.abs(surface.elevationMetres[i] - surface.elevationMetres[j]) / (length2 * 1e3);
            if (grade > 0.12) continue;
            const next = d + length2 * (1 + (grade / 0.035) ** 2 * 2 + random(seed, j + 67e3) * 0.18);
            if (next < cost[j]) {
              cost[j] = next;
              parent[j] = i;
              put(j, next);
            }
          }
        }
        routingProfiles.set(width, { cost, parent, anchors, allowed, links, bridgeEdges });
      };
      useRoadWidth(nominalWidths.arterial);
      const chainTo = (i) => {
        const chain = [];
        for (; i >= 0; i = parent[i]) chain.push(i);
        chain.reverse();
        return chain;
      };
      const pathTo = (i) => {
        const chain = chainTo(i), points = anchors.get(chain[0]).slice();
        if (distance(points.at(-1), point(chain[0])) > 1e-8) points.push(point(chain[0]));
        for (let k = 1; k < chain.length; k++) {
          const bridge = bridgeEdges.get(chain[k - 1] + ":" + chain[k]);
          if (bridge) points.push(...bridge);
          points.push(point(chain[k]));
        }
        return points;
      };
      const corridors = [];
      for (const route of recipe.transport.corridors) {
        if (route.kind !== "road") {
          corridors.push(route);
          continue;
        }
        useRoadWidth(roadWidth(route));
        const clipped = route.points.slice(1).flatMap((p, i) => clipEdge(route.points[i], p, b) || []);
        if (clipped.length < 2) continue;
        const ends = [clipped[0], clipped.at(-1)], paths = [];
        for (const end of ends) {
          if (distance(end, c) <= 1e-8) continue;
          const portEnd = recipe.harbor && distance(end, recipe.harbor.landPoint) < 1e-8, frontage = streetFrontage(end, portEnd ? r * 0.7 : M.hypot(dx, dy) * 0.8);
          if (frontage?.distance <= 1e-8) {
            if (recipe.harbor && distance(end, recipe.harbor.landPoint) <= 1e-8) {
              const other = frontage.segment.reduce((best, p) => distance(p, end) > distance(best, end) ? p : best, frontage.segment[0]);
              if (distance(other, end) > 1e-8) paths.push([other, end]);
            }
            continue;
          }
          if (frontage && safeAccess(frontage.point, end)) {
            paths.push([...frontage.access, end]);
            continue;
          }
          const node = bankNode(end, null, true);
          if (node < 0 || !Number.isFinite(cost[node]) || distance(point(node), end) > M.hypot(dx, dy) * 1.8) continue;
          const tail = point(node);
          if (!safeAccess(tail, end)) continue;
          const points = pathTo(node);
          if (distance(points.at(-1), end) > 1e-8) points.push(end);
          paths.push(points);
        }
        for (const [arm, points] of paths.entries()) corridors.push({ ...route, id: route.id + "-approach-" + arm, sourceId: route.id, points });
      }
      if (recipe.era === "industrial" && recipe.eraPrepared && !corridors.some((route) => route.kind === "rail")) {
        // An industrial-age railway arrives on a straight, dry, gently graded
        // line; choose the bearing that best follows the main highway.
        const dist = (p, q) => M.hypot((p.column - q.column) * metric.column, (p.row - q.row) * metric.row);
        const roads = corridors.filter((route) => route.kind === "road" && route.points?.length > 1 && !route.stationAccess);
        const main = roads.map((route) => ({ route, length: route.points.slice(1).reduce((sum, p, i) => sum + dist(p, route.points[i]), 0) })).sort((a, z) => z.length - a.length)[0];
        const far = main ? main.route.points.reduce((best, p) => dist(p, c) > dist(best, c) ? p : best, main.route.points[0]) : null;
        const preferred = far ? M.atan2((far.row - c.row) * metric.row, (far.column - c.column) * metric.column) : 0;
        const inside = (p) => p.column >= b.west && p.column <= b.east && p.row >= b.north && p.row <= b.south;
        let best = null;
        for (let k = 0; k < 36; k++) {
          const angle = k * M.PI / 18, d = { x: M.cos(angle), y: M.sin(angle) }, at = (t) => ({ column: c.column + d.x * t / metric.column, row: c.row + d.y * t / metric.row });
          let ok = true, t = r * 0.38, previous = elevationAt(surface, at(t)), end = null;
          for (; ok; t += 0.02) {
            const p = at(t);
            if (!inside(p)) { end = at(t - 0.02); break; }
            const height = elevationAt(surface, p);
            if (!isDry(surface, p) || M.abs(height - previous) > 0.02 * 1e3 * 0.03 || channels.some((ch) => {
              const near = distanceToLine(p, ch.points, metric);
              return near.distance < near.widthMetres / 2e3 + 0.012;
            })) ok = false;
            previous = height;
          }
          if (!ok || !end || dist(end, c) < r * 1.8) continue;
          const turn = M.abs(M.atan2(M.sin(angle - preferred), M.cos(angle - preferred)));
          const score = turn + (main ? 0 : 0);
          if (!best || score < best.score) best = { score, end, angle };
        }
        if (best) corridors.push({ id: recipe.id + "-railway-1", kind: "rail", points: [{ ...c }, best.end], synthesized: true });
      }
      const railwayStations = [];
      let railwayStatus = null;
      if (["industrial", "contemporary"].includes(recipe.era)) {
        const half = M.max(0.075, M.min(0.16, 0.055 + M.sqrt((recipe.population?.estimate || 1e3) / 1e5) * 0.035)), candidates2 = [], regional = corridors.filter((route) => route.kind === "rail"), approachRadius = r * 1.45, arms = [], localRailIndices = [];
        for (const route of regional) {
          const reverse = distance(route.points.at(-1), c) < distance(route.points[0], c), sequence = reverse ? route.points.slice().reverse() : route.points.slice();
          if (distance(sequence[0], c) > r * 0.2) continue;
          const corridorIndex = corridors.indexOf(route);
          localRailIndices.push(corridorIndex);
          let index2 = 1;
          while (index2 < sequence.length - 1 && distance(sequence[index2], c) < approachRadius) index2++;
          let portal = sequence[index2];
          if (distance(portal, c) > approachRadius) {
            let low = 0, high = 1;
            for (let k = 0; k < 36; k++) {
              const t = (low + high) / 2;
              if (distance(interpolate(sequence[index2 - 1], sequence[index2], t), c) < approachRadius) low = t;
              else high = t;
            }
            portal = interpolate(sequence[index2 - 1], sequence[index2], (low + high) / 2);
          }
          const outer = [portal, ...sequence.slice(index2).filter((p, k) => k || distance(p, portal) > 1e-8)];
          if (outer.length < 2) continue;
          const length2 = distance(outer[0], outer[1]);
          arms.push({ route, corridorIndex, reverse, outer, inward: {
            x: (outer[0].column - outer[1].column) * metric.column / length2,
            y: (outer[0].row - outer[1].row) * metric.row / length2
          } });
        }
        const axis = form.axisRadians, u = { x: M.cos(axis), y: M.sin(axis) }, v = { x: -M.sin(axis), y: M.cos(axis) }, atCity = (along, across) => ({ column: c.column + (u.x * along + v.x * across) / metric.column, row: c.row + (u.y * along + v.y * across) / metric.row });
        if (arms.length) for (const along of [-0.65, -0.45, -0.28, 0.28, 0.45, 0.65]) for (const across of [0, -0.1, 0.1])
          candidates2.push({ p: atCity(along * r, across * r * form.crossScale), ux: u.x, uy: u.y, score: M.abs(M.abs(along) - 0.45) + M.abs(across) * 0.3 });
        if (arms.length && recipe.era === "industrial") for (const arm of arms) {
          // A terminus on the incoming line itself: the track arrives straight
          // and the station sits where the line meets the built-up edge.
          const d = { x: -arm.inward.x, y: -arm.inward.y }, n = { x: -d.y, y: d.x };
          for (const dist of [0.42, 0.55, 0.7, 0.85, 1.0, 1.15]) for (const off of [0, 0.08, -0.08, 0.16, -0.16])
            candidates2.push({ p: { column: c.column + (d.x * dist * r + n.x * off * r) / metric.column, row: c.row + (d.y * dist * r + n.y * off * r) / metric.row },
              ux: d.x, uy: d.y, score: 0.6 + M.abs(dist - 0.7) * 0.5 + M.abs(off) });
          for (const along of [-0.85, -0.75, 0.75, 0.85]) for (const across of [0, -0.2, 0.2, -0.3, 0.3])
            candidates2.push({ p: atCity(along * r, across * r * form.crossScale), ux: u.x, uy: u.y, score: 1.2 + M.abs(across) });
        }
        const railBridges = bridges.filter((bridge) => bridge.kind === "rail"), bridgeAt = (p) => railBridges.find((bridge) => distanceToLine(p, bridge.points, metric).distance < 4e-3), railHeight = (p) => {
          const bridge = bridgeAt(p);
          if (!bridge) return elevationAt(surface, p);
          const length2 = distance(...bridge.points), t = clamp(distance(p, bridge.points[0]) / length2, 0, 1);
          return bridge.bankHeightsMetres[0] * (1 - t) + bridge.bankHeightsMetres[1] * t;
        };
        const safeRail = (a, z) => {
          if (crossesReserved(a, z) || blockedByMasonry(a, z, nominalWidths.arterial * 0.65)) return false;
          if (bins(a, z).some((key2) => (waterBins.get(key2) || []).some(({ a: c2, z: d }) => {
            const hit = crossing(a, z, c2, d);
            return hit && !bridgeAt(hit);
          }))) return false;
          const length2 = distance(a, z), steps = M.max(2, M.ceil(length2 / 0.02));
          let previous = railHeight(a);
          for (let k = 0; k <= steps; k++) {
            const p = interpolate(a, z, k / steps), height = railHeight(p), bridge = bridgeAt(p);
            if (!bridge && !isDry(surface, p) || k && M.abs(height - previous) / (M.max(length2 / steps, 1e-4) * 1e3) > 0.035 || !bridge && channels.some((ch) => {
              const near = distanceToLine(p, ch.points, metric);
              return near.distance < near.widthMetres / 2e3 + 8e-3;
            })) return false;
            previous = height;
          }
          return true;
        };
        const validAlignment = (curve2, outer, pad) => {
          const edges = curve2.slice(1).map((p, k) => edgeBounds(curve2[k], p)), candidates3 = boundsCandidates(edges);
          for (let i = 0; i < edges.length; i++) {
            const a = curve2[i], z = curve2[i + 1];
            if (distance(a, z) < 1e-8 || inPolygon(a, pad) || inPolygon(z, pad) || pad.some((p, k) => crossing(a, z, p, pad[(k + 1) % pad.length]))) return false;
            for (const j of candidates3(edges[i])) if (j > i + 1) {
              const p = curve2[j], q = curve2[j + 1];
              if (crossing(a, z, p, q) || [a, z].some((v2) => distanceToLine(v2, [p, q], metric).distance < 1e-8) || [p, q].some((v2) => distanceToLine(v2, [a, z], metric).distance < 1e-8)) return false;
            }
          }
          const points = [outer[1], ...curve2];
          for (let i = 1; i < points.length - 1; i++) {
            const a = points[i - 1], p = points[i], z = points[i + 1], x1 = (p.column - a.column) * metric.column, y1 = (p.row - a.row) * metric.row, x2 = (z.column - p.column) * metric.column, y2 = (z.row - p.row) * metric.row, first = M.hypot(x1, y1), last = M.hypot(x2, y2), cross = M.abs(x1 * y2 - y1 * x2);
            if (first < 1e-8 || last < 1e-8 || (x1 * x2 + y1 * y2) / (first * last) < M.cos(M.PI / 12) || cross > 1e-10 && first * last * M.hypot(x1 + x2, y1 + y2) / (2 * cross) < 0.15) return false;
          }
          return true;
        };
        const aligned = (candidate, ux, uy, pad) => {
          const routes = [];
          for (const arm of arms) {
            const portal = arm.outer[0], side = (portal.column - candidate.column) * metric.column * ux + (portal.row - candidate.row) * metric.row * uy < 0 ? -1 : 1, throat = { column: candidate.column + ux * side * (half + 0.16) / metric.column, row: candidate.row + uy * side * (half + 0.16) / metric.row }, buffer = { column: candidate.column - ux * side * (half + 0.03) / metric.column, row: candidate.row - uy * side * (half + 0.03) / metric.row }, terminal = { x: -ux * side, y: -uy * side };
            const curveBetween = (start, end, entry, exit) => {
              const length2 = distance(start, end);
              for (const tension of [0.32, 0.48, 0.64]) {
                const first = { column: start.column + entry.x * length2 * tension / metric.column, row: start.row + entry.y * length2 * tension / metric.row }, last = { column: end.column - exit.x * length2 * tension / metric.column, row: end.row - exit.y * length2 * tension / metric.row }, count = M.max(20, M.ceil(length2 / 0.035)), points2 = [];
                for (let k = 0; k <= count; k++) {
                  const t = k / count, q = 1 - t;
                  points2.push({
                    column: q * q * q * start.column + 3 * q * q * t * first.column + 3 * q * t * t * last.column + t * t * t * end.column,
                    row: q * q * q * start.row + 3 * q * q * t * first.row + 3 * q * t * t * last.row + t * t * t * end.row
                  });
                }
                const curved2 = points2.slice(1, -1).every((p, k) => {
                  const a = points2[k], z = points2[k + 2], x1 = (p.column - a.column) * metric.column, y1 = (p.row - a.row) * metric.row, x2 = (z.column - p.column) * metric.column, y2 = (z.row - p.row) * metric.row, cross = M.abs(x1 * y2 - y1 * x2);
                  return cross < 1e-10 || M.hypot(x1, y1) * M.hypot(x2, y2) * M.hypot(x1 + x2, y1 + y2) / (2 * cross) >= 0.15;
                });
                if (curved2 && points2.slice(1).every((p, k) => safeRail(points2[k], p))) return points2;
              }
              return null;
            };
            const crossings2 = railBridges.filter((bridge) => distanceToLine(bridge.center, arm.route.points, metric).distance < 1e-6 && distance(bridge.center, c) < approachRadius).sort((a, z) => distance(portal, a.center) - distance(portal, z.center)), curve2 = [portal];
            let direction = arm.inward;
            for (const bridge of crossings2) {
              const banks = distance(curve2.at(-1), bridge.points[0]) < distance(curve2.at(-1), bridge.points[1]) ? bridge.points : bridge.points.slice().reverse(), span = distance(...banks), axis2 = { x: (banks[1].column - banks[0].column) * metric.column / span, y: (banks[1].row - banks[0].row) * metric.row / span }, approach2 = curveBetween(curve2.at(-1), banks[0], direction, axis2);
              if (!approach2 || !safeRail(...banks)) return null;
              curve2.push(...approach2.slice(1), banks[1]);
              direction = axis2;
            }
            const approach = curveBetween(curve2.at(-1), throat, direction, terminal);
            if (!approach || !safeRail(throat, candidate) || !safeRail(candidate, buffer)) return null;
            curve2.push(...approach.slice(1), candidate, buffer);
            if (!validAlignment(curve2, arm.outer, pad)) return null;
            const inward = curve2.slice().reverse().concat(arm.outer.slice(1)), points = arm.reverse ? inward.slice().reverse() : inward;
            routes.push({ ...arm.route, points, localAlignment: true });
          }
          return routes;
        };
        candidates2.sort((a, z) => a.score - z.score);
        for (const candidate of candidates2) {
          const { p, ux, uy } = candidate;
          for (const side of [-1, 1]) {
            const at = (x, y) => ({ column: p.column + (ux * x - uy * y * side) / metric.column, row: p.row + (uy * x + ux * y * side) / metric.row }), rect = (left, right, near, far) => [[left, near], [right, near], [right, far], [left, far]].map(([x, y]) => at(x, y)), points = rect(-half, half, 4e-3, 0.08), entrance = at(0, 0.08), building = rect(-half * 0.45, half * 0.45, 0.03, 0.051), freightShed = rect(half * 0.5, half * 0.93, 0.029, 0.061), platform = rect(-half, half, 6e-3, 0.019), crossesPad = (x, y) => inPolygon(x, points) || inPolygon(y, points) || points.some((v2, k) => crossing(x, y, v2, points[(k + 1) % points.length]));
            if (points.some((v2, k) => !safeAccess(v2, points[(k + 1) % points.length])) || !safeAccess(points[0], points[2]) || Array.from({ length: 7 }, (_, k) => 0.014 + k * 0.01).some((y) => !safeAccess(at(-half, y), at(half, y))) || reservedCompounds.some((compound) => compound.points.some((v2) => inPolygon(v2, points))) || corridors.some((route) => route.kind === "road" && route.points.slice(1).some((v2, k) => crossesPad(route.points[k], v2))) || recipe.harbor?.reservedLand && (points.some((v2) => inPolygon(v2, recipe.harbor.reservedLand)) || recipe.harbor.reservedLand.some((v2, k) => crossesPad(v2, recipe.harbor.reservedLand[(k + 1) % recipe.harbor.reservedLand.length])))) continue;
            const frontage = streetFrontage(entrance, M.max(0.3, r * 0.28));
            let access = null;
            if (frontage) access = [frontage.point, entrance];
            else {
              const node = bankNode(entrance);
              if (node >= 0 && Number.isFinite(cost[node]) && distance(point(node), entrance) < M.hypot(dx, dy) * 1.8 && safeAccess(point(node), entrance)) access = pathTo(node).concat(entrance);
            }
            if (!access || access.slice(1).some((v2, k) => inPolygon(access[k], points) || points.some((q, j) => {
              const hit = crossing(access[k], v2, q, points[(j + 1) % points.length]);
              return hit && distance(hit, entrance) > 1e-7;
            }))) continue;
            const routes = aligned(p, ux, uy, points);
            if (!routes) continue;
            for (const [i, route] of routes.entries()) corridors[arms[i].corridorIndex] = route;
            const id = recipe.id + "-railway-station", accessId = id + "-access";
            corridors.push({ id: accessId, kind: "road", stationAccess: true, points: access });
            railwayStations.push({
              id,
              routeId: routes[0].id,
              routeIds: routes.map((route) => route.id),
              name: (recipe.name || "\u5F53\u5730") + "\u7AD9",
              points,
              platforms: [platform],
              building,
              freightShed,
              railPoint: { column: p.column, row: p.row },
              entrance,
              accessId,
              access
            });
            break;
          }
          if (railwayStations.length) break;
        }
        if (localRailIndices.length && !railwayStations.length) {
          railwayStatus = { state: "unconnected", reason: "no-feasible-station" };
          for (const arm of arms) corridors[arm.corridorIndex] = {
            ...arm.route,
            points: arm.reverse ? arm.outer.slice().reverse() : arm.outer
          };
        }
        const retained = new Set(arms.map((arm) => arm.corridorIndex));
        for (const index2 of localRailIndices.slice().reverse()) if (!retained.has(index2)) corridors.splice(index2, 1);
      }
      useRoadWidth(nominalWidths.arterial);
      for (const [i, bridge] of bridges.entries()) {
        if (bridge.kind === "rail") continue;
        if (crossesReserved(...bridge.points) || blockedBridgeByMasonry(bridge)) continue;
        if (corridors.some((route) => route.kind === "road" && bridge.points.every((p) => distanceToLine(p, route.points, metric).distance < 1e-7))) continue;
        const bankPaths = bridge.points.map((bank, k) => {
          const frontage = streetFrontage(bank, r * 0.7);
          if (frontage && frontage.distance < r * 0.7) return [...frontage.access, bank];
          const node = bankNode(bank, bridge.points[1 - k], true);
          if (node < 0 || !Number.isFinite(cost[node]) || !safeAccess(point(node), bank)) return null;
          return pathTo(node).concat(bank);
        });
        if (bankPaths.every(Boolean) && !bankPaths.some((points, k) => points.some((p) => distance(p, bridge.points[1 - k]) < 1e-7))) {
          corridors.push({
            id: bridge.routeId + "-bridge-" + i,
            sourceId: bridge.routeId,
            kind: "road",
            points: bankPaths[0].concat(bankPaths[1].slice().reverse())
          });
          continue;
        }
        const a = bankNode(bridge.points[0], bridge.points[1], true), z = bankNode(bridge.points[1], bridge.points[0], true);
        if (a < 0 || z < 0 || !Number.isFinite(cost[a]) || !Number.isFinite(cost[z]) || !bridgeEdges.has(a + ":" + z)) continue;
        if (chainTo(a).includes(z) || chainTo(z).includes(a)) continue;
        corridors.push({
          id: bridge.routeId + "-bridge-" + i,
          sourceId: bridge.routeId,
          kind: "road",
          points: pathTo(a).concat(bridge.points, pathTo(z).slice().reverse())
        });
      }
      useRoadWidth(nominalWidths.collector);
      const roads = [], used = /* @__PURE__ */ new Set(), ruralSettlements = [];
      const arable = (p) => p.column > b.west && p.column < b.east && p.row > b.north && p.row < b.south && isDry(surface, p) && sample(slopes, n, n, b, p.row, p.column) < 0.13 && !occupied(p) && !insideCity(p) && !channels.some((ch) => {
        const near = distanceToLine(p, ch.points, metric);
        return near.distance < near.widthMetres / 2e3 + 0.035;
      }), croftGround = (p) => {
        if (distance(p, c) < r * 1.45 || distance(p, c) > r * 3.9 || sample(slopes, n, n, b, p.row, p.column) > 0.07) return false;
        for (let k = 0; k < 16; k++) {
          const angle = k * M.PI / 8, q = { column: p.column + M.cos(angle) * 0.13 / metric.column, row: p.row + M.sin(angle) * 0.13 / metric.row };
          if (!arable(q) || sample(slopes, n, n, b, q.row, q.column) > 0.085) return false;
        }
        return true;
      }, candidates = [];
      for (let y = 2; y < n - 2; y += 2) for (let x = 2; x < n - 2; x += 2) {
        const node = y * n + x, p = point(node);
        if (!Number.isFinite(cost[node]) || !croftGround(p)) continue;
        let cultivable = 0;
        for (const reach of [0.3, 0.6, 0.95]) for (let k = 0; k < 12; k++) {
          const angle = k * M.PI / 6, q = { column: p.column + M.cos(angle) * reach / metric.column, row: p.row + M.sin(angle) * reach / metric.row };
          if (arable(q)) cultivable++;
        }
        if (cultivable < 23) continue;
        candidates.push({ node, score: cultivable / 36 - sample(slopes, n, n, b, p.row, p.column) * 2 - 0.018 * distance(p, c) / r + random(seed, 67100 + node) * 0.16 });
      }
      candidates.sort((a, b2) => b2.score - a.score || a.node - b2.node);
      const settlementCount = M.max(2, M.min(10, M.ceil(M.sqrt((recipe.population?.estimate || 1e3) / 1e3))));
      for (const candidate of candidates) {
        if (ruralSettlements.length >= settlementCount) break;
        const p = point(candidate.node);
        if (ruralSettlements.some((site) => distance(site.center, p) < M.max(0.85, r * 0.72))) continue;
        const delta = 0.025, gx = elevationAt(surface, { ...p, column: p.column + delta / metric.column }) - elevationAt(surface, { ...p, column: p.column - delta / metric.column }), gy = elevationAt(surface, { ...p, row: p.row + delta / metric.row }) - elevationAt(surface, { ...p, row: p.row - delta / metric.row }), axisRadians = sample(slopes, n, n, b, p.row, p.column) > 0.015 ? M.atan2(gx, -gy) : form.axisRadians + (random(seed, 67200 + candidate.node) - 0.5) * 0.65, u = { x: M.cos(axisRadians), y: M.sin(axisRadians) }, v = { x: -u.y, y: u.x }, at = (x, y) => ({ column: p.column + (u.x * x + v.x * y) / metric.column, row: p.row + (u.y * x + v.y * y) / metric.row }), id = "country-settlement-" + ruralSettlements.length, variant = M.floor(random(seed, 67300 + candidate.node) * 4), size = 0.82 + random(seed, 67301 + candidate.node) * 0.34, lengthScale = 0.86 + random(seed, 67303 + candidate.node) * 0.3, depthScale = 0.86 + random(seed, 67304 + candidate.node) * 0.28, shear = (random(seed, 67305 + candidate.node) - 0.5) * 0.3, local = (x, y) => at((x * lengthScale + y * shear) * size, y * depthScale * size), lane = (name, points) => ({ id: id + "-" + name, kind: "road", local: true, points: points.map(([x, y]) => local(x, y)) }), layout = ["street-village", "green-village", "fork-village", "courtyard-clusters"][variant], common = (variant === 1 ? [[-0.021, -0.013], [0.022, -9e-3], [4e-3, 0.025]] : variant === 0 ? [[-0.02, 0.022], [8e-3, 0.022], [8e-3, 0.045], [-0.02, 0.045]] : variant === 2 ? [[-5e-3, -0.039], [0.021, -0.039], [0.021, -0.017], [-5e-3, -0.017]] : [[-0.016, -0.012], [0.01, -0.012], [0.01, 0.011], [-0.016, 0.011]]).map(([x, y]) => local(x, y)), localLanes = variant === 0 ? [
          lane("street", [[-0.1, -6e-3], [-0.025, 5e-3], [0.035, -2e-3], [0.1, 0.015]]),
          lane("back-lane", [[0.035, -2e-3], [0.048, -0.055], [0.083, -0.067]])
        ] : variant === 1 ? [
          lane("green-west", [[-0.035, -0.025], [4e-3, 0.04]]),
          lane("green-east", [[4e-3, 0.04], [0.04, -0.022]]),
          lane("green-north", [[0.04, -0.022], [-0.035, -0.025]]),
          lane("approach", [[-0.1, -0.035], [-0.035, -0.025]]),
          lane("croft-lane", [[0.04, -0.022], [0.095, -0.046]])
        ] : variant === 2 ? [
          lane("street", [[-0.095, -0.018], [-0.024, 2e-3], [0.044, 0.03], [0.091, 0.018]]),
          lane("fork", [[-0.024, 2e-3], [-0.046, -0.055], [-0.024, -0.085]]),
          lane("croft-lane", [[0.044, 0.03], [0.035, 0.083]])
        ] : [
          lane("street", [[-0.095, 0.026], [-0.028, 0.026], [0.035, 0.026], [0.084, -4e-3]]),
          lane("west-court", [[-0.028, 0.026], [-0.047, -0.022], [-0.082, -0.044]]),
          lane("east-court", [[0.035, 0.026], [0.043, -0.025], [0.08, -0.044]])
        ], householdTarget = (variant === 1 ? 12 : variant === 0 ? 10 : 8) + M.floor(random(seed, 67302 + candidate.node) * 9);
        if (localLanes.some((lane2) => lane2.points.slice(1).some((q, i) => !safeAccess(lane2.points[i], q)))) continue;
        let croftsFit = true;
        for (const lane2 of localLanes) for (let i = 1; i < lane2.points.length; i++) {
          const a = lane2.points[i - 1], z = lane2.points[i], length2 = distance(a, z), nx = -(z.row - a.row) * metric.row / length2, ny = (z.column - a.column) * metric.column / length2;
          for (let t = 0; t <= 1 && croftsFit; t += 0.25) for (const side of [-1, 1]) {
            const q = { column: a.column + (z.column - a.column) * t + nx * 0.055 * side / metric.column, row: a.row + (z.row - a.row) * t + ny * 0.055 * side / metric.row };
            if (!arable(q) || sample(slopes, n, n, b, q.row, q.column) > 0.085) {
              croftsFit = false;
              break;
            }
          }
        }
        if (!croftsFit) continue;
        let chain = chainTo(candidate.node);
        while (chain.length > 1 && distance(point(chain.at(-1)), p) < 0.13) chain.pop();
        const tail = point(chain.at(-1)), prefix = pathTo(chain.at(-1)), touchesCommon = (a, z) => inPolygon(a, common) || inPolygon(z, common) || common.some((q, i) => crossing(a, z, q, common[(i + 1) % common.length]));
        if (prefix.slice(1).some((q, i) => touchesCommon(prefix[i], q))) continue;
        const entrances = localLanes.flatMap((lane2) => [lane2.points[0], lane2.points.at(-1)]).filter((q) => safeAccess(tail, q) && !touchesCommon(tail, q)).sort((a, z) => distance(tail, a) - distance(tail, z));
        if (!entrances.length) continue;
        const entrance = entrances[0];
        let run = [], approachId = null, anchor = anchors.get(chain[0]);
        const flush = () => {
          if (run.length > 1) {
            approachId = id + "-approach-" + roads.length;
            roads.push({ id: approachId, kind: "road", local: true, points: run });
          }
          run = [];
        };
        for (let i = 1; i < chain.length; i++) {
          const a = chain[i - 1], z = chain[i], key2 = [M.min(a, z), M.max(a, z)].join(":");
          if (used.has(key2)) {
            flush();
            anchor = null;
            continue;
          }
          used.add(key2);
          if (!run.length) {
            if (anchor) run.push(...anchor);
            run.push(point(a));
          }
          const bridge = bridgeEdges.get(a + ":" + z);
          if (bridge) run.push(...bridge);
          run.push(point(z));
          anchor = null;
        }
        if (!run.length) run.push(tail);
        if (distance(run.at(-1), entrance) > 1e-8) run.push(entrance);
        flush();
        roads.push(...localLanes);
        ruralSettlements.push({ id, center: p, entrance, axisRadians, layout, householdTarget, common, localLanes, roadId: approachId, access: prefix.concat(entrance) });
      }
      for (const route of [...roads, ...corridors].filter((route2) => route2.kind === "road")) {
        const points = [];
        for (const p of route.points) if (!points.length || distance(points.at(-1), p) > 1e-8) points.push(p);
        route.points = points;
      }
      const graph = /* @__PURE__ */ new Map(), key = (p) => `${round(p.column)}:${round(p.row)}`;
      for (const route of [...roads, ...corridors].filter((r2) => r2.kind === "road")) for (let i = 1; i < route.points.length; i++) {
        const a = key(route.points[i - 1]), z = key(route.points[i]);
        if (!graph.has(a)) graph.set(a, /* @__PURE__ */ new Set());
        if (!graph.has(z)) graph.set(z, /* @__PURE__ */ new Set());
        graph.get(a).add(z);
        graph.get(z).add(a);
      }
      const safeCurve = (a, z, width) => {
        if (crossesWater(a, z) || crossesReserved(a, z) || blockedByMasonry(a, z, width) || !waterClear(a, z, width)) return false;
        const length2 = distance(a, z);
        if (length2 < 1e-6) return true;
        if (M.abs(elevationAt(surface, a) - elevationAt(surface, z)) / (length2 * 1e3) > 0.12) return false;
        const steps = M.max(4, M.ceil(length2 / 0.025));
        let previous = elevationAt(surface, a);
        for (let k = 1; k <= steps; k++) {
          const p = interpolate(a, z, k / steps), height = elevationAt(surface, p);
          if (!isDry(surface, p) || M.abs(height - previous) / (length2 / steps * 1e3) > 0.12 || channels.some((ch) => {
            const near = distanceToLine(p, ch.points, metric);
            return near.distance < near.widthMetres / 2e3 + 0.01;
          })) return false;
          previous = height;
        }
        return true;
      };
      const portalVertices = new Set(gateStreets.flatMap((street) => street.points.map(key)));
      const curve = (route) => {
        if (route.kind !== "road" || route.points.length < 3) return route;
        const width = roadWidth(route);
        const fixed = (p) => graph.get(key(p))?.size !== 2 || portalVertices.has(key(p)) || bridges.some((bridge) => distanceToLine(p, bridge.points, metric).distance < 0.035);
        const points = [route.points[0]];
        for (let i = 1; i < route.points.length; ) {
          let far = i;
          while (far + 1 < route.points.length && !fixed(route.points[far]) && distance(route.points[i - 1], route.points[far + 1]) < 0.38 && safeCurve(points.at(-1), route.points[far + 1], width)) far++;
          points.push(route.points[far]);
          i = far + 1;
        }
        const out = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
          const a = points[i - 1], p = points[i], z = points[i + 1];
          if (fixed(p)) {
            out.push(p);
            continue;
          }
          const first = interpolate(p, a, 0.42), last = interpolate(p, z, 0.42), arc = [first];
          for (let k = 1; k <= 5; k++) {
            const t = k / 5, q = 1 - t;
            arc.push({ column: q * q * first.column + 2 * q * t * p.column + t * t * last.column, row: q * q * first.row + 2 * q * t * p.row + t * t * last.row });
          }
          if (safeCurve(out.at(-1), first, width) && arc.slice(1).every((q, k) => safeCurve(arc[k], q, width))) out.push(...arc);
          else out.push(p);
        }
        out.push(points.at(-1));
        return { ...route, points: out };
      };
      const villageFrontages = new Set(ruralSettlements.flatMap((village) => village.localLanes));
      const curved = (route) => {
        if (villageFrontages.has(route)) return route;
        const result = curve(route), points = [];
        for (const p of result.points) if (!points.length || distance(points.at(-1), p) > 1e-8) points.push(p);
        return { ...result, points };
      };
      const finalCorridors = corridors.map(curved), ruralRoads = roads.map(curved), fieldRecipe = { ...recipe, localSite: { form, ruralSettlements, urbanEnclosures: enclosures }, transport: { ...recipe.transport, corridors: [...finalCorridors, ...ruralRoads] } }, proposedFields = fields(fieldRecipe, surface, slopes, metric, channels, seed), byHolding = /* @__PURE__ */ new Map();
      for (const field of proposedFields) {
        if (!byHolding.has(field.holdingId)) byHolding.set(field.holdingId, []);
        byHolding.get(field.holdingId).push(field);
      }
      const crops = proposedFields.filter((field) => field.lines.length > 1).map((field) => {
        const points = field.lines[0].concat(field.lines.at(-1).slice().reverse());
        return { points, bounds: polygonBounds(points) };
      }), cropCandidates = boundsCandidates(crops.map((crop) => crop.bounds)), cityCandidates = boundsCandidates(enclosureBounds), cropFree = (a, z) => !cropCandidates(edgeBounds(a, z)).some((i) => {
        const poly = crops[i].points;
        return inPolygon(a, poly) || inPolygon(z, poly) || poly.some((q, j) => crossing(a, z, q, poly[(j + 1) % poly.length]));
      }), trackEdge = (a, z) => {
        if (insideCity(a) || insideCity(z) || !safeAccess(a, z, 1.8) || !cropFree(a, z)) return false;
        const half = 9e-4, length2 = distance(a, z);
        if (length2 < 1e-12) return true;
        const nx = -(z.row - a.row) * metric.row / length2 * half / metric.column, ny = (z.column - a.column) * metric.column / length2 * half / metric.row, strip = [[a.column + nx, a.row + ny], [z.column + nx, z.row + ny], [z.column - nx, z.row - ny], [a.column - nx, a.row - ny]], bounds = {
          west: M.min(a.column, z.column) - half / metric.column,
          east: M.max(a.column, z.column) + half / metric.column,
          north: M.min(a.row, z.row) - half / metric.row,
          south: M.max(a.row, z.row) + half / metric.row
        };
        return !cityCandidates(bounds).some((i) => {
          const polygon = enclosures[i];
          return import_polygon_clipping.default.intersection([strip], [polygon.map((p) => [p.column, p.row])]).length || [a, z].some((p) => distanceToLine(p, polygon.concat(polygon[0]), metric).distance < half);
        });
      }, usableRoutes = [...finalCorridors, ...ruralRoads].filter((route) => route.kind === "road"), farmland = [];
      for (const [holdingId, group] of byHolding) {
        group.sort((a, z) => a.stripIndex - z.stripIndex);
        const middleIndex = M.floor(group.length / 2), middle = group[middleIndex], entrance = middle.access.at(-1), headCenter = (points2) => ({ column: points2.reduce((sum, p) => sum + p.column, 0) / points2.length, row: points2.reduce((sum, p) => sum + p.row, 0) / points2.length }), side = distance(headCenter(middle.headlands[0]), entrance) < distance(headCenter(middle.headlands[1]), entrance) ? 0 : 1, headlands = group.map((field) => headCenter(field.headlands[side])), waypoints = [headlands[0], headlands.at(-1)], candidates2 = [];
        if (headlands.some((p, i) => i && !trackEdge(headlands[i - 1], p))) continue;
        for (const route of usableRoutes) for (let i = 1; i < route.points.length; i++) {
          const a = route.points[i - 1], z = route.points[i], dx2 = (z.column - a.column) * metric.column, dy2 = (z.row - a.row) * metric.row, t = clamp(((entrance.column - a.column) * metric.column * dx2 + (entrance.row - a.row) * metric.row * dy2) / (dx2 * dx2 + dy2 * dy2 || 1), 0, 1), projection = interpolate(a, z, t);
          for (const q of insideCity(projection) ? [a, z] : [projection]) {
            const length2 = distance(q, entrance);
            if (length2 < 1.8 && !insideCity(q)) candidates2.push({ q, length: length2 });
          }
        }
        candidates2.sort((a, z) => a.length - z.length);
        let access = null;
        for (const candidate of candidates2.slice(0, 64)) {
          if (trackEdge(candidate.q, entrance)) {
            access = [candidate.q, entrance];
            break;
          }
          for (const waypoint of waypoints) if (trackEdge(candidate.q, waypoint) && trackEdge(waypoint, entrance)) {
            access = [candidate.q, waypoint, entrance];
            break;
          }
          if (access) break;
        }
        if (!access) continue;
        const traversal = access.concat(headlands.slice(0, middleIndex + 1).reverse(), headlands.slice(1)), points = [];
        if (traversal.some((p, i) => i && !trackEdge(traversal[i - 1], p))) continue;
        for (const p of traversal) if (!points.length || distance(p, points.at(-1)) > 1e-8) points.push(p);
        if (points.length < 2) continue;
        const track = { id: "field-track-" + holdingId, kind: "road", local: true, fieldTrack: true, holdingId, points };
        ruralRoads.push(track);
        usableRoutes.push(track);
        farmland.push(...group.map((field) => ({ ...field, access })));
      }
      for (let i = bridges.length - 1; i >= 0; i--) if (![...finalCorridors, ...ruralRoads].some((route) => route.kind === bridges[i].kind && bridges[i].points.every((p) => distanceToLine(p, route.points, metric).distance < 1e-6))) bridges.splice(i, 1);
      for (const station of railwayStations) station.access = finalCorridors.find((route) => route.id === station.accessId).points;
      return { ruralRoads, farmland, ruralSettlements: ruralSettlements.map((site) => ({ ...site, access: curved({ kind: "road", points: site.access }).points })), corridors: finalCorridors, railwayStations, railwayStatus };
    }
    function landform(recipe, context) {
      const b = context.bounds, c = recipe.location, m = context.gridCellKilometres, r = M.max(0.5, recipe.urban.radiusKm), z = (x, y) => sample(context.elevationMetres, context.rows, context.columns, b, c.row + y / m.row, c.column + x / m.column), h = z(0, 0), dx = z(r, 0) - z(-r, 0), dy = z(0, r) - z(0, -r), cx = z(r, 0) + z(-r, 0) - 2 * h, cy = z(0, r) + z(0, -r) - 2 * h;
      const grade = M.hypot(dx, dy) / (r * 2e3), steep = ["steep", "escarpment"].includes(recipe.terrain?.slopeClass) || grade > 0.065, rolling = recipe.terrain?.slopeClass === "rolling" || grade > 0.018;
      const mixed = (z(r, r) + z(-r, -r) - z(r, -r) - z(-r, r)) / 4, delta = M.hypot(cx - cy, 2 * mixed), high = (cx + cy + delta) / 2, low = (cx + cy - delta) / 2, acrossAxis = M.atan2(2 * mixed, cx - cy) / 2;
      const valley = high > M.max(10, M.hypot(dx, dy) * 0.12) && low < high * 0.5;
      const ridge = low < -15;
      const coast = ["port", "island-port"].includes(recipe.siteType) && steep;
      const kind = coast ? "coastal-slope" : valley ? "valley" : ridge ? "ridge" : steep ? "hillside" : rolling ? "hills" : "plain";
      const axisRadians = kind === "valley" || kind === "ridge" ? acrossAxis + M.PI / 2 : kind === "plain" ? (recipe.morphology?.orientationDegrees || 0) * M.PI / 180 : M.atan2(dx, -dy);
      const crossScale = { plain: 0.92, hills: 0.64, hillside: 0.3, valley: 0.22, ridge: 0.33, "coastal-slope": 0.26 }[kind];
      return {
        kind,
        axisRadians,
        crossScale,
        alongScale: ["valley", "hillside", "coastal-slope"].includes(kind) ? 1.32 : kind === "ridge" ? 1.08 : 0.95,
        label: { plain: "\u7F13\u5761\u5E73\u539F", hills: "\u4E18\u9675\u4E0E\u7F13\u5761", hillside: "\u5C71\u5761\u53F0\u5730", valley: "\u72ED\u957F\u6CB3\u8C37", ridge: "\u5C71\u810A\u4E0E\u9AD8\u53F0", "coastal-slope": "\u6CBF\u6D77\u9661\u5761\u53F0\u5730" }[kind]
      };
    }
    function settlementLandform(form, surface, recipe, metric) {
      if (form.kind !== "valley") return form;
      const radius = recipe.urban.radiusKm, center = recipe.location, across = { x: -M.sin(form.axisRadians), y: M.cos(form.axisRadians) }, h = elevationAt(surface, center), sideGrade = M.max(...[-1, 1].map((sign) => M.abs(elevationAt(surface, {
        column: center.column + across.x * radius * sign / metric.column,
        row: center.row + across.y * radius * sign / metric.row
      }) - h) / (radius * 1e3)));
      return sideGrade > 0.018 ? form : { ...form, kind: "plain", crossScale: 0.92, alongScale: 0.95, label: "\u7F13\u5761\u5E73\u539F" };
    }
    function crossings(recipe, surface, context, channels) {
      const candidates = [], metric = context.gridCellKilometres, bounds = surface.bounds, roadWidth = M.max(5, recipe.urban.streetWidthsMetres?.arterial || 8), clearance = (p) => channels.reduce((best, ch) => {
        const near = distanceToLine(p, ch.points, metric);
        return M.min(best, near.distance - near.widthMetres / 2e3);
      }, Infinity), setback = M.max(0.012, roadWidth / 1e3);
      for (const route of recipe.transport.corridors) if (route.kind === "road" || route.kind === "rail") for (let segment = 1; segment < route.points.length; segment++) {
        const a = route.points[segment - 1], b = route.points[segment], dx = (b.column - a.column) * metric.column, dy = (b.row - a.row) * metric.row, length2 = M.hypot(dx, dy);
        const railway = route.kind === "rail", bridgeWidth = railway ? 6 : roadWidth;
        if (length2 < 1e-3) continue;
        for (const channel of channels) for (let index = 1; index < channel.points.length; index++) {
          const c = channel.points[index - 1], d = channel.points[index], sx = (d.column - c.column) * metric.column, sy = (d.row - c.row) * metric.row, qx = (c.column - a.column) * metric.column, qy = (c.row - a.row) * metric.row, denominator = dx * sy - dy * sx;
          if (M.abs(denominator) < 1e-9) continue;
          const t = (qx * sy - qy * sx) / denominator, u = (qx * dy - qy * dx) / denominator;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const point = { row: a.row + (b.row - a.row) * t, column: a.column + (b.column - a.column) * t };
          const widthMetres = c.widthMetres + (d.widthMetres - c.widthMetres) * u;
          const bank = (sign, axis) => {
            const vx = axis.x * sign, vy = axis.y * sign, limit = M.min(
              vx > 0 ? (bounds.east - point.column) * metric.column / vx : vx < 0 ? (bounds.west - point.column) * metric.column / vx : Infinity,
              vy > 0 ? (bounds.south - point.row) * metric.row / vy : vy < 0 ? (bounds.north - point.row) * metric.row / vy : Infinity
            ), at = (d2) => ({ row: point.row + vy * d2 / metric.row, column: point.column + vx * d2 / metric.column }), dry = (d2) => {
              const p = at(d2);
              if (!isDry(surface, p) || clearance(p) < setback) return false;
              return [-1, 1].every((side) => {
                const corner = { column: p.column - vy * bridgeWidth / 2e3 * side / metric.column, row: p.row + vx * bridgeWidth / 2e3 * side / metric.row };
                return corner.column >= bounds.west && corner.column <= bounds.east && corner.row >= bounds.north && corner.row <= bounds.south && isDry(surface, corner) && clearance(corner) >= 4e-3;
              });
            }, step = M.max(4e-3, M.min(0.025, widthMetres / 1e3 * 0.1));
            let low = 0;
            for (let high = M.min(step, limit); high > low; high = M.min(high + step, limit)) {
              if (dry(high)) {
                for (let k = 0; k < 22; k++) {
                  const mid = (low + high) / 2;
                  if (dry(mid)) high = mid;
                  else low = mid;
                }
                return { point: at(high), distanceKm: high };
              }
              low = high;
            }
            return null;
          }, roadAxis = { x: dx / length2, y: dy / length2 }, solve = (axis) => {
            const banks = [bank(-1, axis), bank(1, axis)];
            if (banks.some((p) => !p)) return null;
            const points = banks.map((p) => p.point), heights = points.map((p) => elevationAt(surface, p)), span = banks.reduce((sum, p) => sum + p.distanceKm, 0), grade = M.abs(heights[1] - heights[0]) / (span * 1e3);
            return grade <= (railway ? 0.035 : 0.12) ? { points, heights, span, grade, axis } : null;
          }, nearby = channels.map((ch) => ({ ch, near: distanceToLine(point, ch.points, metric) })).filter(({ near }) => near.distance < near.widthMetres / 2e3 + setback), localWidth = M.max(widthMetres, ...nearby.map(({ near }) => near.widthMetres)) / 1e3;
          let solved = solve(roadAxis);
          {
            const normals = nearby.map(({ ch }) => {
              let best = Infinity, normal = null;
              for (let i = 1; i < ch.points.length; i++) {
                const a2 = ch.points[i - 1], z = ch.points[i], x = (z.column - a2.column) * metric.column, y = (z.row - a2.row) * metric.row, px = (point.column - a2.column) * metric.column, py = (point.row - a2.row) * metric.row, l = M.hypot(x, y);
                if (l < 1e-9) continue;
                const t2 = clamp((px * x + py * y) / (l * l), 0, 1), d2 = M.hypot(px - x * t2, py - y * t2);
                if (d2 < best) {
                  best = d2;
                  normal = { x: -y / l, y: x / l };
                }
              }
              return normal;
            }).filter(Boolean), axes = normals.slice();
            for (let i = 0; i < normals.length; i++) for (let j = i + 1; j < normals.length; j++) for (const sign of [-1, 1]) {
              const x = normals[i].x + normals[j].x * sign, y = normals[i].y + normals[j].y * sign, l = M.hypot(x, y);
              if (l > 1e-8) axes.push({ x: x / l, y: y / l });
            }
            const score = (result2) => result2.span * (1 + (1 - M.abs(result2.axis.x * roadAxis.x + result2.axis.y * roadAxis.y)) * 0.04);
            for (let axis of axes) {
              if (axis.x * roadAxis.x + axis.y * roadAxis.y < 0) axis = { x: -axis.x, y: -axis.y };
              const candidate = solve(axis);
              if (candidate && (!solved || score(candidate) < score(solved))) solved = candidate;
            }
          }
          if (!solved || railway && solved.span > M.max(0.25, localWidth * 4)) continue;
          candidates.push({
            kind: route.kind,
            routeId: route.id,
            center: point,
            points: solved.points,
            widthMetres: bridgeWidth,
            grade: solved.grade,
            bankHeightsMetres: solved.heights,
            channelIndex: channels.indexOf(channel),
            spanKm: solved.span,
            localWidthKm: localWidth
          });
        }
      }
      const distance = (a, b) => M.hypot((a.column - b.column) * metric.column, (a.row - b.row) * metric.row), result = [];
      candidates.sort((a, b) => a.spanKm + distance(a.center, recipe.location) * 0.08 - (b.spanKm + distance(b.center, recipe.location) * 0.08));
      for (const candidate of candidates) {
        const spacing = M.max(0.12, recipe.urban.radiusKm * 0.8, candidate.localWidthKm * 3);
        if (result.some((bridge) => {
          if (bridge.kind !== candidate.kind) return false;
          const sameBanks = [candidate.points, candidate.points.slice().reverse()].some((points) => bridge.points.every((p, i) => {
            const length2 = distance(p, points[i]);
            if (length2 >= spacing) return false;
            const steps = M.max(1, M.ceil(length2 / 0.01));
            for (let k = 0; k <= steps; k++) {
              const q = interpolate(p, points[i], k / steps);
              if (!isDry(surface, q) || clearance(q) < 4e-3) return false;
            }
            return true;
          }));
          return sameBanks || bridge.channelIndex === candidate.channelIndex && distance(bridge.center, candidate.center) < spacing;
        })) continue;
        result.push({
          ...candidate,
          id: "bridge-" + result.length,
          name: Array.from(recipe.name || "\u5F53\u5730").slice(0, 3).join("") + (candidate.kind === "rail" ? "\u94C1\u8DEF\u6865" : "\u6EAA\u6865") + (result.length ? String(result.length + 1) : "")
        });
      }
      return result.map(({ channelIndex, spanKm, localWidthKm, ...bridge }) => bridge);
    }
    function contourPaths(heights, land, surface) {
      const dryHeights = heights.filter((_, index) => land[index]);
      if (!dryHeights.length) throw new RangeError("\u5DF2\u4FDD\u5B58\u7684\u57CE\u5E02\u8303\u56F4\u6CA1\u6709\u53EF\u7528\u9646\u5730\uFF0C\u8BF7\u6838\u5BF9\u771F\u5B9E\u57CE\u5E02\u951A\u70B9\u4E0E\u6C34\u57DF\u8303\u56F4");
      const minimum = M.min(...dryHeights), maximum = M.max(...dryHeights);
      const span = M.max(1, maximum - minimum);
      // 星球推演：与主地图同一套分层设色（细分 40 档，近似连续渐变）
      const HYP = [[0, [169, 209, 138]], [150, [188, 217, 143]], [450, [223, 226, 156]], [900, [239, 215, 150]], [1500, [230, 184, 120]], [2200, [208, 144, 98]], [3000, [174, 116, 82]], [3900, [148, 112, 94]], [4800, [217, 210, 204]], [5600, [247, 245, 242]]];
      const hyp = (h) => { let i = 1; while (i < HYP.length - 1 && HYP[i][0] < h) i++; const [h0, c0] = HYP[i - 1], [h1, c1] = HYP[i], t = M.max(0, M.min(1, (h - h0) / (h1 - h0))); return c0.map((v, k) => v + (c1[k] - v) * t); };
      const colours = Array.from({ length: 40 }, (_, index) => { const c = hyp(minimum + span * index / 39); return "#" + c.map((v) => M.round(v * 0.9 + 246 * 0.1).toString(16).padStart(2, "0")).join(""); });
      const levels = colours.map((_, index) => minimum + span * index / (colours.length - 1));
      const interval = [5, 10, 20, 25, 50, 100, 200, 500].find((v) => span / v <= 20) || 1e3;
      const contourLevels = Array.from({ length: M.floor(maximum / interval) - M.ceil(minimum / interval) + 1 }, (_, i) => (M.ceil(minimum / interval) + i) * interval);
      const bandPaths = levels.map(() => []);
      const lines = contourLevels.map(() => []), lineSegments = contourLevels.map(() => []);
      const waterPaths = [], dryPaths = [];
      const fmt = (point) => `${round(point.column)} ${round(point.row)}`;
      const clip = (polygon, level, above = true) => {
        const result = [];
        for (let index = 0; index < polygon.length; index++) {
          const a = polygon[index], b = polygon[(index + 1) % polygon.length];
          const inside = (point) => above ? point.height >= level : point.height <= level;
          if (inside(a)) result.push(a);
          if (inside(a) !== inside(b)) {
            const t = (level - a.height) / (b.height - a.height);
            result.push({ row: a.row + (b.row - a.row) * t, column: a.column + (b.column - a.column) * t, height: level });
          }
        }
        return result;
      };
      const dryTriangle = (triangle) => {
        let polygon = triangle;
        for (const field of ["clearance", "depth"]) {
          const result = [], value = (p) => field === "depth" ? -p.depth : p.clearance;
          for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length], va = value(a), vb = value(b);
            if (va > 0) result.push(a);
            if (va > 0 !== vb > 0) {
              const t = va / (va - vb), p = {};
              for (const key of ["column", "row", "height", "clearance", "depth"]) p[key] = a[key] + (b[key] - a[key]) * t;
              result.push(p);
            }
          }
          polygon = result;
        }
        return polygon;
      };
      for (const triangle of surfaceTriangles(surface)) {
        const dry = dryTriangle(triangle);
        if (dry.length < 3) continue;
        const min = M.min(...triangle.map((p) => p.height)), max = M.max(...triangle.map((p) => p.height)), ring = dry.map((p) => [round(p.column) + 0, round(p.row) + 0]), full = `M${ring.map((p) => p.join(" ")).join("L")}Z`;
        dryPaths.push(ring);
        for (let levelIndex = 1; levelIndex < levels.length; levelIndex++) {
          const level = levels[levelIndex], upper = levels[levelIndex + 1] ?? Infinity;
          if (level > max || upper <= min) continue;
          if (level <= min && upper >= max) {
            bandPaths[levelIndex].push(full);
            continue;
          }
          const polygon = clip(clip(dry, level), upper, false);
          if (polygon.length >= 3) bandPaths[levelIndex].push(`M${polygon.map(fmt).join("L")}Z`);
        }
        for (let levelIndex = 0; levelIndex < contourLevels.length; levelIndex++) {
          const level = contourLevels[levelIndex];
          if (level <= min || level >= max) continue;
          const intersections = [];
          for (let edge = 0; edge < dry.length; edge++) {
            const first = dry[edge], last = dry[(edge + 1) % dry.length];
            if (first.height < level === last.height < level) continue;
            const t = (level - first.height) / (last.height - first.height);
            intersections.push({ row: first.row + (last.row - first.row) * t, column: first.column + (last.column - first.column) * t });
          }
          if (intersections.length === 2) {
            lines[levelIndex].push(`M${fmt(intersections[0])}L${fmt(intersections[1])}`);
            lineSegments[levelIndex].push(intersections);
          }
        }
      }
      for (const body of surface.waterDomain.waterBodies) {
        const polygons = body.geometry.type === "Polygon" ? [body.geometry.coordinates] : body.geometry.coordinates;
        for (const rings of polygons) for (const ring of rings) waterPaths.push(`M${ring.map((p) => `${p[0]} ${p[1]}`).join("L")}Z`);
      }
      const dryArea = dryGroundPath(dryPaths);
      return {
        terrainBands: bandPaths.map((paths, index) => ({ d: index ? paths.join("") : dryArea, fill: colours[index], elevation: M.round(levels[index]) })).filter((band) => band.d),
        contours: lines.map((paths, index) => ({
          d: paths.join(""),
          elevation: contourLevels[index],
          major: index % 4 === 0,
          anchor: lineSegments[index][M.floor(lineSegments[index].length * 0.47)]?.[0]
        })).filter((line) => line.d),
        elevationRange: { minimum: M.round(minimum), maximum: M.round(maximum), interval },
        waterArea: waterPaths.join(""),
        dryArea
      };
    }
    function cultivationKind(surface, channels, metric, point, slope, seed, salt) {
      if (slope > 0.035) return "terrace";
      const height = elevationAt(surface, point);
      if (channels.some((channel) => {
        const near = distanceToLine(point, channel.points, metric);
        return near.distance - near.widthMetres / 2e3 < 0.16 && height - near.elevation < 3;
      })) return "meadow";
      return random(seed, salt + 13) < 0.12 ? "orchard" : "field";
    }
    function fields(recipe, surface, slopes, metric, channels, seed) {
      const n = surface.rows, c = recipe.location, r = recipe.urban.radiusKm, b = surface.bounds, roads = recipe.transport.corridors.filter((road) => road.kind === "road" && road.points.length > 1), rails = recipe.transport.corridors.filter((road) => road.kind === "rail"), local = (p) => ({ x: (p.column - c.column) * metric.column, y: (p.row - c.row) * metric.row }), world = (p) => ({ column: c.column + p.x / metric.column, row: c.row + p.y / metric.row }), distance = (a, z) => M.hypot((a.column - z.column) * metric.column, (a.row - z.row) * metric.row), form = recipe.localSite?.form || landform(recipe, { bounds: b, gridCellKilometres: metric, rows: n, columns: n, elevationMetres: surface.elevationMetres }), results = [], holdings = [], urban = (recipe.localSite?.urbanEnclosures || []).map((points) => ({
        bounds: polygonBounds(points),
        geometry: [points.map((p) => [p.column, p.row])]
      })), urbanCandidates = boundsCandidates(urban.map((polygon) => polygon.bounds)), outsideCity = (points) => !urbanCandidates(polygonBounds(points)).some((i) => import_polygon_clipping.default.intersection([points.map((p) => [p.column, p.row])], urban[i].geometry).length);
      const check = (p) => {
        if (p.column < b.west || p.column > b.east || p.row < b.north || p.row > b.south) return false;
        const q = local(p), along = q.x * M.cos(form.axisRadians) + q.y * M.sin(form.axisRadians), across = -q.x * M.sin(form.axisRadians) + q.y * M.cos(form.axisRadians);
        return isDry(surface, p) && sample(slopes, n, n, b, p.row, p.column) < 0.16 && M.hypot(along / (form.alongScale * r), across / (form.crossScale * r)) > 1.13 && !channels.some((ch) => {
          const near = distanceToLine(p, ch.points, metric);
          return near.distance < near.widthMetres / 2e3 + 0.035;
        }) && !roads.some((road) => distanceToLine(p, road.points, metric).distance < 0.025) && !rails.some((road) => distanceToLine(p, road.points, metric).distance < 0.028) && !(recipe.localSite?.ruralSettlements || []).some((site) => distance(p, site.center) < 0.105);
      };
      const overlap = (a, z) => ![a, z].some((polygon) => polygon.some((p, i) => {
        const q = polygon[(i + 1) % polygon.length], nx = q.y - p.y, ny = p.x - q.x, first = a.map((v) => v.x * nx + v.y * ny), second = z.map((v) => v.x * nx + v.y * ny);
        return M.max(...first) <= M.min(...second) || M.max(...second) <= M.min(...first);
      }));
      const safePolygon = (poly) => {
        if (!poly.every((p) => check(world(p))) || waterOverlaps(surface, poly.map(world))) return false;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], z = poly[(i + 1) % poly.length], length2 = M.hypot(z.x - a.x, z.y - a.y);
          for (let k = 1; k <= M.ceil(length2 / 0.018); k++) if (!check(world({ x: a.x + (z.x - a.x) * k / M.ceil(length2 / 0.018), y: a.y + (z.y - a.y) * k / M.ceil(length2 / 0.018) }))) return false;
        }
        return true;
      };
      const villages = recipe.localSite.ruralSettlements;
      for (const [villageIndex, village] of villages.entries()) {
        const origin = local(village.center), cos = M.cos(village.axisRadians), sin = M.sin(village.axisRadians), candidates = [];
        for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
          const key = (y + 4) * 9 + x + 4, salt = 7e4 + villageIndex * 10007 + key * 37, dx = (x + (random(seed, salt) - 0.5) * 0.24) * 0.29, dy = (y + (random(seed, salt + 1) - 0.5) * 0.24) * 0.29, reach = M.hypot(dx, dy);
          if (reach < 0.27 || reach > 1.2) continue;
          const center = { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos }, mid = world(center);
          if (villages.some((other) => other !== village && distance(mid, other.center) < distance(mid, village.center)) || !check(mid)) continue;
          const slope = sample(slopes, n, n, b, mid.row, mid.column);
          candidates.push({ key, salt, center, mid, slope, rank: random(seed, salt + 2) - slope * 2 });
        }
        candidates.sort((a, b2) => b2.rank - a.rank || a.key - b2.key);
        let acceptedHoldings = 0;
        for (const candidate of candidates) {
          if (acceptedHoldings >= 18) break;
          const { salt, center, mid, slope } = candidate, stripCount = 6 + M.floor(random(seed, salt + 3) * 4), stripWidth = 0.028 + random(seed, salt + 4) * 0.018, longLength = 0.26 + random(seed, salt + 5) * 0.23, delta = 0.025, gx = elevationAt(surface, { ...mid, column: mid.column + delta / metric.column }) - elevationAt(surface, { ...mid, column: mid.column - delta / metric.column }), gy = elevationAt(surface, { ...mid, row: mid.row + delta / metric.row }) - elevationAt(surface, { ...mid, row: mid.row - delta / metric.row }), theta = slope > 0.035 ? M.atan2(gx, -gy) : village.axisRadians + (random(seed, salt + 6) - 0.5) * 0.18, long = { x: M.cos(theta), y: M.sin(theta) }, cross = { x: long.y, y: -long.x }, width = stripCount * stripWidth, bend = (random(seed, salt + 7) - 0.5) * 0.014, at = (x, t) => ({
            x: center.x + cross.x * (x + bend * M.sin(M.PI * t)) + long.x * (t - 0.5) * longLength,
            y: center.y + cross.y * (x + bend * M.sin(M.PI * t)) + long.y * (t - 0.5) * longLength
          }), outer = [at(-width * 0.5, 0), at(width * 0.5, 0), at(width * 0.5, 1), at(-width * 0.5, 1)];
          const holdingFootprint = [0, 0.25, 0.5, 0.75, 1].map((t) => at(-width * 0.5, t)).concat([1, 0.75, 0.5, 0.25, 0].map((t) => at(width * 0.5, t))).map(world);
          if (!check(mid) || !outsideCity(holdingFootprint) || holdings.some((holding) => overlap(outer, holding))) continue;
          const group = [], holdingId = "holding-" + village.id + "-" + candidate.key, kind = cultivationKind(surface, channels, metric, mid, slope, seed, salt), palette = window.WorldAtlasCityCharacter.mapPalette;
          for (let index = 0; index < stripCount; index++) {
            const left = (index - stripCount * 0.5) * stripWidth + 1e-3, right = left + stripWidth - 2e-3, outline = [0, 0.25, 0.5, 0.75, 1].map((t) => at(left, t)).concat([1, 0.75, 0.5, 0.25, 0].map((t) => at(right, t)));
            if (!safePolygon(outline) || !check(world(at((left + right) * 0.5, 0.5)))) continue;
            if ([0.2, 0.4, 0.6, 0.8].some((t) => !check(world(at((left + right) * 0.5, t))))) continue;
            const head = 0.012 / longLength, lines = [], rowCount = kind === "meadow" ? 0 : kind === "orchard" ? M.max(2, M.floor(stripWidth / 9e-3)) : M.max(4, M.floor(stripWidth / 4e-3)), headlands = [
              [at(left, 0), at(right, 0), at(right, head), at(left, head)],
              [at(left, 1 - head), at(right, 1 - head), at(right, 1), at(left, 1)]
            ].map((poly) => poly.map(world));
            for (let row = 1; row <= rowCount; row++) {
              const x = left + (right - left) * row / (rowCount + 1);
              lines.push([head, 0.25, 0.5, 0.75, 1 - head].map((t) => world(at(x, t))));
            }
            const first = at((left + right) * 0.5, head * 0.5), last = at((left + right) * 0.5, 1 - head * 0.5), entrance = M.hypot(first.x - origin.x, first.y - origin.y) < M.hypot(last.x - origin.x, last.y - origin.y) ? first : last, access = [village.center, world(entrance)];
            group.push({
              points: outline.map(world),
              center: world(at((left + right) * 0.5, 0.5)),
              lines,
              headlands,
              banks: index === 0 || index === stripCount - 1 ? [[0, 0.25, 0.5, 0.75, 1].map((t) => world(at(index === 0 ? left : right, t)))] : [],
              access,
              holdingId,
              settlementId: village.id,
              stripIndex: index,
              system: slope > 0.035 ? "terrace" : "open-field",
              kind,
              slope,
              areaKm2: (right - left) * longLength,
              fill: kind === "meadow" ? palette.meadow : kind === "orchard" ? palette.orchard : palette.fields[(index + M.floor(random(seed, salt + 6) * 4)) % palette.fields.length]
            });
          }
          const runs = [];
          for (const field of group) {
            const run = runs.at(-1);
            if (run && field.stripIndex === run.at(-1).stripIndex + 1) run.push(field);
            else runs.push([field]);
          }
          const accepted = runs.filter((run) => run.length >= 3).flat();
          if (accepted.length) {
            results.push(...accepted);
            holdings.push(outer);
            acceptedHoldings++;
          }
        }
      }
      return results;
    }
    function woodlandRoadClearance(recipe, road) {
      const widths = recipe.urban.streetWidthsMetres, width = road.kind === "rail" ? widths.arterial * 0.65 : road.fieldTrack ? 1.8 : ["arterial", "collector", "local"].includes(road.kind) ? widths[road.kind] * 1.35 : widths[road.local ? "collector" : "arterial"] * 1.35;
      return width / 2e3 + 2e-3;
    }
    function clearTreeCrowns(recipe, streets, plots) {
      const trees = recipe.localSite?.trees || [], metric = recipe.urban.gridCellKilometres;
      if (!trees.length) return [];
      const maximumRadius = M.max(...trees.map((tree) => tree.radiusMetres)) / 1e3, expand = (points, margin) => {
        const box = polygonBounds(points);
        return {
          west: box.west - margin / metric.column,
          east: box.east + margin / metric.column,
          north: box.north - margin / metric.row,
          south: box.south + margin / metric.row
        };
      }, roads = [...recipe.transport.corridors, ...streets].filter((road) => road.points.length > 1).map((road) => ({ points: road.points, clearance: woodlandRoadClearance(recipe, road) })), roadCandidates = boundsCandidates(roads.map((road) => expand(road.points, road.clearance + maximumRadius))), parcels = plots.filter((points) => points?.length >= 3).map((points) => ({ points, boundary: points.concat(points[0]) })), parcelCandidates = boundsCandidates(parcels.map((parcel) => expand(parcel.points, maximumRadius))), inside = (p, points) => {
        let result = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[i], b = points[j];
          if (a.row > p.row !== b.row > p.row && p.column < (b.column - a.column) * (p.row - a.row) / (b.row - a.row) + a.column) result = !result;
        }
        return result;
      };
      return trees.filter((tree) => {
        const p = tree.point, radius = tree.radiusMetres / 1e3, box = polygonBounds([p]);
        return !roadCandidates(box).some((i) => distanceToLine(p, roads[i].points, metric).distance < radius + roads[i].clearance) && !parcelCandidates(box).some((i) => inside(p, parcels[i].points) || distanceToLine(p, parcels[i].boundary, metric).distance < radius);
      });
    }
    function landscape(recipe, surface, slopes, coordinates, land, seed, farmland, channels) {
      const SIZE = surface.rows;
      const metric = recipe.urban.gridCellKilometres || { row: 10, column: 10 }, center = recipe.location, radius = recipe.urban.radiusKm;
      const trees = [], rocks = [], woods = [];
      const inside = (p, polygon) => {
        let result = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i], b = polygon[j];
          if (a.row > p.row !== b.row > p.row && p.column < (b.column - a.column) * (p.row - a.row) / (b.row - a.row) + a.column) result = !result;
        }
        return result;
      };
      const roads = recipe.transport.corridors.filter((r) => r.kind === "road" || r.kind === "rail").map((road) => {
        const clearance = woodlandRoadClearance(recipe, road), cols = road.points.map((p) => p.column), rows = road.points.map((p) => p.row);
        return { points: road.points, clearance, west: M.min(...cols), east: M.max(...cols), north: M.min(...rows), south: M.max(...rows) };
      });
      const nearRoad = (p, radius2) => roads.some((road) => {
        const reach = road.clearance + radius2, rc = reach / metric.column, rr = reach / metric.row;
        if (p.column < road.west - rc || p.column > road.east + rc || p.row < road.north - rr || p.row > road.south + rr) return false;
        return distanceToLine(p, road.points, metric).distance < reach;
      });
      const villageEdges = (recipe.localSite?.ruralSettlements || []).map((site) => {
        const path = site.access, tail = [path.at(-1)];
        let remaining = 0.14;
        for (let i = path.length - 1; i > 0 && remaining > 0; i--) {
          const a = path[i], b = path[i - 1], length2 = M.hypot((a.column - b.column) * metric.column, (a.row - b.row) * metric.row);
          if (length2 <= remaining) {
            tail.unshift(b);
            remaining -= length2;
          } else {
            tail.unshift(interpolate(a, b, remaining / length2));
            remaining = 0;
          }
        }
        return { center: site.center, tail, lanes: site.localLanes.map((lane) => lane.points) };
      });
      const villageClearance = (p) => villageEdges.reduce((clearance, site) => M.min(
        clearance,
        M.hypot((p.column - site.center.column) * metric.column, (p.row - site.center.row) * metric.row) - 0.1,
        distanceToLine(p, site.tail, metric).distance - 0.055,
        ...site.lanes.map((lane) => distanceToLine(p, lane, metric).distance - 0.055)
      ), Infinity);
      const fieldBoxes = farmland.map((field) => ({
        field,
        boundary: field.points.concat(field.points[0]),
        west: M.min(...field.points.map((p) => p.column)),
        east: M.max(...field.points.map((p) => p.column)),
        north: M.min(...field.points.map((p) => p.row)),
        south: M.max(...field.points.map((p) => p.row))
      }));
      const urban = (recipe.localSite?.urbanEnclosures || []).map((points) => ({
        points,
        boundary: points.concat(points[0]),
        west: M.min(...points.map((p) => p.column)) - 0.025 / metric.column,
        east: M.max(...points.map((p) => p.column)) + 0.025 / metric.column,
        north: M.min(...points.map((p) => p.row)) - 0.025 / metric.row,
        south: M.max(...points.map((p) => p.row)) + 0.025 / metric.row
      })), urbanCandidates = boundsCandidates(urban), domestic = recipe.localSite?.domesticLanes || [], cityClearance = (p, radius2 = 0) => {
        let distance = Infinity;
        for (const i of urbanCandidates({
          west: p.column - radius2 / metric.column,
          east: p.column + radius2 / metric.column,
          north: p.row - radius2 / metric.row,
          south: p.row + radius2 / metric.row
        })) {
          const parcel = urban[i], edge = distanceToLine(p, parcel.boundary, metric).distance;
          distance = M.min(distance, (inside(p, parcel.points) ? -edge : edge) - 0.025);
        }
        for (const street of domestic) distance = M.min(distance, distanceToLine(p, street.points, metric).distance - 0.048);
        return distance;
      };
      const stepKm = M.min(
        (surface.bounds.east - surface.bounds.west) * metric.column,
        (surface.bounds.south - surface.bounds.north) * metric.row
      ) / (SIZE - 1), fieldCandidates = boundsCandidates(fieldBoxes.map((b) => ({
        west: b.west - stepKm / metric.column,
        east: b.east + stepKm / metric.column,
        north: b.north - stepKm / metric.row,
        south: b.south + stepKm / metric.row
      }))), groundAvailable = (p, radius2 = 0) => isDry(surface, p) && villageClearance(p) > radius2 && cityClearance(p, radius2) > radius2 && !channels.some((channel) => {
        const near = distanceToLine(p, channel.points, metric);
        return near.distance < near.widthMetres / 2e3 + 0.02 + radius2;
      }) && !fieldCandidates({
        west: p.column - radius2 / metric.column,
        east: p.column + radius2 / metric.column,
        north: p.row - radius2 / metric.row,
        south: p.row + radius2 / metric.row
      }).some((i) => {
        const b = fieldBoxes[i];
        return inside(p, b.field.points) || distanceToLine(p, b.boundary, metric).distance < radius2;
      }), available = (p, radius2) => {
        if (!groundAvailable(p, radius2) || nearRoad(p, radius2)) return false;
        const extent = radius2 / M.cos(M.PI / 16), crown = Array.from({ length: 16 }, (_, i) => ({
          column: p.column + M.cos(i * M.PI / 8) * extent / metric.column,
          row: p.row + M.sin(i * M.PI / 8) * extent / metric.row
        }));
        return crown.every((point) => point.column >= surface.bounds.west && point.column <= surface.bounds.east && point.row >= surface.bounds.north && point.row <= surface.bounds.south && isDry(surface, point)) && !waterOverlaps(surface, crown);
      }, riverside = new Uint8Array(coordinates.length);
      const valueNoise = (x, y, scale, salt) => {
        const u = x / scale, v = y / scale, i = M.floor(u), j = M.floor(v), ease = (t) => t * t * (3 - 2 * t), a = ease(u - i), b = ease(v - j), at = (xx, yy) => random(seed ^ salt, M.imul(xx, 73856093) ^ M.imul(yy, 19349663)), low = at(i, j) * (1 - a) + at(i + 1, j) * a, high = at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a;
        return low * (1 - b) + high * b;
      };
      const forestSignal = (p) => {
        const x = (p.column - center.column) * metric.column, y = (p.row - center.row) * metric.row, slope = elevationAt(surface, p, surface.slopes), riparian = channels.reduce((best, ch) => {
          const near = distanceToLine(p, ch.points, metric);
          return M.max(best, M.exp(-((M.max(0, near.distance - near.widthMetres / 2e3) / 0.12) ** 2)));
        }, 0);
        return valueNoise(x, y, 0.85, 103) * 0.55 + valueNoise(x, y, 0.29, 193) * 0.3 + valueNoise(x, y, 0.075, 317) * 0.15 + M.min(0.17, slope * 0.9) + riparian * 0.12;
      };
      const cover = coordinates.map((p, i) => {
        let value = M.min(
          forestSignal(p) - 0.53,
          cityClearance(p) / stepKm,
          surface.elevationMetres[i] / 10,
          villageClearance(p) / stepKm
        );
        if (surface.lakeDepths) value = M.min(value, -surface.lakeDepths[i] / 10);
        for (const channel of channels) {
          const near = distanceToLine(p, channel.points, metric);
          value = M.min(value, (near.distance - near.widthMetres / 2e3 - 0.02) / stepKm);
          if (near.distance < 0.18) riverside[i] = 1;
        }
        for (const fieldIndex of fieldCandidates(polygonBounds([p]))) {
          const b = fieldBoxes[fieldIndex];
          if (p.column < b.west - stepKm / metric.column || p.column > b.east + stepKm / metric.column || p.row < b.north - stepKm / metric.row || p.row > b.south + stepKm / metric.row) continue;
          const polygon = b.field.points, distance = distanceToLine(p, b.boundary, metric).distance;
          value = M.min(value, (inside(p, polygon) ? -distance : distance) / stepKm);
        }
        return value;
      });
      const free = coordinates.map((p, i) => land[i] && groundAvailable(p));
      for (let row = 1; row < SIZE - 2; row++) for (let column = 1; column < SIZE - 2; column++) {
        const index = row * SIZE + column;
        for (const triangle of [[index, index + 1, index + SIZE + 1], [index, index + SIZE + 1, index + SIZE]]) {
          if (triangle.every((i) => cover[i] <= 0)) continue;
          const polygon = [];
          for (let edge = 0; edge < 3; edge++) {
            const first = triangle[edge], last = triangle[(edge + 1) % 3], a = coordinates[first], b = coordinates[last], va = cover[first], vb = cover[last];
            if (va > 0) polygon.push(a);
            if (va > 0 !== vb > 0) {
              const t = va / (va - vb);
              polygon.push({ row: a.row + (b.row - a.row) * t, column: a.column + (b.column - a.column) * t });
            }
          }
          if (polygon.length >= 3) woods.push(polygon);
        }
      }
      for (let row = 1; row < SIZE - 2; row++) for (let column = 1; column < SIZE - 2; column++) {
        const index = row * SIZE + column, p = coordinates[index];
        if (!free[index]) continue;
        const value = forestSignal(p);
        if (value > 0.47) {
          const count = value > 0.63 ? 6 : value > 0.53 ? 4 : 1;
          for (let n = 0; n < count; n++) {
            const x = column + (random(seed, index * 9 + n) - 0.5) * 0.85, y = row + (random(seed, index * 9 + n + 4) - 0.5) * 0.85;
            const point = { row: surface.bounds.north + y / (SIZE - 1) * (surface.bounds.south - surface.bounds.north), column: surface.bounds.west + x / (SIZE - 1) * (surface.bounds.east - surface.bounds.west) };
            const radiusMetres = 7 + random(seed, index + n) * 8;
            if (available(point, radiusMetres / 1e3) && forestSignal(point) > 0.47) trees.push({ point, radiusMetres, priority: random(seed, index * 13 + n + 8291) });
          }
        } else if (slopes[index] > 0.035 && random(seed, index) < 0.18) rocks.push({ row: p.row, column: p.column });
      }
      return { woodland: woods, trees: trees.sort((a, b) => a.priority - b.priority).slice(0, 6500).map(({ priority, ...tree }) => tree), rocks };
    }
    function geographicNames(recipe, context, site, metric) {
      const result = [], c = recipe.location, f = site.surface, b = f.bounds;
      const SIZE = f.rows;
      const featureCategory = (kind) => ["river", "valley", "gorge", "lowland-valley"].includes(kind) ? "rivers" : ["mountain", "peak", "ridge", "hills", "foothills", "steep-slope", "snow-mountain", "volcano"].includes(kind) ? "mountains" : kind === "lake" ? "lakes" : ["sea", "inland-sea", "bay", "strait"].includes(kind) ? "seas" : "regions", used = new Set((context.namedFeatures || []).flatMap((feature) => [feature.name, namingCore(feature.name, featureCategory(feature.kind))]));
      const name = (category, suffix, salt) => nameFromComposition(recipe.namePool, category, {
        composition: recipe.naming.composition,
        seed: recipe.seed,
        salt,
        used,
        suffix,
        libraryId: recipe.naming.libraryId
      });
      for (const feature of context.namedFeatures || []) result.push({
        id: "world-" + feature.id,
        name: feature.name,
        kind: feature.kind === "river" ? "river" : "terrain",
        anchor: feature.location,
        priority: 4,
        detailLevel: 0
      });
      for (const [i, ch] of site.channels.entries()) {
        const anchor = ch.points[M.floor(ch.points.length * 0.53)], riverName = name("rivers", ch.kind === "river" ? "\u6CB3" : "\u6EAA", 5100 + i);
        result.push({ id: "supply-river-" + i, name: riverName, kind: "river", anchor, priority: 2, detailLevel: 0 });
        ch.name = riverName;
      }
      for (const [i, lake] of site.lakes.entries()) {
        lake.name = name("lakes", "\u6E56", 5119 + i);
        result.push({ id: "local-lake-" + i, name: lake.name, kind: "river", anchor: lake.anchor, priority: 1, detailLevel: 0 });
      }
      const candidates = [], separation = site.radiusKm * 0.35, rangeX = M.ceil(separation / ((b.east - b.west) * metric.column / (SIZE - 1))), rangeY = M.ceil(separation / ((b.south - b.north) * metric.row / (SIZE - 1)));
      let drySamples = null;
      for (let y = 3; y < SIZE - 3; y++) for (let x = 3; x < SIZE - 3; x++) {
        const i = y * SIZE + x, z = f.elevationMetres[i];
        if ([-SIZE - 1, -SIZE, -SIZE + 1, -1, 1, SIZE - 1, SIZE, SIZE + 1].some((d) => f.elevationMetres[i + d] > z)) continue;
        const p = { row: b.north + y / (SIZE - 1) * (b.south - b.north), column: b.west + x / (SIZE - 1) * (b.east - b.west) };
        if (!isDry(f, p)) continue;
        if (M.hypot((p.row - c.row) * metric.row, (p.column - c.column) * metric.column) < recipe.urban.radiusKm * 0.9) continue;
        if (!drySamples) drySamples = Array.from({ length: SIZE * SIZE }, (_, index) => {
          const q = { row: b.north + M.floor(index / SIZE) / (SIZE - 1) * (b.south - b.north), column: b.west + index % SIZE / (SIZE - 1) * (b.east - b.west) };
          return { ...q, dry: isDry(f, q) };
        });
        let minimum = z;
        for (let yy = M.max(0, y - rangeY); yy <= M.min(SIZE - 1, y + rangeY); yy++) for (let xx = M.max(0, x - rangeX); xx <= M.min(SIZE - 1, x + rangeX); xx++) {
          const q = drySamples[yy * SIZE + xx];
          if (q.dry && M.hypot((p.row - q.row) * metric.row, (p.column - q.column) * metric.column) <= separation) minimum = M.min(minimum, f.elevationMetres[yy * SIZE + xx]);
        }
        if (z - minimum < 30) continue;
        const grade = M.max(...[-SIZE - 1, -SIZE, -SIZE + 1, -1, 0, 1, SIZE - 1, SIZE, SIZE + 1].map((d) => f.slopes[i + d]));
        candidates.push({ p, z, localDryReliefMetres: z - minimum, suffix: grade > 0.065 ? "\u5CF0" : grade > 0.018 ? "\u4E18\u9675" : "\u9AD8\u5730" });
      }
      const peaks = [];
      for (const peak of candidates.sort((a, z) => z.z - a.z)) {
        if (peaks.some((p) => M.hypot((p.p.row - peak.p.row) * metric.row, (p.p.column - peak.p.column) * metric.column) < separation)) continue;
        peaks.push(peak);
        if (peaks.length === 3) break;
      }
      for (const [i, peak] of peaks.entries()) {
        const title = name("mountains", peak.suffix, 5200 + i);
        result.push({
          id: "local-peak-" + i,
          name: title + " \xB7 " + M.round(peak.z) + " m",
          kind: "terrain",
          anchor: peak.p,
          priority: 3,
          detailLevel: 0,
          spot: true,
          localDryReliefMetres: peak.localDryReliefMetres
        });
      }
      const cells = /* @__PURE__ */ new Map();
      for (const polygon of site.woodland) {
        const p = { row: polygon.reduce((s, p2) => s + p2.row, 0) / polygon.length, column: polygon.reduce((s, p2) => s + p2.column, 0) / polygon.length }, x = M.floor((p.column - b.west) / (b.east - b.west) * (SIZE - 1)), y = M.floor((p.row - b.north) / (b.south - b.north) * (SIZE - 1));
        cells.set(y * SIZE + x, p);
      }
      const woods = [];
      while (cells.size) {
        const first = cells.keys().next().value, queue = [first], points = [];
        cells.delete(first);
        for (let k = 0; k < queue.length; k++) {
          const i = queue[k], x = i % SIZE, y = M.floor(i / SIZE);
          points.push({ row: b.north + (y + 0.5) / (SIZE - 1) * (b.south - b.north), column: b.west + (x + 0.5) / (SIZE - 1) * (b.east - b.west) });
          for (const d of [-1, 1, -SIZE, SIZE]) if (cells.has(i + d)) {
            cells.delete(i + d);
            queue.push(i + d);
          }
        }
        if (points.length > 5) woods.push(points);
      }
      for (const [i, wood] of woods.sort((a, z) => z.length - a.length).slice(0, 4).entries()) {
        const mid = { row: wood.reduce((s, p) => s + p.row, 0) / wood.length, column: wood.reduce((s, p) => s + p.column, 0) / wood.length }, anchor = wood.reduce((a, p) => M.hypot(p.row - mid.row, p.column - mid.column) < M.hypot(a.row - mid.row, a.column - mid.column) ? p : a, wood[0]);
        result.push({ id: "local-wood-" + i, name: name("regions", "\u6797", 5300 + i), kind: "forest", anchor, priority: 5, detailLevel: 0 });
      }
      for (const [i, island] of (site.coastal.islands || []).entries()) result.push({ id: "local-island-" + i, name: name("regions", "\u5C9B", 5400 + i), kind: "terrain", anchor: island.anchor, priority: 2, detailLevel: 0 });
      for (const [i, line] of site.contours.entries()) if (line.major && line.anchor) result.push({ id: "contour-" + i, name: line.elevation + " m", kind: "elevation", anchor: line.anchor, priority: 8, detailLevel: 0 });
      return result;
    }
    window.WorldAtlasCitySite = { generate, inhabitedExtent, elevationAt, isDry, waterOverlaps, surfaceTriangles, nameFromPool, nameFromComposition, namingCore, unionPolygons, unionWallBuffers, boundsCandidates, woodlandRoadClearance, clearTreeCrowns, intersectPolygons: import_polygon_clipping.default.intersection, distanceToChannel: (point, channel, metric) => distanceToLine(point, channel.points, metric) };
  })();
})();
/*! Bundled license information:

polygon-clipping/dist/polygon-clipping.umd.js:
  (**
   * splaytree v3.1.2
   * Fast Splay tree for Node and browser
   *
   * @author Alexander Milevski <info@w8r.name>
   * @license MIT
   * @preserve
   *)
  (*! *****************************************************************************
      Copyright (c) Microsoft Corporation. All rights reserved.
      Licensed under the Apache License, Version 2.0 (the "License"); you may not use
      this file except in compliance with the License. You may obtain a copy of the
      License at http://www.apache.org/licenses/LICENSE-2.0

      THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
      KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
      WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
      MERCHANTABLITY OR NON-INFRINGEMENT.

      See the Apache Version 2.0 License for specific language governing permissions
      and limitations under the License.
      ***************************************************************************** *)
*/

Object.defineProperty(window.WorldAtlasCitySite,"generatorId",{value:"7e73804e46a9881ee241bc87ea02dc5e21da984b09c22746670d7fd766a5f020",enumerable:true});
