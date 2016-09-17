'use strict';

require('./support/index');

const Promise = require('bluebird');
const sinon   = require('sinon');

const Context  = require('./../lib/Context');
const Reporter = require('./../lib/Reporter');

describe('Context', () => {

    let context,
        CustomReporter, customReporterConstructorSpy, customReporterReportSpy,
        CustomReporterContext, customReporterContext;

    beforeEach(() => {
        context                        = new Context;
        customReporterConstructorSpy   = sinon.spy();
        customReporterReportSpy        = sinon.spy();
        CustomReporter                 = class {
            constructor() {
                customReporterConstructorSpy(...arguments);
            }

            report() {
                customReporterReportSpy(...arguments);
            }

            clone() {
                return new this.constructor();
            }
        };
        CustomReporterContext          = class extends Context {
        };
        CustomReporterContext.Reporter = CustomReporter;
        customReporterContext          = new CustomReporterContext;
    });

    describe('makeReporter', () => {

        it('should make an instance of Reporter', () => {

            context.makeReporter().should.be.an.instanceOf(Reporter);
        });

        it('should allow the use of a custom Reporter class', () => {

            customReporterContext.makeReporter().should.be.an.instanceOf(CustomReporter);
        });

        it('should invoke the Reporter constructor with itself as the argument', () => {

            customReporterContext.makeReporter();
            customReporterConstructorSpy.should.have.been.calledWith(customReporterContext);
        });
    });

    describe('getUptime', () => {

        it('should return the number of milliseconds that have passed since the instantiation of the context', () => {

            context = new Context;

            return Promise.delay(20).then(() => {

                context.getUptime().should.be.within(18, 50); // Yeah this is kinda tricky
            });
        });
    });

    describe('report', () => {

        it('should invoke the report method on the reporter and extend the data with the internal scope', () => {

            context = new CustomReporterContext({}, {someScopeVar: 'beepboop'});
            context.report('info', {someDataVar: 'beepbop'});
            customReporterReportSpy.should.have.been.calledWithMatch('info', {
                context:     context.id,
                someDataVar: 'beepbop'
            });
        });
    });

    describe('createSubContext', () => {

        it('should create a new context of the same type with the given scope', () => {

            let options       = {verbosity: 3};
            let internalScope = {base: 'foo'};
            let customContext = new CustomReporterContext(options, internalScope);

            let subContext = customContext.createSubContext({ext: 'bar'});
            internalScope.should.deep.equal({base: 'foo'}); //First, check if the initial scope was not modified (no side-effects)
            subContext.should.be.an.instanceOf(CustomReporterContext);
            subContext.options.should.deep.equal(options);
            subContext.parent.should.equal(customContext);
            subContext.scope.should.deep.equal({ext: 'bar'});
        });
    });

    describe('withScope', () => {

        it('should run some function with a subContext that includes the given scope', () => {

            new Context({}, {base: 'foo'}).withScope({ext: 'bar'}, context => context.parent.scope.base + context.scope.ext)
                .should.equal('foobar');
        });
    });
});