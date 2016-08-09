'use strict';

const Shipment = require('./../../lib/Shipment');
const Action   = require('./../../lib/Action');
const Promise  = require('bluebird');

const functionify = require('functionify');

/**
 * Generates an instance of shipment with some test commands. If the spy argument is provided, this function
 * will be invoked every time an action is run, with the action instance as the first argument.
 * @param {Function} [spy]
 * @returns {Shipment}
 */
let testCli = spy => {

    spy = functionify(spy);

    const SubAction         = class SomeSubAction extends Action {
        run(context, options) {
            spy(this);
            console.log('run some action');
        }
    };
    const AnotherAction     = class AnotherCoolAction extends Action {
        run(context, options) {
            spy(this);
            console.log('run another cool action');
        }
    };
    const BadAction         = class BadAction extends Action {
        run(context, options) {
            spy(this);
            throw new Error('something went awfully wrong');
        }
    };
    const ReturnValueAction = class ReturnValueAction extends Action {
        run(context, options) {
            return Promise.delay(20).then(() => 'some return value');
        }
    };
    return new Shipment([
        SubAction,
        AnotherAction,
        BadAction,
        ReturnValueAction
    ]);
};

if (require.main === module) {
    let shipment = testCli();
    shipment.cli();
}
else module.exports = testCli;