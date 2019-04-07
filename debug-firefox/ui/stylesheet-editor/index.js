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

    /* malevic@0.11.6 - Mar 6, 2018 */

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

    function Body({ data, tab, actions }) {
        const host = getURLHost(tab.url);
        const custom = data.settings.customThemes.find(({ url }) => isURLInList(tab.url, url));
        let textNode;
        const placeholderText = [
            '* {',
            '    background-color: #234 !important',
            '    color: #cba !important',
            '}',
        ].join('\n');
        function onTextRender(node) {
            textNode = node;
            textNode.value = (custom ? custom.theme.stylesheet : data.settings.theme.stylesheet) || '';
            if (document.activeElement !== textNode) {
                textNode.focus();
            }
        }
        function applyStyleSheet(css) {
            if (custom) {
                custom.theme = { ...custom.theme, ...{ stylesheet: css } };
                actions.changeSettings({ customThemes: data.settings.customThemes });
            }
            else {
                actions.setTheme({ stylesheet: css });
            }
        }
        function reset() {
            applyStyleSheet('');
        }
        function apply() {
            const css = textNode.value;
            applyStyleSheet(css);
        }
        return (html("body", null,
            html("header", null,
                html("img", { id: "logo", src: "../assets/images/darkreader-type.svg", alt: "Illumify" }),
                html("h1", { id: "title" }, "CSS Editor")),
            html("h3", { id: "sub-title" }, custom ? host : 'All websites'),
            html("textarea", { id: "editor", native: true, placeholder: placeholderText, didmount: onTextRender, didupdate: onTextRender }),
            html("div", { id: "buttons" },
                html(Button, { onclick: reset }, "Reset"),
                html(Button, { onclick: apply }, "Apply"))));
    }

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

    function renderBody(data, tab, actions) {
        sync(document.body, html(Body, { data: data, tab: tab, actions: actions }));
    }
    async function start() {
        const connector = connect();
        window.addEventListener('unload', (e) => connector.disconnect());
        const data = await connector.getData();
        const tab = await connector.getActiveTabInfo();
        renderBody(data, tab, connector);
        connector.subscribeToChanges((data) => renderBody(data, tab, connector));
    }
    start();

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9tYWxldmljL2luZGV4LmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL21hbGV2aWMvc3RhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogbWFsZXZpY0AwLjExLjYgLSBNYXIgNiwgMjAxOCAqL1xuZnVuY3Rpb24gY2xhc3NlcyguLi5hcmdzKSB7XHJcbiAgICBjb25zdCBjbGFzc2VzID0gW107XHJcbiAgICBhcmdzLmZpbHRlcigoYykgPT4gQm9vbGVhbihjKSlcclxuICAgICAgICAuZm9yRWFjaCgoYykgPT4ge1xyXG4gICAgICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKGMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgYyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKC4uLk9iamVjdC5rZXlzKGMpXHJcbiAgICAgICAgICAgICAgICAuZmlsdGVyKChrZXkpID0+IEJvb2xlYW4oY1trZXldKSkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIGNsYXNzZXMuam9pbignICcpO1xyXG59XHJcbmZ1bmN0aW9uIHN0eWxlcyhkZWNsYXJhdGlvbnMpIHtcclxuICAgIHJldHVybiBPYmplY3Qua2V5cyhkZWNsYXJhdGlvbnMpXHJcbiAgICAgICAgLmZpbHRlcigoY3NzUHJvcCkgPT4gZGVjbGFyYXRpb25zW2Nzc1Byb3BdICE9IG51bGwpXHJcbiAgICAgICAgLm1hcCgoY3NzUHJvcCkgPT4gYCR7Y3NzUHJvcH06ICR7ZGVjbGFyYXRpb25zW2Nzc1Byb3BdfTtgKVxyXG4gICAgICAgIC5qb2luKCcgJyk7XHJcbn1cclxuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcclxuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9IG51bGw7XHJcbn1cclxuZnVuY3Rpb24gdG9BcnJheShvYmopIHtcclxuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChvYmopO1xyXG59XHJcbmZ1bmN0aW9uIGZsYXR0ZW4oYXJyKSB7XHJcbiAgICByZXR1cm4gYXJyLnJlZHVjZSgoZmxhdCwgdG9GbGF0dGVuKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIGZsYXQuY29uY2F0KEFycmF5LmlzQXJyYXkodG9GbGF0dGVuKSA/IGZsYXR0ZW4odG9GbGF0dGVuKSA6IHRvRmxhdHRlbik7XHJcbiAgICB9LCBbXSk7XHJcbn1cclxuZnVuY3Rpb24gaXNFbXB0eURlY2xhcmF0aW9uKGQpIHtcclxuICAgIHJldHVybiBkID09IG51bGwgfHwgZCA9PT0gJyc7XHJcbn1cclxuZnVuY3Rpb24gZmxhdHRlbkRlY2xhcmF0aW9ucyhkZWNsYXJhdGlvbnMsIGZ1bmNFeGVjdXRvcikge1xyXG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xyXG4gICAgZmxhdHRlbihkZWNsYXJhdGlvbnMpXHJcbiAgICAgICAgLmZvckVhY2goKGMpID0+IHtcclxuICAgICAgICBpZiAodHlwZW9mIGMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY29uc3QgciA9IGZ1bmNFeGVjdXRvcihjKTtcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocikpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCguLi5mbGF0dGVuKHIpLmZpbHRlcih4ID0+ICFpc0VtcHR5RGVjbGFyYXRpb24oeCkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIGlmICghaXNFbXB0eURlY2xhcmF0aW9uKHIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gocik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAoIWlzRW1wdHlEZWNsYXJhdGlvbihjKSkge1xyXG4gICAgICAgICAgICByZXN1bHRzLnB1c2goYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gcmVzdWx0cztcclxufVxuXG5mdW5jdGlvbiBodG1sKHRhZ09yQ29tcG9uZW50LCBhdHRycywgLi4uY2hpbGRyZW4pIHtcclxuICAgIGlmICh0eXBlb2YgdGFnT3JDb21wb25lbnQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgcmV0dXJuIHsgdGFnOiB0YWdPckNvbXBvbmVudCwgYXR0cnMsIGNoaWxkcmVuIH07XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHRhZ09yQ29tcG9uZW50ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgcmV0dXJuIHRhZ09yQ29tcG9uZW50KGF0dHJzID09IG51bGwgPyB1bmRlZmluZWQgOiBhdHRycywgLi4uZmxhdHRlbihjaGlsZHJlbikpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbn1cblxuY29uc3QgZGF0YUJpbmRpbmdzID0gbmV3IFdlYWtNYXAoKTtcclxuZnVuY3Rpb24gc2V0RGF0YShlbGVtZW50LCBkYXRhKSB7XHJcbiAgICBkYXRhQmluZGluZ3Muc2V0KGVsZW1lbnQsIGRhdGEpO1xyXG59XHJcbmZ1bmN0aW9uIGdldERhdGEoZWxlbWVudCkge1xyXG4gICAgcmV0dXJuIGRhdGFCaW5kaW5ncy5nZXQoZWxlbWVudCk7XHJcbn1cblxuY29uc3QgZXZlbnRMaXN0ZW5lcnMgPSBuZXcgV2Vha01hcCgpO1xyXG5mdW5jdGlvbiBhZGRMaXN0ZW5lcihlbGVtZW50LCBldmVudCwgbGlzdGVuZXIpIHtcclxuICAgIGxldCBsaXN0ZW5lcnM7XHJcbiAgICBpZiAoZXZlbnRMaXN0ZW5lcnMuaGFzKGVsZW1lbnQpKSB7XHJcbiAgICAgICAgbGlzdGVuZXJzID0gZXZlbnRMaXN0ZW5lcnMuZ2V0KGVsZW1lbnQpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgbGlzdGVuZXJzID0ge307XHJcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnMuc2V0KGVsZW1lbnQsIGxpc3RlbmVycyk7XHJcbiAgICB9XHJcbiAgICBpZiAobGlzdGVuZXJzW2V2ZW50XSAhPT0gbGlzdGVuZXIpIHtcclxuICAgICAgICBpZiAoZXZlbnQgaW4gbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXJzW2V2ZW50XSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICAgIGxpc3RlbmVyc1tldmVudF0gPSBsaXN0ZW5lcjtcclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiByZW1vdmVMaXN0ZW5lcihlbGVtZW50LCBldmVudCkge1xyXG4gICAgbGV0IGxpc3RlbmVycztcclxuICAgIGlmIChldmVudExpc3RlbmVycy5oYXMoZWxlbWVudCkpIHtcclxuICAgICAgICBsaXN0ZW5lcnMgPSBldmVudExpc3RlbmVycy5nZXQoZWxlbWVudCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAoZXZlbnQgaW4gbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcnNbZXZlbnRdKTtcclxuICAgICAgICBkZWxldGUgbGlzdGVuZXJzW2V2ZW50XTtcclxuICAgIH1cclxufVxuXG5mdW5jdGlvbiBjcmVhdGVQbHVnaW5zKCkge1xyXG4gICAgY29uc3QgcGx1Z2lucyA9IFtdO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBhZGQocGx1Z2luKSB7XHJcbiAgICAgICAgICAgIHBsdWdpbnMucHVzaChwbHVnaW4pO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGx5KHByb3BzKSB7XHJcbiAgICAgICAgICAgIGxldCByZXN1bHQ7XHJcbiAgICAgICAgICAgIGxldCBwbHVnaW47XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBwbHVnaW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgICAgICAgICBwbHVnaW4gPSBwbHVnaW5zW2ldO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gcGx1Z2luKHByb3BzKTtcclxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxuXG5jb25zdCBuYXRpdmVDb250YWluZXJzID0gbmV3IFdlYWtNYXAoKTtcclxuY29uc3QgbW91bnRlZEVsZW1lbnRzID0gbmV3IFdlYWtNYXAoKTtcclxuY29uc3QgZGlkTW91bnRIYW5kbGVycyA9IG5ldyBXZWFrTWFwKCk7XHJcbmNvbnN0IGRpZFVwZGF0ZUhhbmRsZXJzID0gbmV3IFdlYWtNYXAoKTtcclxuY29uc3Qgd2lsbFVubW91bnRIYW5kbGVycyA9IG5ldyBXZWFrTWFwKCk7XHJcbmNvbnN0IGxpZmVjeWNsZUhhbmRsZXJzID0ge1xyXG4gICAgJ2RpZG1vdW50JzogZGlkTW91bnRIYW5kbGVycyxcclxuICAgICdkaWR1cGRhdGUnOiBkaWRVcGRhdGVIYW5kbGVycyxcclxuICAgICd3aWxsdW5tb3VudCc6IHdpbGxVbm1vdW50SGFuZGxlcnNcclxufTtcclxuY29uc3QgWEhUTUxfTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCc7XHJcbmNvbnN0IFNWR19OUyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XHJcbmNvbnN0IHBsdWdpbnNDcmVhdGVOb2RlID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh7IGQsIHBhcmVudCB9KSA9PiB7XHJcbiAgICBpZiAoIWlzT2JqZWN0KGQpKSB7XHJcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGQgPT0gbnVsbCA/ICcnIDogU3RyaW5nKGQpKTtcclxuICAgIH1cclxuICAgIGlmIChkLnRhZyA9PT0gJ3N2ZycpIHtcclxuICAgICAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKFNWR19OUywgJ3N2ZycpO1xyXG4gICAgfVxyXG4gICAgaWYgKHBhcmVudC5uYW1lc3BhY2VVUkkgPT09IFhIVE1MX05TKSB7XHJcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoZC50YWcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhwYXJlbnQubmFtZXNwYWNlVVJJLCBkLnRhZyk7XHJcbn0pO1xyXG5jb25zdCBwbHVnaW5zTW91bnROb2RlID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh7IG5vZGUsIHBhcmVudCwgbmV4dCB9KSA9PiB7XHJcbiAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKG5vZGUsIG5leHQpO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbn0pO1xyXG5jb25zdCBwbHVnaW5zVW5tb3VudE5vZGUgPSBjcmVhdGVQbHVnaW5zKClcclxuICAgIC5hZGQoKHsgbm9kZSwgcGFyZW50IH0pID0+IHtcclxuICAgIHBhcmVudC5yZW1vdmVDaGlsZChub2RlKTtcclxuICAgIHJldHVybiB0cnVlO1xyXG59KTtcclxuY29uc3QgcGx1Z2luc1NldEF0dHJpYnV0ZSA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICBpZiAodmFsdWUgPT0gbnVsbCB8fCB2YWx1ZSA9PT0gZmFsc2UpIHtcclxuICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKGF0dHIsIHZhbHVlID09PSB0cnVlID8gJycgOiBTdHJpbmcodmFsdWUpKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG59KVxyXG4gICAgLmFkZCgoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICBpZiAoYXR0ci5pbmRleE9mKCdvbicpID09PSAwKSB7XHJcbiAgICAgICAgY29uc3QgZXZlbnQgPSBhdHRyLnN1YnN0cmluZygyKTtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGFkZExpc3RlbmVyKGVsZW1lbnQsIGV2ZW50LCB2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICByZW1vdmVMaXN0ZW5lcihlbGVtZW50LCBldmVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbn0pXHJcbiAgICAuYWRkKCh7IGVsZW1lbnQsIGF0dHIsIHZhbHVlIH0pID0+IHtcclxuICAgIGlmIChhdHRyID09PSAnbmF0aXZlJykge1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICBuYXRpdmVDb250YWluZXJzLnNldChlbGVtZW50LCB0cnVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIG5hdGl2ZUNvbnRhaW5lcnMuZGVsZXRlKGVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIGlmIChhdHRyIGluIGxpZmVjeWNsZUhhbmRsZXJzKSB7XHJcbiAgICAgICAgY29uc3QgaGFuZGxlcnMgPSBsaWZlY3ljbGVIYW5kbGVyc1thdHRyXTtcclxuICAgICAgICBpZiAodmFsdWUpIHtcclxuICAgICAgICAgICAgaGFuZGxlcnMuc2V0KGVsZW1lbnQsIHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGhhbmRsZXJzLmRlbGV0ZShlbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufSlcclxuICAgIC5hZGQoKHsgZWxlbWVudCwgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgaWYgKGF0dHIgPT09ICdkYXRhJykge1xyXG4gICAgICAgIHNldERhdGEoZWxlbWVudCwgdmFsdWUpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG51bGw7XHJcbn0pXHJcbiAgICAuYWRkKCh7IGVsZW1lbnQsIGF0dHIsIHZhbHVlIH0pID0+IHtcclxuICAgIGlmIChhdHRyID09PSAnY2xhc3MnICYmIGlzT2JqZWN0KHZhbHVlKSkge1xyXG4gICAgICAgIGxldCBjbHM7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgIGNscyA9IGNsYXNzZXMoLi4udmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY2xzID0gY2xhc3Nlcyh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjbHMpIHtcclxuICAgICAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgY2xzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdjbGFzcycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59KVxyXG4gICAgLmFkZCgoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICBpZiAoYXR0ciA9PT0gJ3N0eWxlJyAmJiBpc09iamVjdCh2YWx1ZSkpIHtcclxuICAgICAgICBjb25zdCBzdHlsZSA9IHN0eWxlcyh2YWx1ZSk7XHJcbiAgICAgICAgaWYgKHN0eWxlKSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdzdHlsZScsIHN0eWxlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdzdHlsZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59KTtcclxuY29uc3QgZWxlbWVudHNBdHRycyA9IG5ldyBXZWFrTWFwKCk7XHJcbmZ1bmN0aW9uIGdldEF0dHJzKGVsZW1lbnQpIHtcclxuICAgIHJldHVybiBlbGVtZW50c0F0dHJzLmdldChlbGVtZW50KSB8fCBudWxsO1xyXG59XHJcbmZ1bmN0aW9uIGNyZWF0ZU5vZGUoZCwgcGFyZW50LCBuZXh0KSB7XHJcbiAgICBjb25zdCBub2RlID0gcGx1Z2luc0NyZWF0ZU5vZGUuYXBwbHkoeyBkLCBwYXJlbnQgfSk7XHJcbiAgICBpZiAoaXNPYmplY3QoZCkpIHtcclxuICAgICAgICBjb25zdCBlbGVtZW50ID0gbm9kZTtcclxuICAgICAgICBjb25zdCBlbGVtZW50QXR0cnMgPSB7fTtcclxuICAgICAgICBlbGVtZW50c0F0dHJzLnNldChlbGVtZW50LCBlbGVtZW50QXR0cnMpO1xyXG4gICAgICAgIGlmIChkLmF0dHJzKSB7XHJcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGQuYXR0cnMpLmZvckVhY2goKGF0dHIpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gZC5hdHRyc1thdHRyXTtcclxuICAgICAgICAgICAgICAgIHBsdWdpbnNTZXRBdHRyaWJ1dGUuYXBwbHkoeyBlbGVtZW50LCBhdHRyLCB2YWx1ZSB9KTtcclxuICAgICAgICAgICAgICAgIGVsZW1lbnRBdHRyc1thdHRyXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBwbHVnaW5zTW91bnROb2RlLmFwcGx5KHsgbm9kZSwgcGFyZW50LCBuZXh0IH0pO1xyXG4gICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBFbGVtZW50ICYmIGRpZE1vdW50SGFuZGxlcnMuaGFzKG5vZGUpKSB7XHJcbiAgICAgICAgZGlkTW91bnRIYW5kbGVycy5nZXQobm9kZSkobm9kZSk7XHJcbiAgICAgICAgbW91bnRlZEVsZW1lbnRzLnNldChub2RlLCB0cnVlKTtcclxuICAgIH1cclxuICAgIGlmIChpc09iamVjdChkKSAmJiBub2RlIGluc3RhbmNlb2YgRWxlbWVudCAmJiAhbmF0aXZlQ29udGFpbmVycy5oYXMobm9kZSkpIHtcclxuICAgICAgICBzeW5jQ2hpbGROb2RlcyhkLCBub2RlKTtcclxuICAgIH1cclxuICAgIHJldHVybiBub2RlO1xyXG59XHJcbmZ1bmN0aW9uIGNvbGxlY3RBdHRycyhlbGVtZW50KSB7XHJcbiAgICByZXR1cm4gdG9BcnJheShlbGVtZW50LmF0dHJpYnV0ZXMpXHJcbiAgICAgICAgLnJlZHVjZSgob2JqLCB7IG5hbWUsIHZhbHVlIH0pID0+IHtcclxuICAgICAgICBvYmpbbmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICByZXR1cm4gb2JqO1xyXG4gICAgfSwge30pO1xyXG59XHJcbmZ1bmN0aW9uIHN5bmNOb2RlKGQsIGV4aXN0aW5nKSB7XHJcbiAgICBpZiAoaXNPYmplY3QoZCkpIHtcclxuICAgICAgICBjb25zdCBlbGVtZW50ID0gZXhpc3Rpbmc7XHJcbiAgICAgICAgY29uc3QgYXR0cnMgPSBkLmF0dHJzIHx8IHt9O1xyXG4gICAgICAgIGxldCBleGlzdGluZ0F0dHJzID0gZ2V0QXR0cnMoZWxlbWVudCk7XHJcbiAgICAgICAgaWYgKCFleGlzdGluZ0F0dHJzKSB7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nQXR0cnMgPSBjb2xsZWN0QXR0cnMoZWxlbWVudCk7XHJcbiAgICAgICAgICAgIGVsZW1lbnRzQXR0cnMuc2V0KGVsZW1lbnQsIGV4aXN0aW5nQXR0cnMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBPYmplY3Qua2V5cyhleGlzdGluZ0F0dHJzKS5mb3JFYWNoKChhdHRyKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghKGF0dHIgaW4gYXR0cnMpKSB7XHJcbiAgICAgICAgICAgICAgICBwbHVnaW5zU2V0QXR0cmlidXRlLmFwcGx5KHsgZWxlbWVudCwgYXR0ciwgdmFsdWU6IG51bGwgfSk7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgZXhpc3RpbmdBdHRyc1thdHRyXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIE9iamVjdC5rZXlzKGF0dHJzKS5mb3JFYWNoKChhdHRyKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXR0cnNbYXR0cl07XHJcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0F0dHJzW2F0dHJdICE9PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgcGx1Z2luc1NldEF0dHJpYnV0ZS5hcHBseSh7IGVsZW1lbnQsIGF0dHIsIHZhbHVlIH0pO1xyXG4gICAgICAgICAgICAgICAgZXhpc3RpbmdBdHRyc1thdHRyXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKGRpZE1vdW50SGFuZGxlcnMuaGFzKGVsZW1lbnQpICYmICFtb3VudGVkRWxlbWVudHMuaGFzKGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICAgIGRpZE1vdW50SGFuZGxlcnMuZ2V0KGVsZW1lbnQpKGVsZW1lbnQpO1xyXG4gICAgICAgICAgICBtb3VudGVkRWxlbWVudHMuc2V0KGVsZW1lbnQsIHRydWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChkaWRVcGRhdGVIYW5kbGVycy5oYXMoZWxlbWVudCkpIHtcclxuICAgICAgICAgICAgZGlkVXBkYXRlSGFuZGxlcnMuZ2V0KGVsZW1lbnQpKGVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIW5hdGl2ZUNvbnRhaW5lcnMuaGFzKGVsZW1lbnQpKSB7XHJcbiAgICAgICAgICAgIHN5bmNDaGlsZE5vZGVzKGQsIGVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGV4aXN0aW5nLnRleHRDb250ZW50ID0gZCA9PSBudWxsID8gJycgOiBTdHJpbmcoZCk7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gcmVtb3ZlTm9kZShub2RlLCBwYXJlbnQpIHtcclxuICAgIGlmIChub2RlIGluc3RhbmNlb2YgRWxlbWVudCAmJiB3aWxsVW5tb3VudEhhbmRsZXJzLmhhcyhub2RlKSkge1xyXG4gICAgICAgIHdpbGxVbm1vdW50SGFuZGxlcnMuZ2V0KG5vZGUpKG5vZGUpO1xyXG4gICAgfVxyXG4gICAgcGx1Z2luc1VubW91bnROb2RlLmFwcGx5KHsgbm9kZSwgcGFyZW50IH0pO1xyXG59XHJcbmNvbnN0IHBsdWdpbnNNYXRjaE5vZGVzID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh7IGQsIGVsZW1lbnQgfSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlcyA9IFtdO1xyXG4gICAgY29uc3QgZGVjbGFyYXRpb25zID0gQXJyYXkuaXNBcnJheShkLmNoaWxkcmVuKSA/IGZsYXR0ZW5EZWNsYXJhdGlvbnMoZC5jaGlsZHJlbiwgKGZuKSA9PiBmbihlbGVtZW50KSkgOiBbXTtcclxuICAgIGxldCBub2RlSW5kZXggPSAwO1xyXG4gICAgZGVjbGFyYXRpb25zLmZvckVhY2goKGQpID0+IHtcclxuICAgICAgICBjb25zdCBpc0VsZW1lbnQgPSBpc09iamVjdChkKTtcclxuICAgICAgICBjb25zdCBpc1RleHQgPSAhaXNFbGVtZW50O1xyXG4gICAgICAgIGxldCBmb3VuZCA9IG51bGw7XHJcbiAgICAgICAgbGV0IG5vZGUgPSBudWxsO1xyXG4gICAgICAgIGZvciAoOyBub2RlSW5kZXggPCBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBub2RlSW5kZXgrKykge1xyXG4gICAgICAgICAgICBub2RlID0gZWxlbWVudC5jaGlsZE5vZGVzLml0ZW0obm9kZUluZGV4KTtcclxuICAgICAgICAgICAgaWYgKGlzVGV4dCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBFbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3VuZCA9IG5vZGU7XHJcbiAgICAgICAgICAgICAgICAgICAgbm9kZUluZGV4Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGlzRWxlbWVudCAmJiBub2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG5vZGUudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBkLnRhZykge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvdW5kID0gbm9kZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIG5vZGVJbmRleCsrO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgbWF0Y2hlcy5wdXNoKFtkLCBmb3VuZF0pO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbWF0Y2hlcztcclxufSk7XHJcbmZ1bmN0aW9uIGNvbW1pdChtYXRjaGVzLCBlbGVtZW50KSB7XHJcbiAgICBjb25zdCBtYXRjaGVkTm9kZXMgPSBuZXcgU2V0KCk7XHJcbiAgICBtYXRjaGVzLm1hcCgoWywgbm9kZV0pID0+IG5vZGUpXHJcbiAgICAgICAgLmZpbHRlcigobm9kZSkgPT4gbm9kZSlcclxuICAgICAgICAuZm9yRWFjaCgobm9kZSkgPT4gbWF0Y2hlZE5vZGVzLmFkZChub2RlKSk7XHJcbiAgICB0b0FycmF5KGVsZW1lbnQuY2hpbGROb2RlcylcclxuICAgICAgICAuZmlsdGVyKChub2RlKSA9PiAhbWF0Y2hlZE5vZGVzLmhhcyhub2RlKSlcclxuICAgICAgICAuZm9yRWFjaCgobm9kZSkgPT4gcmVtb3ZlTm9kZShub2RlLCBlbGVtZW50KSk7XHJcbiAgICBsZXQgcHJldk5vZGUgPSBudWxsO1xyXG4gICAgbWF0Y2hlcy5mb3JFYWNoKChbZCwgbm9kZV0sIGkpID0+IHtcclxuICAgICAgICBpZiAobm9kZSkge1xyXG4gICAgICAgICAgICBzeW5jTm9kZShkLCBub2RlKTtcclxuICAgICAgICAgICAgcHJldk5vZGUgPSBub2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgbmV4dFNpYmxpbmcgPSAocHJldk5vZGUgP1xyXG4gICAgICAgICAgICAgICAgcHJldk5vZGUubmV4dFNpYmxpbmcgOlxyXG4gICAgICAgICAgICAgICAgKGkgPT09IDAgPyBlbGVtZW50LmZpcnN0Q2hpbGQgOiBudWxsKSk7XHJcbiAgICAgICAgICAgIHByZXZOb2RlID0gY3JlYXRlTm9kZShkLCBlbGVtZW50LCBuZXh0U2libGluZyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuZnVuY3Rpb24gc3luY0NoaWxkTm9kZXMoZCwgZWxlbWVudCkge1xyXG4gICAgY29uc3QgbWF0Y2hlcyA9IHBsdWdpbnNNYXRjaE5vZGVzLmFwcGx5KHsgZCwgZWxlbWVudCB9KTtcclxuICAgIGNvbW1pdChtYXRjaGVzLCBlbGVtZW50KTtcclxufVxyXG5mdW5jdGlvbiByZW5kZXIodGFyZ2V0LCBkZWNsYXJhdGlvbikge1xyXG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dyb25nIHJlbmRlcmluZyB0YXJnZXQnKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHRlbXAgPSB7XHJcbiAgICAgICAgdGFnOiB0YXJnZXQudGFnTmFtZS50b0xvd2VyQ2FzZSgpLFxyXG4gICAgICAgIGF0dHJzOiBjb2xsZWN0QXR0cnModGFyZ2V0KSxcclxuICAgICAgICBjaGlsZHJlbjogQXJyYXkuaXNBcnJheShkZWNsYXJhdGlvbikgPyBkZWNsYXJhdGlvbiA6IFtkZWNsYXJhdGlvbl1cclxuICAgIH07XHJcbiAgICBzeW5jQ2hpbGROb2Rlcyh0ZW1wLCB0YXJnZXQpO1xyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoZGVjbGFyYXRpb24pID9cclxuICAgICAgICB0b0FycmF5KHRhcmdldC5jaGlsZE5vZGVzKSA6XHJcbiAgICAgICAgaXNPYmplY3QoZGVjbGFyYXRpb24pID9cclxuICAgICAgICAgICAgdGFyZ2V0LmZpcnN0RWxlbWVudENoaWxkIDpcclxuICAgICAgICAgICAgdGFyZ2V0LmZpcnN0Q2hpbGQ7XHJcbn1cclxuZnVuY3Rpb24gc3luYyh0YXJnZXQsIGRlY2xhcmF0aW9uT3JGbikge1xyXG4gICAgY29uc3QgZGVjbGFyYXRpb24gPSB0eXBlb2YgZGVjbGFyYXRpb25PckZuID09PSAnZnVuY3Rpb24nID8gZGVjbGFyYXRpb25PckZuKHRhcmdldC5wYXJlbnRFbGVtZW50KSA6IGRlY2xhcmF0aW9uT3JGbjtcclxuICAgIGNvbnN0IGlzRWxlbWVudCA9IGlzT2JqZWN0KGRlY2xhcmF0aW9uKTtcclxuICAgIGlmICghKCghaXNFbGVtZW50ICYmIHRhcmdldCBpbnN0YW5jZW9mIFRleHQpIHx8XHJcbiAgICAgICAgKGlzRWxlbWVudCAmJiB0YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50ICYmIHRhcmdldC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IGRlY2xhcmF0aW9uLnRhZykpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXcm9uZyBzeW5jIHRhcmdldCcpO1xyXG4gICAgfVxyXG4gICAgc3luY05vZGUoZGVjbGFyYXRpb24sIHRhcmdldCk7XHJcbiAgICByZXR1cm4gdGFyZ2V0O1xyXG59XG5cbmNvbnN0IHBsdWdpbnNJc1ZvaWRUYWcgPSBjcmVhdGVQbHVnaW5zKClcclxuICAgIC5hZGQoKHRhZykgPT4gdGFnIGluIFZPSURfVEFHUyk7XHJcbmNvbnN0IHBsdWdpbnNTa2lwQXR0ciA9IGNyZWF0ZVBsdWdpbnMoKVxyXG4gICAgLmFkZCgoeyB2YWx1ZSB9KSA9PiAodmFsdWUgPT0gbnVsbCB8fCB2YWx1ZSA9PT0gZmFsc2UpKVxyXG4gICAgLmFkZCgoeyBhdHRyIH0pID0+ICgoW1xyXG4gICAgJ2RhdGEnLFxyXG4gICAgJ25hdGl2ZScsXHJcbiAgICAnZGlkbW91bnQnLFxyXG4gICAgJ2RpZHVwZGF0ZScsXHJcbiAgICAnd2lsbHVubW91bnQnLFxyXG5dLmluZGV4T2YoYXR0cikgPj0gMCB8fFxyXG4gICAgYXR0ci5pbmRleE9mKCdvbicpID09PSAwKSA/IHRydWUgOiBudWxsKSk7XHJcbmZ1bmN0aW9uIGVzY2FwZUh0bWwocykge1xyXG4gICAgcmV0dXJuIFN0cmluZyhzKVxyXG4gICAgICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcbiAgICAgICAgLnJlcGxhY2UoLzwvZywgJyZsdDsnKVxyXG4gICAgICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcclxuICAgICAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcbiAgICAgICAgLnJlcGxhY2UoLycvZywgJyYjMDM5OycpO1xyXG59XHJcbmNvbnN0IHBsdWdpbnNTdHJpbmdpZnlBdHRyID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh7IHZhbHVlIH0pID0+IHZhbHVlID09PSB0cnVlID8gJycgOiBlc2NhcGVIdG1sKHZhbHVlKSlcclxuICAgIC5hZGQoKHsgYXR0ciwgdmFsdWUgfSkgPT4ge1xyXG4gICAgaWYgKGF0dHIgPT09ICdjbGFzcycgJiYgaXNPYmplY3QodmFsdWUpKSB7XHJcbiAgICAgICAgbGV0IGNscztcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgICAgY2xzID0gY2xhc3NlcyguLi52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjbHMgPSBjbGFzc2VzKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGVzY2FwZUh0bWwoY2xzKTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59KVxyXG4gICAgLmFkZCgoeyBhdHRyLCB2YWx1ZSB9KSA9PiB7XHJcbiAgICBpZiAoYXR0ciA9PT0gJ3N0eWxlJyAmJiBpc09iamVjdCh2YWx1ZSkpIHtcclxuICAgICAgICByZXR1cm4gZXNjYXBlSHRtbChzdHlsZXModmFsdWUpKTtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59KTtcclxuY29uc3QgcGx1Z2luc1Byb2Nlc3NUZXh0ID0gY3JlYXRlUGx1Z2lucygpXHJcbiAgICAuYWRkKCh0ZXh0KSA9PiBlc2NhcGVIdG1sKHRleHQpKTtcclxuZnVuY3Rpb24gYnVpbGRIdG1sKGQsIHRhYnMpIHtcclxuICAgIGNvbnN0IHRhZyA9IGQudGFnO1xyXG4gICAgY29uc3QgYXR0cnMgPSBkLmF0dHJzID09IG51bGwgPyAnJyA6IE9iamVjdC5rZXlzKGQuYXR0cnMpXHJcbiAgICAgICAgLmZpbHRlcigoa2V5KSA9PiAhcGx1Z2luc1NraXBBdHRyLmFwcGx5KHsgYXR0cjoga2V5LCB2YWx1ZTogZC5hdHRyc1trZXldIH0pKVxyXG4gICAgICAgIC5tYXAoKGtleSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGx1Z2luc1N0cmluZ2lmeUF0dHIuYXBwbHkoeyBhdHRyOiBrZXksIHZhbHVlOiBkLmF0dHJzW2tleV0gfSk7XHJcbiAgICAgICAgaWYgKHZhbHVlID09PSAnJykge1xyXG4gICAgICAgICAgICByZXR1cm4gYCAke2tleX1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYCAke2tleX09XCIke3ZhbHVlfVwiYDtcclxuICAgIH0pXHJcbiAgICAgICAgLmpvaW4oJycpO1xyXG4gICAgY29uc3QgaXNWb2lkVGFnID0gcGx1Z2luc0lzVm9pZFRhZy5hcHBseSh0YWcpO1xyXG4gICAgaWYgKGlzVm9pZFRhZykge1xyXG4gICAgICAgIHJldHVybiBgJHt0YWJzfTwke3RhZ30ke2F0dHJzfS8+YDtcclxuICAgIH1cclxuICAgIGxldCBodG1sVGV4dCA9IGAke3RhYnN9PCR7dGFnfSR7YXR0cnN9PmA7XHJcbiAgICBsZXQgc2hvdWxkSW5kZW50Q2xvc2luZ1RhZyA9IGZhbHNlO1xyXG4gICAgZmxhdHRlbkRlY2xhcmF0aW9ucyhkLmNoaWxkcmVuLCBleGVjdXRlQ2hpbGRGbilcclxuICAgICAgICAuZm9yRWFjaCgoYykgPT4ge1xyXG4gICAgICAgIGlmIChpc09iamVjdChjKSkge1xyXG4gICAgICAgICAgICBzaG91bGRJbmRlbnRDbG9zaW5nVGFnID0gdHJ1ZTtcclxuICAgICAgICAgICAgaHRtbFRleHQgKz0gYFxcbiR7YnVpbGRIdG1sKGMsIGAke3RhYnN9ICAgIGApfWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBodG1sVGV4dCArPSBwbHVnaW5zUHJvY2Vzc1RleHQuYXBwbHkoYyk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBpZiAoc2hvdWxkSW5kZW50Q2xvc2luZ1RhZykge1xyXG4gICAgICAgIGh0bWxUZXh0ICs9IGBcXG4ke3RhYnN9YDtcclxuICAgIH1cclxuICAgIGh0bWxUZXh0ICs9IGA8LyR7ZC50YWd9PmA7XHJcbiAgICByZXR1cm4gaHRtbFRleHQ7XHJcbn1cclxuZnVuY3Rpb24gZXhlY3V0ZUNoaWxkRm4oZm4pIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgcmV0dXJuIGZuKHt9KTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiByZW5kZXJUb1N0cmluZyhkZWNsYXJhdGlvbk9yRm4pIHtcclxuICAgIGNvbnN0IGRlY2xhcmF0aW9uID0gdHlwZW9mIGRlY2xhcmF0aW9uT3JGbiA9PT0gJ2Z1bmN0aW9uJyA/IGV4ZWN1dGVDaGlsZEZuKGRlY2xhcmF0aW9uT3JGbikgOiBkZWNsYXJhdGlvbk9yRm47XHJcbiAgICBpZiAoaXNPYmplY3QoZGVjbGFyYXRpb24pKSB7XHJcbiAgICAgICAgcmV0dXJuIGJ1aWxkSHRtbChkZWNsYXJhdGlvbiwgJycpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBsdWdpbnNQcm9jZXNzVGV4dC5hcHBseShkZWNsYXJhdGlvbik7XHJcbn1cclxuY29uc3QgVk9JRF9UQUdTID0gW1xyXG4gICAgJ2FyZWEnLFxyXG4gICAgJ2Jhc2UnLFxyXG4gICAgJ2Jhc2Vmb250JyxcclxuICAgICdiZ3NvdW5kJyxcclxuICAgICdicicsXHJcbiAgICAnY29sJyxcclxuICAgICdjb21tYW5kJyxcclxuICAgICdlbWJlZCcsXHJcbiAgICAnZnJhbWUnLFxyXG4gICAgJ2hyJyxcclxuICAgICdpbWcnLFxyXG4gICAgJ2ltYWdlJyxcclxuICAgICdpbnB1dCcsXHJcbiAgICAnaXNpbmRleCcsXHJcbiAgICAna2V5Z2VuJyxcclxuICAgICdsaW5rJyxcclxuICAgICdtZW51aXRlbScsXHJcbiAgICAnbWV0YScsXHJcbiAgICAnbmV4dGlkJyxcclxuICAgICdwYXJhbScsXHJcbiAgICAnc291cmNlJyxcclxuICAgICd0cmFjaycsXHJcbiAgICAnd2JyJyxcclxuICAgICdjaXJjbGUnLFxyXG4gICAgJ2VsbGlwc2UnLFxyXG4gICAgJ2ltYWdlJyxcclxuICAgICdsaW5lJyxcclxuICAgICdwYXRoJyxcclxuICAgICdwb2x5Z29uJyxcclxuICAgICdyZWN0JyxcclxuXS5yZWR1Y2UoKG1hcCwgdGFnKSA9PiAobWFwW3RhZ10gPSB0cnVlLCBtYXApLCB7fSk7XG5cbmNvbnN0IHBsdWdpbnMgPSB7XHJcbiAgICByZW5kZXI6IHtcclxuICAgICAgICBjcmVhdGVOb2RlOiBwbHVnaW5zQ3JlYXRlTm9kZSxcclxuICAgICAgICBtYXRjaE5vZGVzOiBwbHVnaW5zTWF0Y2hOb2RlcyxcclxuICAgICAgICBtb3VudE5vZGU6IHBsdWdpbnNNb3VudE5vZGUsXHJcbiAgICAgICAgc2V0QXR0cmlidXRlOiBwbHVnaW5zU2V0QXR0cmlidXRlLFxyXG4gICAgICAgIHVubW91bnROb2RlOiBwbHVnaW5zVW5tb3VudE5vZGUsXHJcbiAgICB9LFxyXG4gICAgc3RhdGljOiB7XHJcbiAgICAgICAgaXNWb2lkVGFnOiBwbHVnaW5zSXNWb2lkVGFnLFxyXG4gICAgICAgIHByb2Nlc3NUZXh0OiBwbHVnaW5zUHJvY2Vzc1RleHQsXHJcbiAgICAgICAgc2tpcEF0dHI6IHBsdWdpbnNTa2lwQXR0cixcclxuICAgICAgICBzdHJpbmdpZnlBdHRyOiBwbHVnaW5zU3RyaW5naWZ5QXR0cixcclxuICAgIH1cclxufTtcblxuZXhwb3J0IHsgcGx1Z2lucywgaHRtbCwgcmVuZGVyLCBzeW5jLCBnZXRBdHRycywgY2xhc3Nlcywgc3R5bGVzLCBnZXREYXRhLCByZW5kZXJUb1N0cmluZywgZXNjYXBlSHRtbCB9O1xuIiwiLyogbWFsZXZpY0AwLjExLjYgLSBNYXIgNiwgMjAxOCAqL1xuaW1wb3J0IHsgc3luYyB9IGZyb20gJ21hbGV2aWMnO1xuXG5sZXQgY29tcG9uZW50c0NvdW50ZXIgPSAwO1xyXG5mdW5jdGlvbiB3aXRoU3RhdGUoZm4sIGluaXRpYWxTdGF0ZSA9IHt9KSB7XHJcbiAgICBjb25zdCBwYXJlbnRzU3RhdGVzID0gbmV3IFdlYWtNYXAoKTtcclxuICAgIGNvbnN0IGRlZmF1bHRLZXkgPSBgc3RhdGUtJHtjb21wb25lbnRzQ291bnRlcisrfWA7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKGF0dHJzID0ge30sIC4uLmNoaWxkcmVuKSB7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gYXR0cnMua2V5ID09IG51bGwgPyBkZWZhdWx0S2V5IDogYXR0cnMua2V5O1xyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAocGFyZW50RG9tTm9kZSkge1xyXG4gICAgICAgICAgICBsZXQgc3RhdGVzO1xyXG4gICAgICAgICAgICBpZiAocGFyZW50c1N0YXRlcy5oYXMocGFyZW50RG9tTm9kZSkpIHtcclxuICAgICAgICAgICAgICAgIHN0YXRlcyA9IHBhcmVudHNTdGF0ZXMuZ2V0KHBhcmVudERvbU5vZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3RhdGVzID0gbmV3IE1hcCgpO1xyXG4gICAgICAgICAgICAgICAgcGFyZW50c1N0YXRlcy5zZXQocGFyZW50RG9tTm9kZSwgc3RhdGVzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsZXQgbWF0Y2g7XHJcbiAgICAgICAgICAgIGlmIChzdGF0ZXMuaGFzKGtleSkpIHtcclxuICAgICAgICAgICAgICAgIG1hdGNoID0gc3RhdGVzLmdldChrZXkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbWF0Y2ggPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbm9kZTogbnVsbCxcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZTogaW5pdGlhbFN0YXRlLFxyXG4gICAgICAgICAgICAgICAgICAgIGF0dHJzOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXSxcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBzdGF0ZXMuc2V0KGtleSwgbWF0Y2gpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG1hdGNoLmF0dHJzID0gYXR0cnM7XHJcbiAgICAgICAgICAgIG1hdGNoLmNoaWxkcmVuID0gY2hpbGRyZW47XHJcbiAgICAgICAgICAgIGxldCBjYWxsaW5nQ29tcG9uZW50ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIGludm9rZUNvbXBvbmVudEZuKHN0YXRlLCBhdHRycywgY2hpbGRyZW4pIHtcclxuICAgICAgICAgICAgICAgIGNhbGxpbmdDb21wb25lbnQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGVjbGFyYXRpb24gPSBmbihPYmplY3QuYXNzaWduKHt9LCBhdHRycywgeyBzdGF0ZSwgc2V0U3RhdGUgfSksIC4uLmNoaWxkcmVuKTtcclxuICAgICAgICAgICAgICAgIGNhbGxpbmdDb21wb25lbnQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGRlY2xhcmF0aW9uLmF0dHJzID0gZGVjbGFyYXRpb24uYXR0cnMgfHwge307XHJcbiAgICAgICAgICAgICAgICBjb25zdCBvbGREaWRNb3VudCA9IGRlY2xhcmF0aW9uLmF0dHJzLmRpZG1vdW50O1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkRGlkVXBkYXRlID0gZGVjbGFyYXRpb24uYXR0cnMuZGlkdXBkYXRlO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb2xkV2lsbFVubW91bnQgPSBkZWNsYXJhdGlvbi5hdHRycy5vbGREaWRVbm1vdW50O1xyXG4gICAgICAgICAgICAgICAgZGVjbGFyYXRpb24uYXR0cnMuZGlkbW91bnQgPSBmdW5jdGlvbiAoZG9tTm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlcy5nZXQoa2V5KS5ub2RlID0gZG9tTm9kZTtcclxuICAgICAgICAgICAgICAgICAgICBvbGREaWRNb3VudCAmJiBvbGREaWRNb3VudChkb21Ob2RlKTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBkZWNsYXJhdGlvbi5hdHRycy5kaWR1cGRhdGUgPSBmdW5jdGlvbiAoZG9tTm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0YXRlcy5nZXQoa2V5KS5ub2RlID0gZG9tTm9kZTtcclxuICAgICAgICAgICAgICAgICAgICBvbGREaWRVcGRhdGUgJiYgb2xkRGlkVXBkYXRlKGRvbU5vZGUpO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgIGRlY2xhcmF0aW9uLmF0dHJzLndpbGx1bm1vdW50ID0gZnVuY3Rpb24gKGRvbU5vZGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGF0ZXMuZGVsZXRlKGtleSk7XHJcbiAgICAgICAgICAgICAgICAgICAgb2xkV2lsbFVubW91bnQgJiYgb2xkV2lsbFVubW91bnQoZG9tTm9kZSk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlY2xhcmF0aW9uO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uIHNldFN0YXRlKG5ld1N0YXRlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGluZ0NvbXBvbmVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FsbGluZyBgc2V0U3RhdGVgIGluc2lkZSBjb21wb25lbnQgZnVuY3Rpb24gbGVhZHMgdG8gaW5maW5pdGUgcmVjdXJzaW9uJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IHN0YXRlcy5nZXQoa2V5KTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG1lcmdlZCA9IE9iamVjdC5hc3NpZ24oe30sIG1hdGNoLnN0YXRlLCBuZXdTdGF0ZSk7XHJcbiAgICAgICAgICAgICAgICBtYXRjaC5zdGF0ZSA9IG1lcmdlZDtcclxuICAgICAgICAgICAgICAgIHN5bmMobWF0Y2gubm9kZSwgaW52b2tlQ29tcG9uZW50Rm4obWVyZ2VkLCBtYXRjaC5hdHRycywgbWF0Y2guY2hpbGRyZW4pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gaW52b2tlQ29tcG9uZW50Rm4obWF0Y2guc3RhdGUsIG1hdGNoLmF0dHJzLCBtYXRjaC5jaGlsZHJlbik7XHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcbn1cblxuZXhwb3J0IGRlZmF1bHQgd2l0aFN0YXRlO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztJQUFBO0lBQ0EsU0FBUyxPQUFPLENBQUMsR0FBRyxJQUFJLEVBQUU7SUFDMUIsSUFBSSxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDdkIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQyxTQUFTLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSztJQUN4QixRQUFRLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO0lBQ25DLFlBQVksT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixTQUFTO0lBQ1QsYUFBYSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsRUFBRTtJQUN4QyxZQUFZLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxQyxpQkFBaUIsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkQsU0FBUztJQUNULEtBQUssQ0FBQyxDQUFDO0lBQ1AsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUNELFNBQVMsTUFBTSxDQUFDLFlBQVksRUFBRTtJQUM5QixJQUFJLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDcEMsU0FBUyxNQUFNLENBQUMsQ0FBQyxPQUFPLEtBQUssWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQztJQUMzRCxTQUFTLEdBQUcsQ0FBQyxDQUFDLE9BQU8sS0FBSyxDQUFDLEVBQUUsT0FB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LElBQUksU0FBUztJQUNiLElBQUksT0FBTztJQUNYLElBQUksT0FBTztJQUNYLElBQUksSUFBSTtJQUNSLElBQUksS0FBSztJQUNULElBQUksT0FBTztJQUNYLElBQUksT0FBTztJQUNYLElBQUksU0FBUztJQUNiLElBQUksUUFBUTtJQUNaLElBQUksTUFBTTtJQUNWLElBQUksVUFBVTtJQUNkLElBQUksTUFBTTtJQUNWLElBQUksUUFBUTtJQUNaLElBQUksT0FBTztJQUNYLElBQUksUUFBUTtJQUNaLElBQUksT0FBTztJQUNYLElBQUksS0FBSztJQUNULElBQUksUUFBUTtJQUNaLElBQUksU0FBUztJQUNiLElBQUksT0FBTztJQUNYLElBQUksTUFBTTtJQUNWLElBQUksTUFBTTtJQUNWLElBQUksU0FBUztJQUNiLElBQUksTUFBTTtJQUNWLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7O0lBRW5ELE1BQU0sT0FBTyxHQUFHO0lBQ2hCLElBQUksTUFBTSxFQUFFO0lBQ1osUUFBUSxVQUFVLEVBQUUsaUJBQWlCO0lBQ3JDLFFBQVEsVUFBVSxFQUFFLGlCQUFpQjtJQUNyQyxRQUFRLFNBQVMsRUFBRSxnQkFBZ0I7SUFDbkMsUUFBUSxZQUFZLEVBQUUsbUJBQW1CO0lBQ3pDLFFBQVEsV0FBVyxFQUFFLGtCQUFrQjtJQUN2QyxLQUFLO0lBQ0wsSUFBSSxNQUFNLEVBQUU7SUFDWixRQUFRLFNBQVMsRUFBRSxnQkFBZ0I7SUFDbkMsUUFBUSxXQUFXLEVBQUUsa0JBQWtCO0lBQ3ZDLFFBQVEsUUFBUSxFQUFFLGVBQWU7SUFDakMsUUFBUSxhQUFhLEVBQUUsb0JBQW9CO0lBQzNDLEtBQUs7SUFDTCxDQUFDLENBQUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lDdGlCRixrQ0FBa0M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
