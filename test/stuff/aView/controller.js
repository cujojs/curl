define(['text!./template.html', 'css!./css'], function (template) {
	return {
		render: function (node) {
			try {
				node.innerHTML = template;
			}
			catch (ex) {
				// firggin IE
				var div = node.ownerDocument.createElement('div');
				div.innerHTML = template;
				while (div.firstChild) {
					node.appendChild(div.removeChild(div.firstChild));
				}
			}
		}
	}
});
