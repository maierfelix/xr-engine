const PIXEL_RATIO = (() => {
  let ctx = document.createElement("canvas").getContext("2d");
  let dpr = window.devicePixelRatio || 1;
  let bsr = (
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio || 1
  );
  let ratio = dpr / bsr;
  return (ratio);
})();

function nextPowerOfTwo(n) {
  if (n === 0) return 1;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  return n + 1;
};

function getAspectRatio(x, y) {
  let xx = x;
  let yy = y;
  if (yy > xx) {
    let t = xx;
    xx = yy;
    yy = t;
  }
  while (yy !== 0) {
    let m = xx % yy;
    xx = yy;
    yy = m;
  };
  return { x: x / xx, y: y / xx };
};

function getNodePosition(node) {
  let x = 0;
  let y = 0;
  let depth = 0;
  while (node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
    depth++;
  };
  return {
    depth,
    x: x + node.offsetLeft,
    y: y + node.offsetTop,
    width: node.offsetWidth + x,
    height: node.offsetHeight + y
  };
};

function getCSSSelectorFromStyle(style) {
  return css(style).stylesheet.rules[0].selectors[0];
}

function getCSSStyles(el) {
  let sheets = document.styleSheets;
  let out = [];
  for (let ii in sheets) {
    let rules = sheets[ii].rules || sheets[ii].cssRules;
    for (let jj in rules) {
      let {selectorText} = rules[jj];
      if (el.matches(selectorText) && out.indexOf(selectorText) <= -1) {
        out.push(getCSSSelectorFromStyle(rules[jj].cssText));
      }
    };
  };
  return out;
};

function getAbsoluteElementBoundings(element) {
  let rect = element.getBoundingClientRect();
  let style = window.getComputedStyle(element);
  let margin = {
    top: parseFloat(style.marginTop),
    bottom: parseFloat(style.marginBottom),
    left: parseFloat(style.marginLeft),
    right: parseFloat(style.marginRight)
  };
  let out = {
    left: rect.left + margin.left,
    top: rect.top + margin.top,
    width: rect.width + margin.right + margin.left,
    height: rect.height + margin.bottom + margin.top
  };
  return out;
};

class DirtyRectangle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
};

const DOMURL = window.URL || window.webkitURL || window;

if (typeof dat === "undefined") throw new Error(`Please import 'dat.GUI' before dat.GUI.gl!`);

dat.GL = class GL {

  constructor({ alpha, scale, element } = _) {
    if (!element) throw new Error("Invalid element!");
    this._alpha = alpha !== void 0 ? alpha : 1.0;
    this._scale = scale !== void 0 ? scale : 1.0;
    this.element = element || null;
    this.ctx = null;
    this.view = null;
    this.buffer = null;
    this.lastHTML = ``;
    this.onrasterize = null;
    this.onresize = null;
    this.boundings = null;
    this.alpha = this._alpha;
    this.scale = this._scale;
    this.isCircular = false;
    this.xmlSerializer = new XMLSerializer();
    this.cssAST = null;
    this.parseCSSInput();
    this.createCanvas();
    //this.rasterize(false, null);
    this.watchElement();
    this.onContentUpdate(null);
  }

  get alpha() { return this._alpha; }
  set alpha(v) { this._alpha = v; }

  get scale() { return this._scale; }
  set scale(v) {
    let scale = Math.max(0.0, v);
    if (v < 1.0) console.warn(`Scale smaller than`, 1.0, `is not allowed`);
    if (this._scale !== scale) {
      this._scale = scale;
      this.updateBoundings();
      this.resize();
    }
  }

  createCanvas() {
    this.ctx = document.createElement("canvas").getContext("2d");
    this.view = this.ctx.canvas;
    this.updateBoundings();
    this.resize();
  }

  watchElement() {
    let {element} = this;
    let observer = new MutationObserver(mutations => {
      let contentUpdate = false;
      for (let ii = 0; ii < mutations.length; ++ii) {
        let mutation = mutations[ii];
        if (
          (mutation.type === "childList") ||
          (mutation.addedNodes.length > 0) ||
          (mutation.removedNodes.length > 0)
        ) {
          contentUpdate = true;
        }
      };
      if (contentUpdate) this.onContentUpdate(mutations);
      if (this.isCircular) return;
      if (this.needsResize()) {
        this.updateBoundings();
        this.resize();
      }
      this.rasterize(false, mutations);
    });
    let config = {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    };
    observer.observe(element, config);
  }

  needsResize() {
    let current = this.boundings;
    let next = this.getBoundings();
    return (
      current.width !== next.width ||
      current.height !== next.height
    );
  }

  getBoundings() {
    let {element} = this;
    let {boundings} = this;
    let content = element.querySelector("[htmlgl='content']");
    let {x, y} = element.getBoundingClientRect();
    let width = -999999999;
    let height = -999999999;
    let nodes = content.getElementsByTagName("*");
    for (let ii = 0; ii < nodes.length; ++ii) {
      let node = nodes[ii];
      let bounds = node.getBoundingClientRect();
      if (bounds.left - x + bounds.width > width) width = bounds.left - x + bounds.width;
      if (bounds.top - y + bounds.height > height) height = bounds.top - y + bounds.height;
    };
    return {
      x: 0, y: 0,
      width, height
    };
  }

  rasterize(force = false, mutations) {
    this.rasterizeHTML(buffer => {
      this.buffer = buffer;
      this.draw();
      if (this.onrasterize instanceof Function) {
        // allow to only redraw sub-areas of the element
        if (mutations) {
          let dirtyRects = this.getPartialDirtyRects(mutations);
          this.onrasterize(dirtyRects);
        // on forced rasterization we create a dirtyrect
        // covering the complete element
        } else if (force) {
          let dirtyRect = this.getFullDirtyRect(mutations);
          this.onrasterize([dirtyRect]);
        }
      }
    }, force);
  }

  getFullDirtyRect() {
    let {scale, element} = this;
    let rect = element.getBoundingClientRect();
    let aspect = this.getBoundingAspect();
    let scaleX = (scale / (aspect.x * scale));
    let scaleY = (scale / (aspect.y * scale));
    let x = (rect.left - bx) * scaleX;
    let y = (rect.top - by) * scaleY;
    let width = (rect.width) * scaleX;
    let height = (rect.height) * scaleY;
    let dirtyRect = new DirtyRectangle(
      x, y,
      width, height
    );
    return dirtyRect;
  }

  getPartialDirtyRects(mutations) {
    let {element} = this;
    let elements = [];
    let dirtyRects = [];
    let rect = element.getBoundingClientRect();
    let bx = rect.left;
    let by = rect.top;
    let aspect = this.getBoundingAspect();
    let scaleX = (this.scale / (aspect.x * this.scale));
    let scaleY = (this.scale / (aspect.y * this.scale));
    for (let ii = 0; ii < mutations.length; ++ii) {
      let mutation = mutations[ii];
      let {target} = mutation;
      if (elements.indexOf(target) <= -1 && target !== element) {
        elements.push(target);
        let rect = target.getBoundingClientRect();
        let x = (rect.left - bx) * scaleX;
        let y = (rect.top - by) * scaleY;
        let width = Math.ceil((rect.width) * scaleX);
        let height = Math.ceil((rect.height) * scaleY);
        /*{
          let style = window.getComputedStyle(target);
          let padding = {
            top: parseFloat(style.paddingTop) * scaleY,
            bottom: parseFloat(style.paddingBottom) * scaleY,
            left: parseFloat(style.paddingLeft) * scaleX,
            right: parseFloat(style.paddingRight) * scaleX
          };
          x -= padding.left + padding.right;
          width += padding.left + padding.right;
          y -= padding.top + padding.bottom;
          height += padding.top + padding.bottom;
        }
        {
          let style = window.getComputedStyle(target);
          let padding = {
            top: parseFloat(style.marginTop) * scaleY,
            bottom: parseFloat(style.marginBottom) * scaleY,
            left: parseFloat(style.marginLeft) * scaleX,
            right: parseFloat(style.marginRight) * scaleX
          };
          x -= padding.left + padding.right;
          width += padding.left + padding.right;
          y -= padding.top + padding.bottom;
          height += padding.top + padding.bottom;
        }*/
        let dirtyRect = new DirtyRectangle(x, y, width, height);
        dirtyRect.scaleX = scaleX;
        dirtyRect.scaleY = scaleY;
        dirtyRects.push(dirtyRect);
      }
    };
    return dirtyRects;
  }

  rasterizeHTML(resolve, forced) {
    let {element} = this;
    let xmlSerializer = this.xmlSerializer;
    let style = element.querySelector("[htmlgl='style']");
    let content = element.querySelector("[htmlgl='content']");
    let html = ``;
    if (style) {
      let styleHTML = style.innerHTML;
      html += `<style type="text/css">${styleHTML}</style>`;
    }
    if (content) {
      let contentHTML = xmlSerializer.serializeToString(content);
      html += `${contentHTML}`;
    }
    // dont update if nothing changed
    if (!forced && html === this.lastHTML) {
      if (resolve instanceof Function) resolve(null);
      return;
    }
    this.lastHTML = html;
    this.rasterizeImage(html, buffer => {
      if (resolve instanceof Function) resolve(buffer);
    });
  }

  rasterizeImage(html, resolve) {
    let {ctx} = this;
    let width = ctx.canvas.width;
    let height = ctx.canvas.height;
    let url = `<svg xmlns='http://www.w3.org/2000/svg' width='${width/PIXEL_RATIO}' height='${height/PIXEL_RATIO}'>
        <foreignObject width='${100/PIXEL_RATIO}%' height='${100/PIXEL_RATIO}%' externalResourcesRequired='true'>
          ${html}
        </foreignObject>
      </svg>`;

    let img = new Image();
    img.setAttribute("crossorigin", "anonymous");
    img.onload = function() {
      resolve(img);
    };
    img.src = `data:image/svg+xml;charset=utf-8;base64,` + btoa(url);
  }

  clear() {
    let {ctx} = this;
    let {canvas} = ctx;
    ctx.clearRect(
      0, 0,
      canvas.width, canvas.height
    );
  }

  draw() {
    let {ctx} = this;
    let {alpha, scale} = this;
    let {width, height} = this.boundings;
    let {buffer} = this;
    if (!buffer) return;
    let aspect = this.getBoundingAspect();
    let scaledWidth = width * (scale / (aspect.x * scale));
    let scaledHeight = height * (scale / (aspect.y * scale));
    this.clear();
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      buffer,
      0, 0,
      width, height,
      0, 0,
      scaledWidth, scaledHeight
    );
  }

  resize() {
    let {ctx} = this;
    let {canvas} = ctx;
    let {scale} = this;
    let {boundings} = this;
    let width = boundings.width * scale;
    let height = boundings.height * scale;
    let potw = nextPowerOfTwo(width * PIXEL_RATIO);
    let poth = nextPowerOfTwo(height * PIXEL_RATIO);
    let dim = Math.max(potw, poth);
    let needsResize = canvas.width !== dim || canvas.height !== dim;
    this.isCircular = true;
    if (needsResize) canvas.width = canvas.height = dim;
    ctx.imageSmoothingEnabled = true;
    ctx.webkitImageSmoothingEnabled = true;
    ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
    this.draw();
    if (this.onresize instanceof Function) {
      if (potw > 0 && poth > 0) this.onresize();
    }
    setTimeout(() => {
      this.isCircular = false;
    });
  }

  onContentUpdate(mutations) {
    console.log("Content Update:", mutations);
    let {element} = this;
    let all = element.querySelectorAll("*");
    let inputs = element.getElementsByTagName("input");
    let selects = element.getElementsByTagName("select");
    // apply pseudo style fakeing
    for (let ii = 0; ii < all.length; ++ii) {
      let el = all[ii];
      let pseudoStyles = this.resolvePseudoStyles(el);
      if (pseudoStyles) this.applyPseudoEventListeners(el, pseudoStyles);
    };
    // apply margin/padding embedding
    for (let ii = 0; ii < all.length; ++ii) {
      let el = all[ii];
      this.inlineComputedElementStyles(el);
    };
    for (let ii = 0; ii < inputs.length; ++ii) {
      this.mirrorContentInputNodeEvents(inputs[ii]);
    };
    for (let ii = 0; ii < selects.length; ++ii) {
      this.mirrorContentSelectNodeEvents(selects[ii]);
    };
  }

  inlineComputedElementStyles(el) {
    let style = window.getComputedStyle(el);
    el.style.boxSizing = style.boxSizing;
    el.style.width = style.width;
    el.style.height = style.height;
  }

  applyPseudoEventListeners(el, pseudoStyles) {
    let hover = pseudoStyles[":hover"];
    let focus = pseudoStyles[":focus"];
    // hover fake events
    if (hover) {
      el.onmouseover = e => {
        hover.map(style => {
          el.style.setProperty(style.property, style.value);
        });
      };
      el.onmouseout = e => {
        hover.map(style => {
          el.style.removeProperty(style.property, style.value);
        });
      };
    }
    // focus fake events
    if (focus) {
      el.onfocus = e => {
        focus.map(style => {
          el.style.setProperty(style.property, style.value);
        });
      };
      el.onblur = e => {
        focus.map(style => {
          el.style.removeProperty(style.property, style.value);
        });
      };
    }
  }

  mirrorContentInputNodeEvents(node) {
    let type = node.getAttribute("type");
    // checkbox check-uncheck fix
    if (type === "checkbox") {
      node.onchange = e => {
        if (!node.checked) node.removeAttribute("checked");
      };
    }
    // input value fix
    else if (type === "text") {
      let descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      let setter = descriptor.set;
      function updateValue(node) {
        // only update if it's necessary
        if (node.value !== node.getAttribute("lastvalue")) {
          node.setAttribute("value", node.value);
          node.setAttribute("lastvalue", node.value);
        }
      };
      descriptor.set = function() {
        updateValue(this);
        setter.apply(this, arguments);
      };
      Object.defineProperty(HTMLInputElement.prototype, "value", descriptor);
      updateValue(node);
      node.onchange = e => updateValue(node);
      node.oninput = e => updateValue(node);
    }
  }

  mirrorContentSelectNodeEvents(node) {
    function updateSelectedItem() {
      let {children} = node;
      // reset
      for (let ii = 0; ii < children.length; ++ii) {
        children[ii].removeAttribute("selected");
      };
      // set
      children[node.selectedIndex].setAttribute("selected", "selected");
    };
    node.onchange = e => updateSelectedItem();
  }

  getBoundingAspect() {
    let {ctx} = this;
    let {canvas} = ctx;
    let local = this.boundings;
    let foreign = {
      width: canvas.width,
      height: canvas.height
    };
    let x0 = 0, y0 = 0;
    let x1 = 0, y1 = 0;
    x0 = Math.max(local.width, canvas.width);
    x1 = Math.min(local.width, canvas.width);
    y0 = Math.max(local.height, canvas.height);
    y1 = Math.min(local.height, canvas.height);
    return {
      power: Math.log2(canvas.width),
      x: x1 / x0,
      y: y1 / y0
    };
  }

  updateBoundings() {
    let boundings = this.getBoundings();
    let aspect = getAspectRatio(boundings.width, boundings.height);
    boundings.aspect = aspect;
    this.boundings = boundings;
  }

  getElementFromPosition(x, y) {
    let {element} = this;
    let children = element.getElementsByTagName("*");
    let intersection = null;
    let intersections = [];
    let lastPos = null;
    for (let ii = 0; ii < children.length; ++ii) {
      let child = children[ii];
      let pos = getNodePosition(child);
      if (x >= pos.x && x <= pos.width && y >= pos.y && y <= pos.height) {
        intersection = child;
        intersections.push(child);
      }
    };
    return {
      intersection, intersections
    };
  }

  getCSSRulesBySelector(input) {
    let rules = this.cssAST;
    let out = [];
    for (let ii = 0; ii < rules.length; ++ii) {
      let rule = rules[ii];
      for (let jj = 0; jj < rule.selectors.length; ++jj) {
        let selector = rule.selectors[jj];
        if (input === selector) out.push(rule);
      };
    };
    return out;
  }

  resolvePseudoStyles(node) {
    let rules = this.cssAST;
    let nodeSelectors = getCSSStyles(node);
    let out = {};
    nodeSelectors.map(sel => {
      let rules = this.getCSSRulesBySelector(sel);
      rules.map(rule => {
        rule.pseudos.map(pseudo => {
          if (!out[pseudo]) out[pseudo] = [];
          rule.declarations.map(decl => {
            out[pseudo].push(decl);
          });
        });
      });
    });
    if (Object.keys(out).length) return out;
    return null;
  }

  parseCSSInput() {
    let {element} = this;
    let ast = css(element.querySelector("[htmlgl='style']").innerHTML);
    let {rules} = ast.stylesheet;
    this.cssAST = rules;
    rules.map(rule => {
      rule.selectors = rule.selectors.map(input => {
        let br = input.match(/\[[^\]]+\]|\{[^}]+\}|<[^>]+>/g);
        if (br) {
          br = br[0];
          // put into quotes manually
          if (!br.match(/".*?"/g)) {
            let sel = br.substr(1, br.length - 2);
            let split = sel.split(`=`);
            let name = split[0];
            let value = split[1];
            let fixed = br.replace(br, `${name}="${value}"`);
            input = input.replace(br, `[${fixed}]`);
          }
        }
        return input;
      });
      let pseudoClasses = [":hover", ":active", ":focus"];
      rule.pseudos = [];
      rule.selectors = rule.selectors.map(input => {
        pseudoClasses.map(pseudoName => {
          let match = input.match(pseudoName);
          if (match) {
            rule.pseudos.push(pseudoName);
            input = input.replace(pseudoName, ``);
          }
        });
        return input;
      });
    });
  }

};
