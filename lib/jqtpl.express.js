var jqtpl = require('./jqtpl'),
    fs = require('fs'),
    path = require('path');


// add express specific tags
jqtpl.tag.partial = {
    _default: { $2: 'null' },
    open: 'if($notnull_1){_=_.concat($item.data.partial($1,$2));}'
};

jqtpl.tag.layout = {
    _default: { $2: 'null' },
    open: 'if($notnull_1){_=_.concat($item.data.layout($1,$2));}'
};


/**
 * Print debugging information to stdout, export print method,
 * to let other commonjs systems without "util" to mock it.
 * @param {*} data any kind of data.
 * @export
 */
exports.debug = function(data) {
    var util = require('util');
    util.debug.apply(util, arguments);
};

/**
 * Support Express compile method (used by 3 > Express >= 2.0)
 *
 * @param {string} markup html string.
 * @param {Object} options
 *     `filename` Used by `cache` to key caches.
 *     `scope` Function execution context.
 *     `debug` Output generated function body.
 *
 * @return {string} rendered html string.
 * @export
 */
exports.compile = function(markup, options) {
    options = options || {};
    var name = options.filename || markup;

    // express calls compile if the template have to be recompiled
    // so we have to clean cache before compile
    delete jqtpl.template[name];

    // precompile the template and cache it using filename
    jqtpl.template(name, markup);

    if (options.debug) {
        // print the template generator fn
        exports.debug(jqtpl.template[name]);
    }

    return function render(locals) {
		return jqtpl.tmpl(name, locals, options);
	};
};

/**
 * Clear cache
 * @export
 */
exports.clearCache = function() {
    var cache = jqtpl.template,
        name;
    for (name in cache) {
        if (cache.hasOwnProperty(name)) {
            delete cache[name];
        }
    }
};

/**
 * renderFile for Express >= 3.0
 */
exports.renderFile = function(templatepath, options, callback) {

	var cached = options.settings['view cache'];

	var layoutpath;
	if ( !options.isLayout ) {
		// called by jqtpl to handle {{layout ..}}
		options.layout = function(layoutname) {

			// resolve the layout argument to template filename. We use
			// same directory as original template and the same suffix
			var layout_extname = path.extname(layoutname);
			if ( !layout_extname ) {
				layoutname += path.extname(templatepath);
			}
			layoutpath = path.join(path.dirname(templatepath), layoutname);
		}
	}

	// called with rendered template string
	function _ready(body) {
		if ( layoutpath ) {
			// layout was requested. Run the requested layout with the
			// generated body
			options.body = body;
			options.isLayout = true; // flag recursive call that it's in layout
			return exports.renderFile(layoutpath, options, callback);
		} else {
			// no layout, just return the body
			return callback(null, body);
		}
	}

	if ( cached && jqtpl.template[templatepath] ) {
		_ready(jqtpl.tmpl(templatepath, options));
	} else {
		fs.readFile(templatepath, 'utf8', function(err, str) {
			if (err) return callback(err);
			try {
			    delete jqtpl.template[templatepath];
				options.filename = templatepath;
				jqtpl.template(templatepath, str);
				_ready(jqtpl.tmpl(templatepath, options));
			} catch (err) {
				callback(err);
			}
		});
	}
};
