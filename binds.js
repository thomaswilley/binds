'use strict';

let fragMap = new Map();
let fragsBasePath;
let object;
let objectName;
let databasePropertyName;
let FRAGTYPES = Object.freeze({
  none: null,
  loading: -1
});

const clearBinds = () => {
  ObservableSlim.remove(object[databasePropertyName]);
  object[databasePropertyName] = object['_'+databasePropertyName];
}

const loadBinds = (_object, _databasePropertyName, _fragsBasePath) => {
	fragsBasePath = _fragsBasePath;
	object = _object;
	objectName = _databasePropertyName.split('.')[0];
	databasePropertyName = _databasePropertyName.split('.')[1];

  object['_' + databasePropertyName] = object[databasePropertyName];
  object[databasePropertyName] = ObservableSlim.create(object['_' + databasePropertyName], true, function(changes) {
    changes.forEach((change) => {
      let path = objectName + '.' + databasePropertyName + '.' + change.currentPath;
      let toRender = pathsToRender(path);
      if (toRender) {
        document.querySelectorAll('[data-bind="'+toRender+'"]').forEach((el) => {
          try {
            renderElement(el, toRender);
          } catch(err) {
            console.log('unable to render @ ', toRender);
          }
        });
      }
    });
  });
}

/*
const loadBinds = () => {
  window._db = db;
  window.db = ObservableSlim.create(window._db, true, function(changes) {
    changes.forEach((change) => {
      let path = 'db.' + change.currentPath;
      let toRender = pathsToRender(path);
      if (toRender) {
        document.querySelectorAll('[data-bind="'+toRender+'"]').forEach((el) => {
          try {
            renderElement(el, toRender);
          } catch(err) {
            console.log('unable to render @ ', toRender);
          }
        });
      }
    });
  });
}
	*/

const getAllKeys = (rootName, obj) => {
  const isObject = val =>
    val && typeof val === 'object' && !Array.isArray(val);

  const addDelimiter = (a, b) =>
    a ? `${a}.${b}` : b;

  const paths = (obj = {}, head = '') => {
    return Object.entries(obj).reduce((product, [key, value]) => 
      {
        let fullPath = addDelimiter(head, key)
        if (isObject(value)) {
          let ret = product.concat(paths(value, fullPath));
          ret = ret.concat(fullPath);
          return ret;
        } else {
          return product.concat(fullPath);
        }
      }, []);
  }

  var keys = paths(obj);
  for (var i = 0; i < keys.length; i++) {
    keys[i] = rootName + '.' + keys[i];
  }

	if (!keys.includes(rootName)) keys.push(rootName);

  return keys;
}

const forceRenderElement = (el) => {
	let elBind = el;
	let pathBind = el.dataset['bind']
	try {
		renderElement(elBind, pathBind);
	} catch(err) {
		console.log('unable to render @ ', pathBind, err);
	}
}

const forceRenderAll = () => {
  let keysInDB = getAllKeys(`${objectName}.${databasePropertyName}`, object[databasePropertyName]);
  let availableBinds = [];
  document.querySelectorAll('[data-bind]').forEach((el) => {
    let thisBind = {};
    let elBind = el;
    let pathBind = el.dataset['bind']
    thisBind[pathBind] = elBind;
    availableBinds.push(thisBind);
    if (keysInDB.includes(pathBind)) {
      try {
        renderElement(elBind, pathBind);
      } catch(err) {
        console.log('unable to render @ ', pathBind, err);
      }
    }
  });
  return availableBinds;
};

const pathsToRender = (path) => {
  // traverse this path and it's parents
  // return array of all which are referenced by a dom element (via data-bind property)
  // note: brute force for now. inelegant & low performance.
  if (document.querySelectorAll('[data-bind="'+path+'"]').length > 0) {
    return path;
  } else {
    let nodes = path.split('.');
    if (nodes.length > 1) {
      return pathsToRender(nodes.slice(0, nodes.length-1).join('.'));
    }
  }
}

const renderElement = async (el, path, target) => {
  //console.log('render @ ', el, path, target);
  var newEl = document.createElement(el.nodeName);
  el.getAttributeNames().forEach((attr) => {
    newEl.setAttribute(attr, el.getAttribute(attr));
  });

  let bindTo = el.dataset['bind'];
	// special case (* === page load)
	if (bindTo === '*') bindTo = `${objectName}.${databasePropertyName}`;

  // observableslim uses .0/i..n notation for arrays. detect & change to [i] for eval
  let lastNode = parseInt(bindTo.split('.').reverse()[0]);
  if (!isNaN(lastNode)) {
    let leaves = bindTo.split('.');
    if(leaves.length > 1) {
      bindTo = leaves.slice(0, leaves.length-1).join('.') + '[' + lastNode.toString() + ']';
    }
  }

  if (el.dataset.rootonlyopwrap) {
    bindTo = el.dataset.rootonlyopwrap + '(' + bindTo + ')';
  }

  if (el.dataset.selector) {
    bindTo = bindTo + '[' + el.dataset.selector + ']';
  }

	if (el.dataset.evalselector) {
		bindTo = bindTo + '["' + eval(el.dataset.evalselector) + '"]';
	}

  if (el.dataset.filter) {
    bindTo = bindTo + '.' + el.dataset.filter;
  }

  if (el.dataset.opwrap) {
    bindTo = el.dataset.opwrap + '(' + bindTo + ')';
  }

  if (el.dataset.trailingfilter) {
    bindTo = bindTo + '.' + el.dataset.trailingfilter;
  }

  if (el.dataset.debug) {
    console.log(">>> DEBUG element: ", bindTo, eval(bindTo));
  }

	var itemsRaw = eval(bindTo);

	if (el.dataset.preprocessor) {
		let preprocessor = eval(el.dataset.preprocessor);
		if (preprocessor) {
			itemsRaw = preprocessor.call(this, itemsRaw);
		}
	}

  let bTemplated = el.dataset.template || el.dataset.fragtemplate ? true : false;
  let itemPostProcessor = eval(el.dataset['postprocessor']);

  let items = typeof(itemsRaw) === 'object' && itemsRaw.length ? Array.prototype.slice.call(itemsRaw) : [itemsRaw];
 
  if (!bTemplated) {
    //items = typeof(itemsRaw) === 'object' && itemsRaw.length ? Array.prototype.slice.call(itemsRaw) : [itemsRaw];
    let itemRender = eval(el.dataset['itemtemplate']);

    if (!itemRender) {
      // get parent's itemRender and use that. we're in a dynamic child.
      // TODO: make this recursive; for now it only looks at first parent and then fails non-gracefully.
      itemRender = eval(el.parentNode.dataset['itemtemplate']);
      if (!itemRender && !itemPostProcessor) {
        if (items.length === 1) {
          newEl.appendChild(document.createTextNode(items[0]));
        } else {
          console.log('exception. unable to render child b/c parent doesnt have a template: ', path, items);
        }
      }
    }
    else {
      items.forEach((item,index,arr) => {
        let elNew = itemRender(item);
        if(arr.length>1) {
          elNew.dataset['bind'] = path + '.' + index;
        }
        newEl.appendChild(elNew);
      });
    }
  }
  else {
    let template;
    let templateHtml;
    if (el.dataset.fragtemplate) {
      template = document.createElement('template');
      templateHtml = await getFragTemplate(el.dataset.fragtemplate);

    } else {
      templateHtml = document.getElementById(el.dataset.template).innerHTML;
    }

    if (!templateHtml) {
      console.log('template missing for ', el.dataset.template);
    } else {
      items.forEach((item) => {
				let objName = el.dataset.objectname ? el.dataset.objectname : bindTo.split('.').reverse()[0];
				let params = {};
				params[objName] = item;
        let interpd = interpolate(templateHtml, params);
        if (template) {
          if (interpd) {
            template.innerHTML = interpd;
            let clone = template.content.firstElementChild.cloneNode(true);
            newEl.appendChild(clone);
          }
        } else {
          newEl.appendChild(interpd);
        }
      });
    }
  }

  if (itemPostProcessor) {
    itemPostProcessor(newEl, items);
  }


  let bindid; 
  if (bTemplated && newEl.dataset.forcerender) {
    bindid = Math.random(16).toString().slice(2);
    newEl.dataset['bindid'] = bindid;
  }

  el.replaceWith(newEl);

  let newDomEl = document.querySelector('[data-bindid="'+bindid+'"]');
  if (newDomEl && newDomEl.dataset.forcerender) {
    let elsToRender = newDomEl.querySelectorAll('[data-bind]');
    elsToRender.forEach((elToRender) => {
			if (!elToRender.dataset.noforcerender) {
				forceRenderElement(elToRender);
			}
    });
  }
}

const getFragTemplate = async (fragPath) => {
  let allowedPassthroughFragTypes = ['svg','html'];
  return new Promise((resolve,reject) => {
    let key = encodeURI(fragPath);
    console.log(key);
    if (key in Object.keys(fragMap))
    {
      let frag = fragMap[key];
      return frag;
    }
    else
    {
      fragMap[key] = new Promise((resolve, reject) => {
        if (!allowedPassthroughFragTypes.includes(fragPath.split('.').reverse()[0])) {
          fragPath = fragsBasePath + fragPath + '.html';
        }
				fetch(fragPath)
          .then(r=>r.text())
          .then(
            frag=> {
              fragMap[key] = frag;
              resolve(frag)
            },
            err=>reject(err)
          );
      });
      resolve(fragMap[key]);
    }
  });
}

/**
 * Get a template from a string
 * https://stackoverflow.com/a/41015840
 * @param  {String} str    The string to interpolate
 * @param  {Object} params The parameters
 * @return {String}        The interpolated string
 */
function interpolate (str, params) {
  let fn;
  try {
    let names = Object.keys(params);
    let vals = Object.values(params);
    return new Function(...names, `return \`${str}\`;`)(...vals);
  } catch(err) {
    console.log('unable to interpolate.', err, str, params);
    //fn = new Function('');
  }
  return null;
}
