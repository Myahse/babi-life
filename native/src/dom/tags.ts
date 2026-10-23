// The HTML and SVG tags of the game's JSX, as opposed to the three.js ones (mesh, group…) of its canvases.

/** The tags the game writes as HTML (and SVG): the others are three.js's, inside a canvas. */
export const HTML_TAGS = new Set([
  'div', 'span', 'button', 'p', 'li', 'ul', 'ol', 'section', 'header', 'footer', 'main', 'nav', 'article', 'aside', 'form', 'fieldset', 'label', 'input', 'textarea', 'select', 'option',
  'img', 'a', 'b', 'strong', 'i', 'em', 'small', 'code', 'pre', 'sup', 'sub', 'time', 'mark', 'abbr', 'kbd', 's', 'u', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'figure', 'figcaption', 'blockquote', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'video', 'canvas', 'iframe', 'progress', 'dialog',
  'dl', 'dt', 'dd', 'legend', 'optgroup', 'datalist', 'animate', 'animateTransform',
  'svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'ellipse', 'defs', 'linearGradient', 'radialGradient', 'stop', 'text', 'tspan', 'clipPath', 'mask', 'pattern', 'use', 'symbol',
])
