require('should');
const RdfClassLoader = require("../lib/rdf/RdfClassLoader").RdfClassLoader;
const Resource = require("../lib/rdf/Resource").Resource;
const JsonLdStreamParser = require("../lib/rdf/JsonLdStreamParser").JsonLdStreamParser;
const ComponentRunner = require("../lib/ComponentRunner").ComponentRunner;
const Constants = require("../lib/Constants");
const Hello = require("./helloworld").Hello;
const fs = require("fs");
const Readable = require("stream").Readable;

describe('ComponentRunner', function () {
  var runner;
  beforeEach(function () {
    runner = new ComponentRunner();
  });

  describe('constructing an N3 Parser, unnamed', function () {
    it('should construct a module loader', function () {
      runner._newModuleLoader().should.be.instanceof(RdfClassLoader);
      runner._newModuleLoader()._captureAllProperties.should.be.false();
      runner._newModuleLoader()._captureAllClasses.should.be.false();
    });

    it('should construct a config loader', function () {
      runner._newConfigLoader().should.be.instanceof(RdfClassLoader);
      runner._newConfigLoader()._captureAllProperties.should.be.true();
      runner._newConfigLoader()._captureAllClasses.should.be.true();
    });

    it('should allow components to be registered', function () {
      let component1 = new Resource('mycomponent1');
      let component2 = new Resource('mycomponent2');
      let component3 = new Resource('mycomponent3');
      runner._registerComponentResource(component1);
      runner._registerComponentResource(component2);
      runner._registerComponentResource(component3);
      runner._componentResources.should.have.property('mycomponent1', component1);
      runner._componentResources.should.have.property('mycomponent2', component2);
      runner._componentResources.should.have.property('mycomponent3', component3);
    });

    it('should allow module components to be registered', function () {
      let component1 = new Resource('mycomponent1');
      let component2 = new Resource('mycomponent2');
      let component3 = new Resource('mycomponent3');
      let module = new Resource('mymodule', { hasComponent: [ component1, component2, component3 ] });
      runner.registerModuleResource(module);
      runner._componentResources.should.have.property('mycomponent1', component1);
      runner._componentResources.should.have.property('mycomponent2', component2);
      runner._componentResources.should.have.property('mycomponent3', component3);
    });

    describe('with a manual triple stream', function () {
      let module = 'http://example.org/myModule';
      let component1 = 'http://example.org/myModule#mycomponent1';
      let component2 = 'http://example.org/myModule#mycomponent2';
      let component3 = 'http://example.org/myModule#mycomponent3';

      beforeEach(function (done) {
        let moduleStream = new Readable({ objectMode: true });
        moduleStream.push({ subject: module, predicate: Constants.PREFIXES['rdf'] + 'type', object: Constants.PREFIXES['lsdc'] + 'Module'});
        moduleStream.push({ subject: module, predicate: Constants.PREFIXES['lsdc'] + 'hasComponent', object: component1});
        moduleStream.push({ subject: module, predicate: Constants.PREFIXES['npm'] + 'requireName', object: '"../../test/helloworld"'});
        moduleStream.push({ subject: component1, predicate: Constants.PREFIXES['rdf'] + 'type', object: Constants.PREFIXES['lsdc'] + 'ComponentConstructable'});
        moduleStream.push({ subject: component1, predicate: Constants.PREFIXES['npm'] + 'requireElement', object: '"Hello"'});
        moduleStream.push({ subject: component1, predicate: Constants.PREFIXES['lsdc'] + 'hasParameter', object: 'http://example.org/myModule/params#param1'});
        moduleStream.push({ subject: component1, predicate: Constants.PREFIXES['lsdc'] + 'hasParameter', object: 'http://example.org/myModule/params#param3'});
        moduleStream.push({ subject: module, predicate: Constants.PREFIXES['lsdc'] + 'hasComponent', object: component2});
        moduleStream.push({ subject: component2, predicate: Constants.PREFIXES['rdf'] + 'type', object: Constants.PREFIXES['lsdc'] + 'ComponentConstructable'});
        moduleStream.push({ subject: component2, predicate: Constants.PREFIXES['npm'] + 'requireElement', object: '"Hello"'});
        moduleStream.push({ subject: component2, predicate: Constants.PREFIXES['lsdc'] + 'hasParameter', object: 'http://example.org/myModule/params#param1'});
        moduleStream.push({ subject: module, predicate: Constants.PREFIXES['lsdc'] + 'hasComponent', object: component3});
        moduleStream.push({ subject: component3, predicate: Constants.PREFIXES['rdf'] + 'type', object: Constants.PREFIXES['lsdc'] + 'ComponentConstructable'});
        moduleStream.push({ subject: component3, predicate: Constants.PREFIXES['npm'] + 'requireElement', object: '"Hello"'});
        moduleStream.push({ subject: component3, predicate: Constants.PREFIXES['lsdc'] + 'hasParameter', object: 'http://example.org/myModule/params#param2'});
        moduleStream.push(null);
        runner.registerModuleResourcesStream(moduleStream).then(done);
      });

      it('should allow module components to be registered', function () {
        runner._componentResources.should.have.property(component1);
        runner._componentResources.should.have.property(component2);
        runner._componentResources.should.have.property(component3);
      });

      it('should allow a config resource to be run', function () {
        let fields = { types: [ new Resource(component1) ] };
        fields['http://example.org/myModule/params#param1'] = [ Resource.newString('ABC') ];
        fields['http://example.org/myModule/params#param2'] = [ Resource.newString('DEF') ];
        fields['http://example.org/myModule/params#param3'] = [ Resource.newString('GHI') ];
        var run = runner.runConfig(new Resource(null, fields));
        run._params.should.deepEqual({
          'http://example.org/myModule/params#param1': ['ABC'],
          'http://example.org/myModule/params#param3': ['GHI']
        });
      });

      it('should allow a config stream to be run', function (done) {
        let config1 = 'http://example.org/myModule#myconfig1';
        let configResourceStream = new Readable({ objectMode: true });
        configResourceStream.push({ subject: config1, predicate: Constants.PREFIXES['rdf'] + 'type', object: component1});
        configResourceStream.push({ subject: config1, predicate: 'http://example.org/myModule/params#param1', object: '"ABC"'});
        configResourceStream.push({ subject: config1, predicate: 'http://example.org/myModule/params#param2', object: '"DEF"'});
        configResourceStream.push({ subject: config1, predicate: 'http://example.org/myModule/params#param3', object: '"GHI"'});
        configResourceStream.push(null);

        runner.runConfigStream(config1, configResourceStream).then((run) => {
          run._params.should.deepEqual({
            'http://example.org/myModule/params#param1': ['ABC'],
            'http://example.org/myModule/params#param3': ['GHI']
          });
          done();
        }).catch(done);
      });

      it('should allow a manual run', function () {
        let params = {};
        params['http://example.org/myModule/params#param1'] = 'ABC';
        params['http://example.org/myModule/params#param2'] = 'DEF';
        params['http://example.org/myModule/params#param3'] = 'GHI';
        let run = runner.runManually(component1, params);
        run._params.should.deepEqual({
          'http://example.org/myModule/params#param1': ['ABC'],
          'http://example.org/myModule/params#param3': ['GHI']
        });
      });
    });

    describe('with a file triple stream', function () {
      beforeEach(function (done) {
        let moduleStream = fs.createReadStream(__dirname + '/assets/module-hello-world.jsonld').pipe(new JsonLdStreamParser());
        runner.registerModuleResourcesStream(moduleStream).then(done);
      });

      it('should allow module components to be registered', function () {
        runner._componentResources.should.have.property('http://example.org/HelloWorldModule#SayHelloComponent');
      });

      it('should allow a config resource to be run', function () {
        let fields = { types: [ new Resource('http://example.org/HelloWorldModule#SayHelloComponent') ] };
        fields['http://example.org/hello/hello'] = [ Resource.newString('WORLD') ];
        fields['http://example.org/hello/say'] = [ Resource.newString('HELLO') ];
        fields['http://example.org/hello/bla'] = [ Resource.newString('BLA') ];
        var run = runner.runConfig(new Resource(null, fields));
        run._params.should.deepEqual({
          'http://example.org/hello/hello': ['WORLD'],
          'http://example.org/hello/say': ['HELLO']
        });
      });

      it('should allow a config stream to be run', function (done) {
        let configResourceStream = fs.createReadStream(__dirname + '/assets/config-hello-world.jsonld').pipe(new JsonLdStreamParser());
        runner.runConfigStream('http://example.org/myconfig', configResourceStream).then((run) => {
          run._params.should.deepEqual({
            'http://example.org/hello/hello': ['WORLD'],
            'http://example.org/hello/say': ['HI']
          });
          done();
        }).catch(done);
      });

      it('should allow a manual run', function () {
        let params = {};
        params['http://example.org/hello/hello'] = 'WORLD';
        params['http://example.org/hello/say'] = 'BONJOUR';
        params['http://example.org/hello/bla'] = 'BLA';
        let run = runner.runManually('http://example.org/HelloWorldModule#SayHelloComponent', params);
        run._params.should.deepEqual({
          'http://example.org/hello/hello': ['WORLD'],
          'http://example.org/hello/say': ['BONJOUR']
        });
      });
    });
  });

  describe('constructing an component with inheritable parameters', function () {
    beforeEach(function (done) {
      let moduleStream = fs.createReadStream(__dirname + '/assets/module-hello-world.jsonld').pipe(new JsonLdStreamParser());
      runner.registerModuleResourcesStream(moduleStream).then(done);
    });

    it('should produce the correct instances', function (done) {
      let configResourceStream = fs.createReadStream(__dirname + '/assets/config-hello-world-referenced.jsonld').pipe(new JsonLdStreamParser());
      runner.runConfigStream('http://example.org/myHelloWorld1', configResourceStream).then((run) => {
        run._params.should.deepEqual({
          'http://example.org/hello/hello': [ new Hello() ],
          'http://example.org/hello/say': [ new Hello() ]
        });
        run._params['http://example.org/hello/hello'][0].should.be.equal(run._params['http://example.org/hello/say'][0]);
        done();
      }).catch(done);
    });

    it('should allow a config stream with unreferenced component instances to be run', function (done) {
      let configResourceStream = fs.createReadStream(__dirname + '/assets/config-hello-world-unreferenced.jsonld').pipe(new JsonLdStreamParser());
      runner.runConfigStream('http://example.org/myHelloWorld1', configResourceStream).then((run) => {
        run._params.should.deepEqual({
          'http://example.org/hello/hello': [ new Hello() ],
          'http://example.org/hello/say': [ new Hello() ]
        });
        run._params['http://example.org/hello/hello'][0].should.not.be.equal(run._params['http://example.org/hello/say'][0]);
        done();
      }).catch(done);
    });
  });

  describe('constructing an component with referenced components', function () {
    beforeEach(function (done) {
      let moduleStream = fs.createReadStream(__dirname + '/assets/module-hello-world-inheritableparams.jsonld').pipe(new JsonLdStreamParser());
      runner.registerModuleResourcesStream(moduleStream).then(done);
    });

    it('should allow a config stream with component instances with inherited parameters to be run', function (done) {
      let configResourceStream1 = fs.createReadStream(__dirname + '/assets/config-hello-world-inheritparam.jsonld').pipe(new JsonLdStreamParser());
      let configResourceStream2 = fs.createReadStream(__dirname + '/assets/config-hello-world-inheritparam.jsonld').pipe(new JsonLdStreamParser());
      runner.runConfigStream('http://example.org/myHelloWorld1', configResourceStream1).then((run) => {
        run._params.should.deepEqual({
          'http://example.org/hello/something': [ "SOMETHING" ]
        });
        runner.runConfigStream('http://example.org/myHelloWorld2', configResourceStream2).then((run) => {
          run._params.should.deepEqual({
            'http://example.org/hello/something': [ "SOMETHING" ]
          });
          done();
        }).catch(done);
      }).catch(done);
    });
  });
});
