'use strict';

const {difference, keys, mapValues} = require('lodash');

const path       = require('path');
const defaults   = require('defa');
const express    = require('express');
const bodyParser = require('body-parser');
const morgan     = require('morgan');

const runActionViaFork = require('./runActionViaFork');
const runActionViaApi  = require('./runActionViaApi');

/**
 * HTTP server that exposes the actions of a Shipment instance
 * Default port: 6565
 *
 * Actions can be invoked via POST http://host:port/action-name
 * All data should be JSON-encoded and sent as the POST body.
 * Expected request body payload: {args, verifyKey}
 * The verify key will be used in the output of the fork in formatting some lifecycle events
 * The client may use this key to verify that these lifecycle events are legitimate
 */
class ShipmentServer {

    /**
     * @param {Shipment} shipment
     * @param {Object} options
     * @param {Number} options.port The port on which to listen for incoming connections (default SHIPMENT_PORT env)
     * @param {Number} options.basePath The base route (default SHIPMENT_BASE_PATH env)
     * @param {Boolean} [options.useFork = true] Whether to use a forked process (child process) to run the action
     * @param {Boolean} [options.output = true] Whether to pipe output from the worker process to standard streams
     */
    constructor(shipment, options) {

        options = defaults(options, {
            output:   true,
            useFork:  true,
            port:     process.env.SHIPMENT_PORT,
            basePath: process.env.SHIPMENT_BASE_PATH,
            app:      () => ShipmentServer.makeApp()
        }, {
            port:     6565,
            basePath: ''
        });

        this.shipment = shipment;

        this.app      = options.app;
        this.port     = options.port;
        this.basePath = options.basePath;
        this.useFork  = options.useFork;
        this.output   = options.output;

        this.app.use(this.basePath, this.router());
    }

    /**
     * Generate an express router that exposes all available actions in the Shipment instance
     * @returns {Router}
     */
    router() {
        let router = express.Router();
        router.get('', this.indexRoute());
        for (const action of this.shipment.actions) {
            router.post(this.getActionUrl(action), this.actionRoute(action));
        }
        return router;
    }

    /**
     * Generate an object describing the application,
     * available actions and their options
     *
     * @returns {Object}
     */
    get manual() {

        const actions = mapValues(this.shipment.actions, action => ({description: action.description}));

        return {actions};
    }

    /**
     * Get a route handler for the index / help route
     * @returns {function}
     */
    indexRoute() {
        return (req, res) => {
            res.json({app: this.manual});
        };
    }

    /**
     * Get a route handler for the given action
     * @param {String} action
     * @returns {function}
     */
    actionRoute(action) {
        return (req, res) => {

            // Check for other keys than args and/or verifyKey in request body object
            const diff = difference(keys(req.body), ['args', 'verifyKey']);

            if (diff.length)
                throw new Error(`Unexpected key(s) ('${diff.join('\', \'')}'${diff.length > 3 ? '...' : ''}) ` +
                    'in request body, expecting \'args\', \'verifyKey\'.');

            this.runAction(action, req.body, res);
        };
    }

    /**
     * Get the route name (URL) for the given action
     * @param {BaseAction} action
     * @returns {string}
     */
    getActionUrl(action) {
        return '/' + action.name;
    }

    /**
     * Retrieve the "exportPath" property from the internal Shipment instance
     * Throw an error if it's empty
     * @returns {String}
     */
    get exportPath() {
        if (!this.shipment.exportPath)
            throw new Error('The Shipment instance passed to ShipmentServer must provide an exportPath');
        return this.shipment.exportPath;
    }

    /**
     * Get the file path of the shipment worker script that will be used by the forked process
     * @returns {string}
     */
    static get workerPath() {
        return path.join(path.dirname(__dirname), 'fork.js');
    }

    /**
     * Create a child process that runs the given action with the given args
     * And pipe its output to the given stream
     * @param {BaseAction} action
     * @param {Object} args
     * @param {String} [verifyKey]
     * @param {http.res} response
     */
    async runAction(action, {args, verifyKey}, response) {
        if (this.useFork) {
            await runActionViaFork({
                output:     this.output,
                workerPath: ShipmentServer.workerPath,
                exportPath: this.exportPath,
            }, action, {args, verifyKey}, response);
        } else {
            try {
                await runActionViaApi({output: this.output}, action, {args, verifyKey}, response);
            } catch (e) {
                console.error(e); // eslint-disable-line no-console
                console.warn(`Above error occurred in action "${action.name}"`); // eslint-disable-line no-console
            }
        }
    }

    /**
     * Start the HTTP server and return its handle
     * @returns {http.Server}
     */
    serve() {
        console.log(`Shipment server listening on port ${this.port}`); // eslint-disable-line no-console
        return this.app.listen(this.port);
    }

    /**
     * Instantiate the default express app with the appropriate middleware
     * @returns {*}
     */
    static makeApp() {
        let app = express();
        app.use(morgan('combined', {immediate: true}));
        app.use(bodyParser.json({type: '*/*'}));
        return app;
    }
}

module.exports = ShipmentServer;