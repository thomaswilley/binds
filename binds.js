// (c) 2022 thomaswilley
'use strict';

const loadBinds = async() => {
  Array.prototype.slice.call(document.querySelectorAll('._bound_')).map((element) => {
    render(element);
    if (Object.keys(element.dataset).includes('updatedby')) {
      if (element.dataset.updatedby !== 'self') {
        document.getElementById(element.dataset.updatedby).addEventListener('change', () => {
          render(element);
        });
      } else {
        element.addEventListener('change', () => {
          eval(element.dataset.object + ' = ' + getUpdateFn(element));
        });
      }
    }
  });
}

function getRenderFn(element) {
  var renderfn;
  if (Object.keys(element.dataset).includes('filter')) {
    renderfn = element.dataset.object + '.map(function(el) { return ' + element.dataset.filter + ' }).flat();';
  } else {
    renderfn = element.dataset.object;
  }
  return renderfn;
}

function getUpdateFn(element) {
  if (Object.keys(element.dataset).includes('updatefn')) {
    return element.dataset.updatefn;
  } else {
    return element.value;
  }
}

const render = async(element) => {
  _render(element, getRenderFn(element));
}

const _renderItem = async(element, values) => {
  var renderItemFn = eval(element.dataset.template);
  if (values.length > 0) {
    values.forEach(value => {
      var _newItem = renderItemFn(value);
      element.append(_newItem);
    });
  } else {
    var _newItem = renderItemFn(values);
    element.append(_newItem);
  }
}

const _render = async(element, renderfn) => {
  const values = eval(renderfn);
  switch (element.tagName.toUpperCase()) {
    default:
      empty(element);
      _renderItem(element, values);
      break;
  }
}

function empty(element) {
  while (element.firstChild) {
    element.removeChild(element.lastChild);
  }
}
