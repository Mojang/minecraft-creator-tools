function at(n,t){var a=Object.keys(n);if(Object.getOwnPropertySymbols){var e=Object.getOwnPropertySymbols(n);t&&(e=e.filter(function(r){return Object.getOwnPropertyDescriptor(n,r).enumerable})),a.push.apply(a,e)}return a}function c(n){for(var t=1;t<arguments.length;t++){var a=arguments[t]!=null?arguments[t]:{};t%2?at(Object(a),!0).forEach(function(e){y(n,e,a[e])}):Object.getOwnPropertyDescriptors?Object.defineProperties(n,Object.getOwnPropertyDescriptors(a)):at(Object(a)).forEach(function(e){Object.defineProperty(n,e,Object.getOwnPropertyDescriptor(a,e))})}return n}function kn(n){"@babel/helpers - typeof";return kn=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},kn(n)}function na(n,t){if(!(n instanceof t))throw new TypeError("Cannot call a class as a function")}function ta(n,t){for(var a=0;a<t.length;a++){var e=t[a];e.enumerable=e.enumerable||!1,e.configurable=!0,"value"in e&&(e.writable=!0),Object.defineProperty(n,e.key,e)}}function aa(n,t,a){return t&&ta(n.prototype,t),Object.defineProperty(n,"prototype",{writable:!1}),n}function y(n,t,a){return t in n?Object.defineProperty(n,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):n[t]=a,n}function Wn(n,t){return ra(n)||oa(n,t)||Pt(n,t)||fa()}function on(n){return ea(n)||ia(n)||Pt(n)||sa()}function ea(n){if(Array.isArray(n))return _n(n)}function ra(n){if(Array.isArray(n))return n}function ia(n){if(typeof Symbol<"u"&&n[Symbol.iterator]!=null||n["@@iterator"]!=null)return Array.from(n)}function oa(n,t){var a=n==null?null:typeof Symbol<"u"&&n[Symbol.iterator]||n["@@iterator"];if(a!=null){var e=[],r=!0,o=!1,i,s;try{for(a=a.call(n);!(r=(i=a.next()).done)&&(e.push(i.value),!(t&&e.length===t));r=!0);}catch(f){o=!0,s=f}finally{try{!r&&a.return!=null&&a.return()}finally{if(o)throw s}}return e}}function Pt(n,t){if(n){if(typeof n=="string")return _n(n,t);var a=Object.prototype.toString.call(n).slice(8,-1);if(a==="Object"&&n.constructor&&(a=n.constructor.name),a==="Map"||a==="Set")return Array.from(n);if(a==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a))return _n(n,t)}}function _n(n,t){(t==null||t>n.length)&&(t=n.length);for(var a=0,e=new Array(t);a<t;a++)e[a]=n[a];return e}function sa(){throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function fa(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}var et=function(){},Hn={},Ot={},Ct=null,It={mark:et,measure:et};try{typeof window<"u"&&(Hn=window),typeof document<"u"&&(Ot=document),typeof MutationObserver<"u"&&(Ct=MutationObserver),typeof performance<"u"&&(It=performance)}catch{}var la=Hn.navigator||{},rt=la.userAgent,it=rt===void 0?"":rt,z=Hn,p=Ot,ot=Ct,ln=It;z.document;var L=!!p.documentElement&&!!p.head&&typeof p.addEventListener=="function"&&typeof p.createElement=="function",Nt=~it.indexOf("MSIE")||~it.indexOf("Trident/"),cn,un,mn,vn,dn,T="___FONT_AWESOME___",Mn=16,Tt="fa",_t="svg-inline--fa",W="data-fa-i2svg",Ln="data-fa-pseudo-element",ca="data-fa-pseudo-element-pending",Xn="data-prefix",Gn="data-icon",st="fontawesome-i2svg",ua="async",ma=["HTML","HEAD","STYLE","SCRIPT"],Mt=(function(){try{return!0}catch{return!1}})(),b="classic",h="sharp",Bn=[b,h];function sn(n){return new Proxy(n,{get:function(a,e){return e in a?a[e]:a[b]}})}var nn=sn((cn={},y(cn,b,{fa:"solid",fas:"solid","fa-solid":"solid",far:"regular","fa-regular":"regular",fal:"light","fa-light":"light",fat:"thin","fa-thin":"thin",fad:"duotone","fa-duotone":"duotone",fab:"brands","fa-brands":"brands",fak:"kit","fa-kit":"kit"}),y(cn,h,{fa:"solid",fass:"solid","fa-solid":"solid"}),cn)),tn=sn((un={},y(un,b,{solid:"fas",regular:"far",light:"fal",thin:"fat",duotone:"fad",brands:"fab",kit:"fak"}),y(un,h,{solid:"fass"}),un)),an=sn((mn={},y(mn,b,{fab:"fa-brands",fad:"fa-duotone",fak:"fa-kit",fal:"fa-light",far:"fa-regular",fas:"fa-solid",fat:"fa-thin"}),y(mn,h,{fass:"fa-solid"}),mn)),va=sn((vn={},y(vn,b,{"fa-brands":"fab","fa-duotone":"fad","fa-kit":"fak","fa-light":"fal","fa-regular":"far","fa-solid":"fas","fa-thin":"fat"}),y(vn,h,{"fa-solid":"fass"}),vn)),da=/fa(s|r|l|t|d|b|k|ss)?[\-\ ]/,Lt="fa-layers-text",ga=/Font ?Awesome ?([56 ]*)(Solid|Regular|Light|Thin|Duotone|Brands|Free|Pro|Sharp|Kit)?.*/i,ba=sn((dn={},y(dn,b,{900:"fas",400:"far",normal:"far",300:"fal",100:"fat"}),y(dn,h,{900:"fass"}),dn)),Rt=[1,2,3,4,5,6,7,8,9,10],pa=Rt.concat([11,12,13,14,15,16,17,18,19,20]),ha=["class","data-prefix","data-icon","data-fa-transform","data-fa-mask"],$={GROUP:"duotone-group",SWAP_OPACITY:"swap-opacity",PRIMARY:"primary",SECONDARY:"secondary"},en=new Set;Object.keys(tn[b]).map(en.add.bind(en));Object.keys(tn[h]).map(en.add.bind(en));var ya=[].concat(Bn,on(en),["2xs","xs","sm","lg","xl","2xl","beat","border","fade","beat-fade","bounce","flip-both","flip-horizontal","flip-vertical","flip","fw","inverse","layers-counter","layers-text","layers","li","pull-left","pull-right","pulse","rotate-180","rotate-270","rotate-90","rotate-by","shake","spin-pulse","spin-reverse","spin","stack-1x","stack-2x","stack","ul",$.GROUP,$.SWAP_OPACITY,$.PRIMARY,$.SECONDARY]).concat(Rt.map(function(n){return"".concat(n,"x")})).concat(pa.map(function(n){return"w-".concat(n)})),J=z.FontAwesomeConfig||{};function ka(n){var t=p.querySelector("script["+n+"]");if(t)return t.getAttribute(n)}function wa(n){return n===""?!0:n==="false"?!1:n==="true"?!0:n}if(p&&typeof p.querySelector=="function"){var xa=[["data-family-prefix","familyPrefix"],["data-css-prefix","cssPrefix"],["data-family-default","familyDefault"],["data-style-default","styleDefault"],["data-replacement-class","replacementClass"],["data-auto-replace-svg","autoReplaceSvg"],["data-auto-add-css","autoAddCss"],["data-auto-a11y","autoA11y"],["data-search-pseudo-elements","searchPseudoElements"],["data-observe-mutations","observeMutations"],["data-mutate-approach","mutateApproach"],["data-keep-original-source","keepOriginalSource"],["data-measure-performance","measurePerformance"],["data-show-missing-icons","showMissingIcons"]];xa.forEach(function(n){var t=Wn(n,2),a=t[0],e=t[1],r=wa(ka(a));r!=null&&(J[e]=r)})}var zt={styleDefault:"solid",familyDefault:"classic",cssPrefix:Tt,replacementClass:_t,autoReplaceSvg:!0,autoAddCss:!0,autoA11y:!0,searchPseudoElements:!1,observeMutations:!0,mutateApproach:"async",keepOriginalSource:!0,measurePerformance:!1,showMissingIcons:!0};J.familyPrefix&&(J.cssPrefix=J.familyPrefix);var q=c(c({},zt),J);q.autoReplaceSvg||(q.observeMutations=!1);var m={};Object.keys(zt).forEach(function(n){Object.defineProperty(m,n,{enumerable:!0,set:function(a){q[n]=a,Z.forEach(function(e){return e(m)})},get:function(){return q[n]}})});Object.defineProperty(m,"familyPrefix",{enumerable:!0,set:function(t){q.cssPrefix=t,Z.forEach(function(a){return a(m)})},get:function(){return q.cssPrefix}});z.FontAwesomeConfig=m;var Z=[];function Aa(n){return Z.push(n),function(){Z.splice(Z.indexOf(n),1)}}var X=Mn,N={size:16,x:0,y:0,rotate:0,flipX:!1,flipY:!1};function Ea(n){if(!(!n||!L)){var t=p.createElement("style");t.setAttribute("type","text/css"),t.innerHTML=n;for(var a=p.head.childNodes,e=null,r=a.length-1;r>-1;r--){var o=a[r],i=(o.tagName||"").toUpperCase();["STYLE","LINK"].indexOf(i)>-1&&(e=o)}return p.head.insertBefore(t,e),n}}var Sa="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";function rn(){for(var n=12,t="";n-- >0;)t+=Sa[Math.random()*62|0];return t}function K(n){for(var t=[],a=(n||[]).length>>>0;a--;)t[a]=n[a];return t}function Vn(n){return n.classList?K(n.classList):(n.getAttribute("class")||"").split(" ").filter(function(t){return t})}function Ft(n){return"".concat(n).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function Pa(n){return Object.keys(n||{}).reduce(function(t,a){return t+"".concat(a,'="').concat(Ft(n[a]),'" ')},"").trim()}function An(n){return Object.keys(n||{}).reduce(function(t,a){return t+"".concat(a,": ").concat(n[a].trim(),";")},"")}function qn(n){return n.size!==N.size||n.x!==N.x||n.y!==N.y||n.rotate!==N.rotate||n.flipX||n.flipY}function Oa(n){var t=n.transform,a=n.containerWidth,e=n.iconWidth,r={transform:"translate(".concat(a/2," 256)")},o="translate(".concat(t.x*32,", ").concat(t.y*32,") "),i="scale(".concat(t.size/16*(t.flipX?-1:1),", ").concat(t.size/16*(t.flipY?-1:1),") "),s="rotate(".concat(t.rotate," 0 0)"),f={transform:"".concat(o," ").concat(i," ").concat(s)},u={transform:"translate(".concat(e/2*-1," -256)")};return{outer:r,inner:f,path:u}}function Ca(n){var t=n.transform,a=n.width,e=a===void 0?Mn:a,r=n.height,o=r===void 0?Mn:r,i="";return Nt?i+="translate(".concat(t.x/X-e/2,"em, ").concat(t.y/X-o/2,"em) "):i+="translate(calc(-50% + ".concat(t.x/X,"em), calc(-50% + ").concat(t.y/X,"em)) "),i+="scale(".concat(t.size/X*(t.flipX?-1:1),", ").concat(t.size/X*(t.flipY?-1:1),") "),i+="rotate(".concat(t.rotate,"deg) "),i}var Ia=`:root, :host {
  --fa-font-solid: normal 900 1em/1 "Font Awesome 6 Solid";
  --fa-font-regular: normal 400 1em/1 "Font Awesome 6 Regular";
  --fa-font-light: normal 300 1em/1 "Font Awesome 6 Light";
  --fa-font-thin: normal 100 1em/1 "Font Awesome 6 Thin";
  --fa-font-duotone: normal 900 1em/1 "Font Awesome 6 Duotone";
  --fa-font-sharp-solid: normal 900 1em/1 "Font Awesome 6 Sharp";
  --fa-font-brands: normal 400 1em/1 "Font Awesome 6 Brands";
}

svg:not(:root).svg-inline--fa, svg:not(:host).svg-inline--fa {
  overflow: visible;
  box-sizing: content-box;
}

.svg-inline--fa {
  display: var(--fa-display, inline-block);
  height: 1em;
  overflow: visible;
  vertical-align: -0.125em;
}
.svg-inline--fa.fa-2xs {
  vertical-align: 0.1em;
}
.svg-inline--fa.fa-xs {
  vertical-align: 0em;
}
.svg-inline--fa.fa-sm {
  vertical-align: -0.0714285705em;
}
.svg-inline--fa.fa-lg {
  vertical-align: -0.2em;
}
.svg-inline--fa.fa-xl {
  vertical-align: -0.25em;
}
.svg-inline--fa.fa-2xl {
  vertical-align: -0.3125em;
}
.svg-inline--fa.fa-pull-left {
  margin-right: var(--fa-pull-margin, 0.3em);
  width: auto;
}
.svg-inline--fa.fa-pull-right {
  margin-left: var(--fa-pull-margin, 0.3em);
  width: auto;
}
.svg-inline--fa.fa-li {
  width: var(--fa-li-width, 2em);
  top: 0.25em;
}
.svg-inline--fa.fa-fw {
  width: var(--fa-fw-width, 1.25em);
}

.fa-layers svg.svg-inline--fa {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
}

.fa-layers-counter, .fa-layers-text {
  display: inline-block;
  position: absolute;
  text-align: center;
}

.fa-layers {
  display: inline-block;
  height: 1em;
  position: relative;
  text-align: center;
  vertical-align: -0.125em;
  width: 1em;
}
.fa-layers svg.svg-inline--fa {
  -webkit-transform-origin: center center;
          transform-origin: center center;
}

.fa-layers-text {
  left: 50%;
  top: 50%;
  -webkit-transform: translate(-50%, -50%);
          transform: translate(-50%, -50%);
  -webkit-transform-origin: center center;
          transform-origin: center center;
}

.fa-layers-counter {
  background-color: var(--fa-counter-background-color, #ff253a);
  border-radius: var(--fa-counter-border-radius, 1em);
  box-sizing: border-box;
  color: var(--fa-inverse, #fff);
  line-height: var(--fa-counter-line-height, 1);
  max-width: var(--fa-counter-max-width, 5em);
  min-width: var(--fa-counter-min-width, 1.5em);
  overflow: hidden;
  padding: var(--fa-counter-padding, 0.25em 0.5em);
  right: var(--fa-right, 0);
  text-overflow: ellipsis;
  top: var(--fa-top, 0);
  -webkit-transform: scale(var(--fa-counter-scale, 0.25));
          transform: scale(var(--fa-counter-scale, 0.25));
  -webkit-transform-origin: top right;
          transform-origin: top right;
}

.fa-layers-bottom-right {
  bottom: var(--fa-bottom, 0);
  right: var(--fa-right, 0);
  top: auto;
  -webkit-transform: scale(var(--fa-layers-scale, 0.25));
          transform: scale(var(--fa-layers-scale, 0.25));
  -webkit-transform-origin: bottom right;
          transform-origin: bottom right;
}

.fa-layers-bottom-left {
  bottom: var(--fa-bottom, 0);
  left: var(--fa-left, 0);
  right: auto;
  top: auto;
  -webkit-transform: scale(var(--fa-layers-scale, 0.25));
          transform: scale(var(--fa-layers-scale, 0.25));
  -webkit-transform-origin: bottom left;
          transform-origin: bottom left;
}

.fa-layers-top-right {
  top: var(--fa-top, 0);
  right: var(--fa-right, 0);
  -webkit-transform: scale(var(--fa-layers-scale, 0.25));
          transform: scale(var(--fa-layers-scale, 0.25));
  -webkit-transform-origin: top right;
          transform-origin: top right;
}

.fa-layers-top-left {
  left: var(--fa-left, 0);
  right: auto;
  top: var(--fa-top, 0);
  -webkit-transform: scale(var(--fa-layers-scale, 0.25));
          transform: scale(var(--fa-layers-scale, 0.25));
  -webkit-transform-origin: top left;
          transform-origin: top left;
}

.fa-1x {
  font-size: 1em;
}

.fa-2x {
  font-size: 2em;
}

.fa-3x {
  font-size: 3em;
}

.fa-4x {
  font-size: 4em;
}

.fa-5x {
  font-size: 5em;
}

.fa-6x {
  font-size: 6em;
}

.fa-7x {
  font-size: 7em;
}

.fa-8x {
  font-size: 8em;
}

.fa-9x {
  font-size: 9em;
}

.fa-10x {
  font-size: 10em;
}

.fa-2xs {
  font-size: 0.625em;
  line-height: 0.1em;
  vertical-align: 0.225em;
}

.fa-xs {
  font-size: 0.75em;
  line-height: 0.0833333337em;
  vertical-align: 0.125em;
}

.fa-sm {
  font-size: 0.875em;
  line-height: 0.0714285718em;
  vertical-align: 0.0535714295em;
}

.fa-lg {
  font-size: 1.25em;
  line-height: 0.05em;
  vertical-align: -0.075em;
}

.fa-xl {
  font-size: 1.5em;
  line-height: 0.0416666682em;
  vertical-align: -0.125em;
}

.fa-2xl {
  font-size: 2em;
  line-height: 0.03125em;
  vertical-align: -0.1875em;
}

.fa-fw {
  text-align: center;
  width: 1.25em;
}

.fa-ul {
  list-style-type: none;
  margin-left: var(--fa-li-margin, 2.5em);
  padding-left: 0;
}
.fa-ul > li {
  position: relative;
}

.fa-li {
  left: calc(var(--fa-li-width, 2em) * -1);
  position: absolute;
  text-align: center;
  width: var(--fa-li-width, 2em);
  line-height: inherit;
}

.fa-border {
  border-color: var(--fa-border-color, #eee);
  border-radius: var(--fa-border-radius, 0.1em);
  border-style: var(--fa-border-style, solid);
  border-width: var(--fa-border-width, 0.08em);
  padding: var(--fa-border-padding, 0.2em 0.25em 0.15em);
}

.fa-pull-left {
  float: left;
  margin-right: var(--fa-pull-margin, 0.3em);
}

.fa-pull-right {
  float: right;
  margin-left: var(--fa-pull-margin, 0.3em);
}

.fa-beat {
  -webkit-animation-name: fa-beat;
          animation-name: fa-beat;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, ease-in-out);
          animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-bounce {
  -webkit-animation-name: fa-bounce;
          animation-name: fa-bounce;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
          animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
}

.fa-fade {
  -webkit-animation-name: fa-fade;
          animation-name: fa-fade;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
          animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
}

.fa-beat-fade {
  -webkit-animation-name: fa-beat-fade;
          animation-name: fa-beat-fade;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
          animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
}

.fa-flip {
  -webkit-animation-name: fa-flip;
          animation-name: fa-flip;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, ease-in-out);
          animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-shake {
  -webkit-animation-name: fa-shake;
          animation-name: fa-shake;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, linear);
          animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin {
  -webkit-animation-name: fa-spin;
          animation-name: fa-spin;
  -webkit-animation-delay: var(--fa-animation-delay, 0s);
          animation-delay: var(--fa-animation-delay, 0s);
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 2s);
          animation-duration: var(--fa-animation-duration, 2s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, linear);
          animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin-reverse {
  --fa-animation-direction: reverse;
}

.fa-pulse,
.fa-spin-pulse {
  -webkit-animation-name: fa-spin;
          animation-name: fa-spin;
  -webkit-animation-direction: var(--fa-animation-direction, normal);
          animation-direction: var(--fa-animation-direction, normal);
  -webkit-animation-duration: var(--fa-animation-duration, 1s);
          animation-duration: var(--fa-animation-duration, 1s);
  -webkit-animation-iteration-count: var(--fa-animation-iteration-count, infinite);
          animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  -webkit-animation-timing-function: var(--fa-animation-timing, steps(8));
          animation-timing-function: var(--fa-animation-timing, steps(8));
}

@media (prefers-reduced-motion: reduce) {
  .fa-beat,
.fa-bounce,
.fa-fade,
.fa-beat-fade,
.fa-flip,
.fa-pulse,
.fa-shake,
.fa-spin,
.fa-spin-pulse {
    -webkit-animation-delay: -1ms;
            animation-delay: -1ms;
    -webkit-animation-duration: 1ms;
            animation-duration: 1ms;
    -webkit-animation-iteration-count: 1;
            animation-iteration-count: 1;
    transition-delay: 0s;
    transition-duration: 0s;
  }
}
@-webkit-keyframes fa-beat {
  0%, 90% {
    -webkit-transform: scale(1);
            transform: scale(1);
  }
  45% {
    -webkit-transform: scale(var(--fa-beat-scale, 1.25));
            transform: scale(var(--fa-beat-scale, 1.25));
  }
}
@keyframes fa-beat {
  0%, 90% {
    -webkit-transform: scale(1);
            transform: scale(1);
  }
  45% {
    -webkit-transform: scale(var(--fa-beat-scale, 1.25));
            transform: scale(var(--fa-beat-scale, 1.25));
  }
}
@-webkit-keyframes fa-bounce {
  0% {
    -webkit-transform: scale(1, 1) translateY(0);
            transform: scale(1, 1) translateY(0);
  }
  10% {
    -webkit-transform: scale(var(--fa-bounce-start-scale-x, 1.1), var(--fa-bounce-start-scale-y, 0.9)) translateY(0);
            transform: scale(var(--fa-bounce-start-scale-x, 1.1), var(--fa-bounce-start-scale-y, 0.9)) translateY(0);
  }
  30% {
    -webkit-transform: scale(var(--fa-bounce-jump-scale-x, 0.9), var(--fa-bounce-jump-scale-y, 1.1)) translateY(var(--fa-bounce-height, -0.5em));
            transform: scale(var(--fa-bounce-jump-scale-x, 0.9), var(--fa-bounce-jump-scale-y, 1.1)) translateY(var(--fa-bounce-height, -0.5em));
  }
  50% {
    -webkit-transform: scale(var(--fa-bounce-land-scale-x, 1.05), var(--fa-bounce-land-scale-y, 0.95)) translateY(0);
            transform: scale(var(--fa-bounce-land-scale-x, 1.05), var(--fa-bounce-land-scale-y, 0.95)) translateY(0);
  }
  57% {
    -webkit-transform: scale(1, 1) translateY(var(--fa-bounce-rebound, -0.125em));
            transform: scale(1, 1) translateY(var(--fa-bounce-rebound, -0.125em));
  }
  64% {
    -webkit-transform: scale(1, 1) translateY(0);
            transform: scale(1, 1) translateY(0);
  }
  100% {
    -webkit-transform: scale(1, 1) translateY(0);
            transform: scale(1, 1) translateY(0);
  }
}
@keyframes fa-bounce {
  0% {
    -webkit-transform: scale(1, 1) translateY(0);
            transform: scale(1, 1) translateY(0);
  }
  10% {
    -webkit-transform: scale(var(--fa-bounce-start-scale-x, 1.1), var(--fa-bounce-start-scale-y, 0.9)) translateY(0);
            transform: scale(var(--fa-bounce-start-scale-x, 1.1), var(--fa-bounce-start-scale-y, 0.9)) translateY(0);
  }
  30% {
    -webkit-transform: scale(var(--fa-bounce-jump-scale-x, 0.9), var(--fa-bounce-jump-scale-y, 1.1)) translateY(var(--fa-bounce-height, -0.5em));
            transform: scale(var(--fa-bounce-jump-scale-x, 0.9), var(--fa-bounce-jump-scale-y, 1.1)) translateY(var(--fa-bounce-height, -0.5em));
  }
  50% {
    -webkit-transform: scale(var(--fa-bounce-land-scale-x, 1.05), var(--fa-bounce-land-scale-y, 0.95)) translateY(0);
            transform: scale(var(--fa-bounce-land-scale-x, 1.05), var(--fa-bounce-land-scale-y, 0.95)) translateY(0);
  }
  57% {
    -webkit-transform: scale(1, 1) translateY(var(--fa-bounce-rebound, -0.125em));
            transform: scale(1, 1) translateY(var(--fa-bounce-rebound, -0.125em));
  }
  64% {
    -webkit-transform: scale(1, 1) translateY(0);
            transform: scale(1, 1) translateY(0);
  }
  100% {
    -webkit-transform: scale(1, 1) translateY(0);
            transform: scale(1, 1) translateY(0);
  }
}
@-webkit-keyframes fa-fade {
  50% {
    opacity: var(--fa-fade-opacity, 0.4);
  }
}
@keyframes fa-fade {
  50% {
    opacity: var(--fa-fade-opacity, 0.4);
  }
}
@-webkit-keyframes fa-beat-fade {
  0%, 100% {
    opacity: var(--fa-beat-fade-opacity, 0.4);
    -webkit-transform: scale(1);
            transform: scale(1);
  }
  50% {
    opacity: 1;
    -webkit-transform: scale(var(--fa-beat-fade-scale, 1.125));
            transform: scale(var(--fa-beat-fade-scale, 1.125));
  }
}
@keyframes fa-beat-fade {
  0%, 100% {
    opacity: var(--fa-beat-fade-opacity, 0.4);
    -webkit-transform: scale(1);
            transform: scale(1);
  }
  50% {
    opacity: 1;
    -webkit-transform: scale(var(--fa-beat-fade-scale, 1.125));
            transform: scale(var(--fa-beat-fade-scale, 1.125));
  }
}
@-webkit-keyframes fa-flip {
  50% {
    -webkit-transform: rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -180deg));
            transform: rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -180deg));
  }
}
@keyframes fa-flip {
  50% {
    -webkit-transform: rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -180deg));
            transform: rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -180deg));
  }
}
@-webkit-keyframes fa-shake {
  0% {
    -webkit-transform: rotate(-15deg);
            transform: rotate(-15deg);
  }
  4% {
    -webkit-transform: rotate(15deg);
            transform: rotate(15deg);
  }
  8%, 24% {
    -webkit-transform: rotate(-18deg);
            transform: rotate(-18deg);
  }
  12%, 28% {
    -webkit-transform: rotate(18deg);
            transform: rotate(18deg);
  }
  16% {
    -webkit-transform: rotate(-22deg);
            transform: rotate(-22deg);
  }
  20% {
    -webkit-transform: rotate(22deg);
            transform: rotate(22deg);
  }
  32% {
    -webkit-transform: rotate(-12deg);
            transform: rotate(-12deg);
  }
  36% {
    -webkit-transform: rotate(12deg);
            transform: rotate(12deg);
  }
  40%, 100% {
    -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
  }
}
@keyframes fa-shake {
  0% {
    -webkit-transform: rotate(-15deg);
            transform: rotate(-15deg);
  }
  4% {
    -webkit-transform: rotate(15deg);
            transform: rotate(15deg);
  }
  8%, 24% {
    -webkit-transform: rotate(-18deg);
            transform: rotate(-18deg);
  }
  12%, 28% {
    -webkit-transform: rotate(18deg);
            transform: rotate(18deg);
  }
  16% {
    -webkit-transform: rotate(-22deg);
            transform: rotate(-22deg);
  }
  20% {
    -webkit-transform: rotate(22deg);
            transform: rotate(22deg);
  }
  32% {
    -webkit-transform: rotate(-12deg);
            transform: rotate(-12deg);
  }
  36% {
    -webkit-transform: rotate(12deg);
            transform: rotate(12deg);
  }
  40%, 100% {
    -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
  }
}
@-webkit-keyframes fa-spin {
  0% {
    -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
  }
}
@keyframes fa-spin {
  0% {
    -webkit-transform: rotate(0deg);
            transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
  }
}
.fa-rotate-90 {
  -webkit-transform: rotate(90deg);
          transform: rotate(90deg);
}

.fa-rotate-180 {
  -webkit-transform: rotate(180deg);
          transform: rotate(180deg);
}

.fa-rotate-270 {
  -webkit-transform: rotate(270deg);
          transform: rotate(270deg);
}

.fa-flip-horizontal {
  -webkit-transform: scale(-1, 1);
          transform: scale(-1, 1);
}

.fa-flip-vertical {
  -webkit-transform: scale(1, -1);
          transform: scale(1, -1);
}

.fa-flip-both,
.fa-flip-horizontal.fa-flip-vertical {
  -webkit-transform: scale(-1, -1);
          transform: scale(-1, -1);
}

.fa-rotate-by {
  -webkit-transform: rotate(var(--fa-rotate-angle, none));
          transform: rotate(var(--fa-rotate-angle, none));
}

.fa-stack {
  display: inline-block;
  vertical-align: middle;
  height: 2em;
  position: relative;
  width: 2.5em;
}

.fa-stack-1x,
.fa-stack-2x {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
  z-index: var(--fa-stack-z-index, auto);
}

.svg-inline--fa.fa-stack-1x {
  height: 1em;
  width: 1.25em;
}
.svg-inline--fa.fa-stack-2x {
  height: 2em;
  width: 2.5em;
}

.fa-inverse {
  color: var(--fa-inverse, #fff);
}

.sr-only,
.fa-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only-focusable:not(:focus),
.fa-sr-only-focusable:not(:focus) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.svg-inline--fa .fa-primary {
  fill: var(--fa-primary-color, currentColor);
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa .fa-secondary {
  fill: var(--fa-secondary-color, currentColor);
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-primary {
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-secondary {
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa mask .fa-primary,
.svg-inline--fa mask .fa-secondary {
  fill: black;
}

.fad.fa-inverse,
.fa-duotone.fa-inverse {
  color: var(--fa-inverse, #fff);
}`;function jt(){var n=Tt,t=_t,a=m.cssPrefix,e=m.replacementClass,r=Ia;if(a!==n||e!==t){var o=new RegExp("\\.".concat(n,"\\-"),"g"),i=new RegExp("\\--".concat(n,"\\-"),"g"),s=new RegExp("\\.".concat(t),"g");r=r.replace(o,".".concat(a,"-")).replace(i,"--".concat(a,"-")).replace(s,".".concat(e))}return r}var ft=!1;function Cn(){m.autoAddCss&&!ft&&(Ea(jt()),ft=!0)}var Na={mixout:function(){return{dom:{css:jt,insertCss:Cn}}},hooks:function(){return{beforeDOMElementCreation:function(){Cn()},beforeI2svg:function(){Cn()}}}},_=z||{};_[T]||(_[T]={});_[T].styles||(_[T].styles={});_[T].hooks||(_[T].hooks={});_[T].shims||(_[T].shims=[]);var O=_[T],Yt=[],Ta=function n(){p.removeEventListener("DOMContentLoaded",n),wn=1,Yt.map(function(t){return t()})},wn=!1;L&&(wn=(p.documentElement.doScroll?/^loaded|^c/:/^loaded|^i|^c/).test(p.readyState),wn||p.addEventListener("DOMContentLoaded",Ta));function _a(n){L&&(wn?setTimeout(n,0):Yt.push(n))}function fn(n){var t=n.tag,a=n.attributes,e=a===void 0?{}:a,r=n.children,o=r===void 0?[]:r;return typeof n=="string"?Ft(n):"<".concat(t," ").concat(Pa(e),">").concat(o.map(fn).join(""),"</").concat(t,">")}function lt(n,t,a){if(n&&n[t]&&n[t][a])return{prefix:t,iconName:a,icon:n[t][a]}}var In=function(t,a,e,r){var o=Object.keys(t),i=o.length,s=a,f,u,l;for(e===void 0?(f=1,l=t[o[0]]):(f=0,l=e);f<i;f++)u=o[f],l=s(l,t[u],u,t);return l};function Ma(n){for(var t=[],a=0,e=n.length;a<e;){var r=n.charCodeAt(a++);if(r>=55296&&r<=56319&&a<e){var o=n.charCodeAt(a++);(o&64512)==56320?t.push(((r&1023)<<10)+(o&1023)+65536):(t.push(r),a--)}else t.push(r)}return t}function Rn(n){var t=Ma(n);return t.length===1?t[0].toString(16):null}function La(n,t){var a=n.length,e=n.charCodeAt(t),r;return e>=55296&&e<=56319&&a>t+1&&(r=n.charCodeAt(t+1),r>=56320&&r<=57343)?(e-55296)*1024+r-56320+65536:e}function ct(n){return Object.keys(n).reduce(function(t,a){var e=n[a],r=!!e.icon;return r?t[e.iconName]=e.icon:t[a]=e,t},{})}function zn(n,t){var a=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{},e=a.skipHooks,r=e===void 0?!1:e,o=ct(t);typeof O.hooks.addPack=="function"&&!r?O.hooks.addPack(n,ct(t)):O.styles[n]=c(c({},O.styles[n]||{}),o),n==="fas"&&zn("fa",t)}var gn,bn,pn,G=O.styles,Ra=O.shims,za=(gn={},y(gn,b,Object.values(an[b])),y(gn,h,Object.values(an[h])),gn),Kn=null,Dt={},$t={},Ut={},Wt={},Ht={},Fa=(bn={},y(bn,b,Object.keys(nn[b])),y(bn,h,Object.keys(nn[h])),bn);function ja(n){return~ya.indexOf(n)}function Ya(n,t){var a=t.split("-"),e=a[0],r=a.slice(1).join("-");return e===n&&r!==""&&!ja(r)?r:null}var Xt=function(){var t=function(o){return In(G,function(i,s,f){return i[f]=In(s,o,{}),i},{})};Dt=t(function(r,o,i){if(o[3]&&(r[o[3]]=i),o[2]){var s=o[2].filter(function(f){return typeof f=="number"});s.forEach(function(f){r[f.toString(16)]=i})}return r}),$t=t(function(r,o,i){if(r[i]=i,o[2]){var s=o[2].filter(function(f){return typeof f=="string"});s.forEach(function(f){r[f]=i})}return r}),Ht=t(function(r,o,i){var s=o[2];return r[i]=i,s.forEach(function(f){r[f]=i}),r});var a="far"in G||m.autoFetchSvg,e=In(Ra,function(r,o){var i=o[0],s=o[1],f=o[2];return s==="far"&&!a&&(s="fas"),typeof i=="string"&&(r.names[i]={prefix:s,iconName:f}),typeof i=="number"&&(r.unicodes[i.toString(16)]={prefix:s,iconName:f}),r},{names:{},unicodes:{}});Ut=e.names,Wt=e.unicodes,Kn=En(m.styleDefault,{family:m.familyDefault})};Aa(function(n){Kn=En(n.styleDefault,{family:m.familyDefault})});Xt();function Qn(n,t){return(Dt[n]||{})[t]}function Da(n,t){return($t[n]||{})[t]}function U(n,t){return(Ht[n]||{})[t]}function Gt(n){return Ut[n]||{prefix:null,iconName:null}}function $a(n){var t=Wt[n],a=Qn("fas",n);return t||(a?{prefix:"fas",iconName:a}:null)||{prefix:null,iconName:null}}function F(){return Kn}var Jn=function(){return{prefix:null,iconName:null,rest:[]}};function En(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},a=t.family,e=a===void 0?b:a,r=nn[e][n],o=tn[e][n]||tn[e][r],i=n in O.styles?n:null;return o||i||null}var ut=(pn={},y(pn,b,Object.keys(an[b])),y(pn,h,Object.keys(an[h])),pn);function Sn(n){var t,a=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},e=a.skipLookups,r=e===void 0?!1:e,o=(t={},y(t,b,"".concat(m.cssPrefix,"-").concat(b)),y(t,h,"".concat(m.cssPrefix,"-").concat(h)),t),i=null,s=b;(n.includes(o[b])||n.some(function(u){return ut[b].includes(u)}))&&(s=b),(n.includes(o[h])||n.some(function(u){return ut[h].includes(u)}))&&(s=h);var f=n.reduce(function(u,l){var v=Ya(m.cssPrefix,l);if(G[l]?(l=za[s].includes(l)?va[s][l]:l,i=l,u.prefix=l):Fa[s].indexOf(l)>-1?(i=l,u.prefix=En(l,{family:s})):v?u.iconName=v:l!==m.replacementClass&&l!==o[b]&&l!==o[h]&&u.rest.push(l),!r&&u.prefix&&u.iconName){var d=i==="fa"?Gt(u.iconName):{},g=U(u.prefix,u.iconName);d.prefix&&(i=null),u.iconName=d.iconName||g||u.iconName,u.prefix=d.prefix||u.prefix,u.prefix==="far"&&!G.far&&G.fas&&!m.autoFetchSvg&&(u.prefix="fas")}return u},Jn());return(n.includes("fa-brands")||n.includes("fab"))&&(f.prefix="fab"),(n.includes("fa-duotone")||n.includes("fad"))&&(f.prefix="fad"),!f.prefix&&s===h&&(G.fass||m.autoFetchSvg)&&(f.prefix="fass",f.iconName=U(f.prefix,f.iconName)||f.iconName),(f.prefix==="fa"||i==="fa")&&(f.prefix=F()||"fas"),f}var Ua=(function(){function n(){na(this,n),this.definitions={}}return aa(n,[{key:"add",value:function(){for(var a=this,e=arguments.length,r=new Array(e),o=0;o<e;o++)r[o]=arguments[o];var i=r.reduce(this._pullDefinitions,{});Object.keys(i).forEach(function(s){a.definitions[s]=c(c({},a.definitions[s]||{}),i[s]),zn(s,i[s]);var f=an[b][s];f&&zn(f,i[s]),Xt()})}},{key:"reset",value:function(){this.definitions={}}},{key:"_pullDefinitions",value:function(a,e){var r=e.prefix&&e.iconName&&e.icon?{0:e}:e;return Object.keys(r).map(function(o){var i=r[o],s=i.prefix,f=i.iconName,u=i.icon,l=u[2];a[s]||(a[s]={}),l.length>0&&l.forEach(function(v){typeof v=="string"&&(a[s][v]=u)}),a[s][f]=u}),a}}]),n})(),mt=[],B={},V={},Wa=Object.keys(V);function Ha(n,t){var a=t.mixoutsTo;return mt=n,B={},Object.keys(V).forEach(function(e){Wa.indexOf(e)===-1&&delete V[e]}),mt.forEach(function(e){var r=e.mixout?e.mixout():{};if(Object.keys(r).forEach(function(i){typeof r[i]=="function"&&(a[i]=r[i]),kn(r[i])==="object"&&Object.keys(r[i]).forEach(function(s){a[i]||(a[i]={}),a[i][s]=r[i][s]})}),e.hooks){var o=e.hooks();Object.keys(o).forEach(function(i){B[i]||(B[i]=[]),B[i].push(o[i])})}e.provides&&e.provides(V)}),a}function Fn(n,t){for(var a=arguments.length,e=new Array(a>2?a-2:0),r=2;r<a;r++)e[r-2]=arguments[r];var o=B[n]||[];return o.forEach(function(i){t=i.apply(null,[t].concat(e))}),t}function H(n){for(var t=arguments.length,a=new Array(t>1?t-1:0),e=1;e<t;e++)a[e-1]=arguments[e];var r=B[n]||[];r.forEach(function(o){o.apply(null,a)})}function M(){var n=arguments[0],t=Array.prototype.slice.call(arguments,1);return V[n]?V[n].apply(null,t):void 0}function jn(n){n.prefix==="fa"&&(n.prefix="fas");var t=n.iconName,a=n.prefix||F();if(t)return t=U(a,t)||t,lt(Bt.definitions,a,t)||lt(O.styles,a,t)}var Bt=new Ua,Xa=function(){m.autoReplaceSvg=!1,m.observeMutations=!1,H("noAuto")},Ga={i2svg:function(){var t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};return L?(H("beforeI2svg",t),M("pseudoElements2svg",t),M("i2svg",t)):Promise.reject("Operation requires a DOM of some kind.")},watch:function(){var t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{},a=t.autoReplaceSvgRoot;m.autoReplaceSvg===!1&&(m.autoReplaceSvg=!0),m.observeMutations=!0,_a(function(){Va({autoReplaceSvgRoot:a}),H("watch",t)})}},Ba={icon:function(t){if(t===null)return null;if(kn(t)==="object"&&t.prefix&&t.iconName)return{prefix:t.prefix,iconName:U(t.prefix,t.iconName)||t.iconName};if(Array.isArray(t)&&t.length===2){var a=t[1].indexOf("fa-")===0?t[1].slice(3):t[1],e=En(t[0]);return{prefix:e,iconName:U(e,a)||a}}if(typeof t=="string"&&(t.indexOf("".concat(m.cssPrefix,"-"))>-1||t.match(da))){var r=Sn(t.split(" "),{skipLookups:!0});return{prefix:r.prefix||F(),iconName:U(r.prefix,r.iconName)||r.iconName}}if(typeof t=="string"){var o=F();return{prefix:o,iconName:U(o,t)||t}}}},E={noAuto:Xa,config:m,dom:Ga,parse:Ba,library:Bt,findIconDefinition:jn,toHtml:fn},Va=function(){var t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{},a=t.autoReplaceSvgRoot,e=a===void 0?p:a;(Object.keys(O.styles).length>0||m.autoFetchSvg)&&L&&m.autoReplaceSvg&&E.dom.i2svg({node:e})};function Pn(n,t){return Object.defineProperty(n,"abstract",{get:t}),Object.defineProperty(n,"html",{get:function(){return n.abstract.map(function(e){return fn(e)})}}),Object.defineProperty(n,"node",{get:function(){if(L){var e=p.createElement("div");return e.innerHTML=n.html,e.children}}}),n}function qa(n){var t=n.children,a=n.main,e=n.mask,r=n.attributes,o=n.styles,i=n.transform;if(qn(i)&&a.found&&!e.found){var s=a.width,f=a.height,u={x:s/f/2,y:.5};r.style=An(c(c({},o),{},{"transform-origin":"".concat(u.x+i.x/16,"em ").concat(u.y+i.y/16,"em")}))}return[{tag:"svg",attributes:r,children:t}]}function Ka(n){var t=n.prefix,a=n.iconName,e=n.children,r=n.attributes,o=n.symbol,i=o===!0?"".concat(t,"-").concat(m.cssPrefix,"-").concat(a):o;return[{tag:"svg",attributes:{style:"display: none;"},children:[{tag:"symbol",attributes:c(c({},r),{},{id:i}),children:e}]}]}function Zn(n){var t=n.icons,a=t.main,e=t.mask,r=n.prefix,o=n.iconName,i=n.transform,s=n.symbol,f=n.title,u=n.maskId,l=n.titleId,v=n.extra,d=n.watchable,g=d===void 0?!1:d,w=e.found?e:a,S=w.width,P=w.height,C=r==="fak",k=[m.replacementClass,o?"".concat(m.cssPrefix,"-").concat(o):""].filter(function(R){return v.classes.indexOf(R)===-1}).filter(function(R){return R!==""||!!R}).concat(v.classes).join(" "),x={children:[],attributes:c(c({},v.attributes),{},{"data-prefix":r,"data-icon":o,class:k,role:v.attributes.role||"img",xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 ".concat(S," ").concat(P)})},I=C&&!~v.classes.indexOf("fa-fw")?{width:"".concat(S/P*16*.0625,"em")}:{};g&&(x.attributes[W]=""),f&&(x.children.push({tag:"title",attributes:{id:x.attributes["aria-labelledby"]||"title-".concat(l||rn())},children:[f]}),delete x.attributes.title);var A=c(c({},x),{},{prefix:r,iconName:o,main:a,mask:e,maskId:u,transform:i,symbol:s,styles:c(c({},I),v.styles)}),Y=e.found&&a.found?M("generateAbstractMask",A)||{children:[],attributes:{}}:M("generateAbstractIcon",A)||{children:[],attributes:{}},D=Y.children,On=Y.attributes;return A.children=D,A.attributes=On,s?Ka(A):qa(A)}function vt(n){var t=n.content,a=n.width,e=n.height,r=n.transform,o=n.title,i=n.extra,s=n.watchable,f=s===void 0?!1:s,u=c(c(c({},i.attributes),o?{title:o}:{}),{},{class:i.classes.join(" ")});f&&(u[W]="");var l=c({},i.styles);qn(r)&&(l.transform=Ca({transform:r,width:a,height:e}),l["-webkit-transform"]=l.transform);var v=An(l);v.length>0&&(u.style=v);var d=[];return d.push({tag:"span",attributes:u,children:[t]}),o&&d.push({tag:"span",attributes:{class:"sr-only"},children:[o]}),d}function Qa(n){var t=n.content,a=n.title,e=n.extra,r=c(c(c({},e.attributes),a?{title:a}:{}),{},{class:e.classes.join(" ")}),o=An(e.styles);o.length>0&&(r.style=o);var i=[];return i.push({tag:"span",attributes:r,children:[t]}),a&&i.push({tag:"span",attributes:{class:"sr-only"},children:[a]}),i}var Nn=O.styles;function Yn(n){var t=n[0],a=n[1],e=n.slice(4),r=Wn(e,1),o=r[0],i=null;return Array.isArray(o)?i={tag:"g",attributes:{class:"".concat(m.cssPrefix,"-").concat($.GROUP)},children:[{tag:"path",attributes:{class:"".concat(m.cssPrefix,"-").concat($.SECONDARY),fill:"currentColor",d:o[0]}},{tag:"path",attributes:{class:"".concat(m.cssPrefix,"-").concat($.PRIMARY),fill:"currentColor",d:o[1]}}]}:i={tag:"path",attributes:{fill:"currentColor",d:o}},{found:!0,width:t,height:a,icon:i}}var Ja={found:!1,width:512,height:512};function Za(n,t){!Mt&&!m.showMissingIcons&&n&&console.error('Icon with name "'.concat(n,'" and prefix "').concat(t,'" is missing.'))}function Dn(n,t){var a=t;return t==="fa"&&m.styleDefault!==null&&(t=F()),new Promise(function(e,r){if(M("missingIconAbstract"),a==="fa"){var o=Gt(n)||{};n=o.iconName||n,t=o.prefix||t}if(n&&t&&Nn[t]&&Nn[t][n]){var i=Nn[t][n];return e(Yn(i))}Za(n,t),e(c(c({},Ja),{},{icon:m.showMissingIcons&&n?M("missingIconAbstract")||{}:{}}))})}var dt=function(){},$n=m.measurePerformance&&ln&&ln.mark&&ln.measure?ln:{mark:dt,measure:dt},Q='FA "6.2.1"',ne=function(t){return $n.mark("".concat(Q," ").concat(t," begins")),function(){return Vt(t)}},Vt=function(t){$n.mark("".concat(Q," ").concat(t," ends")),$n.measure("".concat(Q," ").concat(t),"".concat(Q," ").concat(t," begins"),"".concat(Q," ").concat(t," ends"))},nt={begin:ne,end:Vt},hn=function(){};function gt(n){var t=n.getAttribute?n.getAttribute(W):null;return typeof t=="string"}function te(n){var t=n.getAttribute?n.getAttribute(Xn):null,a=n.getAttribute?n.getAttribute(Gn):null;return t&&a}function ae(n){return n&&n.classList&&n.classList.contains&&n.classList.contains(m.replacementClass)}function ee(){if(m.autoReplaceSvg===!0)return yn.replace;var n=yn[m.autoReplaceSvg];return n||yn.replace}function re(n){return p.createElementNS("http://www.w3.org/2000/svg",n)}function ie(n){return p.createElement(n)}function qt(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},a=t.ceFn,e=a===void 0?n.tag==="svg"?re:ie:a;if(typeof n=="string")return p.createTextNode(n);var r=e(n.tag);Object.keys(n.attributes||[]).forEach(function(i){r.setAttribute(i,n.attributes[i])});var o=n.children||[];return o.forEach(function(i){r.appendChild(qt(i,{ceFn:e}))}),r}function oe(n){var t=" ".concat(n.outerHTML," ");return t="".concat(t,"Font Awesome fontawesome.com "),t}var yn={replace:function(t){var a=t[0];if(a.parentNode)if(t[1].forEach(function(r){a.parentNode.insertBefore(qt(r),a)}),a.getAttribute(W)===null&&m.keepOriginalSource){var e=p.createComment(oe(a));a.parentNode.replaceChild(e,a)}else a.remove()},nest:function(t){var a=t[0],e=t[1];if(~Vn(a).indexOf(m.replacementClass))return yn.replace(t);var r=new RegExp("".concat(m.cssPrefix,"-.*"));if(delete e[0].attributes.id,e[0].attributes.class){var o=e[0].attributes.class.split(" ").reduce(function(s,f){return f===m.replacementClass||f.match(r)?s.toSvg.push(f):s.toNode.push(f),s},{toNode:[],toSvg:[]});e[0].attributes.class=o.toSvg.join(" "),o.toNode.length===0?a.removeAttribute("class"):a.setAttribute("class",o.toNode.join(" "))}var i=e.map(function(s){return fn(s)}).join(`
`);a.setAttribute(W,""),a.innerHTML=i}};function bt(n){n()}function Kt(n,t){var a=typeof t=="function"?t:hn;if(n.length===0)a();else{var e=bt;m.mutateApproach===ua&&(e=z.requestAnimationFrame||bt),e(function(){var r=ee(),o=nt.begin("mutate");n.map(r),o(),a()})}}var tt=!1;function Qt(){tt=!0}function Un(){tt=!1}var xn=null;function pt(n){if(ot&&m.observeMutations){var t=n.treeCallback,a=t===void 0?hn:t,e=n.nodeCallback,r=e===void 0?hn:e,o=n.pseudoElementsCallback,i=o===void 0?hn:o,s=n.observeMutationsRoot,f=s===void 0?p:s;xn=new ot(function(u){if(!tt){var l=F();K(u).forEach(function(v){if(v.type==="childList"&&v.addedNodes.length>0&&!gt(v.addedNodes[0])&&(m.searchPseudoElements&&i(v.target),a(v.target)),v.type==="attributes"&&v.target.parentNode&&m.searchPseudoElements&&i(v.target.parentNode),v.type==="attributes"&&gt(v.target)&&~ha.indexOf(v.attributeName))if(v.attributeName==="class"&&te(v.target)){var d=Sn(Vn(v.target)),g=d.prefix,w=d.iconName;v.target.setAttribute(Xn,g||l),w&&v.target.setAttribute(Gn,w)}else ae(v.target)&&r(v.target)})}}),L&&xn.observe(f,{childList:!0,attributes:!0,characterData:!0,subtree:!0})}}function se(){xn&&xn.disconnect()}function fe(n){var t=n.getAttribute("style"),a=[];return t&&(a=t.split(";").reduce(function(e,r){var o=r.split(":"),i=o[0],s=o.slice(1);return i&&s.length>0&&(e[i]=s.join(":").trim()),e},{})),a}function le(n){var t=n.getAttribute("data-prefix"),a=n.getAttribute("data-icon"),e=n.innerText!==void 0?n.innerText.trim():"",r=Sn(Vn(n));return r.prefix||(r.prefix=F()),t&&a&&(r.prefix=t,r.iconName=a),r.iconName&&r.prefix||(r.prefix&&e.length>0&&(r.iconName=Da(r.prefix,n.innerText)||Qn(r.prefix,Rn(n.innerText))),!r.iconName&&m.autoFetchSvg&&n.firstChild&&n.firstChild.nodeType===Node.TEXT_NODE&&(r.iconName=n.firstChild.data)),r}function ce(n){var t=K(n.attributes).reduce(function(r,o){return r.name!=="class"&&r.name!=="style"&&(r[o.name]=o.value),r},{}),a=n.getAttribute("title"),e=n.getAttribute("data-fa-title-id");return m.autoA11y&&(a?t["aria-labelledby"]="".concat(m.replacementClass,"-title-").concat(e||rn()):(t["aria-hidden"]="true",t.focusable="false")),t}function ue(){return{iconName:null,title:null,titleId:null,prefix:null,transform:N,symbol:!1,mask:{iconName:null,prefix:null,rest:[]},maskId:null,extra:{classes:[],styles:{},attributes:{}}}}function ht(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{styleParser:!0},a=le(n),e=a.iconName,r=a.prefix,o=a.rest,i=ce(n),s=Fn("parseNodeAttributes",{},n),f=t.styleParser?fe(n):[];return c({iconName:e,title:n.getAttribute("title"),titleId:n.getAttribute("data-fa-title-id"),prefix:r,transform:N,mask:{iconName:null,prefix:null,rest:[]},maskId:null,symbol:!1,extra:{classes:o,styles:f,attributes:i}},s)}var me=O.styles;function Jt(n){var t=m.autoReplaceSvg==="nest"?ht(n,{styleParser:!1}):ht(n);return~t.extra.classes.indexOf(Lt)?M("generateLayersText",n,t):M("generateSvgReplacementMutation",n,t)}var j=new Set;Bn.map(function(n){j.add("fa-".concat(n))});Object.keys(nn[b]).map(j.add.bind(j));Object.keys(nn[h]).map(j.add.bind(j));j=on(j);function yt(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:null;if(!L)return Promise.resolve();var a=p.documentElement.classList,e=function(v){return a.add("".concat(st,"-").concat(v))},r=function(v){return a.remove("".concat(st,"-").concat(v))},o=m.autoFetchSvg?j:Bn.map(function(l){return"fa-".concat(l)}).concat(Object.keys(me));o.includes("fa")||o.push("fa");var i=[".".concat(Lt,":not([").concat(W,"])")].concat(o.map(function(l){return".".concat(l,":not([").concat(W,"])")})).join(", ");if(i.length===0)return Promise.resolve();var s=[];try{s=K(n.querySelectorAll(i))}catch{}if(s.length>0)e("pending"),r("complete");else return Promise.resolve();var f=nt.begin("onTree"),u=s.reduce(function(l,v){try{var d=Jt(v);d&&l.push(d)}catch(g){Mt||g.name==="MissingIcon"&&console.error(g)}return l},[]);return new Promise(function(l,v){Promise.all(u).then(function(d){Kt(d,function(){e("active"),e("complete"),r("pending"),typeof t=="function"&&t(),f(),l()})}).catch(function(d){f(),v(d)})})}function ve(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:null;Jt(n).then(function(a){a&&Kt([a],t)})}function de(n){return function(t){var a=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},e=(t||{}).icon?t:jn(t||{}),r=a.mask;return r&&(r=(r||{}).icon?r:jn(r||{})),n(e,c(c({},a),{},{mask:r}))}}var ge=function(t){var a=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},e=a.transform,r=e===void 0?N:e,o=a.symbol,i=o===void 0?!1:o,s=a.mask,f=s===void 0?null:s,u=a.maskId,l=u===void 0?null:u,v=a.title,d=v===void 0?null:v,g=a.titleId,w=g===void 0?null:g,S=a.classes,P=S===void 0?[]:S,C=a.attributes,k=C===void 0?{}:C,x=a.styles,I=x===void 0?{}:x;if(t){var A=t.prefix,Y=t.iconName,D=t.icon;return Pn(c({type:"icon"},t),function(){return H("beforeDOMElementCreation",{iconDefinition:t,params:a}),m.autoA11y&&(d?k["aria-labelledby"]="".concat(m.replacementClass,"-title-").concat(w||rn()):(k["aria-hidden"]="true",k.focusable="false")),Zn({icons:{main:Yn(D),mask:f?Yn(f.icon):{found:!1,width:null,height:null,icon:{}}},prefix:A,iconName:Y,transform:c(c({},N),r),symbol:i,title:d,maskId:l,titleId:w,extra:{attributes:k,styles:I,classes:P}})})}},be={mixout:function(){return{icon:de(ge)}},hooks:function(){return{mutationObserverCallbacks:function(a){return a.treeCallback=yt,a.nodeCallback=ve,a}}},provides:function(t){t.i2svg=function(a){var e=a.node,r=e===void 0?p:e,o=a.callback,i=o===void 0?function(){}:o;return yt(r,i)},t.generateSvgReplacementMutation=function(a,e){var r=e.iconName,o=e.title,i=e.titleId,s=e.prefix,f=e.transform,u=e.symbol,l=e.mask,v=e.maskId,d=e.extra;return new Promise(function(g,w){Promise.all([Dn(r,s),l.iconName?Dn(l.iconName,l.prefix):Promise.resolve({found:!1,width:512,height:512,icon:{}})]).then(function(S){var P=Wn(S,2),C=P[0],k=P[1];g([a,Zn({icons:{main:C,mask:k},prefix:s,iconName:r,transform:f,symbol:u,maskId:v,title:o,titleId:i,extra:d,watchable:!0})])}).catch(w)})},t.generateAbstractIcon=function(a){var e=a.children,r=a.attributes,o=a.main,i=a.transform,s=a.styles,f=An(s);f.length>0&&(r.style=f);var u;return qn(i)&&(u=M("generateAbstractTransformGrouping",{main:o,transform:i,containerWidth:o.width,iconWidth:o.width})),e.push(u||o.icon),{children:e,attributes:r}}}},pe={mixout:function(){return{layer:function(a){var e=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},r=e.classes,o=r===void 0?[]:r;return Pn({type:"layer"},function(){H("beforeDOMElementCreation",{assembler:a,params:e});var i=[];return a(function(s){Array.isArray(s)?s.map(function(f){i=i.concat(f.abstract)}):i=i.concat(s.abstract)}),[{tag:"span",attributes:{class:["".concat(m.cssPrefix,"-layers")].concat(on(o)).join(" ")},children:i}]})}}}},he={mixout:function(){return{counter:function(a){var e=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},r=e.title,o=r===void 0?null:r,i=e.classes,s=i===void 0?[]:i,f=e.attributes,u=f===void 0?{}:f,l=e.styles,v=l===void 0?{}:l;return Pn({type:"counter",content:a},function(){return H("beforeDOMElementCreation",{content:a,params:e}),Qa({content:a.toString(),title:o,extra:{attributes:u,styles:v,classes:["".concat(m.cssPrefix,"-layers-counter")].concat(on(s))}})})}}}},ye={mixout:function(){return{text:function(a){var e=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},r=e.transform,o=r===void 0?N:r,i=e.title,s=i===void 0?null:i,f=e.classes,u=f===void 0?[]:f,l=e.attributes,v=l===void 0?{}:l,d=e.styles,g=d===void 0?{}:d;return Pn({type:"text",content:a},function(){return H("beforeDOMElementCreation",{content:a,params:e}),vt({content:a,transform:c(c({},N),o),title:s,extra:{attributes:v,styles:g,classes:["".concat(m.cssPrefix,"-layers-text")].concat(on(u))}})})}}},provides:function(t){t.generateLayersText=function(a,e){var r=e.title,o=e.transform,i=e.extra,s=null,f=null;if(Nt){var u=parseInt(getComputedStyle(a).fontSize,10),l=a.getBoundingClientRect();s=l.width/u,f=l.height/u}return m.autoA11y&&!r&&(i.attributes["aria-hidden"]="true"),Promise.resolve([a,vt({content:a.innerHTML,width:s,height:f,transform:o,title:r,extra:i,watchable:!0})])}}},ke=new RegExp('"',"ug"),kt=[1105920,1112319];function we(n){var t=n.replace(ke,""),a=La(t,0),e=a>=kt[0]&&a<=kt[1],r=t.length===2?t[0]===t[1]:!1;return{value:Rn(r?t[0]:t),isSecondary:e||r}}function wt(n,t){var a="".concat(ca).concat(t.replace(":","-"));return new Promise(function(e,r){if(n.getAttribute(a)!==null)return e();var o=K(n.children),i=o.filter(function(D){return D.getAttribute(Ln)===t})[0],s=z.getComputedStyle(n,t),f=s.getPropertyValue("font-family").match(ga),u=s.getPropertyValue("font-weight"),l=s.getPropertyValue("content");if(i&&!f)return n.removeChild(i),e();if(f&&l!=="none"&&l!==""){var v=s.getPropertyValue("content"),d=~["Sharp"].indexOf(f[2])?h:b,g=~["Solid","Regular","Light","Thin","Duotone","Brands","Kit"].indexOf(f[2])?tn[d][f[2].toLowerCase()]:ba[d][u],w=we(v),S=w.value,P=w.isSecondary,C=f[0].startsWith("FontAwesome"),k=Qn(g,S),x=k;if(C){var I=$a(S);I.iconName&&I.prefix&&(k=I.iconName,g=I.prefix)}if(k&&!P&&(!i||i.getAttribute(Xn)!==g||i.getAttribute(Gn)!==x)){n.setAttribute(a,x),i&&n.removeChild(i);var A=ue(),Y=A.extra;Y.attributes[Ln]=t,Dn(k,g).then(function(D){var On=Zn(c(c({},A),{},{icons:{main:D,mask:Jn()},prefix:g,iconName:x,extra:Y,watchable:!0})),R=p.createElement("svg");t==="::before"?n.insertBefore(R,n.firstChild):n.appendChild(R),R.outerHTML=On.map(function(Zt){return fn(Zt)}).join(`
`),n.removeAttribute(a),e()}).catch(r)}else e()}else e()})}function xe(n){return Promise.all([wt(n,"::before"),wt(n,"::after")])}function Ae(n){return n.parentNode!==document.head&&!~ma.indexOf(n.tagName.toUpperCase())&&!n.getAttribute(Ln)&&(!n.parentNode||n.parentNode.tagName!=="svg")}function xt(n){if(L)return new Promise(function(t,a){var e=K(n.querySelectorAll("*")).filter(Ae).map(xe),r=nt.begin("searchPseudoElements");Qt(),Promise.all(e).then(function(){r(),Un(),t()}).catch(function(){r(),Un(),a()})})}var Ee={hooks:function(){return{mutationObserverCallbacks:function(a){return a.pseudoElementsCallback=xt,a}}},provides:function(t){t.pseudoElements2svg=function(a){var e=a.node,r=e===void 0?p:e;m.searchPseudoElements&&xt(r)}}},At=!1,Se={mixout:function(){return{dom:{unwatch:function(){Qt(),At=!0}}}},hooks:function(){return{bootstrap:function(){pt(Fn("mutationObserverCallbacks",{}))},noAuto:function(){se()},watch:function(a){var e=a.observeMutationsRoot;At?Un():pt(Fn("mutationObserverCallbacks",{observeMutationsRoot:e}))}}}},Et=function(t){var a={size:16,x:0,y:0,flipX:!1,flipY:!1,rotate:0};return t.toLowerCase().split(" ").reduce(function(e,r){var o=r.toLowerCase().split("-"),i=o[0],s=o.slice(1).join("-");if(i&&s==="h")return e.flipX=!0,e;if(i&&s==="v")return e.flipY=!0,e;if(s=parseFloat(s),isNaN(s))return e;switch(i){case"grow":e.size=e.size+s;break;case"shrink":e.size=e.size-s;break;case"left":e.x=e.x-s;break;case"right":e.x=e.x+s;break;case"up":e.y=e.y-s;break;case"down":e.y=e.y+s;break;case"rotate":e.rotate=e.rotate+s;break}return e},a)},Pe={mixout:function(){return{parse:{transform:function(a){return Et(a)}}}},hooks:function(){return{parseNodeAttributes:function(a,e){var r=e.getAttribute("data-fa-transform");return r&&(a.transform=Et(r)),a}}},provides:function(t){t.generateAbstractTransformGrouping=function(a){var e=a.main,r=a.transform,o=a.containerWidth,i=a.iconWidth,s={transform:"translate(".concat(o/2," 256)")},f="translate(".concat(r.x*32,", ").concat(r.y*32,") "),u="scale(".concat(r.size/16*(r.flipX?-1:1),", ").concat(r.size/16*(r.flipY?-1:1),") "),l="rotate(".concat(r.rotate," 0 0)"),v={transform:"".concat(f," ").concat(u," ").concat(l)},d={transform:"translate(".concat(i/2*-1," -256)")},g={outer:s,inner:v,path:d};return{tag:"g",attributes:c({},g.outer),children:[{tag:"g",attributes:c({},g.inner),children:[{tag:e.icon.tag,children:e.icon.children,attributes:c(c({},e.icon.attributes),g.path)}]}]}}}},Tn={x:0,y:0,width:"100%",height:"100%"};function St(n){var t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:!0;return n.attributes&&(n.attributes.fill||t)&&(n.attributes.fill="black"),n}function Oe(n){return n.tag==="g"?n.children:[n]}var Ce={hooks:function(){return{parseNodeAttributes:function(a,e){var r=e.getAttribute("data-fa-mask"),o=r?Sn(r.split(" ").map(function(i){return i.trim()})):Jn();return o.prefix||(o.prefix=F()),a.mask=o,a.maskId=e.getAttribute("data-fa-mask-id"),a}}},provides:function(t){t.generateAbstractMask=function(a){var e=a.children,r=a.attributes,o=a.main,i=a.mask,s=a.maskId,f=a.transform,u=o.width,l=o.icon,v=i.width,d=i.icon,g=Oa({transform:f,containerWidth:v,iconWidth:u}),w={tag:"rect",attributes:c(c({},Tn),{},{fill:"white"})},S=l.children?{children:l.children.map(St)}:{},P={tag:"g",attributes:c({},g.inner),children:[St(c({tag:l.tag,attributes:c(c({},l.attributes),g.path)},S))]},C={tag:"g",attributes:c({},g.outer),children:[P]},k="mask-".concat(s||rn()),x="clip-".concat(s||rn()),I={tag:"mask",attributes:c(c({},Tn),{},{id:k,maskUnits:"userSpaceOnUse",maskContentUnits:"userSpaceOnUse"}),children:[w,C]},A={tag:"defs",children:[{tag:"clipPath",attributes:{id:x},children:Oe(d)},I]};return e.push(A,{tag:"rect",attributes:c({fill:"currentColor","clip-path":"url(#".concat(x,")"),mask:"url(#".concat(k,")")},Tn)}),{children:e,attributes:r}}}},Ie={provides:function(t){var a=!1;z.matchMedia&&(a=z.matchMedia("(prefers-reduced-motion: reduce)").matches),t.missingIconAbstract=function(){var e=[],r={fill:"currentColor"},o={attributeType:"XML",repeatCount:"indefinite",dur:"2s"};e.push({tag:"path",attributes:c(c({},r),{},{d:"M156.5,447.7l-12.6,29.5c-18.7-9.5-35.9-21.2-51.5-34.9l22.7-22.7C127.6,430.5,141.5,440,156.5,447.7z M40.6,272H8.5 c1.4,21.2,5.4,41.7,11.7,61.1L50,321.2C45.1,305.5,41.8,289,40.6,272z M40.6,240c1.4-18.8,5.2-37,11.1-54.1l-29.5-12.6 C14.7,194.3,10,216.7,8.5,240H40.6z M64.3,156.5c7.8-14.9,17.2-28.8,28.1-41.5L69.7,92.3c-13.7,15.6-25.5,32.8-34.9,51.5 L64.3,156.5z M397,419.6c-13.9,12-29.4,22.3-46.1,30.4l11.9,29.8c20.7-9.9,39.8-22.6,56.9-37.6L397,419.6z M115,92.4 c13.9-12,29.4-22.3,46.1-30.4l-11.9-29.8c-20.7,9.9-39.8,22.6-56.8,37.6L115,92.4z M447.7,355.5c-7.8,14.9-17.2,28.8-28.1,41.5 l22.7,22.7c13.7-15.6,25.5-32.9,34.9-51.5L447.7,355.5z M471.4,272c-1.4,18.8-5.2,37-11.1,54.1l29.5,12.6 c7.5-21.1,12.2-43.5,13.6-66.8H471.4z M321.2,462c-15.7,5-32.2,8.2-49.2,9.4v32.1c21.2-1.4,41.7-5.4,61.1-11.7L321.2,462z M240,471.4c-18.8-1.4-37-5.2-54.1-11.1l-12.6,29.5c21.1,7.5,43.5,12.2,66.8,13.6V471.4z M462,190.8c5,15.7,8.2,32.2,9.4,49.2h32.1 c-1.4-21.2-5.4-41.7-11.7-61.1L462,190.8z M92.4,397c-12-13.9-22.3-29.4-30.4-46.1l-29.8,11.9c9.9,20.7,22.6,39.8,37.6,56.9 L92.4,397z M272,40.6c18.8,1.4,36.9,5.2,54.1,11.1l12.6-29.5C317.7,14.7,295.3,10,272,8.5V40.6z M190.8,50 c15.7-5,32.2-8.2,49.2-9.4V8.5c-21.2,1.4-41.7,5.4-61.1,11.7L190.8,50z M442.3,92.3L419.6,115c12,13.9,22.3,29.4,30.5,46.1 l29.8-11.9C470,128.5,457.3,109.4,442.3,92.3z M397,92.4l22.7-22.7c-15.6-13.7-32.8-25.5-51.5-34.9l-12.6,29.5 C370.4,72.1,384.4,81.5,397,92.4z"})});var i=c(c({},o),{},{attributeName:"opacity"}),s={tag:"circle",attributes:c(c({},r),{},{cx:"256",cy:"364",r:"28"}),children:[]};return a||s.children.push({tag:"animate",attributes:c(c({},o),{},{attributeName:"r",values:"28;14;28;28;14;28;"})},{tag:"animate",attributes:c(c({},i),{},{values:"1;0;1;1;0;1;"})}),e.push(s),e.push({tag:"path",attributes:c(c({},r),{},{opacity:"1",d:"M263.7,312h-16c-6.6,0-12-5.4-12-12c0-71,77.4-63.9,77.4-107.8c0-20-17.8-40.2-57.4-40.2c-29.1,0-44.3,9.6-59.2,28.7 c-3.9,5-11.1,6-16.2,2.4l-13.1-9.2c-5.6-3.9-6.9-11.8-2.6-17.2c21.2-27.2,46.4-44.7,91.2-44.7c52.3,0,97.4,29.8,97.4,80.2 c0,67.6-77.4,63.5-77.4,107.8C275.7,306.6,270.3,312,263.7,312z"}),children:a?[]:[{tag:"animate",attributes:c(c({},i),{},{values:"1;0;0;0;0;1;"})}]}),a||e.push({tag:"path",attributes:c(c({},r),{},{opacity:"0",d:"M232.5,134.5l7,168c0.3,6.4,5.6,11.5,12,11.5h9c6.4,0,11.7-5.1,12-11.5l7-168c0.3-6.8-5.2-12.5-12-12.5h-23 C237.7,122,232.2,127.7,232.5,134.5z"}),children:[{tag:"animate",attributes:c(c({},i),{},{values:"0;0;1;1;0;0;"})}]}),{tag:"g",attributes:{class:"missing"},children:e}}}},Ne={hooks:function(){return{parseNodeAttributes:function(a,e){var r=e.getAttribute("data-fa-symbol"),o=r===null?!1:r===""?!0:r;return a.symbol=o,a}}}},Te=[Na,be,pe,he,ye,Ee,Se,Pe,Ce,Ie,Ne];Ha(Te,{mixoutsTo:E});E.noAuto;E.config;E.library;E.dom;var _e=E.parse;E.findIconDefinition;E.toHtml;var Me=E.icon;E.layer;E.text;E.counter;export{Me as i,_e as p};
