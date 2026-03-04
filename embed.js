! function n(o, i, a) {
    function u(e, t) {
        if (!i[e]) {
            if (!o[e]) {
                var r = "function" == typeof require && require;
                if (!t && r) return r(e, !0);
                if (c) return c(e, !0);
                throw (t = new Error("Cannot find module '" + e + "'")).code = "MODULE_NOT_FOUND", t
            }
            r = i[e] = {
                exports: {}
            }, o[e][0].call(r.exports, function(t) {
                return u(o[e][1][t] || t)
            }, r, r.exports, n, o, i, a)
        }
        return i[e].exports
    }
    for (var c = "function" == typeof require && require, t = 0; t < a.length; t++) u(a[t]);
    return u
}({
    1: [function(t, e, r) {
        "use strict";
        var i = function(t, e) {
                if (Array.isArray(t)) return t;
                if (Symbol.iterator in Object(t)) {
                    var r = e,
                        n = [],
                        o = !0,
                        e = !1,
                        i = void 0;
                    try {
                        for (var a, u = t[Symbol.iterator](); !(o = (a = u.next()).done) && (n.push(a.value), !r || n.length !== r); o = !0);
                    } catch (t) {
                        e = !0, i = t
                    } finally {
                        try {
                            !o && u.return && u.return()
                        } finally {
                            if (e) throw i
                        }
                    }
                    return n
                }
                throw new TypeError("Invalid attempt to destructure non-iterable instance")
            },
            o = [],
            a = "https://stg.form.run";

        function n(t) {
            var e, r, n;
            "true" == t.dataset.rendered && 0 != t.childElementCount || (e = t.dataset.formrunForm, t.dataset.formrunHost && (a = t.dataset.formrunHost), e || console.error("data-formrun-form is not set."), /@[^\/]+/.test(e) || console.error("data-formrun-form is invalid: " + e), e = a + "/embed/" + e, "true" === t.dataset.dynamicInit && (r = window.location.search) && (e = function(t, e) {
                if (!e || "" === e) return t;
                var t = t.split("?"),
                    r = (t = i(t, 2))[0],
                    t = t[1],
                    n = new URLSearchParams(t || ""),
                    o = (new URLSearchParams(e.replace(/^\?/, "")).forEach(function(t, e) {
                        e.endsWith("[]") ? n.getAll(e).includes(t) || n.append(e, t) : n.set(e, t)
                    }), []);
                console.log("data log", n.forEach(function(t, e) {
                    o.push(encodeURIComponent(e) + "=" + encodeURIComponent(t))
                }), (t = o.join("&")) ? r + "?" + t : r)
                return n.forEach(function(t, e) {
                    o.push(encodeURIComponent(e) + "=" + encodeURIComponent(t))
                }), (t = o.join("&")) ? r + "?" + t : r
            }(e, r)), (n = document.createElement("iframe")).setAttribute("src", e), n.setAttribute("frameborder", "no"), n.setAttribute("loading", "lazy"), n.style.backgroundColor = "#FFFFFF", n.style.width = "100%", n.style.height = "0", "true" === t.dataset.formrunRedirect && n.addEventListener("load", function() {
                n.contentWindow.postMessage({
                    formrunRedirect: !0
                }, "*")
            }), t.appendChild(n), o.push(n), t.dataset.rendered = "true")
        }

        function u() {
            Array.prototype.forEach.call(document.querySelectorAll(".formrun-embed"), function(t) {
                n(t)
            })
        }
        window.addEventListener("message", function(e) {
            var r;
            e.origin == a && null != (r = function(t) {
                try {
                    return JSON.parse(t)
                } catch (t) {}
            }(e.data)) && ("scrollTop" == r.action && o.forEach(function(t) {
                t.scrollIntoView(!0)
            }), r.height && o.forEach(function(t) {
                0 <= t.getAttribute("src").indexOf(r.friendlyKey) && e.source === t.contentWindow && ("thanks" === r.page && t.style.height !== r.height + "px" && window.scrollTo(0, t.offsetTop), t.style.display = "block", t.style.height = r.height + "px")
            }))
        }, !1), "loading" == document.readyState ? document.addEventListener("DOMContentLoaded", u, !1) : u()
    }, {}]
}, {}, [1]);
