var express = require('express'),
    http = require('http'),
    path = require('path'),
    _ = require('underscore'),
    envs = require('./envs'),
    app = express(),
    str = require('underscore.string'),
    siteMap = require('./sitemap'),
    generateDocco = require('./server/docco-generator'),
    config,
    read;


//docco is async but doesnt provide callback support :(
generateDocco( './src/javascripts/examples/', {
    output: 'docs/',
    extension: '.js',
    template: 'src/views/docco.jst'
});


/**
 * configuration for all environments
 */
config = envs( app.get('env') );
app.configure(function(){
    read = require('./server/utils').read(config);
    var staticPath = path.join(__dirname, config.staticDir);
	app.set('port', config.port);
	app.set('views', __dirname + '/src/views');
	app.set('view engine', 'jade');
    app.set('view options', { pretty: true });
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(require('less-middleware')({
        src: __dirname+'/src/less',
        force: true,
        dest: __dirname + '/src/stylesheets',
        paths: [__dirname+ '/src/less'],
        prefix: '/stylesheets',
        compress: false
    }));
	app.use(express['static'](staticPath));
    //serve toxiclibsjs modules
    app.use('/toxiclibsjs',express.static(config.toxiclibsjsDir));
	app.use(app.router);
});

//process the examples to generate id's, hrefs, etc
siteMap.examples.forEach(function(ex){
    var hyphenated = str.dasherize( str.strLeftBack(ex.src,'.') );
    ex = _.defaults( ex, { options: {} });
     _.extend(ex, {
        id: hyphenated,
        href: '/examples/'+hyphenated,
        tags: ex.tags.split(', ')
    });
});

//variables for every template
app.locals({
    pretty: true,
    env: app.get('env'),
    staticUrl: config.staticUrl,
    rootUrl: config.rootUrl
});

app.configure('dev',function(){
    app.use(express.errorHandler());
});

app.get('/', function(req, res){
    res.render('index', siteMap.pages[0]);
});


//generate an app.get for every example
siteMap.examples.forEach(function(ex){
    app.get(ex.href, function( req, res ){
        //FIXME: workaround because docco doesnt have callback
        //read the pagelet synchronously if this is the first-ever server request
        //during this process.
        if( !ex.pagelet ){
            ex.pagelet = read.docco( ex.src );
        }
        res.render( ex.template, ex );
    });
});

//strip out pagelets from examples object
var omitFor = function(key, omits){
    omits = _.isArray(omits) ? omits : [omits];
    return function(o){
        o[key] = _.map(o[key],function(ex){
            return _.omit.apply(_, [ex].concat(omits));
        });
        return o;
    };
};
app.get('/api', function(req, res){
    //cant have those pagelet buffers in the response
    res.send(
        _.chain(siteMap)
        .clone()
        .tap(omitFor('examples','pagelet'))
        .value()
    );
});

http.createServer(app).listen(app.get('port'), function(){
    console.log('toxiclibsjs server listening on port '+ app.get('port'));
});
exports.app = app;
