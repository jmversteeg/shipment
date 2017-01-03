'use strict';

const _         = require('lodash');
const events    = require('events');
const Immutable = require('immutable');

const combineHandlers = require('./combineHandlers');
const ParseContext    = require('./ParseContext');

/**
 * Maps incoming top-level object events to
 * context instances and fire deeper events
 */
class EventParser extends events.EventEmitter {

    constructor() {
        super();
        this.contexts = {};
        this.handlers = [];

        /*  Number of handlers that are to remain at the end of the stack regardless of whether new handlers
         Are inserted "last" */
        this.finalHandlers = 0;
    }

    /**
     * Read incoming top-level object
     * @param obj
     */
    receive(obj) {
        if (obj.begin) this.begin(obj);
        this.fire(obj);
    }

    /**
     * Invoked for incoming "begin" objects
     * @param obj
     */
    begin(obj) {
        let id        = obj.context;
        let timestamp = obj.timestamp;
        let context   = new ParseContext(id, timestamp);
        _.extend(context, obj.begin);
        // e.g. "begin":{"parent":"507d8410-b172-11e6-a36f-7f298ebb314a","scope":{"action":"land"}}
        // Translate context to actual object
        if (context.parent && context.parent !== null)
            context.parent = this.getContext(context.parent);
        this.contexts[id] = context;
        this.emit('begin', context, obj);
    }

    /**
     * Invoke event handlers for the given event object
     * @param obj
     */
    fire(obj) {

        let context   = this.getContext(obj.context);
        let timestamp = obj.timestamp;
        let data      = Immutable.fromJS(_.omit(obj, 'context', 'timestamp'));

        let info = {context, timestamp};

        _(this.handlers)
            .concat((data, info) => this.emit('uncaught', data, info))
            .forEach(handler => {
                data = handler(data, info, obj);
                if (data === null || data === undefined) return false;
            });
    }

    /**
     * Add the given function to the end of the handler stack, and make sure handlers that are subsequently added
     * will be inserted before the given one (unless added via `useFinal`)
     *
     * @param {Function} fn
     */
    useFinal(fn) {
        this.finalHandlers++;
        this.handlers.push(fn);
    }

    /**
     * Push the given function onto the event handler stack.
     * The function must return either true (consumed) or false (not consumed) in order to propagate the event
     * to the next handler if appropriate.
     *
     * Event handlers will be invoked with two arguments:
     * 1. An immutable data structure containing the event object with "context" and "timestamp" omitted
     * 2. An object containing {timestamp, context} where context is an instance of ParserContext
     * 3. The raw incoming object
     *
     * @param {Function} fn
     * @param {Boolean} [first = false] Whether to push the handler to the front of the stack
     */
    use(fn, first = false) {
        if (first) this.handlers.unshift(fn);
        else this.handlers.splice(this.handlers.length - this.finalHandlers, 0, fn);
    }

    /**
     * Same as `use` but expects an object of handlers that will be combined using `combineHandlers`
     *
     * @param {Object} fns
     * @param {Boolean} [first = false] Whether to push the handlers to the front of the stack
     */
    useCombine(fns, first = false) {
        this.use(combineHandlers(fns), first);
    }

    /**
     * By enabling this, an error will be thrown for any event
     * that is not handled by the handler stack.
     *
     * @param {boolean} [on = true]
     */
    setStrict(on = true) {
        if (!on && this.uncaughtEventListener) {
            this.removeListener('uncaught', this.uncaughtEventListener);
            this.uncaughtEventListener = null;
        }
        if (on) {
            this.uncaughtEventListener = data => {
                throw new Error(`Unhandled event in EventParser: ${JSON.stringify(data)}`);
            };
            this.addListener('uncaught', this.uncaughtEventListener);
        }
    }

    /**
     * Get the context associated with the given id
     * If no ParseContext available, returns the id
     *
     * @param {String} id
     * @returns {Context|String}
     */
    getContext(id) {
        return _.get(this.contexts, id, id);
    }
}

module.exports = EventParser;