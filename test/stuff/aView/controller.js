define(['text!./template', 'css!./css'], function (template, css) {
	return {
		render: function (node) {
			node.innerHTML = template;
		}
	}
});
