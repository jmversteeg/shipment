'use strict';

require('./support/index');

const ShipmentWorker = require('./../lib/ShipmentWorker');
const Shipment       = require('./../lib/Shipment');

const exporter    = __dirname + '/fixtures/testShipmentExporter.js';
const badExporter = __dirname + '/fixtures/testServer.js';

describe('ShipmentWorker', function () {

    let shipmentWorker;

    beforeEach(() => {

        shipmentWorker = new ShipmentWorker(exporter);
    });

    describe('constructor', () => {

        it('should take the path of a module that exports a shipment instance', () => {

            shipmentWorker.shipment.should.be.an.instanceOf(Shipment);
        });

        it('should throw if a non-string value is given', () => {

            (() => new ShipmentWorker(123)).should.throw();
        });

        it('should throw when the given exportPath does not provide a shipment instance', () => {

            (() => new ShipmentWorker(badExporter)).should.throw();
        });
    });

    describe('call', () => {

        it('should invoke the action with the given name and return a promise', () => {

            return shipmentWorker.call({action: 'some-sub-action'}).should.be.fulfilled;
        });

        it('should throw when the given action does not exist', () => {

            (() => shipmentWorker.call({action: 'non-existent-magic-action'})).should.throw();
        });

        it('should reject if the action handler throws', () => {
            return shipmentWorker.call({action: 'bad-action'}).should.be.rejected;
        });

        it('should await completion of the action', () => {

            return shipmentWorker.call({action: 'return-value-action'}).should.eventually.equal('some return value');
        });

        it('should take input arguments', () => {

            return shipmentWorker.call({
                action: 'to-upper-action',
                args:   {message: 'oy mate'}
            }).should.eventually.equal('OY MATE');
        });
    });
});