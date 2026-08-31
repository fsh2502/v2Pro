(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[97], {
    D1Df: function(e, t, n) {
        "use strict";
        function r(e) {
            return r = "function" === typeof Symbol && "symbol" === typeof Symbol.iterator ? function(e) {
                return typeof e
            }
            : function(e) {
                return e && "function" === typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
            }
            ,
            r(e)
        }
        function o() {
            return o = Object.assign || function(e) {
                for (var t = 1; t < arguments.length; t++) {
                    var n = arguments[t];
                    for (var r in n)
                        Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r])
                }
                return e
            }
            ,
            o.apply(this, arguments)
        }
        function i(e, t) {
            var n = Object.keys(e);
            if (Object.getOwnPropertySymbols) {
                var r = Object.getOwnPropertySymbols(e);
                t && (r = r.filter(function(t) {
                    return Object.getOwnPropertyDescriptor(e, t).enumerable
                })),
                n.push.apply(n, r)
            }
            return n
        }
        function a(e) {
            for (var t = 1; t < arguments.length; t++) {
                var n = null != arguments[t] ? arguments[t] : {};
                t % 2 ? i(n, !0).forEach(function(t) {
                    y(e, t, n[t])
                }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : i(n).forEach(function(t) {
                    Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t))
                })
            }
            return e
        }
        function s(e, t) {
            if (null == e)
                return {};
            var n, r, o = c(e, t);
            if (Object.getOwnPropertySymbols) {
                var i = Object.getOwnPropertySymbols(e);
                for (r = 0; r < i.length; r++)
                    n = i[r],
                    t.indexOf(n) >= 0 || Object.prototype.propertyIsEnumerable.call(e, n) && (o[n] = e[n])
            }
            return o
        }
        function c(e, t) {
            if (null == e)
                return {};
            var n, r, o = {}, i = Object.keys(e);
            for (r = 0; r < i.length; r++)
                n = i[r],
                t.indexOf(n) >= 0 || (o[n] = e[n]);
            return o
        }
        function u(e, t) {
            if (!(e instanceof t))
                throw new TypeError("Cannot call a class as a function")
        }
        function l(e, t) {
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                r.enumerable = r.enumerable || !1,
                r.configurable = !0,
                "value"in r && (r.writable = !0),
                Object.defineProperty(e, r.key, r)
            }
        }
        function f(e, t, n) {
            return t && l(e.prototype, t),
            n && l(e, n),
            e
        }
        function p(e, t) {
            return !t || "object" !== r(t) && "function" !== typeof t ? h(e) : t
        }
        function d(e) {
            return d = Object.setPrototypeOf ? Object.getPrototypeOf : function(e) {
                return e.__proto__ || Object.getPrototypeOf(e)
            }
            ,
            d(e)
        }
        function h(e) {
            if (void 0 === e)
                throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
            return e
        }
        function m(e, t) {
            if ("function" !== typeof t && null !== t)
                throw new TypeError("Super expression must either be null or a function");
            e.prototype = Object.create(t && t.prototype, {
                constructor: {
                    value: e,
                    writable: !0,
                    configurable: !0
                }
            }),
            t && v(e, t)
        }
        function v(e, t) {
            return v = Object.setPrototypeOf || function(e, t) {
                return e.__proto__ = t,
                e
            }
            ,
            v(e, t)
        }
        function y(e, t, n) {
            return t in e ? Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0
            }) : e[t] = n,
            e
        }
        var g = n("q1tI")
          , b = (n("17x9"),
        n("H38U"))
          , w = n("aRTE");
        function x(e) {
            for (var t = "", n = 0; n < e.length; n++) {
                var r = e.charCodeAt(n);
                r < 128 ? t += String.fromCharCode(r) : r < 2048 ? (t += String.fromCharCode(192 | r >> 6),
                t += String.fromCharCode(128 | 63 & r)) : r < 55296 || r >= 57344 ? (t += String.fromCharCode(224 | r >> 12),
                t += String.fromCharCode(128 | r >> 6 & 63),
                t += String.fromCharCode(128 | 63 & r)) : (n++,
                r = 65536 + ((1023 & r) << 10 | 1023 & e.charCodeAt(n)),
                t += String.fromCharCode(240 | r >> 18),
                t += String.fromCharCode(128 | r >> 12 & 63),
                t += String.fromCharCode(128 | r >> 6 & 63),
                t += String.fromCharCode(128 | 63 & r))
            }
            return t
        }
        var O = {
            size: 128,
            level: "L",
            bgColor: "#FFFFFF",
            fgColor: "#000000",
            includeMargin: !1
        }
          , E = 4
          , _ = .1;
        function k(e) {
            var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0
              , n = [];
            return e.forEach(function(e, r) {
                var o = null;
                e.forEach(function(i, a) {
                    if (!i && null !== o)
                        return n.push("M".concat(o + t, " ").concat(r + t, "h").concat(a - o, "v1H").concat(o + t, "z")),
                        void (o = null);
                    if (a !== e.length - 1)
                        i && null === o && (o = a);
                    else {
                        if (!i)
                            return;
                        null === o ? n.push("M".concat(a + t, ",").concat(r + t, " h1v1H").concat(a + t, "z")) : n.push("M".concat(o + t, ",").concat(r + t, " h").concat(a + 1 - o, "v1H").concat(o + t, "z"))
                    }
                })
            }),
            n.join("")
        }
        function S(e, t) {
            return e.slice().map(function(e, n) {
                return n < t.y || n >= t.y + t.h ? e : e.map(function(e, n) {
                    return (n < t.x || n >= t.x + t.w) && e
                })
            })
        }
        function C(e, t) {
            var n = e.imageSettings
              , r = e.size
              , o = e.includeMargin;
            if (null == n)
                return null;
            var i = o ? E : 0
              , a = t.length + 2 * i
              , s = Math.floor(r * _)
              , c = a / r
              , u = (n.width || s) * c
              , l = (n.height || s) * c
              , f = null == n.x ? t.length / 2 - u / 2 : n.x * c
              , p = null == n.y ? t.length / 2 - l / 2 : n.y * c
              , d = null;
            if (n.excavate) {
                var h = Math.floor(f)
                  , m = Math.floor(p)
                  , v = Math.ceil(u + f - h)
                  , y = Math.ceil(l + p - m);
                d = {
                    x: h,
                    y: m,
                    w: v,
                    h: y
                }
            }
            return {
                x: f,
                y: p,
                h: l,
                w: u,
                excavation: d
            }
        }
        var j = function() {
            try {
                (new Path2D).addPath(new Path2D)
            } catch (e) {
                return !1
            }
            return !0
        }()
          , P = function(e) {
            function t() {
                var e, n;
                u(this, t);
                for (var r = arguments.length, o = new Array(r), i = 0; i < r; i++)
                    o[i] = arguments[i];
                return n = p(this, (e = d(t)).call.apply(e, [this].concat(o))),
                y(h(n), "_canvas", void 0),
                y(h(n), "_image", void 0),
                y(h(n), "state", {
                    imgLoaded: !1
                }),
                y(h(n), "handleImageLoad", function() {
                    n.setState({
                        imgLoaded: !0
                    })
                }),
                n
            }
            return m(t, e),
            f(t, [{
                key: "componentDidMount",
                value: function() {
                    this._image && this._image.complete && this.handleImageLoad(),
                    this.update()
                }
            }, {
                key: "componentWillReceiveProps",
                value: function(e) {
                    var t, n, r = null === (t = this.props.imageSettings) || void 0 === t ? void 0 : t.src, o = null === (n = e.imageSettings) || void 0 === n ? void 0 : n.src;
                    r !== o && this.setState({
                        imgLoaded: !1
                    })
                }
            }, {
                key: "componentDidUpdate",
                value: function() {
                    this.update()
                }
            }, {
                key: "update",
                value: function() {
                    var e = this.props
                      , t = e.value
                      , n = e.size
                      , r = e.level
                      , o = e.bgColor
                      , i = e.fgColor
                      , a = e.includeMargin
                      , s = e.imageSettings
                      , c = new b(-1,w[r]);
                    if (c.addData(x(t)),
                    c.make(),
                    null != this._canvas) {
                        var u = this._canvas
                          , l = u.getContext("2d");
                        if (!l)
                            return;
                        var f = c.modules;
                        if (null === f)
                            return;
                        var p = a ? E : 0
                          , d = f.length + 2 * p
                          , h = C(this.props, f);
                        null != s && null != h && null != h.excavation && (f = S(f, h.excavation));
                        var m = window.devicePixelRatio || 1;
                        u.height = u.width = n * m;
                        var v = n / d * m;
                        l.scale(v, v),
                        l.fillStyle = o,
                        l.fillRect(0, 0, d, d),
                        l.fillStyle = i,
                        j ? l.fill(new Path2D(k(f, p))) : f.forEach(function(e, t) {
                            e.forEach(function(e, n) {
                                e && l.fillRect(n + p, t + p, 1, 1)
                            })
                        }),
                        this.state.imgLoaded && this._image && null != h && l.drawImage(this._image, h.x + p, h.y + p, h.w, h.h)
                    }
                }
            }, {
                key: "render",
                value: function() {
                    var e = this
                      , t = this.props
                      , n = (t.value,
                    t.size)
                      , r = (t.level,
                    t.bgColor,
                    t.fgColor,
                    t.style)
                      , i = (t.includeMargin,
                    t.imageSettings)
                      , c = s(t, ["value", "size", "level", "bgColor", "fgColor", "style", "includeMargin", "imageSettings"])
                      , u = a({
                        height: n,
                        width: n
                    }, r)
                      , l = null
                      , f = i && i.src;
                    return null != i && null != f && (l = g.createElement("img", {
                        src: f,
                        style: {
                            display: "none"
                        },
                        onLoad: this.handleImageLoad,
                        ref: function(t) {
                            return e._image = t
                        }
                    })),
                    g.createElement(g.Fragment, null, g.createElement("canvas", o({
                        style: u,
                        height: n,
                        width: n,
                        ref: function(t) {
                            return e._canvas = t
                        }
                    }, c)), l)
                }
            }]),
            t
        }(g.PureComponent);
        y(P, "defaultProps", O);
        var T = function(e) {
            function t() {
                return u(this, t),
                p(this, d(t).apply(this, arguments))
            }
            return m(t, e),
            f(t, [{
                key: "render",
                value: function() {
                    var e = this.props
                      , t = e.value
                      , n = e.size
                      , r = e.level
                      , i = e.bgColor
                      , a = e.fgColor
                      , c = e.includeMargin
                      , u = e.imageSettings
                      , l = s(e, ["value", "size", "level", "bgColor", "fgColor", "includeMargin", "imageSettings"])
                      , f = new b(-1,w[r]);
                    f.addData(x(t)),
                    f.make();
                    var p = f.modules;
                    if (null === p)
                        return null;
                    var d = c ? E : 0
                      , h = p.length + 2 * d
                      , m = C(this.props, p)
                      , v = null;
                    null != u && null != m && (null != m.excavation && (p = S(p, m.excavation)),
                    v = g.createElement("image", {
                        xlinkHref: u.src,
                        height: m.h,
                        width: m.w,
                        x: m.x + d,
                        y: m.y + d,
                        preserveAspectRatio: "none"
                    }));
                    var y = k(p, d);
                    return g.createElement("svg", o({
                        shapeRendering: "crispEdges",
                        height: n,
                        width: n,
                        viewBox: "0 0 ".concat(h, " ").concat(h)
                    }, l), g.createElement("path", {
                        fill: i,
                        d: "M0,0 h".concat(h, "v").concat(h, "H0z")
                    }), g.createElement("path", {
                        fill: a,
                        d: y
                    }), v)
                }
            }]),
            t
        }(g.PureComponent);
        y(T, "defaultProps", O);
        var L = function(e) {
            var t = e.renderAs
              , n = s(e, ["renderAs"])
              , r = "svg" === t ? T : P;
            return g.createElement(r, n)
        };
        L.defaultProps = a({
            renderAs: "canvas"
        }, O),
        e.exports = L
    },
    H38U: function(e, t, n) {
        var r = n("f4xo")
          , o = n("rcnY")
          , i = n("wU8J")
          , a = n("Iq15")
          , s = n("dWSS");
        function c(e, t) {
            this.typeNumber = e,
            this.errorCorrectLevel = t,
            this.modules = null,
            this.moduleCount = 0,
            this.dataCache = null,
            this.dataList = []
        }
        var u = c.prototype;
        u.addData = function(e) {
            var t = new r(e);
            this.dataList.push(t),
            this.dataCache = null
        }
        ,
        u.isDark = function(e, t) {
            if (e < 0 || this.moduleCount <= e || t < 0 || this.moduleCount <= t)
                throw new Error(e + "," + t);
            return this.modules[e][t]
        }
        ,
        u.getModuleCount = function() {
            return this.moduleCount
        }
        ,
        u.make = function() {
            if (this.typeNumber < 1) {
                var e = 1;
                for (e = 1; e < 40; e++) {
                    for (var t = o.getRSBlocks(e, this.errorCorrectLevel), n = new i, r = 0, s = 0; s < t.length; s++)
                        r += t[s].dataCount;
                    for (s = 0; s < this.dataList.length; s++) {
                        var c = this.dataList[s];
                        n.put(c.mode, 4),
                        n.put(c.getLength(), a.getLengthInBits(c.mode, e)),
                        c.write(n)
                    }
                    if (n.getLengthInBits() <= 8 * r)
                        break
                }
                this.typeNumber = e
            }
            this.makeImpl(!1, this.getBestMaskPattern())
        }
        ,
        u.makeImpl = function(e, t) {
            this.moduleCount = 4 * this.typeNumber + 17,
            this.modules = new Array(this.moduleCount);
            for (var n = 0; n < this.moduleCount; n++) {
                this.modules[n] = new Array(this.moduleCount);
                for (var r = 0; r < this.moduleCount; r++)
                    this.modules[n][r] = null
            }
            this.setupPositionProbePattern(0, 0),
            this.setupPositionProbePattern(this.moduleCount - 7, 0),
            this.setupPositionProbePattern(0, this.moduleCount - 7),
            this.setupPositionAdjustPattern(),
            this.setupTimingPattern(),
            this.setupTypeInfo(e, t),
            this.typeNumber >= 7 && this.setupTypeNumber(e),
            null == this.dataCache && (this.dataCache = c.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)),
            this.mapData(this.dataCache, t)
        }
        ,
        u.setupPositionProbePattern = function(e, t) {
            for (var n = -1; n <= 7; n++)
                if (!(e + n <= -1 || this.moduleCount <= e + n))
                    for (var r = -1; r <= 7; r++)
                        t + r <= -1 || this.moduleCount <= t + r || (this.modules[e + n][t + r] = 0 <= n && n <= 6 && (0 == r || 6 == r) || 0 <= r && r <= 6 && (0 == n || 6 == n) || 2 <= n && n <= 4 && 2 <= r && r <= 4)
        }
        ,
        u.getBestMaskPattern = function() {
            for (var e = 0, t = 0, n = 0; n < 8; n++) {
                this.makeImpl(!0, n);
                var r = a.getLostPoint(this);
                (0 == n || e > r) && (e = r,
                t = n)
            }
            return t
        }
        ,
        u.createMovieClip = function(e, t, n) {
            var r = e.createEmptyMovieClip(t, n)
              , o = 1;
            this.make();
            for (var i = 0; i < this.modules.length; i++)
                for (var a = i * o, s = 0; s < this.modules[i].length; s++) {
                    var c = s * o
                      , u = this.modules[i][s];
                    u && (r.beginFill(0, 100),
                    r.moveTo(c, a),
                    r.lineTo(c + o, a),
                    r.lineTo(c + o, a + o),
                    r.lineTo(c, a + o),
                    r.endFill())
                }
            return r
        }
        ,
        u.setupTimingPattern = function() {
            for (var e = 8; e < this.moduleCount - 8; e++)
                null == this.modules[e][6] && (this.modules[e][6] = e % 2 == 0);
            for (var t = 8; t < this.moduleCount - 8; t++)
                null == this.modules[6][t] && (this.modules[6][t] = t % 2 == 0)
        }
        ,
        u.setupPositionAdjustPattern = function() {
            for (var e = a.getPatternPosition(this.typeNumber), t = 0; t < e.length; t++)
                for (var n = 0; n < e.length; n++) {
                    var r = e[t]
                      , o = e[n];
                    if (null == this.modules[r][o])
                        for (var i = -2; i <= 2; i++)
                            for (var s = -2; s <= 2; s++)
                                this.modules[r + i][o + s] = -2 == i || 2 == i || -2 == s || 2 == s || 0 == i && 0 == s
                }
        }
        ,
        u.setupTypeNumber = function(e) {
            for (var t = a.getBCHTypeNumber(this.typeNumber), n = 0; n < 18; n++) {
                var r = !e && 1 == (t >> n & 1);
                this.modules[Math.floor(n / 3)][n % 3 + this.moduleCount - 8 - 3] = r
            }
            for (n = 0; n < 18; n++) {
                r = !e && 1 == (t >> n & 1);
                this.modules[n % 3 + this.moduleCount - 8 - 3][Math.floor(n / 3)] = r
            }
        }
        ,
        u.setupTypeInfo = function(e, t) {
            for (var n = this.errorCorrectLevel << 3 | t, r = a.getBCHTypeInfo(n), o = 0; o < 15; o++) {
                var i = !e && 1 == (r >> o & 1);
                o < 6 ? this.modules[o][8] = i : o < 8 ? this.modules[o + 1][8] = i : this.modules[this.moduleCount - 15 + o][8] = i
            }
            for (o = 0; o < 15; o++) {
                i = !e && 1 == (r >> o & 1);
                o < 8 ? this.modules[8][this.moduleCount - o - 1] = i : o < 9 ? this.modules[8][15 - o - 1 + 1] = i : this.modules[8][15 - o - 1] = i
            }
            this.modules[this.moduleCount - 8][8] = !e
        }
        ,
        u.mapData = function(e, t) {
            for (var n = -1, r = this.moduleCount - 1, o = 7, i = 0, s = this.moduleCount - 1; s > 0; s -= 2) {
                6 == s && s--;
                while (1) {
                    for (var c = 0; c < 2; c++)
                        if (null == this.modules[r][s - c]) {
                            var u = !1;
                            i < e.length && (u = 1 == (e[i] >>> o & 1));
                            var l = a.getMask(t, r, s - c);
                            l && (u = !u),
                            this.modules[r][s - c] = u,
                            o--,
                            -1 == o && (i++,
                            o = 7)
                        }
                    if (r += n,
                    r < 0 || this.moduleCount <= r) {
                        r -= n,
                        n = -n;
                        break
                    }
                }
            }
        }
        ,
        c.PAD0 = 236,
        c.PAD1 = 17,
        c.createData = function(e, t, n) {
            for (var r = o.getRSBlocks(e, t), s = new i, u = 0; u < n.length; u++) {
                var l = n[u];
                s.put(l.mode, 4),
                s.put(l.getLength(), a.getLengthInBits(l.mode, e)),
                l.write(s)
            }
            var f = 0;
            for (u = 0; u < r.length; u++)
                f += r[u].dataCount;
            if (s.getLengthInBits() > 8 * f)
                throw new Error("code length overflow. (" + s.getLengthInBits() + ">" + 8 * f + ")");
            s.getLengthInBits() + 4 <= 8 * f && s.put(0, 4);
            while (s.getLengthInBits() % 8 != 0)
                s.putBit(!1);
            while (1) {
                if (s.getLengthInBits() >= 8 * f)
                    break;
                if (s.put(c.PAD0, 8),
                s.getLengthInBits() >= 8 * f)
                    break;
                s.put(c.PAD1, 8)
            }
            return c.createBytes(s, r)
        }
        ,
        c.createBytes = function(e, t) {
            for (var n = 0, r = 0, o = 0, i = new Array(t.length), c = new Array(t.length), u = 0; u < t.length; u++) {
                var l = t[u].dataCount
                  , f = t[u].totalCount - l;
                r = Math.max(r, l),
                o = Math.max(o, f),
                i[u] = new Array(l);
                for (var p = 0; p < i[u].length; p++)
                    i[u][p] = 255 & e.buffer[p + n];
                n += l;
                var d = a.getErrorCorrectPolynomial(f)
                  , h = new s(i[u],d.getLength() - 1)
                  , m = h.mod(d);
                c[u] = new Array(d.getLength() - 1);
                for (p = 0; p < c[u].length; p++) {
                    var v = p + m.getLength() - c[u].length;
                    c[u][p] = v >= 0 ? m.get(v) : 0
                }
            }
            var y = 0;
            for (p = 0; p < t.length; p++)
                y += t[p].totalCount;
            var g = new Array(y)
              , b = 0;
            for (p = 0; p < r; p++)
                for (u = 0; u < t.length; u++)
                    p < i[u].length && (g[b++] = i[u][p]);
            for (p = 0; p < o; p++)
                for (u = 0; u < t.length; u++)
                    p < c[u].length && (g[b++] = c[u][p]);
            return g
        }
        ,
        e.exports = c
    },
    aRTE: function(e, t) {
        e.exports = {
            L: 1,
            M: 0,
            Q: 3,
            H: 2
        }
    },
    f4xo: function(e, t, n) {
        var r = n("nVVt");
        function o(e) {
            this.mode = r.MODE_8BIT_BYTE,
            this.data = e
        }
        o.prototype = {
            getLength: function(e) {
                return this.data.length
            },
            write: function(e) {
                for (var t = 0; t < this.data.length; t++)
                    e.put(this.data.charCodeAt(t), 8)
            }
        },
        e.exports = o
    },
    rcnY: function(e, t, n) {
        var r = n("aRTE");
        function o(e, t) {
            this.totalCount = e,
            this.dataCount = t
        }
        o.RS_BLOCK_TABLE = [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9], [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16], [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13], [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9], [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12], [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15], [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14], [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15], [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13], [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16], [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13], [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15], [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12], [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13], [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12], [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16], [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15], [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15], [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14], [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16], [4, 144, 116, 4, 145, 117], [17, 68, 42], [17, 50, 22, 6, 51, 23], [19, 46, 16, 6, 47, 17], [2, 139, 111, 7, 140, 112], [17, 74, 46], [7, 54, 24, 16, 55, 25], [34, 37, 13], [4, 151, 121, 5, 152, 122], [4, 75, 47, 14, 76, 48], [11, 54, 24, 14, 55, 25], [16, 45, 15, 14, 46, 16], [6, 147, 117, 4, 148, 118], [6, 73, 45, 14, 74, 46], [11, 54, 24, 16, 55, 25], [30, 46, 16, 2, 47, 17], [8, 132, 106, 4, 133, 107], [8, 75, 47, 13, 76, 48], [7, 54, 24, 22, 55, 25], [22, 45, 15, 13, 46, 16], [10, 142, 114, 2, 143, 115], [19, 74, 46, 4, 75, 47], [28, 50, 22, 6, 51, 23], [33, 46, 16, 4, 47, 17], [8, 152, 122, 4, 153, 123], [22, 73, 45, 3, 74, 46], [8, 53, 23, 26, 54, 24], [12, 45, 15, 28, 46, 16], [3, 147, 117, 10, 148, 118], [3, 73, 45, 23, 74, 46], [4, 54, 24, 31, 55, 25], [11, 45, 15, 31, 46, 16], [7, 146, 116, 7, 147, 117], [21, 73, 45, 7, 74, 46], [1, 53, 23, 37, 54, 24], [19, 45, 15, 26, 46, 16], [5, 145, 115, 10, 146, 116], [19, 75, 47, 10, 76, 48], [15, 54, 24, 25, 55, 25], [23, 45, 15, 25, 46, 16], [13, 145, 115, 3, 146, 116], [2, 74, 46, 29, 75, 47], [42, 54, 24, 1, 55, 25], [23, 45, 15, 28, 46, 16], [17, 145, 115], [10, 74, 46, 23, 75, 47], [10, 54, 24, 35, 55, 25], [19, 45, 15, 35, 46, 16], [17, 145, 115, 1, 146, 116], [14, 74, 46, 21, 75, 47], [29, 54, 24, 19, 55, 25], [11, 45, 15, 46, 46, 16], [13, 145, 115, 6, 146, 116], [14, 74, 46, 23, 75, 47], [44, 54, 24, 7, 55, 25], [59, 46, 16, 1, 47, 17], [12, 151, 121, 7, 152, 122], [12, 75, 47, 26, 76, 48], [39, 54, 24, 14, 55, 25], [22, 45, 15, 41, 46, 16], [6, 151, 121, 14, 152, 122], [6, 75, 47, 34, 76, 48], [46, 54, 24, 10, 55, 25], [2, 45, 15, 64, 46, 16], [17, 152, 122, 4, 153, 123], [29, 74, 46, 14, 75, 47], [49, 54, 24, 10, 55, 25], [24, 45, 15, 46, 46, 16], [4, 152, 122, 18, 153, 123], [13, 74, 46, 32, 75, 47], [48, 54, 24, 14, 55, 25], [42, 45, 15, 32, 46, 16], [20, 147, 117, 4, 148, 118], [40, 75, 47, 7, 76, 48], [43, 54, 24, 22, 55, 25], [10, 45, 15, 67, 46, 16], [19, 148, 118, 6, 149, 119], [18, 75, 47, 31, 76, 48], [34, 54, 24, 34, 55, 25], [20, 45, 15, 61, 46, 16]],
        o.getRSBlocks = function(e, t) {
            var n = o.getRsBlockTable(e, t);
            if (void 0 == n)
                throw new Error("bad rs block @ typeNumber:" + e + "/errorCorrectLevel:" + t);
            for (var r = n.length / 3, i = new Array, a = 0; a < r; a++)
                for (var s = n[3 * a + 0], c = n[3 * a + 1], u = n[3 * a + 2], l = 0; l < s; l++)
                    i.push(new o(c,u));
            return i
        }
        ,
        o.getRsBlockTable = function(e, t) {
            switch (t) {
            case r.L:
                return o.RS_BLOCK_TABLE[4 * (e - 1) + 0];
            case r.M:
                return o.RS_BLOCK_TABLE[4 * (e - 1) + 1];
            case r.Q:
                return o.RS_BLOCK_TABLE[4 * (e - 1) + 2];
            case r.H:
                return o.RS_BLOCK_TABLE[4 * (e - 1) + 3];
            default:
                return
            }
        }
        ,
        e.exports = o
    },
    wU8J: function(e, t) {
        function n() {
            this.buffer = new Array,
            this.length = 0
        }
        n.prototype = {
            get: function(e) {
                var t = Math.floor(e / 8);
                return 1 == (this.buffer[t] >>> 7 - e % 8 & 1)
            },
            put: function(e, t) {
                for (var n = 0; n < t; n++)
                    this.putBit(1 == (e >>> t - n - 1 & 1))
            },
            getLengthInBits: function() {
                return this.length
            },
            putBit: function(e) {
                var t = Math.floor(this.length / 8);
                this.buffer.length <= t && this.buffer.push(0),
                e && (this.buffer[t] |= 128 >>> this.length % 8),
                this.length++
            }
        },
        e.exports = n
    },
    Iq15: function(e, t, n) {
        var r = n("nVVt")
          , o = n("dWSS")
          , i = n("dQei")
          , a = {
            PATTERN000: 0,
            PATTERN001: 1,
            PATTERN010: 2,
            PATTERN011: 3,
            PATTERN100: 4,
            PATTERN101: 5,
            PATTERN110: 6,
            PATTERN111: 7
        }
          , s = {
            PATTERN_POSITION_TABLE: [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]],
            G15: 1335,
            G18: 7973,
            G15_MASK: 21522,
            getBCHTypeInfo: function(e) {
                var t = e << 10;
                while (s.getBCHDigit(t) - s.getBCHDigit(s.G15) >= 0)
                    t ^= s.G15 << s.getBCHDigit(t) - s.getBCHDigit(s.G15);
                return (e << 10 | t) ^ s.G15_MASK
            },
            getBCHTypeNumber: function(e) {
                var t = e << 12;
                while (s.getBCHDigit(t) - s.getBCHDigit(s.G18) >= 0)
                    t ^= s.G18 << s.getBCHDigit(t) - s.getBCHDigit(s.G18);
                return e << 12 | t
            },
            getBCHDigit: function(e) {
                var t = 0;
                while (0 != e)
                    t++,
                    e >>>= 1;
                return t
            },
            getPatternPosition: function(e) {
                return s.PATTERN_POSITION_TABLE[e - 1]
            },
            getMask: function(e, t, n) {
                switch (e) {
                case a.PATTERN000:
                    return (t + n) % 2 == 0;
                case a.PATTERN001:
                    return t % 2 == 0;
                case a.PATTERN010:
                    return n % 3 == 0;
                case a.PATTERN011:
                    return (t + n) % 3 == 0;
                case a.PATTERN100:
                    return (Math.floor(t / 2) + Math.floor(n / 3)) % 2 == 0;
                case a.PATTERN101:
                    return t * n % 2 + t * n % 3 == 0;
                case a.PATTERN110:
                    return (t * n % 2 + t * n % 3) % 2 == 0;
                case a.PATTERN111:
                    return (t * n % 3 + (t + n) % 2) % 2 == 0;
                default:
                    throw new Error("bad maskPattern:" + e)
                }
            },
            getErrorCorrectPolynomial: function(e) {
                for (var t = new o([1],0), n = 0; n < e; n++)
                    t = t.multiply(new o([1, i.gexp(n)],0));
                return t
            },
            getLengthInBits: function(e, t) {
                if (1 <= t && t < 10)
                    switch (e) {
                    case r.MODE_NUMBER:
                        return 10;
                    case r.MODE_ALPHA_NUM:
                        return 9;
                    case r.MODE_8BIT_BYTE:
                        return 8;
                    case r.MODE_KANJI:
                        return 8;
                    default:
                        throw new Error("mode:" + e)
                    }
                else if (t < 27)
                    switch (e) {
                    case r.MODE_NUMBER:
                        return 12;
                    case r.MODE_ALPHA_NUM:
                        return 11;
                    case r.MODE_8BIT_BYTE:
                        return 16;
                    case r.MODE_KANJI:
                        return 10;
                    default:
                        throw new Error("mode:" + e)
                    }
                else {
                    if (!(t < 41))
                        throw new Error("type:" + t);
                    switch (e) {
                    case r.MODE_NUMBER:
                        return 14;
                    case r.MODE_ALPHA_NUM:
                        return 13;
                    case r.MODE_8BIT_BYTE:
                        return 16;
                    case r.MODE_KANJI:
                        return 12;
                    default:
                        throw new Error("mode:" + e)
                    }
                }
            },
            getLostPoint: function(e) {
                for (var t = e.getModuleCount(), n = 0, r = 0; r < t; r++)
                    for (var o = 0; o < t; o++) {
                        for (var i = 0, a = e.isDark(r, o), s = -1; s <= 1; s++)
                            if (!(r + s < 0 || t <= r + s))
                                for (var c = -1; c <= 1; c++)
                                    o + c < 0 || t <= o + c || 0 == s && 0 == c || a == e.isDark(r + s, o + c) && i++;
                        i > 5 && (n += 3 + i - 5)
                    }
                for (r = 0; r < t - 1; r++)
                    for (o = 0; o < t - 1; o++) {
                        var u = 0;
                        e.isDark(r, o) && u++,
                        e.isDark(r + 1, o) && u++,
                        e.isDark(r, o + 1) && u++,
                        e.isDark(r + 1, o + 1) && u++,
                        0 != u && 4 != u || (n += 3)
                    }
                for (r = 0; r < t; r++)
                    for (o = 0; o < t - 6; o++)
                        e.isDark(r, o) && !e.isDark(r, o + 1) && e.isDark(r, o + 2) && e.isDark(r, o + 3) && e.isDark(r, o + 4) && !e.isDark(r, o + 5) && e.isDark(r, o + 6) && (n += 40);
                for (o = 0; o < t; o++)
                    for (r = 0; r < t - 6; r++)
                        e.isDark(r, o) && !e.isDark(r + 1, o) && e.isDark(r + 2, o) && e.isDark(r + 3, o) && e.isDark(r + 4, o) && !e.isDark(r + 5, o) && e.isDark(r + 6, o) && (n += 40);
                var l = 0;
                for (o = 0; o < t; o++)
                    for (r = 0; r < t; r++)
                        e.isDark(r, o) && l++;
                var f = Math.abs(100 * l / t / t - 50) / 5;
                return n += 10 * f,
                n
            }
        };
        e.exports = s
    },
    dWSS: function(e, t, n) {
        var r = n("dQei");
        function o(e, t) {
            if (void 0 == e.length)
                throw new Error(e.length + "/" + t);
            var n = 0;
            while (n < e.length && 0 == e[n])
                n++;
            this.num = new Array(e.length - n + t);
            for (var r = 0; r < e.length - n; r++)
                this.num[r] = e[r + n]
        }
        o.prototype = {
            get: function(e) {
                return this.num[e]
            },
            getLength: function() {
                return this.num.length
            },
            multiply: function(e) {
                for (var t = new Array(this.getLength() + e.getLength() - 1), n = 0; n < this.getLength(); n++)
                    for (var i = 0; i < e.getLength(); i++)
                        t[n + i] ^= r.gexp(r.glog(this.get(n)) + r.glog(e.get(i)));
                return new o(t,0)
            },
            mod: function(e) {
                if (this.getLength() - e.getLength() < 0)
                    return this;
                for (var t = r.glog(this.get(0)) - r.glog(e.get(0)), n = new Array(this.getLength()), i = 0; i < this.getLength(); i++)
                    n[i] = this.get(i);
                for (i = 0; i < e.getLength(); i++)
                    n[i] ^= r.gexp(r.glog(e.get(i)) + t);
                return new o(n,0).mod(e)
            }
        },
        e.exports = o
    },
    nVVt: function(e, t) {
        e.exports = {
            MODE_NUMBER: 1,
            MODE_ALPHA_NUM: 2,
            MODE_8BIT_BYTE: 4,
            MODE_KANJI: 8
        }
    },
    dQei: function(e, t) {
        for (var n = {
            glog: function(e) {
                if (e < 1)
                    throw new Error("glog(" + e + ")");
                return n.LOG_TABLE[e]
            },
            gexp: function(e) {
                while (e < 0)
                    e += 255;
                while (e >= 256)
                    e -= 255;
                return n.EXP_TABLE[e]
            },
            EXP_TABLE: new Array(256),
            LOG_TABLE: new Array(256)
        }, r = 0; r < 8; r++)
            n.EXP_TABLE[r] = 1 << r;
        for (r = 8; r < 256; r++)
            n.EXP_TABLE[r] = n.EXP_TABLE[r - 4] ^ n.EXP_TABLE[r - 5] ^ n.EXP_TABLE[r - 6] ^ n.EXP_TABLE[r - 8];
        for (r = 0; r < 255; r++)
            n.LOG_TABLE[n.EXP_TABLE[r]] = r;
        e.exports = n
    }
}]);
