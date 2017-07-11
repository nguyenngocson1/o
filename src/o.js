(
    function(win, doc, script, bundleConfig)
    {
        "use strict";
        var registryFactory;
        var registry;
        var parser;
        var transport;
        var proxy;
        var pathname = win.location.pathname;
        var dirname = function(path)
        {
            return path.split("/").slice(0, -1).join("/")
        }
        var exportTo = function(where, what, path)
        {
            if(path == null) {
                return;
            }
            path.split(".").reduce(
                function(prev, item, i, arr)
                {
                    return prev[item] = prev[item] == null ? (i == arr.length - 1 ? what : {}) : prev[item];
                },
                where
            );
        };
        var runner = function(o, config)
        {
            if(config.src || config.module) {
                var _o = function(doc)
                {
                    return o(
                        function(promised)
                        {
                            return promised(doc)
                        }
                    ).then(
                        function(System)
                        {
                            exportTo(
                                win,
                                function()
                                {
                                    return Promise.resolve(System);
                                },
                                config.export
                            );
                            return System.import((config.src || config.module).split("#")[0]).then(
                                function(module)
                                {
                                    if(typeof module === "function") {
                                        return module(Promise.resolve(System))
                                    } else {
                                        return Promise.resolve(System);
                                    }

                                }
                            ).catch(
                                function(e)
                                {
                                    console.error(e);
                                }
                            );
                        }
                    );
                }
                if(config.module) {
                    exportTo(win, _o, config.export);
                } else {
                    _o(doc);
                }
            } else {
                exportTo(win, o, config.export);
            }
            return o;
        }
        runner.config = function(script, resolve, _config)
        {
            var temp;
            var __dirname = dirname(pathname);
            // TODO: take some bits out? or namespace them with o?
            var config = Object.assign(
                {},
                _config || {},
                [].slice.call(script.attributes).reduce(
                    function(prev, item, i, arr)
                    {
                        var key = item.nodeName;
                        if(key.indexOf("data-") === 0) {
                            var value = item.value;
                            key = key.substr(5);
                            switch(key) {
                                case "basepath":
                                case "includepath":
                                    if(value[value.length - 1] === "/") {
                                        value = value.substr(0, value.length - 1);
                                    }
                                    break;
                            }
                            prev[key] = value;
                        }
                        return prev;
                    },
                    {}
                )
            );
            var _src = getAttribute(doc, "src", "").split("/");
            config.includepath = config.includepath || (_src.length > 3 ? _src.slice(0, -3).join("/") : "./node_modules");
            var src;
            if(config.src) {
                temp = config.src.split("#");
                config.src = temp[0];
                if(temp[1]) {
                    config.hash = resolve(temp[1], __dirname);
                }
                src = config.src;
            } else if(script.hasAttribute("src")) {
                src = script.getAttribute("src");
            }
            if(config.basepath) {
                config.basepath = resolve(config.basepath, __dirname);
                if(src) {
                    config.baseURL = resolve(src, config.basepath);
                    if(config.src) {
                        config.src = config.baseURL;
                    }
                } else {
                    config.baseURL = pathname, config.basepath;
                }
            } else {
                if(src) {
                    config.baseURL = resolve(src, __dirname);
                    if(config.src) {
                        config.src = config.baseURL;
                    }
                } else {
                    config.baseURL = pathname;
                }
                config.basepath = dirname(config.baseURL);
            }
            if(config.hash) {
                config.basepath = dirname(config.hash);
            }

            // if(Object.keys(bundleConfig).length === 0) {
                [
                    "includepath",
                    "src"
                ].forEach(
                    function(item)
                    {
                        if(config[item] != null) {
                            config[item] = resolve(config[item], config.basepath);
                        }
                    }
                );

            // }
            return config;
        }
        var getCurrentScript = function(doc)
        {
            var scripts = doc.getElementsByTagName("script");
            return scripts[scripts.length - 1];
        }
        var getAttribute = function(doc, attr, value)
        {
            var script = getCurrentScript(doc);
            return script.hasAttribute(attr) ? script.getAttribute(attr) : value;
        };
        var getConfig = function(key, value)
        {
            // TODO: should doc be an arg?
            return getAttribute(doc, "data-" + key, value)
        }
        /* rewrite */
        var appendVersionToPackageNameRewriter = function(includePath, rewriter)
        {
            return function(path, headers)
            {
                var hash = "";
                // this is unpkg specific
                if(headers["X-Content-Version"] != null) {
                    var parts = path.split("/");
                    var index = 0;
                    // check to make sure it doen't already have one
                    if(parts[index].indexOf("@") === 0) {
                        index = 1;
                    }
                    parts[index] += "@" + headers['X-Content-Version'];
                    path = parts.join("/");
                }
                return rewriter(path, headers);
            }
        }
        var getRewriter = function(includePath)
        {
            var rewriter = defaultRewriter(includePath);
            if(includePath.indexOf("://") !== -1) {
                return appendVersionToPackageNameRewriter(includePath, rewriter);
            } else {
                return rewriter;
            }
        }
        var defaultRewriter = function()
        {
            return function(path, headers)
            {
                return {
                    path: path,
                    hash: Object.keys(headers).length > 0 ? "#" + JSON.stringify(headers) : ""
                };
            }
        }
        var normalizeHash = function(path, rewriter)
        {
            var temp = path.split("#");
            path = temp[0];
            var hash = temp[1] || "";
            if(hash) {
                var headers = {};
                if(hash.indexOf("{") === 0) {
                    headers = JSON.parse(hash);
                } else if(hash.indexOf("@") === 0) {
                    headers["X-Content-Version"] = hash.substr(1);
                    // TODO: rethink? 
                } else if(hash.indexOf(".") !== 0 && hash.indexOf("/") > 0) {
                    headers['Content-Type'] = hash;
                }
                if(Object.keys(headers).length > 0) {
                    return rewriter(path, headers)
                }
                hash = "#" + hash;
            }
            return {
                path: path,
                hash: hash
            };
        }
        /* rewrite */
        /* resolve */
        var normalizeName = function (child, parentBase)
        {
            var parts = child.split("/").filter(
                function(item)
                {
                    return item !== "";
                }
            );
            if (child[0] === "/") {
                parentBase = [parts.shift()];
            }
            if (child[0] !== ".") {
                parts = ["."].concat(parts);
            } 
            return parentBase.concat(parts).reduce(
                function(prev, item, i, arr)
                {
                    if(item == "..") {
                        return prev.slice(0, -1);
                    }
                    if(item == ".") {
                        return prev;
                    }
                    return prev.concat(item);
                },
                []
            ).join("/")
        }

        var getResolve = function(includePath, defaultBase)
        {
            includePath = includePath || "";
            var rewriter = getRewriter(includePath);
            return function(path, base)
            {
                // base should always be a dirname with no trailing slash
                var obj = normalizeHash(path, rewriter);
                path = obj.path;
                var first2Chars = path.substr(0, 2);
                var firstChar = first2Chars[0];
                if(
                    first2Chars != ".." && first2Chars != "./" && firstChar != "/" && path.indexOf("://") === -1
                ) {
                    path = includePath + "/" + path;
                }
                var temp = path.split("/");
                if(path.indexOf("://") !== -1) {
                    return temp.slice(0, 3).join("/") + normalizeName(temp.slice(3).join("/"), [""]) + obj.hash;
                }
                base = base || defaultBase;
                // try {
                path = normalizeName(temp.join("/"), base.split("/"));
                // } catch(e) {
                //     console.log(path, base);
                // }
                if(path[0] != "/" && path.indexOf("://") === -1) {
                    path = "/" + path;
                }
                return path + obj.hash;
            }
        }
        /* resolve */
        var basepath = function(doc, src)
        {
            var path = getConfig("basepath",  false);
            if(!path) {
                src = getAttribute(doc, src || "src", "");
                var parts = pathname.split("/");
                if(src[0] !== "/") {
                    parts[parts.length - 1] = src;
                }
                path = dirname(parts.join("/"));
            } else {
                if(path[path.length - 1] === "/") {
                    path = path.substr(0, path.length -1)
                }
            }
            return path;
        };
        /* test */
        if(window.test) {
            Object.assign(
                window,
                {
                    basepath: basepath,
                    normalizeName: normalizeName,
                    getResolve: getResolve,
                    exportTo: exportTo,
                    dirname: dirname
                }
            );
            return;
        }
        /* test */
        return (
            function(includePath, currentScript, currentBase)
            {
                var config = Object.assign(
                    {},
                    {
                        registry: "/src/registry/memory.js",
                        parser: "/src/parser/evalSync.js",
                        transport: "/src/transport/xhrNodeResolver.js",
                        proxy: "/src/proxy/noop.js"
                    },
                    runner.config(currentScript, getResolve(includePath, currentBase))
                );
                var resolve = getResolve(config.includepath, currentBase);
                var utils = [
                    "transport",
                    "parser",
                    "registry",
                    "proxy"
                ].map(
                    function(item)
                    {
                        return {
                            path: config[item],
                            key: item
                        };
                    }
                ).map(
                    function(item)
                    {
                        return script(resolve(item.path, config.basepath), item.key, currentScript, config.includepath)
                    }
                ).map(
                    function(injectScript, i)
                    {
                        if(injectScript) {
                            return new Promise(
                                function(resolve, reject)
                                {
                                    var previous = win[injectScript.callback];
                                    win[injectScript.callback] = function(func)
                                    {
                                        delete win[injectScript.callback];
                                        if(typeof previous !== "undefined") {
                                            win[injectScript.callback] = previous;
                                        }
                                        var result = func(injectScript.path, config);
                                        if(i == 2) {
                                            registryFactory = result;
                                            result = result();
                                        }
                                        resolve(
                                            result
                                        );
                                    }
                                    injectScript();
                                }
                            );
                        }
                    }
                );
                var getPromisedLoader = function(resolve, config)
                {
                    var factory = function(doc, _proxy, register)
                    {
                        register = register || registry;
                        _proxy = _proxy || proxy; 
                        return function(path)
                        {
                            return register(
                                resolve(path, (this ? this.getConfig() : config).basepath),
                                _proxy(
                                    transport,
                                    factory,
                                    registryFactory,
                                    config,
                                    resolve
                                ),
                                parser,
                                resolve
                            );
                        }
                    }
                    return factory;
                };
                return runner(
                    function(cb)
                    {
                        var registerDynamic;
                        // TODO: resolve will change here, is that ok? Yes
                        var localConfig = runner.config(
                            getCurrentScript(doc),
                            resolve,
                            // TODO: Allow bundle config to be overwritable? Good/bad idea?
                            // inherit everything apart from the baseURL
                            Object.assign(
                                {},
                                config,
                                bundleConfig,
                                {
                                    baseURL: bundleConfig.baseURL || null,
                                    basepath: bundleConfig.basepath || null
                                }
                            )
                        );
                        resolve = getResolve(localConfig.includepath, basepath(doc));
                        return Promise.all(
                            utils
                        ).then(
                            function(modules)
                            {
                                transport = modules[0];
                                parser = modules[1];
                                registry = modules[2];
                                proxy = modules[3];
                                registerDynamic = function(path, deps, executingRequire, cb, filename)
                                {
                                    return Promise.resolve(registry.set(path, cb, filename));
                                }
/*_o*/
                                return getPromisedLoader(resolve, localConfig)(doc)("/src/_o.js");
                            }
                        ).then(
                            function(_o)
                            {
                                var System = Object.assign(
                                    _o(
                                        getPromisedLoader(resolve, localConfig)
                                    )(cb),
                                    {
                                        registry: registry,
                                        registerDynamic: registerDynamic,
                                        resolve: resolve
                                    }
                                );
                                System.config(localConfig);
                                registerDynamic("/" + localConfig.includepath + "/@gardenhq/o/o.js", [], true, function(module){module.exports = Promise.resolve(System);});
                                return System;
                            }
                        );
                    },
                    config
                );
            }
        )(
            getConfig("includepath"),
            getCurrentScript(doc),
            basepath(doc)
        );
    }
)(
    window,
    document,
    function(path, callbackName, script, includePath)
    {
        /* scripts */
        var temp = path.split("?");
        var inject = function()
        {
            var newNode = script.ownerDocument.createElement("script");
            newNode.setAttribute("type", "text/javascript");
            newNode.setAttribute("src", path);
            script.parentNode.insertBefore(newNode, script);
        }
        inject.callback = temp.length === 2 ? temp[1] : callbackName
        inject.path = path;
        return inject;
        /* scripts */
    },
    typeof arguments !== "undefined" ? arguments[0] : {} // protect
)
