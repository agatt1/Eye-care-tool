(function () {
    'use strict';

    /* malevic@0.11.6 - Mar 6, 2018 */
    function classes(...args) {
        const classes = [];
        args.filter((c) => Boolean(c))
            .forEach((c) => {
            if (typeof c === 'string') {
                classes.push(c);
            }
            else if (typeof c === 'object') {
                classes.push(...Object.keys(c)
                    .filter((key) => Boolean(c[key])));
            }
        });
        return classes.join(' ');
    }
    function styles(declarations) {
        return Object.keys(declarations)
            .filter((cssProp) => declarations[cssProp] != null)
            .map((cssProp) => `${cssProp}: ${declarations[cssProp]};`)
            .join(' ');
    }
    function isObject(value) {
        return typeof value === 'object' && value != null;
    }
    function toArray(obj) {
        return Array.prototype.slice.call(obj);
    }
    function flatten(arr) {
        return arr.reduce((flat, toFlatten) => {
            return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
        }, []);
    }
    function isEmptyDeclaration(d) {
        return d == null || d === '';
    }
    function flattenDeclarations(declarations, funcExecutor) {
        const results = [];
        flatten(declarations)
            .forEach((c) => {
            if (typeof c === 'function') {
                const r = funcExecutor(c);
                if (Array.isArray(r)) {
                    results.push(...flatten(r).filter(x => !isEmptyDeclaration(x)));
                }
                else if (!isEmptyDeclaration(r)) {
                    results.push(r);
                }
            }
            else if (!isEmptyDeclaration(c)) {
                results.push(c);
            }
        });
        return results;
    }

    function html(tagOrComponent, attrs, ...children) {
        if (typeof tagOrComponent === 'string') {
            return { tag: tagOrComponent, attrs, children };
        }
        if (typeof tagOrComponent === 'function') {
            return tagOrComponent(attrs == null ? undefined : attrs, ...flatten(children));
        }
        return null;
    }

    const dataBindings = new WeakMap();
    function setData(element, data) {
        dataBindings.set(element, data);
    }
    function getData(element) {
        return dataBindings.get(element);
    }

    const eventListeners = new WeakMap();
    function addListener(element, event, listener) {
        let listeners;
        if (eventListeners.has(element)) {
            listeners = eventListeners.get(element);
        }
        else {
            listeners = {};
            eventListeners.set(element, listeners);
        }
        if (listeners[event] !== listener) {
            if (event in listeners) {
                element.removeEventListener(event, listeners[event]);
            }
            element.addEventListener(event, listener);
            listeners[event] = listener;
        }
    }
    function removeListener(element, event) {
        let listeners;
        if (eventListeners.has(element)) {
            listeners = eventListeners.get(element);
        }
        else {
            return;
        }
        if (event in listeners) {
            element.removeEventListener(event, listeners[event]);
            delete listeners[event];
        }
    }

    function createPlugins() {
        const plugins = [];
        return {
            add(plugin) {
                plugins.push(plugin);
                return this;
            },
            apply(props) {
                let result;
                let plugin;
                for (let i = plugins.length - 1; i >= 0; i--) {
                    plugin = plugins[i];
                    result = plugin(props);
                    if (result != null) {
                        return result;
                    }
                }
                return null;
            }
        };
    }

    const nativeContainers = new WeakMap();
    const mountedElements = new WeakMap();
    const didMountHandlers = new WeakMap();
    const didUpdateHandlers = new WeakMap();
    const willUnmountHandlers = new WeakMap();
    const lifecycleHandlers = {
        'didmount': didMountHandlers,
        'didupdate': didUpdateHandlers,
        'willunmount': willUnmountHandlers
    };
    const XHTML_NS = 'http://www.w3.org/1999/xhtml';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const pluginsCreateNode = createPlugins()
        .add(({ d, parent }) => {
        if (!isObject(d)) {
            return document.createTextNode(d == null ? '' : String(d));
        }
        if (d.tag === 'svg') {
            return document.createElementNS(SVG_NS, 'svg');
        }
        if (parent.namespaceURI === XHTML_NS) {
            return document.createElement(d.tag);
        }
        return document.createElementNS(parent.namespaceURI, d.tag);
    });
    const pluginsMountNode = createPlugins()
        .add(({ node, parent, next }) => {
        parent.insertBefore(node, next);
        return true;
    });
    const pluginsUnmountNode = createPlugins()
        .add(({ node, parent }) => {
        parent.removeChild(node);
        return true;
    });
    const pluginsSetAttribute = createPlugins()
        .add(({ element, attr, value }) => {
        if (value == null || value === false) {
            element.removeAttribute(attr);
        }
        else {
            element.setAttribute(attr, value === true ? '' : String(value));
        }
        return true;
    })
        .add(({ element, attr, value }) => {
        if (attr.indexOf('on') === 0) {
            const event = attr.substring(2);
            if (typeof value === 'function') {
                addListener(element, event, value);
            }
            else {
                removeListener(element, event);
            }
            return true;
        }
        return null;
    })
        .add(({ element, attr, value }) => {
        if (attr === 'native') {
            if (value === true) {
                nativeContainers.set(element, true);
            }
            else {
                nativeContainers.delete(element);
            }
            return true;
        }
        if (attr in lifecycleHandlers) {
            const handlers = lifecycleHandlers[attr];
            if (value) {
                handlers.set(element, value);
            }
            else {
                handlers.delete(element);
            }
            return true;
        }
        return null;
    })
        .add(({ element, attr, value }) => {
        if (attr === 'data') {
            setData(element, value);
            return true;
        }
        return null;
    })
        .add(({ element, attr, value }) => {
        if (attr === 'class' && isObject(value)) {
            let cls;
            if (Array.isArray(value)) {
                cls = classes(...value);
            }
            else {
                cls = classes(value);
            }
            if (cls) {
                element.setAttribute('class', cls);
            }
            else {
                element.removeAttribute('class');
            }
            return true;
        }
        return null;
    })
        .add(({ element, attr, value }) => {
        if (attr === 'style' && isObject(value)) {
            const style = styles(value);
            if (style) {
                element.setAttribute('style', style);
            }
            else {
                element.removeAttribute('style');
            }
            return true;
        }
        return null;
    });
    const elementsAttrs = new WeakMap();
    function getAttrs(element) {
        return elementsAttrs.get(element) || null;
    }
    function createNode(d, parent, next) {
        const node = pluginsCreateNode.apply({ d, parent });
        if (isObject(d)) {
            const element = node;
            const elementAttrs = {};
            elementsAttrs.set(element, elementAttrs);
            if (d.attrs) {
                Object.keys(d.attrs).forEach((attr) => {
                    const value = d.attrs[attr];
                    pluginsSetAttribute.apply({ element, attr, value });
                    elementAttrs[attr] = value;
                });
            }
        }
        pluginsMountNode.apply({ node, parent, next });
        if (node instanceof Element && didMountHandlers.has(node)) {
            didMountHandlers.get(node)(node);
            mountedElements.set(node, true);
        }
        if (isObject(d) && node instanceof Element && !nativeContainers.has(node)) {
            syncChildNodes(d, node);
        }
        return node;
    }
    function collectAttrs(element) {
        return toArray(element.attributes)
            .reduce((obj, { name, value }) => {
            obj[name] = value;
            return obj;
        }, {});
    }
    function syncNode(d, existing) {
        if (isObject(d)) {
            const element = existing;
            const attrs = d.attrs || {};
            let existingAttrs = getAttrs(element);
            if (!existingAttrs) {
                existingAttrs = collectAttrs(element);
                elementsAttrs.set(element, existingAttrs);
            }
            Object.keys(existingAttrs).forEach((attr) => {
                if (!(attr in attrs)) {
                    pluginsSetAttribute.apply({ element, attr, value: null });
                    delete existingAttrs[attr];
                }
            });
            Object.keys(attrs).forEach((attr) => {
                const value = attrs[attr];
                if (existingAttrs[attr] !== value) {
                    pluginsSetAttribute.apply({ element, attr, value });
                    existingAttrs[attr] = value;
                }
            });
            if (didMountHandlers.has(element) && !mountedElements.has(element)) {
                didMountHandlers.get(element)(element);
                mountedElements.set(element, true);
            }
            else if (didUpdateHandlers.has(element)) {
                didUpdateHandlers.get(element)(element);
            }
            if (!nativeContainers.has(element)) {
                syncChildNodes(d, element);
            }
        }
        else {
            existing.textContent = d == null ? '' : String(d);
        }
    }
    function removeNode(node, parent) {
        if (node instanceof Element && willUnmountHandlers.has(node)) {
            willUnmountHandlers.get(node)(node);
        }
        pluginsUnmountNode.apply({ node, parent });
    }
    const pluginsMatchNodes = createPlugins()
        .add(({ d, element }) => {
        const matches = [];
        const declarations = Array.isArray(d.children) ? flattenDeclarations(d.children, (fn) => fn(element)) : [];
        let nodeIndex = 0;
        declarations.forEach((d) => {
            const isElement = isObject(d);
            const isText = !isElement;
            let found = null;
            let node = null;
            for (; nodeIndex < element.childNodes.length; nodeIndex++) {
                node = element.childNodes.item(nodeIndex);
                if (isText) {
                    if (node instanceof Element) {
                        break;
                    }
                    if (node instanceof Text) {
                        found = node;
                        nodeIndex++;
                        break;
                    }
                }
                if (isElement && node instanceof Element) {
                    if (node.tagName.toLowerCase() === d.tag) {
                        found = node;
                    }
                    nodeIndex++;
                    break;
                }
            }
            matches.push([d, found]);
        });
        return matches;
    });
    function commit(matches, element) {
        const matchedNodes = new Set();
        matches.map(([, node]) => node)
            .filter((node) => node)
            .forEach((node) => matchedNodes.add(node));
        toArray(element.childNodes)
            .filter((node) => !matchedNodes.has(node))
            .forEach((node) => removeNode(node, element));
        let prevNode = null;
        matches.forEach(([d, node], i) => {
            if (node) {
                syncNode(d, node);
                prevNode = node;
            }
            else {
                const nextSibling = (prevNode ?
                    prevNode.nextSibling :
                    (i === 0 ? element.firstChild : null));
                prevNode = createNode(d, element, nextSibling);
            }
        });
    }
    function syncChildNodes(d, element) {
        const matches = pluginsMatchNodes.apply({ d, element });
        commit(matches, element);
    }
    function render(target, declaration) {
        if (!(target instanceof Element)) {
            throw new Error('Wrong rendering target');
        }
        const temp = {
            tag: target.tagName.toLowerCase(),
            attrs: collectAttrs(target),
            children: Array.isArray(declaration) ? declaration : [declaration]
        };
        syncChildNodes(temp, target);
        return Array.isArray(declaration) ?
            toArray(target.childNodes) :
            isObject(declaration) ?
                target.firstElementChild :
                target.firstChild;
    }
    function sync(target, declarationOrFn) {
        const declaration = typeof declarationOrFn === 'function' ? declarationOrFn(target.parentElement) : declarationOrFn;
        const isElement = isObject(declaration);
        if (!((!isElement && target instanceof Text) ||
            (isElement && target instanceof Element && target.tagName.toLowerCase() === declaration.tag))) {
            throw new Error('Wrong sync target');
        }
        syncNode(declaration, target);
        return target;
    }

    const pluginsIsVoidTag = createPlugins()
        .add((tag) => tag in VOID_TAGS);
    const pluginsSkipAttr = createPlugins()
        .add(({ value }) => (value == null || value === false))
        .add(({ attr }) => (([
        'data',
        'native',
        'didmount',
        'didupdate',
        'willunmount',
    ].indexOf(attr) >= 0 ||
        attr.indexOf('on') === 0) ? true : null));
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    const pluginsStringifyAttr = createPlugins()
        .add(({ value }) => value === true ? '' : escapeHtml(value))
        .add(({ attr, value }) => {
        if (attr === 'class' && isObject(value)) {
            let cls;
            if (Array.isArray(value)) {
                cls = classes(...value);
            }
            else {
                cls = classes(value);
            }
            return escapeHtml(cls);
        }
        return null;
    })
        .add(({ attr, value }) => {
        if (attr === 'style' && isObject(value)) {
            return escapeHtml(styles(value));
        }
        return null;
    });
    const pluginsProcessText = createPlugins()
        .add((text) => escapeHtml(text));
    const VOID_TAGS = [
        'area',
        'base',
        'basefont',
        'bgsound',
        'br',
        'col',
        'command',
        'embed',
        'frame',
        'hr',
        'img',
        'image',
        'input',
        'isindex',
        'keygen',
        'link',
        'menuitem',
        'meta',
        'nextid',
        'param',
        'source',
        'track',
        'wbr',
        'circle',
        'ellipse',
        'image',
        'line',
        'path',
        'polygon',
        'rect',
    ].reduce((map, tag) => (map[tag] = true, map), {});

    const plugins = {
        render: {
            createNode: pluginsCreateNode,
            matchNodes: pluginsMatchNodes,
            mountNode: pluginsMountNode,
            setAttribute: pluginsSetAttribute,
            unmountNode: pluginsUnmountNode,
        },
        static: {
            isVoidTag: pluginsIsVoidTag,
            processText: pluginsProcessText,
            skipAttr: pluginsSkipAttr,
            stringifyAttr: pluginsStringifyAttr,
        }
    };

    class Connector {
        constructor() {
            this.counter = 0;
            this.port = chrome.runtime.connect({ name: 'ui' });
        }
        getRequestId() {
            return ++this.counter;
        }
        sendRequest(request, executor) {
            const id = this.getRequestId();
            return new Promise((resolve, reject) => {
                const listener = ({ id: responseId, ...response }) => {
                    if (responseId === id) {
                        executor(response, resolve, reject);
                        this.port.onMessage.removeListener(listener);
                    }
                };
                this.port.onMessage.addListener(listener);
                this.port.postMessage({ ...request, id });
            });
        }
        getData() {
            return this.sendRequest({ type: 'get-data' }, ({ data }, resolve) => resolve(data));
        }
        getActiveTabInfo() {
            return this.sendRequest({ type: 'get-active-tab-info' }, ({ data }, resolve) => resolve(data));
        }
        subscribeToChanges(callback) {
            const id = this.getRequestId();
            this.port.onMessage.addListener(({ id: responseId, data }) => {
                if (responseId === id) {
                    callback(data);
                }
            });
            this.port.postMessage({ type: 'subscribe-to-changes', id });
        }
        enable() {
            this.port.postMessage({ type: 'enable' });
        }
        disable() {
            this.port.postMessage({ type: 'disable' });
        }
        setShortcut(command, shortcut) {
            this.port.postMessage({ type: 'set-shortcut', data: { command, shortcut } });
        }
        changeSettings(settings) {
            this.port.postMessage({ type: 'change-settings', data: settings });
        }
        setTheme(theme) {
            this.port.postMessage({ type: 'set-theme', data: theme });
        }
        toggleSitePattern(pattern) {
            this.port.postMessage({ type: 'toggle-site-pattern', data: pattern });
        }
        markNewsAsRead(ids) {
            this.port.postMessage({ type: 'mark-news-as-read', data: ids });
        }
        applyDevDynamicThemeFixes(text) {
            return this.sendRequest({ type: 'apply-dev-dynamic-theme-fixes', data: text }, ({ error }, resolve, reject) => error ? reject(error) : resolve());
        }
        resetDevDynamicThemeFixes() {
            this.port.postMessage({ type: 'reset-dev-dynamic-theme-fixes' });
        }
        applyDevInversionFixes(text) {
            return this.sendRequest({ type: 'apply-dev-inversion-fixes', data: text }, ({ error }, resolve, reject) => error ? reject(error) : resolve());
        }
        resetDevInversionFixes() {
            this.port.postMessage({ type: 'reset-dev-inversion-fixes' });
        }
        applyDevStaticThemes(text) {
            return this.sendRequest({ type: 'apply-dev-static-themes', data: text }, ({ error }, resolve, reject) => error ? reject(error) : resolve());
        }
        resetDevStaticThemes() {
            this.port.postMessage({ type: 'reset-dev-static-themes' });
        }
        disconnect() {
            this.port.disconnect();
        }
    }

    function getURLHost(url) {
        return url.match(/^(.*?:\/{2,3})?(.+?)(\/|$)/)[2];
    }
    /**
     * Determines whether URL has a match in URL template list.
     * @param url Site URL.
     * @paramlist List to search into.
     */
    function isURLInList(url, list) {
        for (let i = 0; i < list.length; i++) {
            if (isURLMatched(url, list[i])) {
                return true;
            }
        }
        return false;
    }
    /**
     * Determines whether URL matches the template.
     * @param url URL.
     * @param urlTemplate URL template ("google.*", "youtube.com" etc).
     */
    function isURLMatched(url, urlTemplate) {
        const regex = createUrlRegex(urlTemplate);
        return Boolean(url.match(regex));
    }
    function createUrlRegex(urlTemplate) {
        urlTemplate = urlTemplate.trim();
        const exactBeginning = (urlTemplate[0] === '^');
        const exactEnding = (urlTemplate[urlTemplate.length - 1] === '$');
        urlTemplate = (urlTemplate
            .replace(/^\^/, '') // Remove ^ at start
            .replace(/\$$/, '') // Remove $ at end
            .replace(/^.*?\/{2,3}/, '') // Remove scheme
            .replace(/\?.*$/, '') // Remove query
            .replace(/\/$/, '') // Remove last slash
        );
        let slashIndex;
        let beforeSlash;
        let afterSlash;
        if ((slashIndex = urlTemplate.indexOf('/')) >= 0) {
            beforeSlash = urlTemplate.substring(0, slashIndex); // google.*
            afterSlash = urlTemplate.replace('$', '').substring(slashIndex); // /login/abc
        }
        else {
            beforeSlash = urlTemplate.replace('$', '');
        }
        //
        // SCHEME and SUBDOMAINS
        let result = (exactBeginning ?
            '^(.*?\\:\\/{2,3})?' // Scheme
            : '^(.*?\\:\\/{2,3})?([^\/]*?\\.)?' // Scheme and subdomains
        );
        //
        // HOST and PORT
        const hostParts = beforeSlash.split('.');
        result += '(';
        for (let i = 0; i < hostParts.length; i++) {
            if (hostParts[i] === '*') {
                hostParts[i] = '[^\\.\\/]+?';
            }
        }
        result += hostParts.join('\\.');
        result += ')';
        //
        // PATH and QUERY
        if (afterSlash) {
            result += '(';
            result += afterSlash.replace('/', '\\/');
            result += ')';
        }
        result += (exactEnding ?
            '(\\/?(\\?[^\/]*?)?)$' // All following queries
            : '(\\/?.*?)$' // All following paths and queries
        );
        //
        // Result
        return new RegExp(result, 'i');
    }

    var FilterMode;
    (function (FilterMode) {
        FilterMode[FilterMode["light"] = 0] = "light";
        FilterMode[FilterMode["dark"] = 1] = "dark";
    })(FilterMode || (FilterMode = {}));
    var ColorblindnessType;
    (function (ColorblindnessType) {
        ColorblindnessType[ColorblindnessType["deuteranopia"] = 0] = "deuteranopia";
        ColorblindnessType[ColorblindnessType["protanopia"] = 1] = "protanopia";
        ColorblindnessType[ColorblindnessType["tritanopia"] = 2] = "tritanopia";
    })(ColorblindnessType || (ColorblindnessType = {}));
    var ColorCorrectionType;
    (function (ColorCorrectionType) {
        ColorCorrectionType[ColorCorrectionType["lmsDaltonization"] = 0] = "lmsDaltonization";
        ColorCorrectionType[ColorCorrectionType["cbFilterService"] = 1] = "cbFilterService";
        ColorCorrectionType[ColorCorrectionType["lab"] = 2] = "lab";
        ColorCorrectionType[ColorCorrectionType["shift"] = 3] = "shift";
    })(ColorCorrectionType || (ColorCorrectionType = {}));

    function getMockData(override = {}) {
        return Object.assign({
            isEnabled: true,
            isReady: true,
            settings: {
                enabled: true,
                theme: {
                    mode: 1,
                    brightness: 110,
                    contrast: 90,
                    grayscale: 20,
                    sepia: 10,
                    useFont: false,
                    fontFamily: 'Segoe UI',
                    textStroke: 0,
                    textScale: 100,
                    useColorCorrection: false,
                    colorblindnessType: ColorblindnessType.deuteranopia,
                    colorCorrectionType: ColorCorrectionType.lmsDaltonization,
                    unclickedColor: '0000FF',
                    clickedColor: '551A8B',
                    engine: 'cssFilter',
                    stylesheet: '',
                },
                customThemes: [],
                siteList: [],
                applyToListedOnly: false,
                changeBrowserTheme: false,
                activationTime: '18:00',
                deactivationTime: '9:00',
                notifyOfNews: false,
                syncSettings: true,
            },
            fonts: [
                'serif',
                'sans-serif',
                'monospace',
                'cursive',
                'fantasy',
                'system-ui'
            ],
            news: [],
            shortcuts: {
                'addSite': 'Alt+Shift+A',
                'toggle': 'Alt+Shift+D'
            },
            devDynamicThemeFixesText: '',
            devInversionFixesText: '',
            devStaticThemesText: '',
        }, override);
    }
    function getMockActiveTabInfo() {
        return {
            url: 'https://darkreader.org/',
            isProtected: false,
            isInDarkList: false,
        };
    }
    function createConnectorMock() {
        let listener = null;
        const data = getMockData();
        const tab = getMockActiveTabInfo();
        const connector = {
            getData() {
                return Promise.resolve(data);
            },
            getActiveTabInfo() {
                return Promise.resolve(tab);
            },
            subscribeToChanges(callback) {
                listener = callback;
            },
            changeSettings(settings) {
                Object.assign(data.settings, settings);
                listener(data);
            },
            setTheme(theme) {
                Object.assign(data.settings.theme, theme);
                listener(data);
            },
            setShortcut(command, shortcut) {
                Object.assign(data.shortcuts, { [command]: shortcut });
                listener(data);
            },
            toggleSitePattern(pattern) {
                const index = data.settings.siteList.indexOf(pattern);
                if (index >= 0) {
                    data.settings.siteList.splice(pattern, 1);
                }
                else {
                    data.settings.siteList.push(pattern);
                }
                listener(data);
            },
            markNewsAsRead(ids) {
                //
            },
            disconnect() {
                //
            },
        };
        return connector;
    }

    function connect() {
        if (typeof chrome === 'undefined' || !chrome.extension) {
            return createConnectorMock();
        }
        return new Connector();
    }

    /* malevic@0.11.6 - Mar 6, 2018 */

    let registered = false;
    function withForms() {
        if (registered) {
            return;
        }
        registered = true;
        plugins.render.setAttribute
            .add(({ element, attr, value }) => {
            if (attr === 'value' && element instanceof HTMLInputElement) {
                const text = value == null ? '' : String(value);
                if (element.hasAttribute('value')) {
                    element.value = text;
                }
                else {
                    element.setAttribute('value', text);
                }
                return true;
            }
            return null;
        });
        plugins.render.createNode
            .add(({ d, parent }) => {
            if ((d == null || typeof d !== 'object') && parent instanceof HTMLTextAreaElement) {
                const text = d;
                const value = text == null ? '' : String(text);
                if (parent.textContent || parent.hasAttribute('value')) {
                    parent.value = text;
                }
                else {
                    parent.textContent = value;
                }
                return parent.firstChild;
            }
            return null;
        });
    }

    /* malevic@0.11.6 - Mar 6, 2018 */

    let componentsCounter = 0;
    function withState(fn, initialState = {}) {
        const parentsStates = new WeakMap();
        const defaultKey = `state-${componentsCounter++}`;
        return function (attrs = {}, ...children) {
            const key = attrs.key == null ? defaultKey : attrs.key;
            return function (parentDomNode) {
                let states;
                if (parentsStates.has(parentDomNode)) {
                    states = parentsStates.get(parentDomNode);
                }
                else {
                    states = new Map();
                    parentsStates.set(parentDomNode, states);
                }
                let match;
                if (states.has(key)) {
                    match = states.get(key);
                }
                else {
                    match = {
                        node: null,
                        state: initialState,
                        attrs: null,
                        children: [],
                    };
                    states.set(key, match);
                }
                match.attrs = attrs;
                match.children = children;
                let callingComponent = false;
                function invokeComponentFn(state, attrs, children) {
                    callingComponent = true;
                    const declaration = fn(Object.assign({}, attrs, { state, setState }), ...children);
                    callingComponent = false;
                    declaration.attrs = declaration.attrs || {};
                    const oldDidMount = declaration.attrs.didmount;
                    const oldDidUpdate = declaration.attrs.didupdate;
                    const oldWillUnmount = declaration.attrs.oldDidUnmount;
                    declaration.attrs.didmount = function (domNode) {
                        states.get(key).node = domNode;
                        oldDidMount && oldDidMount(domNode);
                    };
                    declaration.attrs.didupdate = function (domNode) {
                        states.get(key).node = domNode;
                        oldDidUpdate && oldDidUpdate(domNode);
                    };
                    declaration.attrs.willunmount = function (domNode) {
                        states.delete(key);
                        oldWillUnmount && oldWillUnmount(domNode);
                    };
                    return declaration;
                }
                function setState(newState) {
                    if (callingComponent) {
                        throw new Error('Calling `setState` inside component function leads to infinite recursion');
                    }
                    const match = states.get(key);
                    const merged = Object.assign({}, match.state, newState);
                    match.state = merged;
                    sync(match.node, invokeComponentFn(merged, match.attrs, match.children));
                }
                return invokeComponentFn(match.state, match.attrs, match.children);
            };
        };
    }

    function toArray$1(x) {
        return Array.isArray(x) ? x : [x];
    }
    function mergeClass(cls, propsCls) {
        const normalized = toArray$1(cls).concat(toArray$1(propsCls));
        return classes(...normalized);
    }
    function omitAttrs(omit, attrs) {
        const result = {};
        Object.keys(attrs).forEach((key) => {
            if (omit.indexOf(key) < 0) {
                result[key] = attrs[key];
            }
        });
        return result;
    }

    function Button(props = {}, ...children) {
        const cls = mergeClass('button', props.class);
        const attrs = omitAttrs(['class'], props);
        return (html("button", Object.assign({ class: cls }, attrs),
            html("span", { class: "button__wrapper" }, children)));
    }

    function CheckBox(props = {}) {
        const cls = mergeClass('checkbox', props.class);
        const attrs = omitAttrs(['class', 'checked', 'onchange'], props);
        return (html("label", Object.assign({ class: cls }, attrs),
            html("input", { class: "checkbox__input", type: "checkbox", checked: props.checked, onchange: props.onchange }),
            html("span", { class: "checkbox__checkmark" })));
    }

    function TextBox(props = {}, text) {
        const cls = mergeClass('textbox', props.class);
        const attrs = omitAttrs(['class', 'type'], props);
        return (html("input", Object.assign({ class: cls, type: "text" }, attrs)));
    }

    plugins.render.matchNodes.add(({ d, element }) => {
        if (!(d.attrs && d.attrs.data === VirtualScroll)) {
            return null;
        }
        const elements = Array.from(element.children);
        const elementsByIndex = elements.reduce((map, el) => map.set(getData(el), el), new Map());
        const declarations = d.children[0](element);
        return declarations.map((c) => [c, elementsByIndex.get(c.attrs.data) || null]);
    });
    const elementsHeights = new WeakMap();
    function VirtualScroll(props) {
        if (props.items.length === 0) {
            return props.root;
        }
        function getContent({ scrollToIndex }) {
            return (root) => {
                let itemHeight;
                if (elementsHeights.has(root)) {
                    itemHeight = elementsHeights.get(root);
                }
                else {
                    const tempItem = {
                        ...props.items[0],
                        attrs: {
                            ...props.items[0].attrs,
                            didmount: null,
                            didupdate: null
                        }
                    };
                    const tempNode = render(root, tempItem);
                    itemHeight = tempNode.getBoundingClientRect().height;
                    elementsHeights.set(root, itemHeight);
                }
                return (html("div", { data: VirtualScroll, style: {
                        'flex': 'none',
                        'height': `${props.items.length * itemHeight}px`,
                        'overflow': 'hidden',
                        'position': 'relative',
                    } }, (wrapper) => {
                    if (scrollToIndex >= 0) {
                        root.scrollTop = scrollToIndex * itemHeight;
                    }
                    const containerHeight = document.documentElement.clientHeight - root.getBoundingClientRect().top; // Use this height as a fix for animated height
                    // Prevent removing focused element
                    let focusedIndex = -1;
                    if (document.activeElement) {
                        let current = document.activeElement;
                        while (current && current.parentElement !== wrapper) {
                            current = current.parentElement;
                        }
                        if (current) {
                            focusedIndex = getData(current);
                        }
                    }
                    return props.items
                        .map((item, index) => {
                        return { item, index };
                    })
                        .filter(({ item, index }) => {
                        const eTop = index * itemHeight;
                        const eBottom = (index + 1) * itemHeight;
                        const rTop = root.scrollTop;
                        const rBottom = root.scrollTop + containerHeight;
                        const isTopBoundVisible = eTop >= rTop && eTop <= rBottom;
                        const isBottomBoundVisible = eBottom >= rTop && eBottom <= rBottom;
                        return isTopBoundVisible || isBottomBoundVisible || focusedIndex === index;
                    })
                        .map(({ item, index }) => (html("div", { data: index, style: {
                            'left': '0',
                            'position': 'absolute',
                            'top': `${index * itemHeight}px`,
                            'width': '100%',
                        } }, item)));
                }));
            };
        }
        let rootNode;
        let prevScrollTop;
        const rootDidMount = props.root.attrs && props.root.attrs.didmount;
        const rootDidUpdate = props.root.attrs && props.root.attrs.didupdate;
        return {
            ...props.root,
            attrs: {
                ...props.root.attrs,
                didmount: (node) => {
                    rootNode = node;
                    rootDidMount && rootDidMount(rootNode);
                },
                didupdate: (node) => {
                    rootNode = node;
                    rootDidUpdate && rootDidUpdate(rootNode);
                },
                onscroll: (e) => {
                    if (rootNode.scrollTop === prevScrollTop) {
                        return;
                    }
                    prevScrollTop = rootNode.scrollTop;
                    render(rootNode, getContent({ scrollToIndex: -1 }));
                }
            },
            children: [getContent({ scrollToIndex: isNaN(props.scrollToIndex) ? -1 : props.scrollToIndex })]
        };
    }

    const valueNodes = new WeakMap();
    function Select(props) {
        const { state, setState } = props;
        const values = Object.keys(props.options);
        let rootNode;
        function onRender(node) {
            rootNode = node;
            if (!valueNodes.has(rootNode)) {
                valueNodes.set(rootNode, new Map());
            }
        }
        function onOuterClick(e) {
            const r = rootNode.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
                window.removeEventListener('click', onOuterClick);
                collapseList();
            }
        }
        function onTextInput(e) {
            const text = e.target
                .value
                .toLowerCase()
                .trim();
            expandList();
            values.some((value) => {
                if (value.toLowerCase().indexOf(text) === 0) {
                    scrollToValue(value);
                    return true;
                }
            });
        }
        function onKeyPress(e) {
            const input = e.target;
            if (e.key === 'Enter') {
                const value = input.value;
                input.blur();
                collapseList();
                props.onChange(value);
            }
        }
        function scrollToValue(value) {
            setState({ focusedIndex: values.indexOf(value) });
        }
        function onExpandClick() {
            if (state.isExpanded) {
                collapseList();
            }
            else {
                expandList();
            }
        }
        function expandList() {
            setState({ isExpanded: true });
            scrollToValue(props.value);
            window.addEventListener('click', onOuterClick);
        }
        function collapseList() {
            setState({ isExpanded: false });
        }
        function onSelectOption(e) {
            let current = e.target;
            while (current && !current.matches('.select__option')) {
                current = current.parentElement;
            }
            if (current) {
                const value = getData(current);
                props.onChange(value);
            }
            collapseList();
        }
        function saveValueNode(value, domNode) {
            valueNodes.get(rootNode).set(value, domNode);
        }
        function removeValueNode(value) {
            valueNodes.get(rootNode).delete(value);
        }
        return (html("span", { class: "select", didmount: onRender, didupdate: onRender },
            html("span", { class: "select__line" },
                html(TextBox, { class: "select__textbox", value: props.value, oninput: onTextInput, onkeypress: onKeyPress }),
                html(Button, { class: "select__expand", onclick: onExpandClick },
                    html("span", { class: "select__expand__icon" }))),
            html(VirtualScroll, { root: html("span", { class: {
                        'select__list': true,
                        'select__list--expanded': state.isExpanded,
                        'select__list--short': Object.keys(props.options).length <= 7,
                    }, onclick: onSelectOption }), items: Object.entries(props.options).map(([value, content]) => (html("span", { class: "select__option", data: value, didmount: (domNode) => saveValueNode(value, domNode), didupdate: (domNode) => saveValueNode(value, domNode), willunmount: () => removeValueNode(value) }, content))), scrollToIndex: state.focusedIndex })));
    }
    var Select$1 = withState(Select);

    function isFirefox() {
        return navigator.userAgent.indexOf('Firefox') >= 0;
    }
    function isVivaldi() {
        return navigator.userAgent.toLowerCase().indexOf('vivaldi') >= 0;
    }
    function isYaBrowser() {
        return navigator.userAgent.toLowerCase().indexOf('yabrowser') >= 0;
    }
    function isOpera() {
        const agent = navigator.userAgent.toLowerCase();
        return agent.indexOf('opr') >= 0 || agent.indexOf('opera') >= 0;
    }
    function isWindows() {
        return navigator.platform.toLowerCase().indexOf('win') === 0;
    }
    function isMacOS() {
        return navigator.platform.toLowerCase().indexOf('mac') === 0;
    }
    function isMobile() {
        const agent = navigator.userAgent.toLowerCase();
        return agent.indexOf('mobile') >= 0;
    }
    function getChromeVersion() {
        const agent = navigator.userAgent.toLowerCase();
        const m = agent.match(/chrom[e|ium]\/([^ ]+)/);
        if (m && m[1]) {
            return m[1];
        }
        return null;
    }
    function compareChromeVersions($a, $b) {
        const a = $a.split('.').map((x) => parseInt(x));
        const b = $b.split('.').map((x) => parseInt(x));
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
                return a[i] < b[i] ? -1 : 1;
            }
        }
        return 0;
    }

    /**
     * Displays a shortcut and navigates
     * to Chrome Commands page on click.
     */
    function ShortcutLink(props) {
        const cls = mergeClass('shortcut', props.class);
        const shortcut = props.shortcuts[props.commandName];
        let enteringShortcutInProgress = false;
        function startEnteringShortcut(node) {
            if (enteringShortcutInProgress) {
                return;
            }
            enteringShortcutInProgress = true;
            const initialText = node.textContent;
            node.textContent = '...⌨';
            function onKeyDown(e) {
                e.preventDefault();
                const ctrl = e.ctrlKey;
                const alt = e.altKey;
                const command = e.metaKey;
                const shift = e.shiftKey;
                let key = null;
                if (e.code.startsWith('Key')) {
                    key = e.code.substring(3);
                }
                else if (e.code.startsWith('Digit')) {
                    key = e.code.substring(5);
                }
                const shortcut = `${ctrl ? 'Ctrl+' : alt ? 'Alt+' : command ? 'Command+' : ''}${shift ? 'Shift+' : ''}${key ? key : ''}`;
                node.textContent = shortcut;
                if ((ctrl || alt || command || shift) && key) {
                    removeListeners();
                    props.onSetShortcut(shortcut);
                    node.blur();
                    setTimeout(() => {
                        enteringShortcutInProgress = false;
                        node.classList.remove('shortcut--edit');
                        node.textContent = props.textTemplate(shortcut);
                    }, 500);
                }
            }
            function onBlur() {
                removeListeners();
                node.classList.remove('shortcut--edit');
                node.textContent = initialText;
                enteringShortcutInProgress = false;
            }
            function removeListeners() {
                window.removeEventListener('keydown', onKeyDown, true);
                window.removeEventListener('blur', onBlur, true);
            }
            window.addEventListener('keydown', onKeyDown, true);
            window.addEventListener('blur', onBlur, true);
            node.classList.add('shortcut--edit');
        }
        function onClick(e) {
            e.preventDefault();
            if (isFirefox()) {
                startEnteringShortcut(e.target);
                return;
            }
            chrome.tabs.create({
                url: `chrome://extensions/configureCommands#command-${chrome.runtime.id}-${props.commandName}`,
                active: true
            });
        }
        return (html("a", { class: cls, href: "#", onclick: onClick }, props.textTemplate(shortcut)));
    }

    function Tab({ isActive }, ...children) {
        const tabCls = {
            'tab-panel__tab': true,
            'tab-panel__tab--active': isActive
        };
        return (html("div", { class: tabCls }, children));
    }

    function TabPanel(props) {
        const tabsNames = Object.keys(props.tabs);
        function isActiveTab(name, index) {
            return (name == null
                ? index === 0
                : name === props.activeTab);
        }
        const buttons = tabsNames.map((name, i) => {
            const btnCls = {
                'tab-panel__button': true,
                'tab-panel__button--active': isActiveTab(name, i)
            };
            return (html(Button, { class: btnCls, onclick: () => props.onSwitchTab(name) }, props.tabLabels[name]));
        });
        const tabs = tabsNames.map((name, i) => (html(Tab, { isActive: isActiveTab(name, i) }, props.tabs[name])));
        return (html("div", { class: "tab-panel" },
            html("div", { class: "tab-panel__buttons" }, buttons),
            html("div", { class: "tab-panel__tabs" }, tabs)));
    }

    const propsStore = new WeakMap();
    function TextList(props) {
        function onTextChange(e) {
            const index = getData(e.target);
            const values = props.values.slice();
            const value = e.target.value.trim();
            if (values.indexOf(value) >= 0) {
                return;
            }
            if (!value) {
                values.splice(index, 1);
            }
            else if (index === values.length) {
                values.push(value);
            }
            else {
                values.splice(index, 1, value);
            }
            props.onChange(values);
        }
        function createTextBox(text, index) {
            return (html(TextBox, { class: "text-list__textbox", value: text, data: index, placeholder: props.placeholder }));
        }
        return (node) => {
            let shouldFocus = false;
            const prevProps = propsStore.get(node);
            propsStore.set(node, props);
            if (props.isFocused && (!prevProps ||
                !prevProps.isFocused ||
                prevProps.values.length < props.values.length)) {
                shouldFocus = true;
                requestAnimationFrame(() => {
                    const inputs = node.querySelectorAll('.text-list__textbox');
                    const last = inputs.item(inputs.length - 1);
                    last.focus();
                });
            }
            return (html(VirtualScroll, { root: html("div", { class: ['text-list', props.class], onchange: onTextChange }), items: props.values
                    .map(createTextBox)
                    .concat(createTextBox('', props.values.length)), scrollToIndex: shouldFocus ? props.values.length : -1 }));
        };
    }

    function Toggle(props) {
        const { checked, onChange } = props;
        const cls = {
            'toggle': true,
            'toggle--checked': checked,
            [props.class]: props.class
        };
        const clsOn = {
            'toggle__btn': true,
            'toggle__on': true,
            'toggle__btn--active': checked
        };
        const clsOff = {
            'toggle__btn': true,
            'toggle__off': true,
            'toggle__btn--active': !checked
        };
        return (html("span", { class: cls },
            html("span", { class: clsOn, onclick: onChange ? () => !checked && onChange(true) : null }, props.labelOn),
            html("span", { class: clsOff, onclick: onChange ? () => checked && onChange(false) : null }, props.labelOff)));
    }

    function Slider(props) {
        return (html("div", { class: "slidecontainer" },
            html("input", { type: "range", class: "slider-square", min: props.min, max: props.max, step: props.step, value: props.value, oninput: (e) => props.onchange(parseFloat(e.target.value)) }),
            html("div", { class: "slider-square__label" }, props.label)));
    }

    function getLocalMessage(messageName) {
        return chrome.i18n.getMessage(messageName);
    }
    function getUILanguage() {
        return chrome.i18n.getUILanguage();
    }

    function UpDown(props) {
        const buttonDownCls = {
            'updown__button': true,
            'updown__button--disabled': props.value === props.min
        };
        const buttonUpCls = {
            'updown__button': true,
            'updown__button--disabled': props.value === props.max
        };
        function normalize(x) {
            const exp = Math.ceil(Math.log10(props.step));
            if (exp >= 1) {
                const m = Math.pow(10, exp);
                return Math.round(x / m) * m;
            }
            else {
                const m = Math.pow(10, -exp);
                return Math.round(x * m) / m;
            }
        }
        function clamp(x) {
            return Math.max(props.min, Math.min(props.max, x));
        }
        function onButtonDownClick() {
            props.onChange(clamp(normalize(props.value - props.step)));
        }
        function onSliderChange(sliderValue) {
            props.onChange(clamp(normalize(sliderValue)));
        }
        function onButtonUpClick() {
            props.onChange(clamp(normalize(props.value + props.step)));
        }
        const valueText = (props.value === props.default
            ? getLocalMessage('off').toLocaleLowerCase()
            : props.value > props.default
                ? `+${normalize(props.value - props.default)}`
                : `-${normalize(props.default - props.value)}`);
        return (html("div", { class: "updown" },
            html("div", { class: "updown__line" },
                html(Button, { class: buttonDownCls, onclick: onButtonDownClick },
                    html("span", { class: "updown__icon updown__icon-down" })),
                html(Slider, { min: props.min, max: props.max, step: props.step, value: props.value, label: props.name, onchange: onSliderChange }),
                html(Button, { class: buttonUpCls, onclick: onButtonUpClick },
                    html("span", { class: "updown__icon updown__icon-up" }))),
            html("label", { class: "updown__value-text" }, valueText)));
    }

    function printTest() {
        console.log(2);
    }
    function CustToggle(props) {
        const { checked, onChange } = props;
        const cls = {
            'toggle': true,
            'toggle--checked': checked,
            [props.class]: props.class
        };
        const clsOn = {
            'toggle__btn': true,
            'toggle__on': true,
            'toggle__btn--active': checked
        };
        const clsOff = {
            'toggle__btn': true,
            'toggle__off': true,
            'toggle__btn--active': !checked
        };
        printTest();
        return (html("span", { class: cls },
            html("span", { class: clsOn, onclick: onChange ? () => !checked && onChange(true) : null },
                props.labelOn,
                printTest),
            html("span", { class: clsOff, onclick: onChange ? () => checked && onChange(false) : null },
                props.labelOff,
                printTest)));
    }

    function CustomSettingsToggle({ data, tab, actions }) {
        const host = getURLHost(tab.url || '');
        const isCustom = data.settings.customThemes.some(({ url }) => isURLInList(tab.url, url));
        const urlText = (host
            ? host
                .split('.')
                .reduce((elements, part, i) => elements.concat(html("wbr", null), `${i > 0 ? '.' : ''}${part}`), [])
            : 'current site');
        return (html(Button, { class: {
                'custom-settings-toggle': true,
                'custom-settings-toggle--checked': isCustom,
                'custom-settings-toggle--disabled': tab.isProtected || (tab.isInDarkList && !data.settings.applyToListedOnly),
            }, onclick: (e) => {
                if (isCustom) {
                    const filtered = data.settings.customThemes.filter(({ url }) => !isURLInList(tab.url, url));
                    actions.changeSettings({ customThemes: filtered });
                }
                else {
                    const extended = data.settings.customThemes.concat({
                        url: [host],
                        theme: { ...data.settings.theme },
                    });
                    actions.changeSettings({ customThemes: extended });
                    e.currentTarget.classList.add('custom-settings-toggle--checked'); // Speed-up reaction
                }
            } },
            html("span", { class: "custom-settings-toggle__wrapper" },
                getLocalMessage('only_for'),
                " ",
                html("span", { class: "custom-settings-toggle__url" }, urlText))));
    }

    function ModeToggle({ mode, onChange }) {
        return (html("div", { class: "mode-toggle" },
            html("div", { class: "mode-toggle__line" },
                html(Button, { class: { 'mode-toggle__button--active': mode === 1 }, onclick: () => onChange(1) },
                    html("span", { class: "icon icon--dark-mode" })),
                html(Toggle, { checked: mode === 1, labelOn: getLocalMessage('dark'), labelOff: getLocalMessage('light'), onChange: (checked) => onChange(checked ? 1 : 0) }),
                html(Button, { class: { 'mode-toggle__button--active': mode === 0 }, onclick: () => onChange(0) },
                    html("span", { class: "icon icon--light-mode" }))),
            html("label", { class: "mode-toggle__label" }, getLocalMessage('mode'))));
    }

    function FilterSettings({ data, actions, tab }) {
        const custom = data.settings.customThemes.find(({ url }) => isURLInList(tab.url, url));
        const filterConfig = custom ? custom.theme : data.settings.theme;
        function setConfig(config) {
            if (custom) {
                custom.theme = { ...custom.theme, ...config };
                actions.changeSettings({ customThemes: data.settings.customThemes });
            }
            else {
                actions.setTheme(config);
            }
        }
        const brightness = (html(UpDown, { value: filterConfig.brightness, min: 50, max: 150, step: 10, default: 100, name: getLocalMessage('brightness'), onChange: (value) => setConfig({ brightness: value }) }));
        const contrast = (html(UpDown, { value: filterConfig.contrast, min: 50, max: 150, step: 10, default: 100, name: getLocalMessage('contrast'), onChange: (value) => setConfig({ contrast: value }) }));
        const grayscale = (html(UpDown, { value: filterConfig.grayscale, min: 0, max: 100, step: 10, default: 0, name: getLocalMessage('grayscale'), onChange: (value) => setConfig({ grayscale: value }) }));
        const sepia = (html(UpDown, { value: filterConfig.sepia, min: 0, max: 100, step: 10, default: 0, name: getLocalMessage('sepia'), onChange: (value) => setConfig({ sepia: value }) }));
        return (html("section", { class: "filter-settings" },
            html(ModeToggle, { mode: filterConfig.mode, onChange: (mode) => setConfig({ mode }) }),
            brightness,
            contrast,
            sepia,
            grayscale,
            html(CustomSettingsToggle, { data: data, tab: tab, actions: actions })));
    }

    function SiteToggleButton({ data, tab, actions }) {
        const toggleHasEffect = (data.isEnabled &&
            !tab.isProtected &&
            (data.settings.applyToListedOnly || !tab.isInDarkList));
        const host = getURLHost(tab.url || '');
        const urlText = (host
            ? host
                .split('.')
                .reduce((elements, part, i) => elements.concat(html("wbr", null), `${i > 0 ? '.' : ''}${part}`), [])
            : 'current site');
        return (html(Button, { class: {
                'site-toggle': true,
                'site-toggle--disabled': !toggleHasEffect
            }, onclick: () => actions.toggleSitePattern(host) },
            getLocalMessage('toggle'),
            " ",
            html("span", { class: "site-toggle__url" }, urlText)));
    }

    function multiline(...lines) {
        return lines.join('\n');
    }
    function TopSection({ data, actions, tab }) {
        function toggleExtension(enabled) {
            actions.changeSettings({ enabled });
        }
        return (html("header", { class: "header" },
            html("img", { class: "header__logo", src: "../assets/images/darkreader-type.svg", alt: "Illumify" }),
            html("div", { class: "header__control header__site-toggle" },
                html(SiteToggleButton, { data: data, tab: tab, actions: actions }),
                tab.isProtected ? (html("span", { class: "header__site-toggle__unable-text" }, getLocalMessage('page_protected'))) : tab.isInDarkList ? (html("span", { class: "header__site-toggle__unable-text" }, getLocalMessage('page_in_dark_list'))) : (html(ShortcutLink, { commandName: "addSite", shortcuts: data.shortcuts, textTemplate: (hotkey) => (hotkey
                        ? multiline(getLocalMessage('toggle_current_site'), hotkey)
                        : getLocalMessage('setup_hotkey_toggle_site')), onSetShortcut: (shortcut) => actions.setShortcut('addSite', shortcut) }))),
            html("div", { class: "header__control header__app-toggle" },
                html(Toggle, { checked: data.isEnabled, labelOn: getLocalMessage('on'), labelOff: getLocalMessage('off'), onChange: toggleExtension }),
                html(ShortcutLink, { commandName: "toggle", shortcuts: data.shortcuts, textTemplate: (hotkey) => (hotkey
                        ? multiline(getLocalMessage('toggle_extension'), hotkey)
                        : getLocalMessage('setup_hotkey_toggle_extension')), onSetShortcut: (shortcut) => actions.setShortcut('toggle', shortcut) }))));
    }

    function Loader({ complete = false, state, setState }) {
        return (html("div", { class: {
                'loader': true,
                'loader--complete': complete,
                'loader--transition-end': state.finished,
            }, ontransitionend: () => setState({ finished: true }) },
            html("label", { class: "loader__message" }, getLocalMessage('loading_please_wait'))));
    }
    var Loader$1 = withState(Loader);

    function FontSettings({ config, fonts, onChange }) {
        return (html("section", { class: "font-settings" },
            html("div", { class: "font-settings__font-select-container" },
                html("div", { class: "font-settings__font-select-container__line" },
                    html(CheckBox, { checked: config.useFont, onchange: (e) => onChange({ useFont: e.target.checked }) }),
                    html(Select$1, { value: config.fontFamily, onChange: (value) => onChange({ fontFamily: value }), options: fonts.reduce((map, font) => {
                            map[font] = (html("div", { style: { 'font-family': font } }, font));
                            return map;
                        }, {}) })),
                html("label", { class: "font-settings__font-select-container__label" }, getLocalMessage('select_font'))),
            html(UpDown, { value: config.textStroke, min: 0, max: 1, step: 0.1, default: 0, name: getLocalMessage('text_stroke'), onChange: (value) => onChange({ textStroke: value }) }),
            html(UpDown, { value: config.textScale, min: 85, max: 115, step: 1, default: 100, name: getLocalMessage('text_scale'), onChange: (value) => onChange({ textScale: value }) })));
    }

    function MoreSettings({ data, actions, tab }) {
        //export default function MoreSettings({data, actions, tab}: ExtWrapper & {tab: TabInfo} & {data, actions, isFocused: SiteListSettingsProps}) {
        const custom = data.settings.customThemes.find(({ url }) => isURLInList(tab.url, url));
        const filterConfig = custom ? custom.theme : data.settings.theme;
        function setConfig(config) {
            if (custom) {
                custom.theme = { ...custom.theme, ...config };
                actions.changeSettings({ customThemes: data.settings.customThemes });
            }
            else {
                actions.setTheme(config);
            }
        }
        return (html("section", { class: "more-settings" },
            html("div", { class: "more-settings__section" },
                html(FontSettings, { config: filterConfig, fonts: data.fonts, onChange: setConfig })),
            html("div", { class: "more-settings__section" },
                html(CustomSettingsToggle, { data: data, tab: tab, actions: actions }),
                tab.isProtected ? (html("p", { class: "more-settings__description more-settings__description--warning" }, getLocalMessage('page_protected').replace('\n', ' '))) : tab.isInDarkList ? (html("p", { class: "more-settings__description more-settings__description--warning" }, getLocalMessage('page_in_dark_list').replace('\n', ' '))) : (html("p", { class: "more-settings__description" }, getLocalMessage('only_for_description')))),
            isFirefox() ? (html("div", { class: "more-settings__section" },
                html(Toggle, { checked: data.settings.changeBrowserTheme, labelOn: getLocalMessage('custom_browser_theme_on'), labelOff: getLocalMessage('custom_browser_theme_off'), onChange: (checked) => actions.changeSettings({ changeBrowserTheme: checked }) }),
                html("p", { class: "more-settings__description" }, getLocalMessage('change_browser_theme')))) : null));
    }
    /*
    Removed display of engine switching stuff:
    <div class="more-settings__section">
                    <EngineSwitch engine={filterConfig.engine} onChange={(engine) => setConfig({engine})} />
                </div>
    */

    const BLOG_URL = 'https://darkreader.org/blog/';
    const ABOUT_URL = 'https://github.com/agatt1/Illumify/wiki';
    const GITHUB_URL = 'https://github.com/agatt1/Illumify';
    const PRIVACY_URL = 'https://github.com/agatt1/Illumify/wiki/Privacy-Policy';
    function getHelpURL() {
        const helpLocales = ['be', 'cs', 'de', 'en', 'it', 'ru'];
        const locale = getUILanguage();
        const matchLocale = helpLocales.find((hl) => hl === locale) || helpLocales.find((hl) => locale.startsWith(hl)) || 'en';
        return `https://github.com/agatt1/Illumify/wiki/Help`;
    }

    const NEWS_COUNT = 2;
    function News({ news, expanded, onNewsOpen, onClose }) {
        return (html("div", { class: { 'news': true, 'news--expanded': expanded } },
            html("div", { class: "news__header" },
                html("span", { class: "news__header__text" }, getLocalMessage('news')),
                html("span", { class: "news__close", role: "button", onclick: onClose }, "\u2715")),
            html("div", { class: "news__list" },
                news.slice(0, NEWS_COUNT).map((event) => {
                    const date = new Date(event.date);
                    let formattedDate;
                    try {
                        // Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=811403
                        const locale = getUILanguage();
                        formattedDate = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
                    }
                    catch (err) {
                        formattedDate = date.toISOString().substring(0, 10);
                    }
                    return (html("div", { class: { 'news__event': true, 'news__event--unread': !event.read } },
                        html("a", { class: "news__event__link", onclick: () => onNewsOpen(event), href: event.url, target: "_blank" },
                            html("span", { class: "news__event__date" }, formattedDate),
                            event.headline)));
                }),
                (news.length <= NEWS_COUNT
                    ? null
                    : html("a", { class: {
                            'news__read-more': true,
                            'news__read-more--unread': news.slice(NEWS_COUNT).find(({ read }) => !read),
                        }, href: BLOG_URL, target: "_blank", onclick: () => onNewsOpen(...news) }, getLocalMessage('read_more'))))));
    }

    function SiteListSettings({ data, actions, isFocused }) {
        function isSiteUrlValid(value) {
            return /^([^\.\s]+?\.?)+$/.test(value);
        }
        return (html("section", { class: "site-list-settings" },
            html(Toggle, { class: "site-list-settings__toggle", checked: data.settings.applyToListedOnly, labelOn: getLocalMessage('invert_listed_only'), labelOff: getLocalMessage('not_invert_listed'), onChange: (value) => actions.changeSettings({ applyToListedOnly: value }) }),
            html(TextList, { class: "site-list-settings__text-list", placeholder: "google.com/maps", values: data.settings.siteList, isFocused: isFocused, onChange: (values) => {
                    if (values.every(isSiteUrlValid)) {
                        actions.changeSettings({ siteList: values });
                    }
                } }),
            html(ShortcutLink, { class: "site-list-settings__shortcut", commandName: "addSite", shortcuts: data.shortcuts, textTemplate: (hotkey) => (hotkey
                    ? `${getLocalMessage('add_site_to_list')}: ${hotkey}`
                    : getLocalMessage('setup_add_site_hotkey')), onSetShortcut: (shortcut) => actions.setShortcut('addSite', shortcut) })));
    }

    function getDuration(time) {
        let duration = 0;
        if (time.seconds) {
            duration += time.seconds * 1000;
        }
        if (time.minutes) {
            duration += time.minutes * 60 * 1000;
        }
        if (time.hours) {
            duration += time.hours * 60 * 60 * 1000;
        }
        if (time.days) {
            duration += time.days * 24 * 60 * 60 * 1000;
        }
        return duration;
    }

    /*this version of hoverFunction captures an image every 0.5 seconds
    Things checked:
    */
    function hoverFunVer3(){
        //this function injects the html on the webpage (only runs once)
        function initialInject(){
            chrome.tabs.executeScript({
                code: '(' + function(){
                    var ColorHoverThing = document.createElement('div');
                    ColorHoverThing.textContent = "Color";
                    ColorHoverThing.id = "hoverColorDiv";
                    ColorHoverThing.setAttribute("style", "position: absolute; left: 500px; top: 30px; font-size: 50px; color: red");
                    var root = document.documentElement;
                    root.prepend(ColorHoverThing);
                    console.log("html element created");
                   return {success: true};
                } + ')(' + ');'
            }, function(results){
        
            });
        }
        //this function runs every 0.5 seconds, it first captures a tab, then it analyzes color
        function getColorLoop(){
            function captureTab(){
                //capture the visible tab, then send a message with the dataUrl (url to make image)
                chrome.tabs.captureVisibleTab(null, {format: "png"}, function(dataUrl){
                    chrome.runtime.sendMessage({'dataUrlMessage': dataUrl});
                    console.log("dataUrl sent");
                });
            }
            //listen for message
            //console.log("exit visibleTab");
            function createImage(){
                chrome.runtime.onMessage.addListener(function(myMessage, sender, sendResponse){
                    console.log("entered listener");
                    if('dataUrlMessage' in myMessage){
                        console.log("message received");
                        //if message is correctly sent, create new image
                        var dataUrl = dataUrlMessage;
                        var new_img = new Image();
                        new_img.src = dataUrl;
                        console.log("Image Created");
                    }
                    else
                        console.log("message was not received");
                });
                console.log("end of createImage function");
            }
            createImage();
            captureTab();
            //createImage();    
            console.log("end of function");

        } 

        initialInject();
        setInterval(getColorLoop,1000);

        /*ignore this crap
        var img_dataUrl = "incorrect message";
            chrome.tabs.captureVisibleTab(null, {format: "png"}, function(dataUrl){
                img_dataUrl = dataUrl;
                return img_dataUrl;
                //console.log(img_dataUrl);
            })
            if(img_dataUrl != "incorrect message")
                console.log("actually worked");
            else
                console.log("failed");
        */
    }

    //TODO: Fix this function so you can actually disable the hoverFunction
    function enableHoverFun(){

        var enableHover = false;
        
        if(enableHover == false){
            enableHover = true;
            hoverFunOld();
            
        }
        if(enableHover == true){
            enableHover = false;
            chrome.tabs.executeScript({
                code: '(' + function(){
                    //console.log(3);
                    
                   return {success: true};
                } + ')(' + ');'
            }, function(results){
        
            });
            
        }
    }
    //Reference Stuff

    /*basic code injection
    chrome.tabs.executeScript({
            code: '(' + function(){
                //console.log(3);

               return {success: true};
            } + ')(' + ');'
        }, function(results){

        });
    */

    const colorblindnessTypes = [
        {
            "id": ColorblindnessType.deuteranopia,
            "text": "Deuteranopia",
            "corrections": [
                ColorCorrectionType.lmsDaltonization,
                ColorCorrectionType.lab
            ]
        },
        {
            "id": ColorblindnessType.protanopia,
            "text": "Protanopia",
            "corrections": [
                ColorCorrectionType.lmsDaltonization,
                ColorCorrectionType.cbFilterService
            ]
        },
        {
            "id": ColorblindnessType.tritanopia,
            "text": "Tritanopia",
            "corrections": [
                ColorCorrectionType.lmsDaltonization,
                ColorCorrectionType.shift
            ]
        }
    ];
    const colorCorrectionTypes = [
        { "id": ColorCorrectionType.lmsDaltonization, "text": "LMS Daltonization" },
        { "id": ColorCorrectionType.cbFilterService, "text": "CBFS Method" },
        { "id": ColorCorrectionType.lab, "text": "LAB Method" },
        { "id": ColorCorrectionType.shift, "text": "Shifting Method" }
    ];
    function CBSettings({ config, fonts, onChange }) {
        return (html("section", { class: "font-settings" },
            html("div", { class: "font-settings__font-select-container" },
                html("div", { class: "font-settings__font-select-container__line" },
                    html(CheckBox, { checked: config.useColorCorrection, onchange: (e) => onChange({ useColorCorrection: e.target.checked }) }),
                    html(Select$1, { value: colorblindnessTypes.find(x => x.id == config.colorblindnessType).text, onChange: (value) => onChange({ colorblindnessType: colorblindnessTypes.find(x => x.text == value).id }), options: colorblindnessTypes.map(x => x.text) })),
                html("label", { class: "font-settings__font-select-container__label" }, getLocalMessage('enable_cb'))),
            html(UpDown, { value: config.dummy_val, min: 0, max: 1, step: 0.1, default: 0, name: getLocalMessage('sensitivity'), onChange: (value) => onChange({ dummy_val: value }) }),
            html("div", { style: "display:flex; justify-content:center; width:97%; text-align:center;" },
                html("div", null,
                    html("input", { class: "jscolor jscolor-active", style: "width:80px", value: config.unclickedColor, name: "unclicked", onchange: (value) => onChange({ unclickedColor: value.target.value }) }),
                    html("label", { class: "font-settings__font-select-container__label" }, getLocalMessage('unvisited_link'))),
                html(CheckBox, { checked: config.linkColor, onchange: (e) => onChange({ linkColor: e.target.checked }) }),
                html("div", null,
                    html("input", { class: "jscolor jscolor-active", style: "width:80px", value: config.clickedColor, name: "clicked", onchange: (value) => onChange({ clickedColor: value.target.value }) }),
                    html("label", { class: "font-settings__font-select-container__label" }, getLocalMessage('visited_link')))),
            html("script", null, "window.jscolor.installByClassName(\"jscolor\")"),
            html(CustToggle
            //class="site-list-settings__toggle"
            , { 
                //class="site-list-settings__toggle"
                checked: true, labelOn: getLocalMessage('disable_color_hover'), labelOff: getLocalMessage('enable_color_hover'), onChange: () => enableHoverFun() }),
            html(Button, { onclick: () => hoverFunVer3() }, "HOVER")));
    }
    //<button id = "hoverButton" onClick = "hoverFun()">HOVER</button>
    //<input type="button" value="Click" onClick = "console.log('test')"></input>

    function CBModeSettings({ data, actions, tab }) {
        const custom = data.settings.customThemes.find(({ url }) => isURLInList(tab.url, url));
        const filterConfig = custom ? custom.theme : data.settings.theme;
        function setConfig(config) {
            if (custom) {
                custom.theme = { ...custom.theme, ...config };
                actions.changeSettings({ customThemes: data.settings.customThemes });
            }
            else {
                actions.setTheme(config);
            }
        }
        return (html("section", { class: "more-settings" },
            html("div", { class: "more-settings__section" },
                html(CBSettings, { config: filterConfig, fonts: data.fonts, onChange: setConfig })),
            isFirefox() ? (html("div", { class: "more-settings__section" },
                html(Toggle, { checked: data.settings.changeBrowserTheme, labelOn: getLocalMessage('custom_browser_theme_on'), labelOff: getLocalMessage('custom_browser_theme_off'), onChange: (checked) => actions.changeSettings({ changeBrowserTheme: checked }) }),
                html("p", { class: "more-settings__description" }, getLocalMessage('change_browser_theme')))) : null));
    }

    withForms();
    function Body(props) {
        const { state, setState } = props;
        if (!props.data.isReady) {
            return (html("body", null,
                html(Loader$1, null)));
        }
        const unreadNews = props.data.news.filter(({ read }) => !read);
        function toggleNews() {
            if (state.newsOpen && unreadNews.length > 0) {
                props.actions.markNewsAsRead(unreadNews.map(({ id }) => id));
            }
            setState({ newsOpen: !state.newsOpen });
        }
        function onNewsOpen(...news) {
            const unread = news.filter(({ read }) => !read);
            if (unread.length > 0) {
                props.actions.markNewsAsRead(unread.map(({ id }) => id));
            }
        }
        let displayedNewsCount = unreadNews.length;
        if (unreadNews.length > 0 && !props.data.settings.notifyOfNews) {
            const latest = new Date(unreadNews[0].date);
            const today = new Date();
            const newsWereLongTimeAgo = latest.getTime() < today.getTime() - getDuration({ days: 14 });
            if (newsWereLongTimeAgo) {
                displayedNewsCount = 0;
            }
        }
        return (html("body", { class: { 'ext-disabled': !props.data.isEnabled } },
            html("script", { src: "jscolor.js", defer: true }),
            html(Loader$1, { complete: true }),
            html(TopSection, { data: props.data, tab: props.tab, actions: props.actions }),
            html(TabPanel, { activeTab: state.activeTab || 'Filter', onSwitchTab: (tab) => setState({ activeTab: tab }), tabs: {
                    'CBMode': (html(CBModeSettings, { data: props.data, actions: props.actions, tab: props.tab })),
                    'Filter': (html(FilterSettings, { data: props.data, actions: props.actions, tab: props.tab })),
                    'More': (html(MoreSettings, { data: props.data, actions: props.actions, tab: props.tab })),
                    'Site list': (html(SiteListSettings, { data: props.data, actions: props.actions, isFocused: state.activeTab === 'Site list' })),
                }, tabLabels: {
                    'CBMode': getLocalMessage('cbmode'),
                    'Filter': getLocalMessage('filter'),
                    'Site list': getLocalMessage('site_list'),
                    'More': getLocalMessage('more'),
                } }),
            html("footer", null,
                html("div", { class: "footer-links" },
                    html("a", { class: "footer-links__link", href: ABOUT_URL, target: "_blank" }, "About"),
                    html("a", { class: "footer-links__link", href: PRIVACY_URL, target: "_blank" }, getLocalMessage('privacy')),
                    html("a", { class: "footer-links__link", href: GITHUB_URL, target: "_blank" }, "GitHub"),
                    html("a", { class: "footer-links__link", href: getHelpURL(), target: "_blank" }, getLocalMessage('help')))),
            html(News, { news: props.data.news, expanded: state.newsOpen, onNewsOpen: onNewsOpen, onClose: toggleNews })));
    }
    var Body$1 = withState(Body);

    function popupHasBuiltInBorders() {
        const chromeVersion = getChromeVersion();
        return Boolean(chromeVersion &&
            !isVivaldi() &&
            !isYaBrowser() &&
            !isOpera() &&
            isWindows() &&
            compareChromeVersions(chromeVersion, '62.0.3167.0') < 0);
    }
    function popupHasBuiltInHorizontalBorders() {
        const chromeVersion = getChromeVersion();
        return Boolean(chromeVersion &&
            !isVivaldi() &&
            !isYaBrowser() &&
            !isOpera() && ((isWindows() && compareChromeVersions(chromeVersion, '62.0.3167.0') >= 0) ||
            (isMacOS() && compareChromeVersions(chromeVersion, '67.0.3373.0') >= 0)));
    }
    function fixNotClosingPopupOnNavigation() {
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button === 2) {
                return;
            }
            let target = e.target;
            while (target && !(target instanceof HTMLAnchorElement)) {
                target = target.parentElement;
            }
            if (target && target.hasAttribute('href')) {
                requestAnimationFrame(() => window.close());
            }
        });
    }

    function renderBody(data, tab, actions) {
        sync(document.body, (html(Body$1, { data: data, tab: tab, actions: actions })));
    }
    async function start() {
        const connector = connect();
        window.addEventListener('unload', (e) => connector.disconnect());
        const [data, tab] = await Promise.all([
            connector.getData(),
            connector.getActiveTabInfo(),
        ]);
        renderBody(data, tab, connector);
        connector.subscribeToChanges((data) => renderBody(data, tab, connector));
    }
    start();
    document.documentElement.classList.toggle('mobile', isMobile());
    document.documentElement.classList.toggle('built-in-borders', popupHasBuiltInBorders());
    document.documentElement.classList.toggle('built-in-horizontal-borders', popupHasBuiltInHorizontalBorders());
    if (isFirefox()) {
        fixNotClosingPopupOnNavigation();
    }

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9tYWxldmljL2luZGV4LmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbGV2aWMvZm9ybXMuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvbWFsZXZpYy9zdGF0ZS5qcyIsIi4uLy4uLy4uL3NyYy91aS9wb3B1cC9jb21wb25lbnRzL2NiLXNldHRpbmdzL2hvdmVyRnVuY3Rpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIG1hbGV2aWNAMC4xMS42IC0gTWFyIDYsIDIwMTggKi9cbmZ1bmN0aW9uIGNsYXNzZXMoLi4uYXJncykge1xyXG4gICAgY29uc3QgY2xhc3NlcyA9IFtdO1xyXG4gICAgYXJncy5maWx0ZXIoKGMpID0+IEJvb2xlYW4oYykpXHJcbiAgICAgICAgLmZvckVhY2goKGMpID0+IHtcclxuICAgICAgICBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIGNsYXNzZXMucHVzaChjKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIGMgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIGNsYXNzZXMucHVzaCguLi5PYmplY3Qua2V5cyhjKVxyXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoa2V5KSA9PiBCb29sZWFuKGNba2V5XSkpKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBjbGFzc2VzLmpvaW4oJyAnKTtcclxufVxyXG5mdW5jdGlvbiBzdHlsZXMoZGVjbGFyYXRpb25zKSB7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMoZGVjbGFyYXRpb25zKVxyXG4gICAgICAgIC5maWx0ZXIoKGNzc1Byb3ApID0+IGRlY2xhcmF0aW9uc1tjc3NQcm9wXSAhPSBudWxsKVxyXG4gICAgICAgIC5tYXAoKGNzc1Byb3ApID0+IGAke2Nzc1Byb3B9OiAke2RlY2xhcmF0aW9uc1tjc3NQcm9wXX07YClcclxuICAgICAgICAuam9pbignICcpO1xyXG59XHJcbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPSBudWxsO1xyXG59XHJcbmZ1bmN0aW9uIHRvQXJyYXkob2JqKSB7XHJcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwob2JqKTtcclxufVxyXG5mdW5jdGlvbiBmbGF0dGVuKGFycikge1xyXG4gICAgcmV0dXJuIGFyci5yZWR1Y2UoKGZsYXQsIHRvRmxhdHRlbikgPT4ge1xyXG4gICAgICAgIHJldHVybiBmbGF0LmNvbmNhdChBcnJheS5pc0FycmF5KHRvRmxhdHRlbikgPyBmbGF0dGVuKHRvRmxhdHRlbikgOiB0b0ZsYXR0ZW4pO1xyXG4gICAgfSwgW10pO1xyXG59XHJcbmZ1bmN0aW9uIGlzRW1wdHlEZWNsYXJhdGlvbihkKSB7XHJcbiAgICByZXR1cm4gZCA9PSBudWxsIHx8IGQgPT09ICcnO1xyXG59XHJcbmZ1bmN0aW9uIGZsYXR0ZW5EZWNsYXJhdGlvbnMoZGVjbGFyYXRpb25zLCBmdW5jRXhlY3V0b3IpIHtcclxuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcclxuICAgIGZsYXR0ZW4oZGVjbGFyYXRpb25zKVxyXG4gICAgICAgIC5mb3JFYWNoKChjKSA9PiB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBjID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHIgPSBmdW5jRXhlY3V0b3IoYyk7XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goLi4uZmxhdHRlbihyKS5maWx0ZXIoeCA9PiAhaXNFbXB0eURlY2xhcmF0aW9uKHgpKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSBpZiAoIWlzRW1wdHlEZWNsYXJhdGlvbihyKSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKCFpc0VtcHR5RGVjbGFyYXRpb24oYykpIHtcclxuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGMpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIHJlc3VsdHM7XHJcbn1cblxuZnVuY3Rpb24gaHRtbCh0YWdPckNvbXBvbmVudCwgYXR0cnMsIC4uLmNoaWxkcmVuKSB7XHJcbiAgICBpZiAodHlwZW9mIHRhZ09yQ29tcG9uZW50ID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIHJldHVybiB7IHRhZzogdGFnT3JDb21wb25lbnQsIGF0dHJzLCBjaGlsZHJlbiB9O1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiB0YWdPckNvbXBvbmVudCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHJldHVybiB0YWdPckNvbXBvbmVudChhdHRycyA9PSBudWxsID8gdW5kZWZpbmVkIDogYXR0cnMsIC4uLmZsYXR0ZW4oY2hpbGRyZW4pKTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59XG5cbmNvbnN0IGRhdGFCaW5kaW5ncyA9IG5ldyBXZWFrTWFwKCk7XHJcbmZ1bmN0aW9uIHNldERhdGEoZWxlbWVudCwgZGF0YSkge1xyXG4gICAgZGF0YUJpbmRpbmdzLnNldChlbGVtZW50LCBkYXRhKTtcclxufVxyXG5mdW5jdGlvbiBnZXREYXRhKGVsZW1lbnQpIHtcclxuICAgIHJldHVybiBkYXRhQmluZGluZ3MuZ2V0KGVsZW1lbnQpO1xyXG59XG5cbmNvbnN0IGV2ZW50TGlzdGVuZXJzID0gbmV3IFdlYWtNYXAoKTtcclxuZnVuY3Rpb24gYWRkTGlzdGVuZXIoZWxlbWVudCwgZXZlbnQsIGxpc3RlbmVyKSB7XHJcbiAgICBsZXQgbGlzdGVuZXJzO1xyXG4gICAgaWYgKGV2ZW50TGlzdGVuZXJzLmhhcyhlbGVtZW50KSkge1xyXG4gICAgICAgIGxpc3RlbmVycyA9IGV2ZW50TGlzdGVuZXJzLmdldChlbGVtZW50KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGxpc3RlbmVycyA9IHt9O1xyXG4gICAgICAgIGV2ZW50TGlzdGVuZXJzLnNldChlbGVtZW50LCBsaXN0ZW5lcnMpO1xyXG4gICAgfVxyXG4gICAgaWYgKGxpc3RlbmVyc1tldmVudF0gIT09IGxpc3RlbmVyKSB7XHJcbiAgICAgICAgaWYgKGV2ZW50IGluIGxpc3RlbmVycykge1xyXG4gICAgICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyc1tldmVudF0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyKTtcclxuICAgICAgICBsaXN0ZW5lcnNbZXZlbnRdID0gbGlzdGVuZXI7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXIoZWxlbWVudCwgZXZlbnQpIHtcclxuICAgIGxldCBsaXN0ZW5lcnM7XHJcbiAgICBpZiAoZXZlbnRMaXN0ZW5lcnMuaGFzKGVsZW1lbnQpKSB7XHJcbiAgICAgICAgbGlzdGVuZXJzID0gZXZlbnRMaXN0ZW5lcnMuZ2V0KGVsZW1lbnQpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKGV2ZW50IGluIGxpc3RlbmVycykge1xyXG4gICAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXJzW2V2ZW50XSk7XHJcbiAgICAgICAgZGVsZXRlIGxpc3RlbmVyc1tldmVudF07XHJcbiAgICB9XHJcbn1cblxuZnVuY3Rpb24gY3JlYXRlUGx1Z2lucygpIHtcclxuICAgIGNvbnN0IHBsdWdpbnMgPSBbXTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgYWRkKHBsdWdpbikge1xyXG4gICAgICAgICAgICBwbHVnaW5zLnB1c2gocGx1Z2luKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBseShwcm9wcykge1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0O1xyXG4gICAgICAgICAgICBsZXQgcGx1Z2luO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gcGx1Z2lucy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgICAgICAgICAgcGx1Z2luID0gcGx1Z2luc1tpXTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHBsdWdpbihwcm9wcyk7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cblxuY29uc3QgbmF0aXZlQ29udGFpbmVycyA9IG5ldyBXZWFrTWFwKCk7XHJcbmNvbnN0IG1vdW50ZWRFbGVtZW50cyA9IG5ldyBXZWFrTWFwKCk7XHJcbmNvbnN0IGRpZE1vdW50SGFuZGxlcnMgPSBuZXcgV2Vha01hcCgpO1xyXG5jb25zdCBkaWRVcGRhdGVIYW5kbGVycyA9IG5ldyBXZWFrTWFwKCk7XHJcbmNvbnN0IHdpbGxVbm1vdW50SGFuZGxlcnMgPSBuZXcgV2Vha01hcCgpO1xyXG5jb25zdCBsaWZlY3ljbGVIYW5kbGVycyA9IHtcclxuICAgICdkaWRtb3VudCc6IGRpZE1vdW50SGFuZGxlcnMsXHJcbiAgICAnZGlkdXBkYXRlJzogZGlkVXBkYXRlSGFuZGxlcnMsXHJcbiAgICAnd2lsbHVubW91bnQnOiB3aWxsVW5tb3VudEhhbmRsZXJzXHJcbn07XHJcbmNvbnN0IFhIVE1MX05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWwnO1xyXG5jb25zdCBTVkdfTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xyXG5jb25zdCBwbHVnaW5zQ3JlYXRlTm9kZSA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgoeyBkLCBwYXJlbnQgfSkgPT4ge1xyXG4gICAgaWYgKCFpc09iamVjdChkKSkge1xyXG4gICAgICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShkID09IG51bGwgPyAnJyA6IFN0cmluZyhkKSk7XHJcbiAgICB9XHJcbiAgICBpZiAoZC50YWcgPT09ICdzdmcnKSB7XHJcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhTVkdfTlMsICdzdmcnKTtcclxuICAgIH1cclxuICAgIGlmIChwYXJlbnQubmFtZXNwYWNlVVJJID09PSBYSFRNTF9OUykge1xyXG4gICAgICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGQudGFnKTtcclxuICAgIH1cclxuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMocGFyZW50Lm5hbWVzcGFjZVVSSSwgZC50YWcpO1xyXG59KTtcclxuY29uc3QgcGx1Z2luc01vdW50Tm9kZSA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgoeyBub2RlLCBwYXJlbnQsIG5leHQgfSkgPT4ge1xyXG4gICAgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCBuZXh0KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG59KTtcclxuY29uc3QgcGx1Z2luc1VubW91bnROb2RlID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh7IG5vZGUsIHBhcmVudCB9KSA9PiB7XHJcbiAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobm9kZSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufSk7XHJcbmNvbnN0IHBsdWdpbnNTZXRBdHRyaWJ1dGUgPSBjcmVhdGVQbHVnaW5zKClcclxuICAgIC5hZGQoKHsgZWxlbWVudCwgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgaWYgKHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShhdHRyLCB2YWx1ZSA9PT0gdHJ1ZSA/ICcnIDogU3RyaW5nKHZhbHVlKSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufSlcclxuICAgIC5hZGQoKHsgZWxlbWVudCwgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgaWYgKGF0dHIuaW5kZXhPZignb24nKSA9PT0gMCkge1xyXG4gICAgICAgIGNvbnN0IGV2ZW50ID0gYXR0ci5zdWJzdHJpbmcoMik7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBhZGRMaXN0ZW5lcihlbGVtZW50LCBldmVudCwgdmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIoZWxlbWVudCwgZXZlbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59KVxyXG4gICAgLmFkZCgoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICBpZiAoYXR0ciA9PT0gJ25hdGl2ZScpIHtcclxuICAgICAgICBpZiAodmFsdWUgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgbmF0aXZlQ29udGFpbmVycy5zZXQoZWxlbWVudCwgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBuYXRpdmVDb250YWluZXJzLmRlbGV0ZShlbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBpZiAoYXR0ciBpbiBsaWZlY3ljbGVIYW5kbGVycykge1xyXG4gICAgICAgIGNvbnN0IGhhbmRsZXJzID0gbGlmZWN5Y2xlSGFuZGxlcnNbYXR0cl07XHJcbiAgICAgICAgaWYgKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXJzLnNldChlbGVtZW50LCB2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBoYW5kbGVycy5kZWxldGUoZWxlbWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbn0pXHJcbiAgICAuYWRkKCh7IGVsZW1lbnQsIGF0dHIsIHZhbHVlIH0pID0+IHtcclxuICAgIGlmIChhdHRyID09PSAnZGF0YScpIHtcclxuICAgICAgICBzZXREYXRhKGVsZW1lbnQsIHZhbHVlKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59KVxyXG4gICAgLmFkZCgoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICBpZiAoYXR0ciA9PT0gJ2NsYXNzJyAmJiBpc09iamVjdCh2YWx1ZSkpIHtcclxuICAgICAgICBsZXQgY2xzO1xyXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgICAgICBjbHMgPSBjbGFzc2VzKC4uLnZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNscyA9IGNsYXNzZXModmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY2xzKSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdjbGFzcycsIGNscyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnY2xhc3MnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufSlcclxuICAgIC5hZGQoKHsgZWxlbWVudCwgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgaWYgKGF0dHIgPT09ICdzdHlsZScgJiYgaXNPYmplY3QodmFsdWUpKSB7XHJcbiAgICAgICAgY29uc3Qgc3R5bGUgPSBzdHlsZXModmFsdWUpO1xyXG4gICAgICAgIGlmIChzdHlsZSkge1xyXG4gICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnc3R5bGUnLCBzdHlsZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnc3R5bGUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufSk7XHJcbmNvbnN0IGVsZW1lbnRzQXR0cnMgPSBuZXcgV2Vha01hcCgpO1xyXG5mdW5jdGlvbiBnZXRBdHRycyhlbGVtZW50KSB7XHJcbiAgICByZXR1cm4gZWxlbWVudHNBdHRycy5nZXQoZWxlbWVudCkgfHwgbnVsbDtcclxufVxyXG5mdW5jdGlvbiBjcmVhdGVOb2RlKGQsIHBhcmVudCwgbmV4dCkge1xyXG4gICAgY29uc3Qgbm9kZSA9IHBsdWdpbnNDcmVhdGVOb2RlLmFwcGx5KHsgZCwgcGFyZW50IH0pO1xyXG4gICAgaWYgKGlzT2JqZWN0KGQpKSB7XHJcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IG5vZGU7XHJcbiAgICAgICAgY29uc3QgZWxlbWVudEF0dHJzID0ge307XHJcbiAgICAgICAgZWxlbWVudHNBdHRycy5zZXQoZWxlbWVudCwgZWxlbWVudEF0dHJzKTtcclxuICAgICAgICBpZiAoZC5hdHRycykge1xyXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhkLmF0dHJzKS5mb3JFYWNoKChhdHRyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGQuYXR0cnNbYXR0cl07XHJcbiAgICAgICAgICAgICAgICBwbHVnaW5zU2V0QXR0cmlidXRlLmFwcGx5KHsgZWxlbWVudCwgYXR0ciwgdmFsdWUgfSk7XHJcbiAgICAgICAgICAgICAgICBlbGVtZW50QXR0cnNbYXR0cl0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcGx1Z2luc01vdW50Tm9kZS5hcHBseSh7IG5vZGUsIHBhcmVudCwgbmV4dCB9KTtcclxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgRWxlbWVudCAmJiBkaWRNb3VudEhhbmRsZXJzLmhhcyhub2RlKSkge1xyXG4gICAgICAgIGRpZE1vdW50SGFuZGxlcnMuZ2V0KG5vZGUpKG5vZGUpO1xyXG4gICAgICAgIG1vdW50ZWRFbGVtZW50cy5zZXQobm9kZSwgdHJ1ZSk7XHJcbiAgICB9XHJcbiAgICBpZiAoaXNPYmplY3QoZCkgJiYgbm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQgJiYgIW5hdGl2ZUNvbnRhaW5lcnMuaGFzKG5vZGUpKSB7XHJcbiAgICAgICAgc3luY0NoaWxkTm9kZXMoZCwgbm9kZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbm9kZTtcclxufVxyXG5mdW5jdGlvbiBjb2xsZWN0QXR0cnMoZWxlbWVudCkge1xyXG4gICAgcmV0dXJuIHRvQXJyYXkoZWxlbWVudC5hdHRyaWJ1dGVzKVxyXG4gICAgICAgIC5yZWR1Y2UoKG9iaiwgeyBuYW1lLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICAgICAgb2JqW25hbWVdID0gdmFsdWU7XHJcbiAgICAgICAgcmV0dXJuIG9iajtcclxuICAgIH0sIHt9KTtcclxufVxyXG5mdW5jdGlvbiBzeW5jTm9kZShkLCBleGlzdGluZykge1xyXG4gICAgaWYgKGlzT2JqZWN0KGQpKSB7XHJcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IGV4aXN0aW5nO1xyXG4gICAgICAgIGNvbnN0IGF0dHJzID0gZC5hdHRycyB8fCB7fTtcclxuICAgICAgICBsZXQgZXhpc3RpbmdBdHRycyA9IGdldEF0dHJzKGVsZW1lbnQpO1xyXG4gICAgICAgIGlmICghZXhpc3RpbmdBdHRycykge1xyXG4gICAgICAgICAgICBleGlzdGluZ0F0dHJzID0gY29sbGVjdEF0dHJzKGVsZW1lbnQpO1xyXG4gICAgICAgICAgICBlbGVtZW50c0F0dHJzLnNldChlbGVtZW50LCBleGlzdGluZ0F0dHJzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgT2JqZWN0LmtleXMoZXhpc3RpbmdBdHRycykuZm9yRWFjaCgoYXR0cikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIShhdHRyIGluIGF0dHJzKSkge1xyXG4gICAgICAgICAgICAgICAgcGx1Z2luc1NldEF0dHJpYnV0ZS5hcHBseSh7IGVsZW1lbnQsIGF0dHIsIHZhbHVlOiBudWxsIH0pO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIGV4aXN0aW5nQXR0cnNbYXR0cl07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaCgoYXR0cikgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF0dHJzW2F0dHJdO1xyXG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdBdHRyc1thdHRyXSAhPT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHBsdWdpbnNTZXRBdHRyaWJ1dGUuYXBwbHkoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KTtcclxuICAgICAgICAgICAgICAgIGV4aXN0aW5nQXR0cnNbYXR0cl0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChkaWRNb3VudEhhbmRsZXJzLmhhcyhlbGVtZW50KSAmJiAhbW91bnRlZEVsZW1lbnRzLmhhcyhlbGVtZW50KSkge1xyXG4gICAgICAgICAgICBkaWRNb3VudEhhbmRsZXJzLmdldChlbGVtZW50KShlbGVtZW50KTtcclxuICAgICAgICAgICAgbW91bnRlZEVsZW1lbnRzLnNldChlbGVtZW50LCB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoZGlkVXBkYXRlSGFuZGxlcnMuaGFzKGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICAgIGRpZFVwZGF0ZUhhbmRsZXJzLmdldChlbGVtZW50KShlbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFuYXRpdmVDb250YWluZXJzLmhhcyhlbGVtZW50KSkge1xyXG4gICAgICAgICAgICBzeW5jQ2hpbGROb2RlcyhkLCBlbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBleGlzdGluZy50ZXh0Q29udGVudCA9IGQgPT0gbnVsbCA/ICcnIDogU3RyaW5nKGQpO1xyXG4gICAgfVxyXG59XHJcbmZ1bmN0aW9uIHJlbW92ZU5vZGUobm9kZSwgcGFyZW50KSB7XHJcbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQgJiYgd2lsbFVubW91bnRIYW5kbGVycy5oYXMobm9kZSkpIHtcclxuICAgICAgICB3aWxsVW5tb3VudEhhbmRsZXJzLmdldChub2RlKShub2RlKTtcclxuICAgIH1cclxuICAgIHBsdWdpbnNVbm1vdW50Tm9kZS5hcHBseSh7IG5vZGUsIHBhcmVudCB9KTtcclxufVxyXG5jb25zdCBwbHVnaW5zTWF0Y2hOb2RlcyA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgoeyBkLCBlbGVtZW50IH0pID0+IHtcclxuICAgIGNvbnN0IG1hdGNoZXMgPSBbXTtcclxuICAgIGNvbnN0IGRlY2xhcmF0aW9ucyA9IEFycmF5LmlzQXJyYXkoZC5jaGlsZHJlbikgPyBmbGF0dGVuRGVjbGFyYXRpb25zKGQuY2hpbGRyZW4sIChmbikgPT4gZm4oZWxlbWVudCkpIDogW107XHJcbiAgICBsZXQgbm9kZUluZGV4ID0gMDtcclxuICAgIGRlY2xhcmF0aW9ucy5mb3JFYWNoKChkKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaXNFbGVtZW50ID0gaXNPYmplY3QoZCk7XHJcbiAgICAgICAgY29uc3QgaXNUZXh0ID0gIWlzRWxlbWVudDtcclxuICAgICAgICBsZXQgZm91bmQgPSBudWxsO1xyXG4gICAgICAgIGxldCBub2RlID0gbnVsbDtcclxuICAgICAgICBmb3IgKDsgbm9kZUluZGV4IDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgbm9kZUluZGV4KyspIHtcclxuICAgICAgICAgICAgbm9kZSA9IGVsZW1lbnQuY2hpbGROb2Rlcy5pdGVtKG5vZGVJbmRleCk7XHJcbiAgICAgICAgICAgIGlmIChpc1RleHQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBUZXh0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm91bmQgPSBub2RlO1xyXG4gICAgICAgICAgICAgICAgICAgIG5vZGVJbmRleCsrO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpc0VsZW1lbnQgJiYgbm9kZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChub2RlLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gZC50YWcpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3VuZCA9IG5vZGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBub2RlSW5kZXgrKztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG1hdGNoZXMucHVzaChbZCwgZm91bmRdKTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG1hdGNoZXM7XHJcbn0pO1xyXG5mdW5jdGlvbiBjb21taXQobWF0Y2hlcywgZWxlbWVudCkge1xyXG4gICAgY29uc3QgbWF0Y2hlZE5vZGVzID0gbmV3IFNldCgpO1xyXG4gICAgbWF0Y2hlcy5tYXAoKFssIG5vZGVdKSA9PiBub2RlKVxyXG4gICAgICAgIC5maWx0ZXIoKG5vZGUpID0+IG5vZGUpXHJcbiAgICAgICAgLmZvckVhY2goKG5vZGUpID0+IG1hdGNoZWROb2Rlcy5hZGQobm9kZSkpO1xyXG4gICAgdG9BcnJheShlbGVtZW50LmNoaWxkTm9kZXMpXHJcbiAgICAgICAgLmZpbHRlcigobm9kZSkgPT4gIW1hdGNoZWROb2Rlcy5oYXMobm9kZSkpXHJcbiAgICAgICAgLmZvckVhY2goKG5vZGUpID0+IHJlbW92ZU5vZGUobm9kZSwgZWxlbWVudCkpO1xyXG4gICAgbGV0IHByZXZOb2RlID0gbnVsbDtcclxuICAgIG1hdGNoZXMuZm9yRWFjaCgoW2QsIG5vZGVdLCBpKSA9PiB7XHJcbiAgICAgICAgaWYgKG5vZGUpIHtcclxuICAgICAgICAgICAgc3luY05vZGUoZCwgbm9kZSk7XHJcbiAgICAgICAgICAgIHByZXZOb2RlID0gbm9kZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5leHRTaWJsaW5nID0gKHByZXZOb2RlID9cclxuICAgICAgICAgICAgICAgIHByZXZOb2RlLm5leHRTaWJsaW5nIDpcclxuICAgICAgICAgICAgICAgIChpID09PSAwID8gZWxlbWVudC5maXJzdENoaWxkIDogbnVsbCkpO1xyXG4gICAgICAgICAgICBwcmV2Tm9kZSA9IGNyZWF0ZU5vZGUoZCwgZWxlbWVudCwgbmV4dFNpYmxpbmcpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcbmZ1bmN0aW9uIHN5bmNDaGlsZE5vZGVzKGQsIGVsZW1lbnQpIHtcclxuICAgIGNvbnN0IG1hdGNoZXMgPSBwbHVnaW5zTWF0Y2hOb2Rlcy5hcHBseSh7IGQsIGVsZW1lbnQgfSk7XHJcbiAgICBjb21taXQobWF0Y2hlcywgZWxlbWVudCk7XHJcbn1cclxuZnVuY3Rpb24gcmVuZGVyKHRhcmdldCwgZGVjbGFyYXRpb24pIHtcclxuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXcm9uZyByZW5kZXJpbmcgdGFyZ2V0Jyk7XHJcbiAgICB9XHJcbiAgICBjb25zdCB0ZW1wID0ge1xyXG4gICAgICAgIHRhZzogdGFyZ2V0LnRhZ05hbWUudG9Mb3dlckNhc2UoKSxcclxuICAgICAgICBhdHRyczogY29sbGVjdEF0dHJzKHRhcmdldCksXHJcbiAgICAgICAgY2hpbGRyZW46IEFycmF5LmlzQXJyYXkoZGVjbGFyYXRpb24pID8gZGVjbGFyYXRpb24gOiBbZGVjbGFyYXRpb25dXHJcbiAgICB9O1xyXG4gICAgc3luY0NoaWxkTm9kZXModGVtcCwgdGFyZ2V0KTtcclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGRlY2xhcmF0aW9uKSA/XHJcbiAgICAgICAgdG9BcnJheSh0YXJnZXQuY2hpbGROb2RlcykgOlxyXG4gICAgICAgIGlzT2JqZWN0KGRlY2xhcmF0aW9uKSA/XHJcbiAgICAgICAgICAgIHRhcmdldC5maXJzdEVsZW1lbnRDaGlsZCA6XHJcbiAgICAgICAgICAgIHRhcmdldC5maXJzdENoaWxkO1xyXG59XHJcbmZ1bmN0aW9uIHN5bmModGFyZ2V0LCBkZWNsYXJhdGlvbk9yRm4pIHtcclxuICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdHlwZW9mIGRlY2xhcmF0aW9uT3JGbiA9PT0gJ2Z1bmN0aW9uJyA/IGRlY2xhcmF0aW9uT3JGbih0YXJnZXQucGFyZW50RWxlbWVudCkgOiBkZWNsYXJhdGlvbk9yRm47XHJcbiAgICBjb25zdCBpc0VsZW1lbnQgPSBpc09iamVjdChkZWNsYXJhdGlvbik7XHJcbiAgICBpZiAoISgoIWlzRWxlbWVudCAmJiB0YXJnZXQgaW5zdGFuY2VvZiBUZXh0KSB8fFxyXG4gICAgICAgIChpc0VsZW1lbnQgJiYgdGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCAmJiB0YXJnZXQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBkZWNsYXJhdGlvbi50YWcpKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignV3Jvbmcgc3luYyB0YXJnZXQnKTtcclxuICAgIH1cclxuICAgIHN5bmNOb2RlKGRlY2xhcmF0aW9uLCB0YXJnZXQpO1xyXG4gICAgcmV0dXJuIHRhcmdldDtcclxufVxuXG5jb25zdCBwbHVnaW5zSXNWb2lkVGFnID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh0YWcpID0+IHRhZyBpbiBWT0lEX1RBR1MpO1xyXG5jb25zdCBwbHVnaW5zU2tpcEF0dHIgPSBjcmVhdGVQbHVnaW5zKClcclxuICAgIC5hZGQoKHsgdmFsdWUgfSkgPT4gKHZhbHVlID09IG51bGwgfHwgdmFsdWUgPT09IGZhbHNlKSlcclxuICAgIC5hZGQoKHsgYXR0ciB9KSA9PiAoKFtcclxuICAgICdkYXRhJyxcclxuICAgICduYXRpdmUnLFxyXG4gICAgJ2RpZG1vdW50JyxcclxuICAgICdkaWR1cGRhdGUnLFxyXG4gICAgJ3dpbGx1bm1vdW50JyxcclxuXS5pbmRleE9mKGF0dHIpID49IDAgfHxcclxuICAgIGF0dHIuaW5kZXhPZignb24nKSA9PT0gMCkgPyB0cnVlIDogbnVsbCkpO1xyXG5mdW5jdGlvbiBlc2NhcGVIdG1sKHMpIHtcclxuICAgIHJldHVybiBTdHJpbmcocylcclxuICAgICAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxyXG4gICAgICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuICAgICAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXHJcbiAgICAgICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxyXG4gICAgICAgIC5yZXBsYWNlKC8nL2csICcmIzAzOTsnKTtcclxufVxyXG5jb25zdCBwbHVnaW5zU3RyaW5naWZ5QXR0ciA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgoeyB2YWx1ZSB9KSA9PiB2YWx1ZSA9PT0gdHJ1ZSA/ICcnIDogZXNjYXBlSHRtbCh2YWx1ZSkpXHJcbiAgICAuYWRkKCh7IGF0dHIsIHZhbHVlIH0pID0+IHtcclxuICAgIGlmIChhdHRyID09PSAnY2xhc3MnICYmIGlzT2JqZWN0KHZhbHVlKSkge1xyXG4gICAgICAgIGxldCBjbHM7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgIGNscyA9IGNsYXNzZXMoLi4udmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY2xzID0gY2xhc3Nlcyh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBlc2NhcGVIdG1sKGNscyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufSlcclxuICAgIC5hZGQoKHsgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgaWYgKGF0dHIgPT09ICdzdHlsZScgJiYgaXNPYmplY3QodmFsdWUpKSB7XHJcbiAgICAgICAgcmV0dXJuIGVzY2FwZUh0bWwoc3R5bGVzKHZhbHVlKSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufSk7XHJcbmNvbnN0IHBsdWdpbnNQcm9jZXNzVGV4dCA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgodGV4dCkgPT4gZXNjYXBlSHRtbCh0ZXh0KSk7XHJcbmZ1bmN0aW9uIGJ1aWxkSHRtbChkLCB0YWJzKSB7XHJcbiAgICBjb25zdCB0YWcgPSBkLnRhZztcclxuICAgIGNvbnN0IGF0dHJzID0gZC5hdHRycyA9PSBudWxsID8gJycgOiBPYmplY3Qua2V5cyhkLmF0dHJzKVxyXG4gICAgICAgIC5maWx0ZXIoKGtleSkgPT4gIXBsdWdpbnNTa2lwQXR0ci5hcHBseSh7IGF0dHI6IGtleSwgdmFsdWU6IGQuYXR0cnNba2V5XSB9KSlcclxuICAgICAgICAubWFwKChrZXkpID0+IHtcclxuICAgICAgICBjb25zdCB2YWx1ZSA9IHBsdWdpbnNTdHJpbmdpZnlBdHRyLmFwcGx5KHsgYXR0cjoga2V5LCB2YWx1ZTogZC5hdHRyc1trZXldIH0pO1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gJycpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGAgJHtrZXl9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGAgJHtrZXl9PVwiJHt2YWx1ZX1cImA7XHJcbiAgICB9KVxyXG4gICAgICAgIC5qb2luKCcnKTtcclxuICAgIGNvbnN0IGlzVm9pZFRhZyA9IHBsdWdpbnNJc1ZvaWRUYWcuYXBwbHkodGFnKTtcclxuICAgIGlmIChpc1ZvaWRUYWcpIHtcclxuICAgICAgICByZXR1cm4gYCR7dGFic308JHt0YWd9JHthdHRyc30vPmA7XHJcbiAgICB9XHJcbiAgICBsZXQgaHRtbFRleHQgPSBgJHt0YWJzfTwke3RhZ30ke2F0dHJzfT5gO1xyXG4gICAgbGV0IHNob3VsZEluZGVudENsb3NpbmdUYWcgPSBmYWxzZTtcclxuICAgIGZsYXR0ZW5EZWNsYXJhdGlvbnMoZC5jaGlsZHJlbiwgZXhlY3V0ZUNoaWxkRm4pXHJcbiAgICAgICAgLmZvckVhY2goKGMpID0+IHtcclxuICAgICAgICBpZiAoaXNPYmplY3QoYykpIHtcclxuICAgICAgICAgICAgc2hvdWxkSW5kZW50Q2xvc2luZ1RhZyA9IHRydWU7XHJcbiAgICAgICAgICAgIGh0bWxUZXh0ICs9IGBcXG4ke2J1aWxkSHRtbChjLCBgJHt0YWJzfSAgICBgKX1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgaHRtbFRleHQgKz0gcGx1Z2luc1Byb2Nlc3NUZXh0LmFwcGx5KGMpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgaWYgKHNob3VsZEluZGVudENsb3NpbmdUYWcpIHtcclxuICAgICAgICBodG1sVGV4dCArPSBgXFxuJHt0YWJzfWA7XHJcbiAgICB9XHJcbiAgICBodG1sVGV4dCArPSBgPC8ke2QudGFnfT5gO1xyXG4gICAgcmV0dXJuIGh0bWxUZXh0O1xyXG59XHJcbmZ1bmN0aW9uIGV4ZWN1dGVDaGlsZEZuKGZuKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHJldHVybiBmbih7fSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoZGVjbGFyYXRpb25PckZuKSB7XHJcbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9IHR5cGVvZiBkZWNsYXJhdGlvbk9yRm4gPT09ICdmdW5jdGlvbicgPyBleGVjdXRlQ2hpbGRGbihkZWNsYXJhdGlvbk9yRm4pIDogZGVjbGFyYXRpb25PckZuO1xyXG4gICAgaWYgKGlzT2JqZWN0KGRlY2xhcmF0aW9uKSkge1xyXG4gICAgICAgIHJldHVybiBidWlsZEh0bWwoZGVjbGFyYXRpb24sICcnKTtcclxuICAgIH1cclxuICAgIHJldHVybiBwbHVnaW5zUHJvY2Vzc1RleHQuYXBwbHkoZGVjbGFyYXRpb24pO1xyXG59XHJcbmNvbnN0IFZPSURfVEFHUyA9IFtcclxuICAgICdhcmVhJyxcclxuICAgICdiYXNlJyxcclxuICAgICdiYXNlZm9udCcsXHJcbiAgICAnYmdzb3VuZCcsXHJcbiAgICAnYnInLFxyXG4gICAgJ2NvbCcsXHJcbiAgICAnY29tbWFuZCcsXHJcbiAgICAnZW1iZWQnLFxyXG4gICAgJ2ZyYW1lJyxcclxuICAgICdocicsXHJcbiAgICAnaW1nJyxcclxuICAgICdpbWFnZScsXHJcbiAgICAnaW5wdXQnLFxyXG4gICAgJ2lzaW5kZXgnLFxyXG4gICAgJ2tleWdlbicsXHJcbiAgICAnbGluaycsXHJcbiAgICAnbWVudWl0ZW0nLFxyXG4gICAgJ21ldGEnLFxyXG4gICAgJ25leHRpZCcsXHJcbiAgICAncGFyYW0nLFxyXG4gICAgJ3NvdXJjZScsXHJcbiAgICAndHJhY2snLFxyXG4gICAgJ3dicicsXHJcbiAgICAnY2lyY2xlJyxcclxuICAgICdlbGxpcHNlJyxcclxuICAgICdpbWFnZScsXHJcbiAgICAnbGluZScsXHJcbiAgICAncGF0aCcsXHJcbiAgICAncG9seWdvbicsXHJcbiAgICAncmVjdCcsXHJcbl0ucmVkdWNlKChtYXAsIHRhZykgPT4gKG1hcFt0YWddID0gdHJ1ZSwgbWFwKSwge30pO1xuXG5jb25zdCBwbHVnaW5zID0ge1xyXG4gICAgcmVuZGVyOiB7XHJcbiAgICAgICAgY3JlYXRlTm9kZTogcGx1Z2luc0NyZWF0ZU5vZGUsXHJcbiAgICAgICAgbWF0Y2hOb2RlczogcGx1Z2luc01hdGNoTm9kZXMsXHJcbiAgICAgICAgbW91bnROb2RlOiBwbHVnaW5zTW91bnROb2RlLFxyXG4gICAgICAgIHNldEF0dHJpYnV0ZTogcGx1Z2luc1NldEF0dHJpYnV0ZSxcclxuICAgICAgICB1bm1vdW50Tm9kZTogcGx1Z2luc1VubW91bnROb2RlLFxyXG4gICAgfSxcclxuICAgIHN0YXRpYzoge1xyXG4gICAgICAgIGlzVm9pZFRhZzogcGx1Z2luc0lzVm9pZFRhZyxcclxuICAgICAgICBwcm9jZXNzVGV4dDogcGx1Z2luc1Byb2Nlc3NUZXh0LFxyXG4gICAgICAgIHNraXBBdHRyOiBwbHVnaW5zU2tpcEF0dHIsXHJcbiAgICAgICAgc3RyaW5naWZ5QXR0cjogcGx1Z2luc1N0cmluZ2lmeUF0dHIsXHJcbiAgICB9XHJcbn07XG5cbmV4cG9ydCB7IHBsdWdpbnMsIGh0bWwsIHJlbmRlciwgc3luYywgZ2V0QXR0cnMsIGNsYXNzZXMsIHN0eWxlcywgZ2V0RGF0YSwgcmVuZGVyVG9TdHJpbmcsIGVzY2FwZUh0bWwgfTtcbiIsIi8qIG1hbGV2aWNAMC4xMS42IC0gTWFyIDYsIDIwMTggKi9cbmltcG9ydCB7IHBsdWdpbnMgfSBmcm9tICdtYWxldmljJztcblxubGV0IHJlZ2lzdGVyZWQgPSBmYWxzZTtcclxuZnVuY3Rpb24gd2l0aEZvcm1zKCkge1xyXG4gICAgaWYgKHJlZ2lzdGVyZWQpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICByZWdpc3RlcmVkID0gdHJ1ZTtcclxuICAgIHBsdWdpbnMucmVuZGVyLnNldEF0dHJpYnV0ZVxyXG4gICAgICAgIC5hZGQoKHsgZWxlbWVudCwgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgICAgIGlmIChhdHRyID09PSAndmFsdWUnICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRleHQgPSB2YWx1ZSA9PSBudWxsID8gJycgOiBTdHJpbmcodmFsdWUpO1xyXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ3ZhbHVlJykpIHtcclxuICAgICAgICAgICAgICAgIGVsZW1lbnQudmFsdWUgPSB0ZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgdGV4dCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfSk7XHJcbiAgICBwbHVnaW5zLnJlbmRlci5jcmVhdGVOb2RlXHJcbiAgICAgICAgLmFkZCgoeyBkLCBwYXJlbnQgfSkgPT4ge1xyXG4gICAgICAgIGlmICgoZCA9PSBudWxsIHx8IHR5cGVvZiBkICE9PSAnb2JqZWN0JykgJiYgcGFyZW50IGluc3RhbmNlb2YgSFRNTFRleHRBcmVhRWxlbWVudCkge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXh0ID0gZDtcclxuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0ZXh0ID09IG51bGwgPyAnJyA6IFN0cmluZyh0ZXh0KTtcclxuICAgICAgICAgICAgaWYgKHBhcmVudC50ZXh0Q29udGVudCB8fCBwYXJlbnQuaGFzQXR0cmlidXRlKCd2YWx1ZScpKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQudmFsdWUgPSB0ZXh0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LnRleHRDb250ZW50ID0gdmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHBhcmVudC5maXJzdENoaWxkO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0pO1xyXG59XG5cbmV4cG9ydCBkZWZhdWx0IHdpdGhGb3JtcztcbiIsIi8qIG1hbGV2aWNAMC4xMS42IC0gTWFyIDYsIDIwMTggKi9cbmltcG9ydCB7IHN5bmMgfSBmcm9tICdtYWxldmljJztcblxubGV0IGNvbXBvbmVudHNDb3VudGVyID0gMDtcclxuZnVuY3Rpb24gd2l0aFN0YXRlKGZuLCBpbml0aWFsU3RhdGUgPSB7fSkge1xyXG4gICAgY29uc3QgcGFyZW50c1N0YXRlcyA9IG5ldyBXZWFrTWFwKCk7XHJcbiAgICBjb25zdCBkZWZhdWx0S2V5ID0gYHN0YXRlLSR7Y29tcG9uZW50c0NvdW50ZXIrK31gO1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChhdHRycyA9IHt9LCAuLi5jaGlsZHJlbikge1xyXG4gICAgICAgIGNvbnN0IGtleSA9IGF0dHJzLmtleSA9PSBudWxsID8gZGVmYXVsdEtleSA6IGF0dHJzLmtleTtcclxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHBhcmVudERvbU5vZGUpIHtcclxuICAgICAgICAgICAgbGV0IHN0YXRlcztcclxuICAgICAgICAgICAgaWYgKHBhcmVudHNTdGF0ZXMuaGFzKHBhcmVudERvbU5vZGUpKSB7XHJcbiAgICAgICAgICAgICAgICBzdGF0ZXMgPSBwYXJlbnRzU3RhdGVzLmdldChwYXJlbnREb21Ob2RlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN0YXRlcyA9IG5ldyBNYXAoKTtcclxuICAgICAgICAgICAgICAgIHBhcmVudHNTdGF0ZXMuc2V0KHBhcmVudERvbU5vZGUsIHN0YXRlcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IG1hdGNoO1xyXG4gICAgICAgICAgICBpZiAoc3RhdGVzLmhhcyhrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICBtYXRjaCA9IHN0YXRlcy5nZXQoa2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG1hdGNoID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIG5vZGU6IG51bGwsXHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdGU6IGluaXRpYWxTdGF0ZSxcclxuICAgICAgICAgICAgICAgICAgICBhdHRyczogbnVsbCxcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW10sXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgc3RhdGVzLnNldChrZXksIG1hdGNoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBtYXRjaC5hdHRycyA9IGF0dHJzO1xyXG4gICAgICAgICAgICBtYXRjaC5jaGlsZHJlbiA9IGNoaWxkcmVuO1xyXG4gICAgICAgICAgICBsZXQgY2FsbGluZ0NvbXBvbmVudCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBmdW5jdGlvbiBpbnZva2VDb21wb25lbnRGbihzdGF0ZSwgYXR0cnMsIGNoaWxkcmVuKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsaW5nQ29tcG9uZW50ID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gZm4oT2JqZWN0LmFzc2lnbih7fSwgYXR0cnMsIHsgc3RhdGUsIHNldFN0YXRlIH0pLCAuLi5jaGlsZHJlbik7XHJcbiAgICAgICAgICAgICAgICBjYWxsaW5nQ29tcG9uZW50ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBkZWNsYXJhdGlvbi5hdHRycyA9IGRlY2xhcmF0aW9uLmF0dHJzIHx8IHt9O1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkRGlkTW91bnQgPSBkZWNsYXJhdGlvbi5hdHRycy5kaWRtb3VudDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9sZERpZFVwZGF0ZSA9IGRlY2xhcmF0aW9uLmF0dHJzLmRpZHVwZGF0ZTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9sZFdpbGxVbm1vdW50ID0gZGVjbGFyYXRpb24uYXR0cnMub2xkRGlkVW5tb3VudDtcclxuICAgICAgICAgICAgICAgIGRlY2xhcmF0aW9uLmF0dHJzLmRpZG1vdW50ID0gZnVuY3Rpb24gKGRvbU5vZGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZXMuZ2V0KGtleSkubm9kZSA9IGRvbU5vZGU7XHJcbiAgICAgICAgICAgICAgICAgICAgb2xkRGlkTW91bnQgJiYgb2xkRGlkTW91bnQoZG9tTm9kZSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgZGVjbGFyYXRpb24uYXR0cnMuZGlkdXBkYXRlID0gZnVuY3Rpb24gKGRvbU5vZGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZXMuZ2V0KGtleSkubm9kZSA9IGRvbU5vZGU7XHJcbiAgICAgICAgICAgICAgICAgICAgb2xkRGlkVXBkYXRlICYmIG9sZERpZFVwZGF0ZShkb21Ob2RlKTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBkZWNsYXJhdGlvbi5hdHRycy53aWxsdW5tb3VudCA9IGZ1bmN0aW9uIChkb21Ob2RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdGVzLmRlbGV0ZShrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIG9sZFdpbGxVbm1vdW50ICYmIG9sZFdpbGxVbm1vdW50KGRvbU5vZGUpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBkZWNsYXJhdGlvbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmdW5jdGlvbiBzZXRTdGF0ZShuZXdTdGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxpbmdDb21wb25lbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbGxpbmcgYHNldFN0YXRlYCBpbnNpZGUgY29tcG9uZW50IGZ1bmN0aW9uIGxlYWRzIHRvIGluZmluaXRlIHJlY3Vyc2lvbicpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBzdGF0ZXMuZ2V0KGtleSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtZXJnZWQgPSBPYmplY3QuYXNzaWduKHt9LCBtYXRjaC5zdGF0ZSwgbmV3U3RhdGUpO1xyXG4gICAgICAgICAgICAgICAgbWF0Y2guc3RhdGUgPSBtZXJnZWQ7XHJcbiAgICAgICAgICAgICAgICBzeW5jKG1hdGNoLm5vZGUsIGludm9rZUNvbXBvbmVudEZuKG1lcmdlZCwgbWF0Y2guYXR0cnMsIG1hdGNoLmNoaWxkcmVuKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGludm9rZUNvbXBvbmVudEZuKG1hdGNoLnN0YXRlLCBtYXRjaC5hdHRycywgbWF0Y2guY2hpbGRyZW4pO1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG59XG5cbmV4cG9ydCBkZWZhdWx0IHdpdGhTdGF0ZTtcbiIsIi8qdGhpcyB2ZXJzaW9uIG9mIGhvdmVyRnVuY3Rpb24gY2FwdHVyZXMgYW4gaW1hZ2UgZXZlcnkgMC41IHNlY29uZHNcclxuVGhpbmdzIGNoZWNrZWQ6XHJcbiovXHJcbmV4cG9ydCBmdW5jdGlvbiBob3ZlckZ1blZlcjMoKXtcclxuICAgIC8vdGhpcyBmdW5jdGlvbiBpbmplY3RzIHRoZSBodG1sIG9uIHRoZSB3ZWJwYWdlIChvbmx5IHJ1bnMgb25jZSlcclxuICAgIGZ1bmN0aW9uIGluaXRpYWxJbmplY3QoKXtcclxuICAgICAgICBjaHJvbWUudGFicy5leGVjdXRlU2NyaXB0KHtcclxuICAgICAgICAgICAgY29kZTogJygnICsgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgIHZhciBDb2xvckhvdmVyVGhpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgIENvbG9ySG92ZXJUaGluZy50ZXh0Q29udGVudCA9IFwiQ29sb3JcIjtcclxuICAgICAgICAgICAgICAgIENvbG9ySG92ZXJUaGluZy5pZCA9IFwiaG92ZXJDb2xvckRpdlwiXHJcbiAgICAgICAgICAgICAgICBDb2xvckhvdmVyVGhpbmcuc2V0QXR0cmlidXRlKFwic3R5bGVcIiwgXCJwb3NpdGlvbjogYWJzb2x1dGU7IGxlZnQ6IDUwMHB4OyB0b3A6IDMwcHg7IGZvbnQtc2l6ZTogNTBweDsgY29sb3I6IHJlZFwiKTtcclxuICAgICAgICAgICAgICAgIHZhciByb290ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgcm9vdC5wcmVwZW5kKENvbG9ySG92ZXJUaGluZyk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImh0bWwgZWxlbWVudCBjcmVhdGVkXCIpO1xyXG4gICAgICAgICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IHRydWV9O1xyXG4gICAgICAgICAgICB9ICsgJykoJyArICcpOydcclxuICAgICAgICB9LCBmdW5jdGlvbihyZXN1bHRzKXtcclxuICAgIFxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgLy90aGlzIGZ1bmN0aW9uIHJ1bnMgZXZlcnkgMC41IHNlY29uZHMsIGl0IGZpcnN0IGNhcHR1cmVzIGEgdGFiLCB0aGVuIGl0IGFuYWx5emVzIGNvbG9yXHJcbiAgICBmdW5jdGlvbiBnZXRDb2xvckxvb3AoKXtcclxuICAgICAgICBmdW5jdGlvbiBjYXB0dXJlVGFiKCl7XHJcbiAgICAgICAgICAgIC8vY2FwdHVyZSB0aGUgdmlzaWJsZSB0YWIsIHRoZW4gc2VuZCBhIG1lc3NhZ2Ugd2l0aCB0aGUgZGF0YVVybCAodXJsIHRvIG1ha2UgaW1hZ2UpXHJcbiAgICAgICAgICAgIGNocm9tZS50YWJzLmNhcHR1cmVWaXNpYmxlVGFiKG51bGwsIHtmb3JtYXQ6IFwicG5nXCJ9LCBmdW5jdGlvbihkYXRhVXJsKXtcclxuICAgICAgICAgICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsnZGF0YVVybE1lc3NhZ2UnOiBkYXRhVXJsfSk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImRhdGFVcmwgc2VudFwiKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9XHJcbiAgICAgICAgLy9saXN0ZW4gZm9yIG1lc3NhZ2VcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiZXhpdCB2aXNpYmxlVGFiXCIpO1xyXG4gICAgICAgIGZ1bmN0aW9uIGNyZWF0ZUltYWdlKCl7XHJcbiAgICAgICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihmdW5jdGlvbihteU1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKXtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZW50ZXJlZCBsaXN0ZW5lclwiKTtcclxuICAgICAgICAgICAgICAgIGlmKCdkYXRhVXJsTWVzc2FnZScgaW4gbXlNZXNzYWdlKXtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1lc3NhZ2UgcmVjZWl2ZWRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9pZiBtZXNzYWdlIGlzIGNvcnJlY3RseSBzZW50LCBjcmVhdGUgbmV3IGltYWdlXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhdGFVcmwgPSBkYXRhVXJsTWVzc2FnZTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbmV3X2ltZyA9IG5ldyBJbWFnZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIG5ld19pbWcuc3JjID0gZGF0YVVybDtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIkltYWdlIENyZWF0ZWRcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJtZXNzYWdlIHdhcyBub3QgcmVjZWl2ZWRcIik7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZW5kIG9mIGNyZWF0ZUltYWdlIGZ1bmN0aW9uXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjcmVhdGVJbWFnZSgpO1xyXG4gICAgICAgIGNhcHR1cmVUYWIoKTtcclxuICAgICAgICAvL2NyZWF0ZUltYWdlKCk7ICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiZW5kIG9mIGZ1bmN0aW9uXCIpO1xyXG5cclxuICAgIH0gXHJcblxyXG4gICAgaW5pdGlhbEluamVjdCgpO1xyXG4gICAgc2V0SW50ZXJ2YWwoZ2V0Q29sb3JMb29wLDEwMDApO1xyXG5cclxuICAgIC8qaWdub3JlIHRoaXMgY3JhcFxyXG4gICAgdmFyIGltZ19kYXRhVXJsID0gXCJpbmNvcnJlY3QgbWVzc2FnZVwiO1xyXG4gICAgICAgIGNocm9tZS50YWJzLmNhcHR1cmVWaXNpYmxlVGFiKG51bGwsIHtmb3JtYXQ6IFwicG5nXCJ9LCBmdW5jdGlvbihkYXRhVXJsKXtcclxuICAgICAgICAgICAgaW1nX2RhdGFVcmwgPSBkYXRhVXJsO1xyXG4gICAgICAgICAgICByZXR1cm4gaW1nX2RhdGFVcmw7XHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coaW1nX2RhdGFVcmwpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICAgaWYoaW1nX2RhdGFVcmwgIT0gXCJpbmNvcnJlY3QgbWVzc2FnZVwiKVxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImFjdHVhbGx5IHdvcmtlZFwiKTtcclxuICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZmFpbGVkXCIpO1xyXG4gICAgKi9cclxufVxyXG5cclxuXHJcbi8vdGhpcyB2ZXJzaW9uIG9mIGhvdmVyRnVuY3Rpb24gdXNlcyBjaHJvbWUncyBjYXB0dXJldmlzaWJsZVRhYiBtZXRob2QgdG8gb2J0YWluIGFuIGltYWdlXHJcbi8qXHJcblRoaW5ncyBDaGVja2VkOlxyXG4gICAgMS4gSW1hZ2UgZGF0YVVybCBpcyBjb25zaXN0ZW50IHdpdGggZGF0YVVybCBvYnRhaW5lZCBiZWZvcmUgY29kZSBpbmplY3Rpb25cclxuICAgIDIuIEltYWdlIGhhcyBjb25zaXN0ZW50IHdpZHRoIGFuZCBsZW5ndGggcGFyYW1ldGVyc1xyXG4gICAgMy4gb25tb3VzZW1vdmUgc2VlbXMgdG8gd29yayBjb3JyZWN0bHlcclxuICAgIDQuIEltYWdlIHdpZHRoIGFuZCBsZW5ndGggY29ycmVzcG9uZCB0byBjdXJzb3IgeCx5IG1heGltdW1zIChpbWFnZSBjYXB0dXJlcyBlbnRpcmUgYnJvd3NlciB3aW5kb3cpXHJcbiAgICA1LiBSR0IgdmFsdWVzIGFyZSBjb3JyZWN0LCB3b3JrcyB3aXRoIGVudGlyZSBicm93c2VyIHdpbmRvd1xyXG4gICAgNi4gSFNWIHZhbHVlcyBhcmUgY29ycmVjdCwgd29ya3MgY29ycmVjdGx5IHdpdGggbW91c2UgeCx5IHBvc2l0aW9uXHJcbiAgICA3LiBTb21lIGV4Y2VwdGlvbnMgYXJlIGJlaW5nIHRocm93bi4gVGhlc2UgZXhjZXB0aW9ucyBhcmUgcmVsYXRlZCB0aGUgdGhlIGdldEltYWdlRGF0YSBmdW5jdGlvblxyXG4gICAgZnJvbSB0aGUgcHJlcGFyZUNhbnZhcyBmdW5jdGlvbi4gSSBiZWxpZXZlIHRoaXMgaXNzdWUgaXMgZHVlIHRvIGhvdyBJJ20gZHJhd2luZyB0aGUgaW1hZ2UgdG8gdGhlIGNhbnZhcy5cclxuICAgIEkgbG9va2VkIGludG8gdGhpcyBpc3N1ZSwgb25lIG1lbnRpb25lZCBmaXggd2FzIHVzaW5nIHRoZSBpbWFnZSdzIG5hdHVyYWwgaGVpZ2h0IGFuZCB3aWR0aCBpbnN0ZWFkIG9mIHRoZVxyXG4gICAgcmVndWxhciBoZWlnaHQgYW5kIHdpZHRoLiBJIGRpZCB0aGlzLCBidXQgdGhlIGV4Y2VwdGlvbiB3YXMgc3RpbGwgYmVpbmcgdGhyb3duLiBJIGhhdmUgc3Vycm91bmRlZCB0aGUgXHJcbiAgICBvbm1vdXNlbW92ZSBzdGF0ZW1lbnRzIGluIGEgdHJ5IGNhdGNoIGJsb2NrIHRvIGRlYWwgd2l0aCB0aGVzZSBleGNlcHRpb25zLlxyXG4qL1xyXG5leHBvcnQgZnVuY3Rpb24gaG92ZXJGdW5WZXIyKCl7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGdldENvbG9yKCl7XHJcbiAgICAgICAgY2hyb21lLnRhYnMuY2FwdHVyZVZpc2libGVUYWIobnVsbCwge2Zvcm1hdDogXCJwbmdcIn0sIGZ1bmN0aW9uKGRhdGFVcmwpe1xyXG4gICAgICAgICAgICB2YXIgZGF0YVRvV2ViUGFnZSA9IGRhdGFVcmw7XHJcbiAgICAgICAgICAgIGNocm9tZS50YWJzLmV4ZWN1dGVTY3JpcHQoe1xyXG4gICAgICAgICAgICAgICAgY29kZTogJygnICsgZnVuY3Rpb24ocGFyYW1zKXtcclxuICAgICAgICAgICAgICAgICAgICAvL2FsbCBqYXZhc2NyaXB0IGhlcmUgaXMgZXhlY3V0ZWQgYnkgYnJvd3Nlciwgbm90IGV4dGVuc2lvblxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJvdW5kKHZhbHVlLCBkZWNpbWFscyl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIoTWF0aC5yb3VuZCh2YWx1ZSsnZScrZGVjaW1hbHMpKydlLScrZGVjaW1hbHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvL2dldHMgeCx5IHBvc2l0aW9uIG9mIHRoZSBjdXJzb3JcclxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBnZXRNb3VzZVBvcyhlKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHt4OmUuY2xpZW50WCx5OmUuY2xpZW50WX07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vZ2V0cyB0aGUgcmdiIHZhbHVlcyBvZiBhIHBpeGVsXHJcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gZ2V0UGl4ZWwoaW1nRGF0YSwgaW5kZXgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSBpbmRleCo0LCBkID0gaW1nRGF0YS5kYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gW2RbaV0sZFtpKzFdLGRbaSsyXSxkW2krM11dIC8vIFtSLEcsQixBXVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvL2lucHV0OiBpbWFnZSBkYXRhLCB4LHkgbG9jYXRpb24gb2YgdGhlIGN1cnNvclxyXG4gICAgICAgICAgICAgICAgICAgIC8vb3V0cHV0OiByZ2IgdmFsdWVzIG9mIHRoZSBwaXhlbCBhdCBjdXJzb3IgbG9jYXRpb24gIFxyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdldFBpeGVsWFkoaW1nRGF0YSwgeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0UGl4ZWwoaW1nRGF0YSwgeSppbWdEYXRhLndpZHRoK3gpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvL3ByZXBhcmVzIHRoZSBjYW52YXMsIHJldHVybnMgaW1hZ2UgZGF0YSBvZiB0aGUgZW50aXJlIGltYWdlIChicm93c2VyIHdpbmRvdylcclxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBwcmVwYXJlQ2FudmFzKCl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBmaW5hbF9pbWcgPSBuZXcgSW1hZ2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZmluYWxfaW1nLnNyYyA9IHBhcmFtcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYW52YXMud2lkdGggPSBmaW5hbF9pbWcud2lkdGg7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbnZhcy5oZWlnaHQgPSBmaW5hbF9pbWcuaGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NhbnZhcy53aWR0aCA9IGZpbmFsX2ltZy5uYXR1cmFsV2lkdGg7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY2FudmFzLmhlaWdodCA9IGZpbmFsX2ltZy5uYXR1cmFsSGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGZpbmFsX2ltZywwLDAsY2FudmFzLndpZHRoLGNhbnZhcy5oZWlnaHQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaWR0ID0gY29udGV4dC5nZXRJbWFnZURhdGEoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlkdDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgLy9jb252ZXJ0IHJnYiB2YWx1ZXMgdG8gaHN2IHZhbHVlc1xyXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJnYnRvSFNWKHJnYkFycmF5KXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9yZ2IgdmFsdWVzIG5lZWQgdG8gYmUgaW4gZmxvYXQgKDAgLSAxKSBpbnN0ZWFkIG9mICgwIC0gMjU1KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVkID0gcmdiQXJyYXlbMF0gLyAyNTUuMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGdyZWVuID0gcmdiQXJyYXlbMV0gLyAyNTUuMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJsdWUgPSByZ2JBcnJheVsyXSAvIDI1NS4wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgayA9IDAuMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRlbXA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihncmVlbiA8IGJsdWUpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcCA9IGdyZWVuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JlZW4gPSBibHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmx1ZSA9IHRlbXA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrID0gLTEuMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihyZWQgPCBncmVlbil7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZW1wID0gcmVkO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVkID0gZ3JlZW47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmVlbiA9IHRlbXA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrID0gLTIuMCAvIDYuMCAtIGs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNocm9tYSA9IHJlZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZ3JlZW4gPCBibHVlKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNocm9tYSAtPSBncmVlbjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNle1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hyb21hIC09IGJsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzWzBdID0gcm91bmQoKE1hdGguYWJzKGsgKyAoZ3JlZW4gLSBibHVlKSAvICg2LjAgKiBjaHJvbWEgKyAxZS0yMCkpICogMzYwKSwgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc1sxXSA9IHJvdW5kKGNocm9tYSAvIChyZWQgKyAxZS0yMCksIDIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNbMl0gPSByb3VuZChyZWQsIDIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzOyBcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gSFNWdG9Db2xvcihoc3ZBcnJheSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGh1ZSA9IGhzdkFycmF5WzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzYXQgPSBoc3ZBcnJheVsxXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsID0gaHN2QXJyYXlbMl07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL0JlZ2luIEVycm9yIGNoZWNraW5nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGh1ZSA8IDAgfHwgaHVlID4gMzYwKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSHVlIHZhbHVlOiBcIiArIGh1ZSArIFwiIEh1ZSBpcyBub3QgYmV0d2VlbiAwIGFuZCAzNjBcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9CZWdpbiBIU1YgdGVzdGluZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1RPRE86IEFkZCBibGFjaywgd2hpdGUsIGdyYXksIG9yYW5nZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY29sb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKHZhbCA8IDAuMil7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IFwiYmxhY2tcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKChzYXQgPCAwLjIpICYmICh2YWwgPCAwLjg1KSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IFwiZ3JleVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoKHNhdCA8IDAuMTUpICYmICh2YWwgPiAwLjg1KSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IFwid2hpdGVcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKChodWUgPj0gMCkgJiYgKGh1ZSA8IDMwKSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IFwicmVkXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZigoaHVlID49IDMwKSAmJiAoaHVlIDwgNjApKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gXCJvcmFuZ2VcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKChodWUgPj0gNjApICYmIChodWUgPCAxMTApKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gXCJ5ZWxsb3dcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKChodWUgPj0gMTEwKSAmJiAoaHVlIDwgMTgwKSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IFwiZ3JlZW5cIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKChodWUgPj0gMTgwKSAmJiAoaHVlIDwgMjQwKSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IFwiY3lhblwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoKGh1ZSA+PSAyNDApICYmIChodWUgPCAzMDApKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gXCJibHVlXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZigoaHVlID49IDMwMCkgJiYgKGh1ZSA8IDM2MCkpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSBcIm1hZ2VudGFcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNle1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSBcInVua25vd24/XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29sb3I7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiByZ2JUb0NvbG9yKHJnYkFycmF5KXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNvbG9yQXJyYXkgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJnYkFycmF5TWluSW5kZXggPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcE1pbkRpc3RhbmNlID0gMTAwMDAwMDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZ2JfZmluYWxfY29sb3IgPSBcInVua25vd25cIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHIxID0gcmdiQXJyYXlbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBiMSA9IHJnYkFycmF5WzFdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZzEgPSByZ2JBcnJheVsyXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlZCA9IFsyNTUsIDAsIDI1NV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBncmVlbiA9IFswLCAyNTUsIDBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYmx1ZSA9IFswLCAwLCAyNTVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcGluayA9IFsyNTUsIDE5MiwgMjAzXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxpZ2h0X2dyZWVuID0gWzE0NCwgMjM4LCAxNDRdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb3JhbmdlID0gWzI1NSwgMTY1LCAwXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHllbGxvdyA9IFsyNTUsIDI1NSwgMF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBicm93biA9IFsxNjUsIDQyLCA0Ml07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBsaWdodF9ibHVlID0gWzE3MywgMjE2LCAyMzBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHVycGxlID0gWzEyOCwgMCwgMTI4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHdoaXRlID0gWzI1NSwgMjU1LCAyNTVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgZ3JheSA9IFsxMjgsIDEyOCwgMTI4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGJsYWNrID0gWzAsIDAsIDBdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvckFycmF5LnB1c2gocmVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JBcnJheS5wdXNoKGdyZWVuKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JBcnJheS5wdXNoKGJsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvckFycmF5LnB1c2gocGluayk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yQXJyYXkucHVzaChsaWdodF9ncmVlbik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yQXJyYXkucHVzaChvcmFuZ2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvckFycmF5LnB1c2goeWVsbG93KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JBcnJheS5wdXNoKGJyb3duKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JBcnJheS5wdXNoKGxpZ2h0X2JsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvckFycmF5LnB1c2gocHVycGxlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JBcnJheS5wdXNoKHdoaXRlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JBcnJheS5wdXNoKGdyYXkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvckFycmF5LnB1c2goYmxhY2spO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGNvbG9yQXJyYXlbMF1bMV0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yKGkgPSAwOyBpIDwgY29sb3JBcnJheS5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZ2JEaXN0YW5jZSA9IE1hdGguYWJzKHIxIC0gY29sb3JBcnJheVtpXVswXSkgKyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguYWJzKGIxIC0gY29sb3JBcnJheVtpXVsxXSkgKyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguYWJzKGcxIC0gY29sb3JBcnJheVtpXVsyXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihyZ2JEaXN0YW5jZSA8IHRlbXBNaW5EaXN0YW5jZSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmdiQXJyYXlNaW5JbmRleCA9IGk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcE1pbkRpc3RhbmNlID0gcmdiRGlzdGFuY2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAocmdiQXJyYXlNaW5JbmRleCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwicmVkXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmdiX2ZpbmFsX2NvbG9yID0gXCJncmVlblwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwiYmx1ZVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAzOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwicGlua1wiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSA0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwibGlnaHQgZ3JlZW5cIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgNTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZ2JfZmluYWxfY29sb3IgPSBcIm9yYW5nZVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSA2OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwieWVsbG93XCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmdiX2ZpbmFsX2NvbG9yID0gXCJicm93blwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSA4OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwibGlnaHQgYmx1ZVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSA5OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwicHVycGxlXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDEwOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwid2hpdGVcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMTE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmdiX2ZpbmFsX2NvbG9yID0gXCJncmF5XCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDEyOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwiYmxhY2tcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmdiX2ZpbmFsX2NvbG9yO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIENvbG9ySG92ZXJUaGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgICAgIENvbG9ySG92ZXJUaGluZy50ZXh0Q29udGVudCA9IFwiQ29sb3JcIjtcclxuICAgICAgICAgICAgICAgICAgICBDb2xvckhvdmVyVGhpbmcuaWQgPSBcImhvdmVyQ29sb3JEaXZcIlxyXG4gICAgICAgICAgICAgICAgICAgIENvbG9ySG92ZXJUaGluZy5zZXRBdHRyaWJ1dGUoXCJzdHlsZVwiLCBcInBvc2l0aW9uOiBhYnNvbHV0ZTsgbGVmdDogNTAwcHg7IHRvcDogMzBweDsgZm9udC1zaXplOiA1MHB4OyBjb2xvcjogcmVkXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciByb290ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgIHJvb3QucHJlcGVuZChDb2xvckhvdmVyVGhpbmcpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vdXNlTW92ZUZ1biA9IGZ1bmN0aW9uKGUpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW91c2Vjb29yZHMgPSBnZXRNb3VzZVBvcyhlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaW1hZ2VfZGF0YSA9IHByZXBhcmVDYW52YXMoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmdiQXJyYXkgPSBnZXRQaXhlbFhZKGltYWdlX2RhdGEsbW91c2Vjb29yZHMueCxtb3VzZWNvb3Jkcy55KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaHN2QXJyYXkgPSByZ2J0b0hTVihyZ2JBcnJheSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZpbmFsX2NvbG9yID0gSFNWdG9Db2xvcihoc3ZBcnJheSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy92YXIgZmluYWxfY29sb3IgPSByZ2JUb0NvbG9yKHJnYkFycmF5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKHJnYkFycmF5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhoc3ZBcnJheVswXSwgaHN2QXJyYXlbMV0sIGhzdkFycmF5WzJdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGZpbmFsX2NvbG9yKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2h0bWwgc3R1ZmZcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb2xvckhvdmVyVGhpbmcudGV4dENvbnRlbnQgPSBmaW5hbF9jb2xvcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGhzdkFycmF5WzBdKTsgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiRE9NRXhjZXB0aW9uIC0gc291cmNlIHdpZHRoIGlzIDBcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cobW91c2Vjb29yZHMueCwgbW91c2Vjb29yZHMueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKGZpbmFsX2ltZy53aWR0aCwgZmluYWxfaW1nLmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgbW91c2VNb3ZlRnVuKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbW92ZUZ1bmN0aW9uID0gZnVuY3Rpb24oZSl7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHJlbW92ZUZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3VzZU1vdmVGdW4pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBDb2xvckhvdmVyVGhpbmcucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaHJvbWUuZXh0ZW5zaW9uLnNlbmRNZXNzYWdlKHsnbWVzc2FnZSc6IFwiVXNlciBoYXMgc2Nyb2xsZWRcIn0pXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibWVzc2FnZSBzZW50XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCByZW1vdmVGdW5jdGlvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IHRydWV9O1xyXG4gICAgICAgICAgICAgICAgfSArICcpKCcrIEpTT04uc3RyaW5naWZ5KGRhdGFUb1dlYlBhZ2UpICsgJyk7J1xyXG4gICAgICAgICAgICB9LCBmdW5jdGlvbihyZXN1bHRzKXtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2NyaXB0IGNhbGxiYWNrXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImV4ZWN1dGUgc2NyaXB0IGRvbmVcIik7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Q29sb3IoKTtcclxuICAgIGNvbnNvbGUubG9nKFwiZmluaXNoZWQgZ2V0Q29sb3JcIik7XHJcbiAgICBjaHJvbWUuZXh0ZW5zaW9uLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihmdW5jdGlvbihteU1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKXtcclxuICAgICAgICBjb25zb2xlLmxvZyhteU1lc3NhZ2UpO1xyXG4gICAgICAgIGlmKCdtZXNzYWdlJyBpbiBteU1lc3NhZ2UpXHJcbiAgICAgICAgICAgIGlmKG15TWVzc2FnZS5tZXNzYWdlID09IFwiVXNlciBoYXMgc2Nyb2xsZWRcIil7XHJcbiAgICAgICAgICAgICAgICBnZXRDb2xvcigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICB9KVxyXG5cclxuICAgIFxyXG59XHJcblxyXG4vL1RPRE86IEZpeCB0aGlzIGZ1bmN0aW9uIHNvIHlvdSBjYW4gYWN0dWFsbHkgZGlzYWJsZSB0aGUgaG92ZXJGdW5jdGlvblxyXG5leHBvcnQgZnVuY3Rpb24gZW5hYmxlSG92ZXJGdW4oKXtcclxuXHJcbiAgICB2YXIgZW5hYmxlSG92ZXIgPSBmYWxzZTtcclxuICAgIFxyXG4gICAgaWYoZW5hYmxlSG92ZXIgPT0gZmFsc2Upe1xyXG4gICAgICAgIGVuYWJsZUhvdmVyID0gdHJ1ZTtcclxuICAgICAgICBob3ZlckZ1bk9sZCgpO1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG4gICAgaWYoZW5hYmxlSG92ZXIgPT0gdHJ1ZSl7XHJcbiAgICAgICAgZW5hYmxlSG92ZXIgPSBmYWxzZTtcclxuICAgICAgICBjaHJvbWUudGFicy5leGVjdXRlU2NyaXB0KHtcclxuICAgICAgICAgICAgY29kZTogJygnICsgZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coMyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgcmV0dXJuIHtzdWNjZXNzOiB0cnVlfTtcclxuICAgICAgICAgICAgfSArICcpKCcgKyAnKTsnXHJcbiAgICAgICAgfSwgZnVuY3Rpb24ocmVzdWx0cyl7XHJcbiAgICBcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgIH1cclxufVxyXG5cclxuLypcclxuVGhpcyBpcyB0aGUgb3JpZ2luYWwgZnVuY3Rpb24gdXNlZCBmb3IgdGhlIGhvdmVyIHRvb2wuIFxyXG5JdCBjYXB0dXJlZCB0aGUgaW1hZ2UgaW4gYSB2ZXJ5IHJvdW5kYWJvdXQgd2F5LiBJdCB3ZW50IHRocm91Z2ggdGhlIGh0bWwgYW5kIHNhdmVkIHRoZSBmaXJzdCBpbWFnZSBhc3NvY2lhdGVkXHJcbndpdGggdGhlIGltYWdlIHRhZyBhcyB0aGUgaW1hZ2UgdG8gYmUgdXNlZCB3aXRoIHRoZSB0b29sLiBcclxuUkdCIHZhbHVlcyBhbmQgSFNWIHZhbHVlcyBhcmUgY29ycmVjdCB3aXRoIHRoaXMgZnVuY3Rpb24uIFxyXG5Qcm9ibGVtczpcclxuMS4gVGhpcyBmdW5jdGlvbiBvbmx5IHdvcmtzIG9uIG9uZSBpbWFnZVxyXG4yLiBUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3Mgd2l0aCB0aGUgZmlyc3QgaW1hZ2UgaW4gdGhlIGh0bWxcclxuMy4gVGhlIHgseSB2YWx1ZXMgSSBpbnB1dCBpbnRvIGdldHRpbmcgdGhlIHBpeGVsIGRhdGEgYXJlIGluY29ycmVjdC4gVGhleSBhcmUgbm90IHRoZSB4LHkgdmFsdWVzIG9mIHRoZSBpbWFnZSxcclxudGhleSBhcmUgdGhlIHgseSB2YWx1ZXMgb2YgdGhlIHdpbmRvdy4gVGhpcyBzaG91bGQgYmUgY29ycmVjdGVkIHdpdGggY2hyb21lJ3MgY2FwdHVyZVZpc2libGVUYWJcclxuKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGhvdmVyRnVuVmVyMSgpe1xyXG5cclxuICAgIHZhciBhID0gXCJuaWNlIG1lbWVcIjtcclxuXHJcbiAgICAgICAgdmFyIGRhdGFUb1dlYlBhZ2UgPSB7dGV4dDogJ3Rlc3QnLCBmb286IDEsIGJhcjogZmFsc2V9O1xyXG4gICAgICAgIGNocm9tZS50YWJzLmV4ZWN1dGVTY3JpcHQoe1xyXG4gICAgICAgICAgICBjb2RlOiAnKCcgKyBmdW5jdGlvbihwYXJhbXMpIHtcclxuICAgICAgICAgICAgICAgIC8vVGhpcyBmdW5jdGlvbiB3aWxsICB3b3JrIGluIHdlYnBhZ2VcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHBhcmFtcyk7IC8vbG9ncyBpbiB3ZWJwYWdlIGNvbnNvbGVcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdldFBpeGVsKGltZ0RhdGEsIGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSBpbmRleCo0LCBkID0gaW1nRGF0YS5kYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbZFtpXSxkW2krMV0sZFtpKzJdLGRbaSszXV0gLy8gW1IsRyxCLEFdXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdldFBpeGVsWFkoaW1nRGF0YSwgeCwgeSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRQaXhlbChpbWdEYXRhLCB5KmltZ0RhdGEud2lkdGgreCk7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuICAgICAgICAgICAgICAgIHZhciBpbWcgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImltZ1wiKVswXTtcclxuICAgICAgICAgICAgICAgIGNhbnZhcy53aWR0aCA9IGltZy53aWR0aDtcclxuICAgICAgICAgICAgICAgIGNhbnZhcy5oZWlnaHQgPSBpbWcuaGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgdmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoaW1nLDAsMCxjYW52YXMud2lkdGgsY2FudmFzLmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgaWR0ID0gY29udGV4dC5nZXRJbWFnZURhdGEoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGdldE1vdXNlUG9zKGUpe1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7eDplLmNsaWVudFgseTplLmNsaWVudFl9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJnYlRvSGV4KHIsIGcsIGIpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAociA+IDI1NSB8fCBnID4gMjU1IHx8IGIgPiAyNTUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBjb2xvciBjb21wb25lbnRcIjtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKChyIDw8IDE2KSB8IChnIDw8IDgpIHwgYikudG9TdHJpbmcoMTYpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vY29udmVydCByZ2IgdmFsdWVzIHRvIGhzdiB2YWx1ZXNcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJnYnRvSFNWKHIsIGcsIGIpe1xyXG4gICAgICAgICAgICAgICAgICAgIC8vcmdiIHZhbHVlcyBuZWVkIHRvIGJlIGluIGZsb2F0ICgwIC0gMSkgaW5zdGVhZCBvZiAoMCAtMjU1KVxyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZWQgPSByIC8gMjU1LjA7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGdyZWVuID0gZyAvIDI1NS4wO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBibHVlID0gYiAvIDI1NS4wO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXMgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgayA9IDAuMDtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdGVtcDtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZihncmVlbiA8IGJsdWUpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wID0gZ3JlZW47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyZWVuID0gYmx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmx1ZSA9IHRlbXA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGsgPSAtMS4wO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZihyZWQgPCBncmVlbil7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXAgPSByZWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZCA9IGdyZWVuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBncmVlbiA9IHRlbXA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGsgPSAtMi4wIC8gNi4wIC0gaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNocm9tYSA9IHJlZDtcclxuICAgICAgICAgICAgICAgICAgICBpZihncmVlbiA8IGJsdWUpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaHJvbWEgLT0gZ3JlZW47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2V7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNocm9tYSAtPSBibHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXNbMF0gPSAoTWF0aC5hYnMoayArIChncmVlbiAtIGJsdWUpIC8gKDYuMCAqIGNocm9tYSArIDFlLTIwKSkgKiAzNjAuMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzWzFdID0gY2hyb21hIC8gKHJlZCArIDFlLTIwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNbMl0gPSByZWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlczsgXHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQub25tb3VzZW1vdmUgPSBmdW5jdGlvbihlKXtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbW91c2Vjb29yZHMgPSBnZXRNb3VzZVBvcyhlKTtcclxuICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKG1vdXNlY29vcmRzLngpO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cobW91c2Vjb29yZHMueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhnZXRQaXhlbFhZKGlkdCxtb3VzZWNvb3Jkcy54LG1vdXNlY29vcmRzLnkpKTtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmdiQXJyYXkgPSBnZXRQaXhlbFhZKGlkdCxtb3VzZWNvb3Jkcy54LG1vdXNlY29vcmRzLnkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBoc3ZBcnJheSA9IHJnYnRvSFNWKHJnYkFycmF5WzBdLCByZ2JBcnJheVsxXSwgcmdiQXJyYXlbMl0pO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cocmdiQXJyYXlbMF0scmdiQXJyYXlbMV0scmdiQXJyYXlbMl0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGhzdkFycmF5WzBdLCBoc3ZBcnJheVsxXSwgaHN2QXJyYXlbMl0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKHJnYlRvSGV4KHJnYkFycmF5WzBdLHJnYkFycmF5WzFdLHJnYkFycmF5WzJdKSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtzdWNjZXNzOiB0cnVlLCByZXNwb25zZTogXCJUaGlzIGlzIGZyb20gd2VicGFnZS5cIn07XHJcbiAgICAgICAgICAgIH0gKyAnKSgnICsgSlNPTi5zdHJpbmdpZnkoZGF0YVRvV2ViUGFnZSkgKyAnKTsnXHJcbiAgICAgICAgfSwgZnVuY3Rpb24ocmVzdWx0cykge1xyXG4gICAgICAgICAgICAvL1RoaXMgaXMgdGhlIGNhbGxiYWNrIHJlc3BvbnNlIGZyb20gd2VicGFnZVxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXN1bHRzWzBdKTsgLy9sb2dzIGluIGV4dGVuc2lvbiBjb25zb2xlIFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKGEpO1xyXG4gICAgLy93aW5kb3cucHJvbXB0KFwic29tZXRleHRcIixcImRlZmF1bHRUZXh0XCIpOyAgICBcclxufVxyXG5cclxuLy9mdW5jdGlvbnMgZm9yIHVuaXQgdGVzdGluZyAodW5pdCB0ZXN0aW5nIHBlcmZvcm1lZCBhdCBjb2xvci50ZXN0cy50cylcclxuZXhwb3J0IGZ1bmN0aW9uIHJvdW5kKHZhbHVlLCBkZWNpbWFscyl7XHJcbiAgICByZXR1cm4gTnVtYmVyKE1hdGgucm91bmQodmFsdWUrJ2UnK2RlY2ltYWxzKSsnZS0nK2RlY2ltYWxzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJnYnRvSFNWKHJnYkFycmF5KXtcclxuICAgIC8vcmdiIHZhbHVlcyBuZWVkIHRvIGJlIGluIGZsb2F0ICgwIC0gMSkgaW5zdGVhZCBvZiAoMCAtIDI1NSlcclxuICAgIHZhciByZWQgPSByZ2JBcnJheVswXSAvIDI1NS4wO1xyXG4gICAgdmFyIGdyZWVuID0gcmdiQXJyYXlbMV0gLyAyNTUuMDtcclxuICAgIHZhciBibHVlID0gcmdiQXJyYXlbMl0gLyAyNTUuMDtcclxuICAgIFxyXG4gICAgdmFyIHJlcyA9IFtdO1xyXG4gICAgdmFyIGsgPSAwLjA7XHJcbiAgICB2YXIgdGVtcDtcclxuICAgIFxyXG4gICAgaWYoZ3JlZW4gPCBibHVlKXtcclxuICAgICAgICB0ZW1wID0gZ3JlZW47XHJcbiAgICAgICAgZ3JlZW4gPSBibHVlO1xyXG4gICAgICAgIGJsdWUgPSB0ZW1wO1xyXG4gICAgICAgIGsgPSAtMS4wO1xyXG4gICAgfVxyXG4gICAgaWYocmVkIDwgZ3JlZW4pe1xyXG4gICAgICAgIHRlbXAgPSByZWQ7XHJcbiAgICAgICAgcmVkID0gZ3JlZW47XHJcbiAgICAgICAgZ3JlZW4gPSB0ZW1wO1xyXG4gICAgICAgIGsgPSAtMi4wIC8gNi4wIC0gaztcclxuICAgIH1cclxuICAgIHZhciBjaHJvbWEgPSByZWQ7XHJcbiAgICBpZihncmVlbiA8IGJsdWUpe1xyXG4gICAgICAgIGNocm9tYSAtPSBncmVlbjtcclxuICAgIH1cclxuICAgIGVsc2V7XHJcbiAgICAgICAgY2hyb21hIC09IGJsdWU7XHJcbiAgICB9XHJcbiAgICByZXNbMF0gPSByb3VuZCgoTWF0aC5hYnMoayArIChncmVlbiAtIGJsdWUpIC8gKDYuMCAqIGNocm9tYSArIDFlLTIwKSkgKiAzNjApLCAwKTtcclxuICAgIHJlc1sxXSA9IHJvdW5kKGNocm9tYSAvIChyZWQgKyAxZS0yMCksIDIpO1xyXG4gICAgcmVzWzJdID0gcm91bmQocmVkLCAyKTtcclxuICAgIHJldHVybiByZXM7IFxyXG59XHJcbmV4cG9ydCBmdW5jdGlvbiByZ2JUb0NvbG9yKHJnYkFycmF5KXtcclxuICAgIHZhciBjb2xvckFycmF5ID0gW107XHJcbiAgICB2YXIgcmdiQXJyYXlNaW5JbmRleCA9IDA7XHJcbiAgICB2YXIgdGVtcE1pbkRpc3RhbmNlID0gMTAwMDAwMDA7XHJcbiAgICB2YXIgcmdiX2ZpbmFsX2NvbG9yID0gXCJ1bmtub3duXCI7XHJcbiAgICB2YXIgcjEgPSByZ2JBcnJheVswXTtcclxuICAgIHZhciBiMSA9IHJnYkFycmF5WzFdO1xyXG4gICAgdmFyIGcxID0gcmdiQXJyYXlbMl07XHJcbiAgICB2YXIgcmVkID0gWzI1NSwgMCwgMjU1XTtcclxuICAgIHZhciBncmVlbiA9IFswLCAyNTUsIDBdO1xyXG4gICAgdmFyIGJsdWUgPSBbMCwgMCwgMjU1XTtcclxuICAgIHZhciBwaW5rID0gWzI1NSwgMTkyLCAyMDNdO1xyXG4gICAgdmFyIGxpZ2h0X2dyZWVuID0gWzE0NCwgMjM4LCAxNDRdO1xyXG4gICAgdmFyIG9yYW5nZSA9IFsyNTUsIDE2NSwgMF07XHJcbiAgICB2YXIgeWVsbG93ID0gWzI1NSwgMjU1LCAwXTtcclxuICAgIHZhciBicm93biA9IFsxNjUsIDQyLCA0Ml07XHJcbiAgICB2YXIgbGlnaHRfYmx1ZSA9IFsxNzMsIDIxNiwgMjMwXTtcclxuICAgIHZhciBwdXJwbGUgPSBbMTI4LCAwLCAxMjhdO1xyXG4gICAgdmFyIHdoaXRlID0gWzI1NSwgMjU1LCAyNTVdO1xyXG4gICAgdmFyIGdyYXkgPSBbMTI4LCAxMjgsIDEyOF07XHJcbiAgICB2YXIgYmxhY2sgPSBbMCwgMCwgMF07XHJcbiAgICBjb2xvckFycmF5LnB1c2gocmVkKTtcclxuICAgIGNvbG9yQXJyYXkucHVzaChncmVlbik7XHJcbiAgICBjb2xvckFycmF5LnB1c2goYmx1ZSk7XHJcbiAgICBjb2xvckFycmF5LnB1c2gocGluayk7XHJcbiAgICBjb2xvckFycmF5LnB1c2gobGlnaHRfZ3JlZW4pO1xyXG4gICAgY29sb3JBcnJheS5wdXNoKG9yYW5nZSk7XHJcbiAgICBjb2xvckFycmF5LnB1c2goeWVsbG93KTtcclxuICAgIGNvbG9yQXJyYXkucHVzaChicm93bik7XHJcbiAgICBjb2xvckFycmF5LnB1c2gobGlnaHRfYmx1ZSk7XHJcbiAgICBjb2xvckFycmF5LnB1c2gocHVycGxlKTtcclxuICAgIGNvbG9yQXJyYXkucHVzaCh3aGl0ZSk7XHJcbiAgICBjb2xvckFycmF5LnB1c2goZ3JheSk7XHJcbiAgICBjb2xvckFycmF5LnB1c2goYmxhY2spO1xyXG4gICAgLy9jb25zb2xlLmxvZyhjb2xvckFycmF5WzBdWzFdKTtcclxuXHJcbiAgICBmb3IoaSA9IDA7IGkgPCBjb2xvckFycmF5Lmxlbmd0aDsgaSsrKXtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcmdiRGlzdGFuY2UgPSBNYXRoLmFicyhyMSAtIGNvbG9yQXJyYXlbaV1bMF0pICsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5hYnMoYjEgLSBjb2xvckFycmF5W2ldWzFdKSArIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGguYWJzKGcxIC0gY29sb3JBcnJheVtpXVsyXSk7XHJcbiAgICAgICAgaWYocmdiRGlzdGFuY2UgPCB0ZW1wTWluRGlzdGFuY2Upe1xyXG4gICAgICAgICAgICByZ2JBcnJheU1pbkluZGV4ID0gaTtcclxuICAgICAgICAgICAgdGVtcE1pbkRpc3RhbmNlID0gcmdiRGlzdGFuY2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKHJnYkFycmF5TWluSW5kZXgpIHtcclxuICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwicmVkXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgICAgcmdiX2ZpbmFsX2NvbG9yID0gXCJncmVlblwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwiYmx1ZVwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwicGlua1wiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDQ6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwibGlnaHQgZ3JlZW5cIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSA1OlxyXG4gICAgICAgICAgICByZ2JfZmluYWxfY29sb3IgPSBcIm9yYW5nZVwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDY6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwieWVsbG93XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNzpcclxuICAgICAgICAgICAgcmdiX2ZpbmFsX2NvbG9yID0gXCJicm93blwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDg6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwibGlnaHQgYmx1ZVwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDk6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwicHVycGxlXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTA6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwid2hpdGVcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAxMTpcclxuICAgICAgICAgICAgcmdiX2ZpbmFsX2NvbG9yID0gXCJncmF5XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMTI6XHJcbiAgICAgICAgICAgIHJnYl9maW5hbF9jb2xvciA9IFwiYmxhY2tcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICBcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmdiX2ZpbmFsX2NvbG9yO1xyXG59XHJcbmV4cG9ydCBmdW5jdGlvbiBIU1Z0b0NvbG9yKGhzdkFycmF5KXtcclxuICAgIGh1ZSA9IGhzdkFycmF5WzBdO1xyXG4gICAgc2F0ID0gaHN2QXJyYXlbMV07XHJcbiAgICB2YWwgPSBoc3ZBcnJheVsyXTtcclxuICAgIFxyXG4gICAgLy9CZWdpbiBFcnJvciBjaGVja2luZ1xyXG4gICAgaWYoaHVlIDwgMCB8fCBodWUgPiAzNjApe1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiSHVlIHZhbHVlOiBcIiArIGh1ZSArIFwiIEh1ZSBpcyBub3QgYmV0d2VlbiAwIGFuZCAzNjBcIik7XHJcbiAgICB9XHJcbiAgICAvL0JlZ2luIEhTViB0ZXN0aW5nXHJcbiAgICAvL1RPRE86IEFkZCBibGFjaywgd2hpdGUsIGdyYXksIG9yYW5nZVxyXG4gICAgdmFyIGNvbG9yO1xyXG4gICAgaWYodmFsIDwgMC4yKXtcclxuICAgICAgICBjb2xvciA9IFwiYmxhY2tcIjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYoKHNhdCA8IDAuMikgJiYgKHZhbCA8IDAuODUpKXtcclxuICAgICAgICBjb2xvciA9IFwiZ3JleVwiO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZigoc2F0IDwgMC4xNSkgJiYgKHZhbCA+IDAuODUpKXtcclxuICAgICAgICBjb2xvciA9IFwid2hpdGVcIjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYoKGh1ZSA+PSAwKSAmJiAoaHVlIDwgMzApKXtcclxuICAgICAgICBjb2xvciA9IFwicmVkXCI7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmKChodWUgPj0gMzApICYmIChodWUgPCA2MCkpe1xyXG4gICAgICAgIGNvbG9yID0gXCJvcmFuZ2VcIjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYoKGh1ZSA+PSA2MCkgJiYgKGh1ZSA8IDExMCkpe1xyXG4gICAgICAgIGNvbG9yID0gXCJ5ZWxsb3dcIjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYoKGh1ZSA+PSAxMTApICYmIChodWUgPCAxODApKXtcclxuICAgICAgICBjb2xvciA9IFwiZ3JlZW5cIjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYoKGh1ZSA+PSAxODApICYmIChodWUgPCAyNDApKXtcclxuICAgICAgICBjb2xvciA9IFwiY3lhblwiO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZigoaHVlID49IDI0MCkgJiYgKGh1ZSA8IDMwMCkpe1xyXG4gICAgICAgIGNvbG9yID0gXCJibHVlXCI7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmKChodWUgPj0gMzAwKSAmJiAoaHVlIDwgMzYwKSl7XHJcbiAgICAgICAgY29sb3IgPSBcIm1hZ2VudGFcIjtcclxuICAgIH1cclxuICAgIGVsc2V7XHJcbiAgICAgICAgY29sb3IgPSBcInVua25vd24/XCJcclxuICAgIH1cclxuICAgIHJldHVybiBjb2xvcjtcclxufVxyXG4vL1JlZmVyZW5jZSBTdHVmZlxyXG5cclxuLypiYXNpYyBjb2RlIGluamVjdGlvblxyXG5jaHJvbWUudGFicy5leGVjdXRlU2NyaXB0KHtcclxuICAgICAgICBjb2RlOiAnKCcgKyBmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAvL2NvbnNvbGUubG9nKDMpO1xyXG5cclxuICAgICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IHRydWV9O1xyXG4gICAgICAgIH0gKyAnKSgnICsgJyk7J1xyXG4gICAgfSwgZnVuY3Rpb24ocmVzdWx0cyl7XHJcblxyXG4gICAgfSk7XHJcbiovIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztJQUFBO0lBQ0EsU0FBUyxPQUFPLENBQUMsR0FBRyxJQUFJLEVBQUU7SUFDMUIsSUFBSSxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSztJQUN4QixRQUFRLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO0lBQ25DLFlBQVksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixTQUFTO0lBQ1QsYUFBYSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsRUFBRTtJQUN4QyxZQUFZLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxQyxpQkFBaUIsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkQsU0FBUztJQUNULEtBQUssQ0FBQyxDQUFDO0lBQ1AsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUNELFNBQVMsTUFBTSxDQUFDLFlBQVksRUFBRTtJQUM5QixJQUFJLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDcEMsU0FBUyxNQUFNLENBQUMsQ0FBQyxPQUFPLEtBQUssWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQztJQUMzRCxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEUsU0FBUyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbkIsQ0FBQztJQUNELFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRTtJQUN6QixJQUFJLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUM7SUFDdEQsQ0FBQztJQUNELFNBQVMsT0FBTyxDQUFDLEdBQUcsRUFBRTtJQUN0QixJQUFJLE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFDRCxTQUFTLE9BQU8sQ0FBQyxHQUFHLEVBQUU7SUFDdEIsSUFBSSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxLQUFLO0lBQzNDLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0lBQ3RGLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNYLENBQUM7SUFDRCxTQUFTLGtCQUFrQixDQUFDLENBQUMsRUFBRTtJQUMvQixJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2pDLENBQUM7SUFDRCxTQUFTLG1CQUFtQixDQUFDLFlBQVksRUFBRSxZQUFZLEVBQUU7SUFDekQsSUFBSSxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDdkIsSUFBSSxPQUFPLENBQUMsWUFBWSxDQUFDO0lBQ3pCLFNBQVMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLO0lBQ3hCLFFBQVEsSUFBSSxPQUFPLENBQUMsS0FBSyxVQUFVLEVBQUU7SUFDckMsWUFBWSxNQUFNLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEMsWUFBWSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDbEMsZ0JBQWdCLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRixhQUFhO0lBQ2IsaUJBQWlCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUM3QyxnQkFBZ0IsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoQyxhQUFhO0lBQ2IsU0FBUztJQUNULGFBQWEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3pDLFlBQVksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixTQUFTO0lBQ1QsS0FBSyxDQUFDLENBQUM7SUFDUCxJQUFJLE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7O0lBRUQsU0FBUyxJQUFJLENBQUMsY0FBYyxFQUFFLEtBQUssRUFBRSxHQUFHLFFBQVEsRUFBRTtJQUNsRCxJQUFJLElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFO0lBQzVDLFFBQVEsT0FBTyxFQUFFLEdBQUcsRUFBRSxjQUFjLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ3hELEtBQUs7SUFDTCxJQUFJLElBQUksT0FBTyxjQUFjLEtBQUssVUFBVSxFQUFFO0lBQzlDLFFBQVEsT0FBTyxjQUFjLENBQUMsS0FBSyxJQUFJLElBQUksR0FBRyxTQUFTLEdBQUcsS0FBSyxFQUFFLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDdkYsS0FBSztJQUNMLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQzs7SUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBQ25DLFNBQVMsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUU7SUFDaEMsSUFBSSxZQUFZLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBQ0QsU0FBUyxPQUFPLENBQUMsT0FBTyxFQUFFO0lBQzFCLElBQUksT0FBTyxZQUFZLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3JDLENBQUM7O0lBRUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUNyQyxTQUFTLFdBQVcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRTtJQUMvQyxJQUFJLElBQUksU0FBUyxDQUFDO0lBQ2xCLElBQUksSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQ3JDLFFBQVEsU0FBUyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEQsS0FBSztJQUNMLFNBQVM7SUFDVCxRQUFRLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDdkIsUUFBUSxjQUFjLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztJQUMvQyxLQUFLO0lBQ0wsSUFBSSxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxRQUFRLEVBQUU7SUFDdkMsUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDaEMsWUFBWSxPQUFPLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLFNBQVM7SUFDVCxRQUFRLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDbEQsUUFBUSxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsUUFBUSxDQUFDO0lBQ3BDLEtBQUs7SUFDTCxDQUFDO0lBQ0QsU0FBUyxjQUFjLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRTtJQUN4QyxJQUFJLElBQUksU0FBUyxDQUFDO0lBQ2xCLElBQUksSUFBSSxjQUFjLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQ3JDLFFBQVEsU0FBUyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEQsS0FBSztJQUNMLFNBQVM7SUFDVCxRQUFRLE9BQU87SUFDZixLQUFLO0lBQ0wsSUFBSSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDNUIsUUFBUSxPQUFPLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzdELFFBQVEsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEMsS0FBSztJQUNMLENBQUM7O0lBRUQsU0FBUyxhQUFhLEdBQUc7SUFDekIsSUFBSSxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDdkIsSUFBSSxPQUFPO0lBQ1gsUUFBUSxHQUFHLENBQUMsTUFBTSxFQUFFO0lBQ3BCLFlBQVksT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxZQUFZLE9BQU8sSUFBSSxDQUFDO0lBQ3hCLFNBQVM7SUFDVCxRQUFRLEtBQUssQ0FBQyxLQUFLLEVBQUU7SUFDckIsWUFBWSxJQUFJLE1BQU0sQ0FBQztJQUN2QixZQUFZLElBQUksTUFBTSxDQUFDO0lBQ3ZCLFlBQVksS0FBSyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQzFELGdCQUFnQixNQUFNLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BDLGdCQUFnQixNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLGdCQUFnQixJQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUU7SUFDcEMsb0JBQW9CLE9BQU8sTUFBTSxDQUFDO0lBQ2xDLGlCQUFpQjtJQUNqQixhQUFhO0lBQ2IsWUFBWSxPQUFPLElBQUksQ0FBQztJQUN4QixTQUFTO0lBQ1QsS0FBSyxDQUFDO0lBQ04sQ0FBQzs7SUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7SUFDdkMsTUFBTSxlQUFlLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUN0QyxNQUFNLGdCQUFnQixHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7SUFDdkMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBQ3hDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUMxQyxNQUFNLGlCQUFpQixHQUFHO0lBQzFCLElBQUksVUFBVSxFQUFFLGdCQUFnQjtJQUNoQyxJQUFJLFdBQVcsRUFBRSxpQkFBaUI7SUFDbEMsSUFBSSxhQUFhLEVBQUUsbUJBQW1CO0lBQ3RDLENBQUMsQ0FBQztJQUNGLE1BQU0sUUFBUSxHQUFHLDhCQUE4QixDQUFDO0lBQ2hELE1BQU0sTUFBTSxHQUFHLDRCQUE0QixDQUFDO0lBQzVDLE1BQU0saUJBQWlCLEdBQUcsYUFBYSxFQUFFO0lBQ3pDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUs7SUFDNUIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3RCLFFBQVEsT0FBTyxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxJQUFJLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ25FLEtBQUs7SUFDTCxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxLQUFLLEVBQUU7SUFDekIsUUFBUSxPQUFPLFFBQVEsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3ZELEtBQUs7SUFDTCxJQUFJLElBQUksTUFBTSxDQUFDLFlBQVksS0FBSyxRQUFRLEVBQUU7SUFDMUMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdDLEtBQUs7SUFDTCxJQUFJLE9BQU8sUUFBUSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoRSxDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sZ0JBQWdCLEdBQUcsYUFBYSxFQUFFO0lBQ3hDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLO0lBQ3JDLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDcEMsSUFBSSxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxFQUFFO0lBQzFDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUs7SUFDL0IsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdCLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLG1CQUFtQixHQUFHLGFBQWEsRUFBRTtJQUMzQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSztJQUN2QyxJQUFJLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEtBQUssS0FBSyxFQUFFO0lBQzFDLFFBQVEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxLQUFLO0lBQ0wsU0FBUztJQUNULFFBQVEsT0FBTyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLElBQUksR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDeEUsS0FBSztJQUNMLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0lBQ0YsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUs7SUFDdkMsSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO0lBQ2xDLFFBQVEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4QyxRQUFRLElBQUksT0FBTyxLQUFLLEtBQUssVUFBVSxFQUFFO0lBQ3pDLFlBQVksV0FBVyxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDL0MsU0FBUztJQUNULGFBQWE7SUFDYixZQUFZLGNBQWMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0MsU0FBUztJQUNULFFBQVEsT0FBTyxJQUFJLENBQUM7SUFDcEIsS0FBSztJQUNMLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0lBQ0YsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUs7SUFDdkMsSUFBSSxJQUFJLElBQUksS0FBSyxRQUFRLEVBQUU7SUFDM0IsUUFBUSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7SUFDNUIsWUFBWSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2hELFNBQVM7SUFDVCxhQUFhO0lBQ2IsWUFBWSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0MsU0FBUztJQUNULFFBQVEsT0FBTyxJQUFJLENBQUM7SUFDcEIsS0FBSztJQUNMLElBQUksSUFBSSxJQUFJLElBQUksaUJBQWlCLEVBQUU7SUFDbkMsUUFBUSxNQUFNLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqRCxRQUFRLElBQUksS0FBSyxFQUFFO0lBQ25CLFlBQVksUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekMsU0FBUztJQUNULGFBQWE7SUFDYixZQUFZLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDckMsU0FBUztJQUNULFFBQVEsT0FBTyxJQUFJLENBQUM7SUFDcEIsS0FBSztJQUNMLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0lBQ0YsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUs7SUFDdkMsSUFBSSxJQUFJLElBQUksS0FBSyxNQUFNLEVBQUU7SUFDekIsUUFBUSxPQUFPLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2hDLFFBQVEsT0FBTyxJQUFJLENBQUM7SUFDcEIsS0FBSztJQUNMLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0lBQ0YsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUs7SUFDdkMsSUFBSSxJQUFJLElBQUksS0FBSyxPQUFPLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO0lBQzdDLFFBQVEsSUFBSSxHQUFHLENBQUM7SUFDaEIsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDbEMsWUFBWSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7SUFDcEMsU0FBUztJQUNULGFBQWE7SUFDYixZQUFZLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakMsU0FBUztJQUNULFFBQVEsSUFBSSxHQUFHLEVBQUU7SUFDakIsWUFBWSxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMvQyxTQUFTO0lBQ1QsYUFBYTtJQUNiLFlBQVksT0FBTyxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM3QyxTQUFTO0lBQ1QsUUFBUSxPQUFPLElBQUksQ0FBQztJQUNwQixLQUFLO0lBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDLENBQUM7SUFDRixLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSztJQUN2QyxJQUFJLElBQUksSUFBSSxLQUFLLE9BQU8sSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDN0MsUUFBUSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEMsUUFBUSxJQUFJLEtBQUssRUFBRTtJQUNuQixZQUFZLE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pELFNBQVM7SUFDVCxhQUFhO0lBQ2IsWUFBWSxPQUFPLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzdDLFNBQVM7SUFDVCxRQUFRLE9BQU8sSUFBSSxDQUFDO0lBQ3BCLEtBQUs7SUFDTCxJQUFJLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUMsQ0FBQyxDQUFDO0lBQ0gsTUFBTSxhQUFhLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUNwQyxTQUFTLFFBQVEsQ0FBQyxPQUFPLEVBQUU7SUFDM0IsSUFBSSxPQUFPLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDO0lBQzlDLENBQUM7SUFDRCxTQUFTLFVBQVUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUNyQyxJQUFJLE1BQU0sSUFBSSxHQUFHLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3hELElBQUksSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDckIsUUFBUSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDN0IsUUFBUSxNQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7SUFDaEMsUUFBUSxhQUFhLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNqRCxRQUFRLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRTtJQUNyQixZQUFZLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSztJQUNuRCxnQkFBZ0IsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1QyxnQkFBZ0IsbUJBQW1CLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLGdCQUFnQixZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQzNDLGFBQWEsQ0FBQyxDQUFDO0lBQ2YsU0FBUztJQUNULEtBQUs7SUFDTCxJQUFJLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNuRCxJQUFJLElBQUksSUFBSSxZQUFZLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDL0QsUUFBUSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsUUFBUSxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN4QyxLQUFLO0lBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLFlBQVksT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQy9FLFFBQVEsY0FBYyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoQyxLQUFLO0lBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBQ0QsU0FBUyxZQUFZLENBQUMsT0FBTyxFQUFFO0lBQy9CLElBQUksT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUN0QyxTQUFTLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSztJQUMxQyxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7SUFDMUIsUUFBUSxPQUFPLEdBQUcsQ0FBQztJQUNuQixLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDWCxDQUFDO0lBQ0QsU0FBUyxRQUFRLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRTtJQUMvQixJQUFJLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3JCLFFBQVEsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDO0lBQ2pDLFFBQVEsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7SUFDcEMsUUFBUSxJQUFJLGFBQWEsR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDOUMsUUFBUSxJQUFJLENBQUMsYUFBYSxFQUFFO0lBQzVCLFlBQVksYUFBYSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNsRCxZQUFZLGFBQWEsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ3RELFNBQVM7SUFDVCxRQUFRLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLO0lBQ3JELFlBQVksSUFBSSxFQUFFLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtJQUNsQyxnQkFBZ0IsbUJBQW1CLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMxRSxnQkFBZ0IsT0FBTyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0MsYUFBYTtJQUNiLFNBQVMsQ0FBQyxDQUFDO0lBQ1gsUUFBUSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSztJQUM3QyxZQUFZLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxZQUFZLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssRUFBRTtJQUMvQyxnQkFBZ0IsbUJBQW1CLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3BFLGdCQUFnQixhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQzVDLGFBQWE7SUFDYixTQUFTLENBQUMsQ0FBQztJQUNYLFFBQVEsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQzVFLFlBQVksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELFlBQVksZUFBZSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDL0MsU0FBUztJQUNULGFBQWEsSUFBSSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDakQsWUFBWSxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDcEQsU0FBUztJQUNULFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRTtJQUM1QyxZQUFZLGNBQWMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkMsU0FBUztJQUNULEtBQUs7SUFDTCxTQUFTO0lBQ1QsUUFBUSxRQUFRLENBQUMsV0FBVyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRCxLQUFLO0lBQ0wsQ0FBQztJQUNELFNBQVMsVUFBVSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUU7SUFDbEMsSUFBSSxJQUFJLElBQUksWUFBWSxPQUFPLElBQUksbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQ2xFLFFBQVEsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLEtBQUs7SUFDTCxJQUFJLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFDRCxNQUFNLGlCQUFpQixHQUFHLGFBQWEsRUFBRTtJQUN6QyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLO0lBQzdCLElBQUksTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLElBQUksTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDL0csSUFBSSxJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDdEIsSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLO0lBQ2hDLFFBQVEsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLFFBQVEsTUFBTSxNQUFNLEdBQUcsQ0FBQyxTQUFTLENBQUM7SUFDbEMsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUM7SUFDekIsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7SUFDeEIsUUFBUSxPQUFPLFNBQVMsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsRUFBRTtJQUNuRSxZQUFZLElBQUksR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN0RCxZQUFZLElBQUksTUFBTSxFQUFFO0lBQ3hCLGdCQUFnQixJQUFJLElBQUksWUFBWSxPQUFPLEVBQUU7SUFDN0Msb0JBQW9CLE1BQU07SUFDMUIsaUJBQWlCO0lBQ2pCLGdCQUFnQixJQUFJLElBQUksWUFBWSxJQUFJLEVBQUU7SUFDMUMsb0JBQW9CLEtBQUssR0FBRyxJQUFJLENBQUM7SUFDakMsb0JBQW9CLFNBQVMsRUFBRSxDQUFDO0lBQ2hDLG9CQUFvQixNQUFNO0lBQzFCLGlCQUFpQjtJQUNqQixhQUFhO0lBQ2IsWUFBWSxJQUFJLFNBQVMsSUFBSSxJQUFJLFlBQVksT0FBTyxFQUFFO0lBQ3RELGdCQUFnQixJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRTtJQUMxRCxvQkFBb0IsS0FBSyxHQUFHLElBQUksQ0FBQztJQUNqQyxpQkFBaUI7SUFDakIsZ0JBQWdCLFNBQVMsRUFBRSxDQUFDO0lBQzVCLGdCQUFnQixNQUFNO0lBQ3RCLGFBQWE7SUFDYixTQUFTO0lBQ1QsUUFBUSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDakMsS0FBSyxDQUFDLENBQUM7SUFDUCxJQUFJLE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUMsQ0FBQyxDQUFDO0lBQ0gsU0FBUyxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRTtJQUNsQyxJQUFJLE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7SUFDbkMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUM7SUFDbkMsU0FBUyxNQUFNLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDO0lBQy9CLFNBQVMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNuRCxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO0lBQy9CLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNsRCxTQUFTLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDeEIsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLO0lBQ3RDLFFBQVEsSUFBSSxJQUFJLEVBQUU7SUFDbEIsWUFBWSxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzlCLFlBQVksUUFBUSxHQUFHLElBQUksQ0FBQztJQUM1QixTQUFTO0lBQ1QsYUFBYTtJQUNiLFlBQVksTUFBTSxXQUFXLElBQUksUUFBUTtJQUN6QyxnQkFBZ0IsUUFBUSxDQUFDLFdBQVc7SUFDcEMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELFlBQVksUUFBUSxHQUFHLFVBQVUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzNELFNBQVM7SUFDVCxLQUFLLENBQUMsQ0FBQztJQUNQLENBQUM7SUFDRCxTQUFTLGNBQWMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFO0lBQ3BDLElBQUksTUFBTSxPQUFPLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDNUQsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFDRCxTQUFTLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxFQUFFO0lBQ3JDLElBQUksSUFBSSxFQUFFLE1BQU0sWUFBWSxPQUFPLENBQUMsRUFBRTtJQUN0QyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztJQUNsRCxLQUFLO0lBQ0wsSUFBSSxNQUFNLElBQUksR0FBRztJQUNqQixRQUFRLEdBQUcsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRTtJQUN6QyxRQUFRLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQ25DLFFBQVEsUUFBUSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsV0FBVyxHQUFHLENBQUMsV0FBVyxDQUFDO0lBQzFFLEtBQUssQ0FBQztJQUNOLElBQUksY0FBYyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNqQyxJQUFJLE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7SUFDckMsUUFBUSxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUNsQyxRQUFRLFFBQVEsQ0FBQyxXQUFXLENBQUM7SUFDN0IsWUFBWSxNQUFNLENBQUMsaUJBQWlCO0lBQ3BDLFlBQVksTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUM5QixDQUFDO0lBQ0QsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLGVBQWUsRUFBRTtJQUN2QyxJQUFJLE1BQU0sV0FBVyxHQUFHLE9BQU8sZUFBZSxLQUFLLFVBQVUsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHLGVBQWUsQ0FBQztJQUN4SCxJQUFJLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM1QyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsU0FBUyxJQUFJLE1BQU0sWUFBWSxJQUFJO0lBQy9DLFNBQVMsU0FBUyxJQUFJLE1BQU0sWUFBWSxPQUFPLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsS0FBSyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtJQUN2RyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUM3QyxLQUFLO0lBQ0wsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLElBQUksT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQzs7SUFFRCxNQUFNLGdCQUFnQixHQUFHLGFBQWEsRUFBRTtJQUN4QyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksU0FBUyxDQUFDLENBQUM7SUFDcEMsTUFBTSxlQUFlLEdBQUcsYUFBYSxFQUFFO0lBQ3ZDLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssS0FBSyxLQUFLLENBQUMsQ0FBQztJQUMzRCxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQztJQUN6QixJQUFJLE1BQU07SUFDVixJQUFJLFFBQVE7SUFDWixJQUFJLFVBQVU7SUFDZCxJQUFJLFdBQVc7SUFDZixJQUFJLGFBQWE7SUFDakIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3BCLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDOUMsU0FBUyxVQUFVLENBQUMsQ0FBQyxFQUFFO0lBQ3ZCLElBQUksT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3BCLFNBQVMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7SUFDL0IsU0FBUyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQztJQUM5QixTQUFTLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDO0lBQzlCLFNBQVMsT0FBTyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUM7SUFDaEMsU0FBUyxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFDRCxNQUFNLG9CQUFvQixHQUFHLGFBQWEsRUFBRTtJQUM1QyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssS0FBSyxLQUFLLElBQUksR0FBRyxFQUFFLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hFLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUs7SUFDOUIsSUFBSSxJQUFJLElBQUksS0FBSyxPQUFPLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO0lBQzdDLFFBQVEsSUFBSSxHQUFHLENBQUM7SUFDaEIsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDbEMsWUFBWSxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7SUFDcEMsU0FBUztJQUNULGFBQWE7SUFDYixZQUFZLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakMsU0FBUztJQUNULFFBQVEsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0IsS0FBSztJQUNMLElBQUksT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQyxDQUFDO0lBQ0YsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSztJQUM5QixJQUFJLElBQUksSUFBSSxLQUFLLE9BQU8sSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDN0MsUUFBUSxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUN6QyxLQUFLO0lBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxFQUFFO0lBQzFDLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLElBaURBLE1BQU0sU0FBUyxHQUFHO0lBQ2xCLElBQUksTUFBTTtJQUNWLElBQUksTUFBTTtJQUNWLElBQUksVUFBVTtJQUNkLElBQUksU0FBUztJQUNiLElBQUksSUFBSTtJQUNSLElBQUksS0FBSztJQUNULElBQUksU0FBUztJQUNiLElBQUksT0FBTztJQUNYLElBQUksT0FBTztJQUNYLElBQUksSUFBSTtJQUNSLElBQUksS0FBSztJQUNULElBQUksT0FBTztJQUNYLElBQUksT0FBTztJQUNYLElBQUksU0FBUztJQUNiLElBQUksUUFBUTtJQUNaLElBQUksTUFBTTtJQUNWLElBQUksVUFBVTtJQUNkLElBQUksTUFBTTtJQUNWLElBQUksUUFBUTtJQUNaLElBQUksT0FBTztJQUNYLElBQUksUUFBUTtJQUNaLElBQUksT0FBTztJQUNYLElBQUksS0FBSztJQUNULElBQUksUUFBUTtJQUNaLElBQUksU0FBUztJQUNiLElBQUksT0FBTztJQUNYLElBQUksTUFBTTtJQUNWLElBQUksTUFBTTtJQUNWLElBQUksU0FBUztJQUNiLElBQUksTUFBTTtJQUNWLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7O0lBRW5ELE1BQU0sT0FBTyxHQUFHO0lBQ2hCLElBQUksTUFBTSxFQUFFO0lBQ1osUUFBUSxVQUFVLEVBQUUsaUJBQWlCO0lBQ3JDLFFBQVEsVUFBVSxFQUFFLGlCQUFpQjtJQUNyQyxRQUFRLFNBQVMsRUFBRSxnQkFBZ0I7SUFDbkMsUUFBUSxZQUFZLEVBQUUsbUJBQW1CO0lBQ3pDLFFBQVEsV0FBVyxFQUFFLGtCQUFrQjtJQUN2QyxLQUFLO0lBQ0wsSUFBSSxNQUFNLEVBQUU7SUFDWixRQUFRLFNBQVMsRUFBRSxnQkFBZ0I7SUFDbkMsUUFBUSxXQUFXLEVBQUUsa0JBQWtCO0lBQ3ZDLFFBQVEsUUFBUSxFQUFFLGVBQWU7SUFDakMsUUFBUSxhQUFhLEVBQUUsb0JBQW9CO0lBQzNDLEtBQUs7SUFDTCxDQUFDLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQ3RpQkY7QUFDQSxBQUNBO0lBQ0EsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQ3ZCLFNBQVMsU0FBUyxHQUFHO0lBQ3JCLElBQUksSUFBSSxVQUFVLEVBQUU7SUFDcEIsUUFBUSxPQUFPO0lBQ2YsS0FBSztJQUNMLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQztJQUN0QixJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWTtJQUMvQixTQUFTLEdBQUcsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSztJQUMzQyxRQUFRLElBQUksSUFBSSxLQUFLLE9BQU8sSUFBSSxPQUFPLFlBQVksZ0JBQWdCLEVBQUU7SUFDckUsWUFBWSxNQUFNLElBQUksR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUQsWUFBWSxJQUFJLE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDL0MsZ0JBQWdCLE9BQU8sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBQ3JDLGFBQWE7SUFDYixpQkFBaUI7SUFDakIsZ0JBQWdCLE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3BELGFBQWE7SUFDYixZQUFZLE9BQU8sSUFBSSxDQUFDO0lBQ3hCLFNBQVM7SUFDVCxRQUFRLE9BQU8sSUFBSSxDQUFDO0lBQ3BCLEtBQUssQ0FBQyxDQUFDO0lBQ1AsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVU7SUFDN0IsU0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSztJQUNoQyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsS0FBSyxNQUFNLFlBQVksbUJBQW1CLEVBQUU7SUFDM0YsWUFBWSxNQUFNLElBQUksR0FBRyxDQUFDLENBQUM7SUFDM0IsWUFBWSxNQUFNLEtBQUssR0FBRyxJQUFJLElBQUksSUFBSSxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0QsWUFBWSxJQUFJLE1BQU0sQ0FBQyxXQUFXLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRTtJQUNwRSxnQkFBZ0IsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7SUFDcEMsYUFBYTtJQUNiLGlCQUFpQjtJQUNqQixnQkFBZ0IsTUFBTSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7SUFDM0MsYUFBYTtJQUNiLFlBQVksT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDO0lBQ3JDLFNBQVM7SUFDVCxRQUFRLE9BQU8sSUFBSSxDQUFDO0lBQ3BCLEtBQUssQ0FBQyxDQUFDO0lBQ1AsQ0FBQzs7SUN0Q0Q7QUFDQSxBQUNBO0lBQ0EsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDMUIsU0FBUyxTQUFTLENBQUMsRUFBRSxFQUFFLFlBQVksR0FBRyxFQUFFLEVBQUU7SUFDMUMsSUFBSSxNQUFNLGFBQWEsR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBQ3hDLElBQUksTUFBTSxVQUFVLEdBQUcsQ0FBQyxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxPQUFPLFVBQVUsS0FBSyxHQUFHLEVBQUUsRUFBRSxHQUFHLFFBQVEsRUFBRTtJQUM5QyxRQUFRLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLElBQUksSUFBSSxHQUFHLFVBQVUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQy9ELFFBQVEsT0FBTyxVQUFVLGFBQWEsRUFBRTtJQUN4QyxZQUFZLElBQUksTUFBTSxDQUFDO0lBQ3ZCLFlBQVksSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFO0lBQ2xELGdCQUFnQixNQUFNLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMxRCxhQUFhO0lBQ2IsaUJBQWlCO0lBQ2pCLGdCQUFnQixNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNuQyxnQkFBZ0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDekQsYUFBYTtJQUNiLFlBQVksSUFBSSxLQUFLLENBQUM7SUFDdEIsWUFBWSxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDakMsZ0JBQWdCLEtBQUssR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLGFBQWE7SUFDYixpQkFBaUI7SUFDakIsZ0JBQWdCLEtBQUssR0FBRztJQUN4QixvQkFBb0IsSUFBSSxFQUFFLElBQUk7SUFDOUIsb0JBQW9CLEtBQUssRUFBRSxZQUFZO0lBQ3ZDLG9CQUFvQixLQUFLLEVBQUUsSUFBSTtJQUMvQixvQkFBb0IsUUFBUSxFQUFFLEVBQUU7SUFDaEMsaUJBQWlCLENBQUM7SUFDbEIsZ0JBQWdCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLGFBQWE7SUFDYixZQUFZLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLFlBQVksS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDdEMsWUFBWSxJQUFJLGdCQUFnQixHQUFHLEtBQUssQ0FBQztJQUN6QyxZQUFZLFNBQVMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7SUFDL0QsZ0JBQWdCLGdCQUFnQixHQUFHLElBQUksQ0FBQztJQUN4QyxnQkFBZ0IsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7SUFDbkcsZ0JBQWdCLGdCQUFnQixHQUFHLEtBQUssQ0FBQztJQUN6QyxnQkFBZ0IsV0FBVyxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztJQUM1RCxnQkFBZ0IsTUFBTSxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUM7SUFDL0QsZ0JBQWdCLE1BQU0sWUFBWSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO0lBQ2pFLGdCQUFnQixNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQztJQUN2RSxnQkFBZ0IsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxPQUFPLEVBQUU7SUFDaEUsb0JBQW9CLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQztJQUNuRCxvQkFBb0IsV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN4RCxpQkFBaUIsQ0FBQztJQUNsQixnQkFBZ0IsV0FBVyxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsVUFBVSxPQUFPLEVBQUU7SUFDakUsb0JBQW9CLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQztJQUNuRCxvQkFBb0IsWUFBWSxJQUFJLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMxRCxpQkFBaUIsQ0FBQztJQUNsQixnQkFBZ0IsV0FBVyxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsVUFBVSxPQUFPLEVBQUU7SUFDbkUsb0JBQW9CLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdkMsb0JBQW9CLGNBQWMsSUFBSSxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDOUQsaUJBQWlCLENBQUM7SUFDbEIsZ0JBQWdCLE9BQU8sV0FBVyxDQUFDO0lBQ25DLGFBQWE7SUFDYixZQUFZLFNBQVMsUUFBUSxDQUFDLFFBQVEsRUFBRTtJQUN4QyxnQkFBZ0IsSUFBSSxnQkFBZ0IsRUFBRTtJQUN0QyxvQkFBb0IsTUFBTSxJQUFJLEtBQUssQ0FBQywwRUFBMEUsQ0FBQyxDQUFDO0lBQ2hILGlCQUFpQjtJQUNqQixnQkFBZ0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5QyxnQkFBZ0IsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN4RSxnQkFBZ0IsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7SUFDckMsZ0JBQWdCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3pGLGFBQWE7SUFDYixZQUFZLE9BQU8saUJBQWlCLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvRSxTQUFTLENBQUM7SUFDVixLQUFLLENBQUM7SUFDTixDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQ3BFRDtJQUNBO0lBQ0E7QUFDQSxJQUFPLFNBQVMsWUFBWSxFQUFFO0lBQzlCO0lBQ0EsSUFBSSxTQUFTLGFBQWEsRUFBRTtJQUM1QixRQUFRLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQ2xDLFlBQVksSUFBSSxFQUFFLEdBQUcsR0FBRyxVQUFVO0lBQ2xDLGdCQUFnQixJQUFJLGVBQWUsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3BFLGdCQUFnQixlQUFlLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQztJQUN0RCxnQkFBZ0IsZUFBZSxDQUFDLEVBQUUsR0FBRyxnQkFBZTtJQUNwRCxnQkFBZ0IsZUFBZSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUseUVBQXlFLENBQUMsQ0FBQztJQUNqSSxnQkFBZ0IsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQztJQUNwRCxnQkFBZ0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM5QyxnQkFBZ0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3BELGVBQWUsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN0QyxhQUFhLEdBQUcsSUFBSSxHQUFHLElBQUk7SUFDM0IsU0FBUyxFQUFFLFNBQVMsT0FBTyxDQUFDO0lBQzVCO0lBQ0EsU0FBUyxDQUFDLENBQUM7SUFDWCxLQUFLO0lBQ0w7SUFDQSxJQUFJLFNBQVMsWUFBWSxFQUFFO0lBQzNCLFFBQVEsU0FBUyxVQUFVLEVBQUU7SUFDN0I7SUFDQSxZQUFZLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFLFNBQVMsT0FBTyxDQUFDO0lBQ2xGLGdCQUFnQixNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDeEUsZ0JBQWdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDNUMsYUFBYSxFQUFDO0lBQ2QsU0FBUztJQUNUO0lBQ0E7SUFDQSxRQUFRLFNBQVMsV0FBVyxFQUFFO0lBQzlCLFlBQVksTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLFNBQVMsU0FBUyxFQUFFLE1BQU0sRUFBRSxZQUFZLENBQUM7SUFDMUYsZ0JBQWdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNoRCxnQkFBZ0IsR0FBRyxnQkFBZ0IsSUFBSSxTQUFTLENBQUM7SUFDakQsb0JBQW9CLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNwRDtJQUNBLG9CQUFvQixJQUFJLE9BQU8sR0FBRyxjQUFjLENBQUM7SUFDakQsb0JBQW9CLElBQUksT0FBTyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7SUFDOUMsb0JBQW9CLE9BQU8sQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDO0lBQzFDLG9CQUFvQixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ2pELGlCQUFpQjtJQUNqQjtJQUNBLG9CQUFvQixPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDNUQsYUFBYSxFQUFDO0lBQ2QsWUFBWSxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7SUFDdkQsU0FBUztJQUNULFFBQVEsV0FBVyxFQUFFLENBQUM7SUFDdEIsUUFBUSxVQUFVLEVBQUUsQ0FBQztJQUNyQjtJQUNBLFFBQVEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDOztJQUV2QyxLQUFLOztJQUVMLElBQUksYUFBYSxFQUFFLENBQUM7SUFDcEIsSUFBSSxXQUFXLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDOztJQUVuQztJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDO0FBQ0QsQUE4U0E7SUFDQTtBQUNBLElBQU8sU0FBUyxjQUFjLEVBQUU7O0lBRWhDLElBQUksSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO0lBQzVCO0lBQ0EsSUFBSSxHQUFHLFdBQVcsSUFBSSxLQUFLLENBQUM7SUFDNUIsUUFBUSxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzNCLFFBQVEsV0FBVyxFQUFFLENBQUM7SUFDdEI7SUFDQSxLQUFLO0lBQ0wsSUFBSSxHQUFHLFdBQVcsSUFBSSxJQUFJLENBQUM7SUFDM0IsUUFBUSxXQUFXLEdBQUcsS0FBSyxDQUFDO0lBQzVCLFFBQVEsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDbEMsWUFBWSxJQUFJLEVBQUUsR0FBRyxHQUFHLFVBQVU7SUFDbEM7SUFDQTtJQUNBLGVBQWUsT0FBTyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN0QyxhQUFhLEdBQUcsSUFBSSxHQUFHLElBQUk7SUFDM0IsU0FBUyxFQUFFLFNBQVMsT0FBTyxDQUFDO0lBQzVCO0lBQ0EsU0FBUyxDQUFDLENBQUM7SUFDWDtJQUNBLEtBQUs7SUFDTCxDQUFDO0FBQ0QsSUE4UkE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7O01BQUU7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyJ9
