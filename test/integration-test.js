'use strict';
var util = require('util');
var _ = require('lodash');
var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));
var expect = chai.expect;
var redis = require('redis');
var Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
var client;

var readModel = require('../index');

describe('integration-test', function() {

  before(function() {

    client = redis.createClient();

    // using db2 for test isolation
    client.select(2);

    client.flushdb();

    readModel.init({
      log: {
        debug: function(msg, args) {
          console.log(msg, args);
        }
      },
      client: client
    });

    readModel.register('car', {
      idField: 'id',
      indexedFields: [{
        fieldName: 'priceRange'
      }, {
        fieldName: 'year',
        getValue: function(entity) {
          return entity.yearOfManufacture;
        }
      }, {
        fieldName: 'featureId',
        getValue: function(entity) {
          return entity.featureIds;
        }
      }],
      sortFields: [{
        fieldName: 'make',
        alpha: true
      }, {
        fieldName: 'price'
      }],
      defaultSortField: 'make'
    });
  });

  after(function() {
    if (client) {
      client.quit();
    }
    readModel.quit();
  });

  describe('set', function() {

    var entityV1 = {
      id: 1234,
      priceRange: '1,000-5,000',
      yearOfManufacture: 99,
      price: 10,
      make: 'Honda',
      featureIds: [1, 2, 3]
    };

    before(function(done) {
      readModel.set('car', entityV1).then(function() {
        done();
      }).catch(done);
    });

    it('stores the entity', function(done) {
      client.getAsync('car:1234').then(function(res) {
        expect(JSON.parse(res)).to.eql(entityV1);
        done();
      }).catch(done);
    });

    it('adds sortFields to hash', function(done) {
      client.hgetallAsync('h:car:1234').then(function(res) {
        expect(res).to.eql({
          price: '10',
          make: 'Honda'
        });
        done();
      }).catch(done);
    });

    it('adds index (fieldName)', function(done) {
      client.sismemberAsync('x:car-priceRange:1,000-5,000', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (by function)', function(done) {
      client.sismemberAsync('x:car-year:99', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (array 1)', function(done) {
      client.sismemberAsync('x:car-featureId:1', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (array 2)', function(done) {
      client.sismemberAsync('x:car-featureId:2', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (array 3)', function(done) {
      client.sismemberAsync('x:car-featureId:3', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    describe('set (update)', function() {
      var entityV2 = {
        id: 1234,
        priceRange: '5,000-6,000',
        yearOfManufacture: 100,
        price: 5,
        make: 'Ford',
        featureIds: [3, 4, 5]
      };

      before(function(done) {
        readModel.set('car', entityV2).then(function() {
          done();
        }).catch(done);
      });

      it('stores the entity', function(done) {
        client.getAsync('car:1234').then(function(res) {
          expect(JSON.parse(res)).to.eql(entityV2);
          done();
        }).catch(done);
      });

      it('adds sortFields to hash', function(done) {
        client.hgetallAsync('h:car:1234').then(function(res) {
          expect(res).to.eql({
            price: '5',
            make: 'Ford'
          });
          done();
        }).catch(done);
      });

      it('adds index (fieldName)', function(done) {
        client.sismemberAsync('x:car-priceRange:5,000-6,000', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('removes previous index (fieldName)', function(done) {
        client.sismemberAsync('x:car-priceRange:1,000-5,000', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });

      it('adds index (by function)', function(done) {
        client.sismemberAsync('x:car-year:100', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('removes previous index (by function)', function(done) {
        client.sismemberAsync('x:car-year:99', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });

      it('removed previous index (array 1)', function(done) {
        client.sismemberAsync('x:car-featureId:1', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });

      it('removes previous index (array 2)', function(done) {
        client.sismemberAsync('x:car-featureId:2', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });

      it('keeps index (array 3)', function(done) {
        client.sismemberAsync('x:car-featureId:3', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('adds index (array 4)', function(done) {
        client.sismemberAsync('x:car-featureId:4', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });
    });
  });

  describe('setIndex', function() {

    before(function(done) {
      readModel.setIndex('car', {
        entityId: 1234,
        indexName: 'userId',
        value: [100, 101, 102]
      }).then(function() {
        done();
      }).catch(done);
    });

    it('adds index (val 1)', function(done) {
      client.sismemberAsync('x:car-userId:100', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (val 2)', function(done) {
      client.sismemberAsync('x:car-userId:101', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (val 3)', function(done) {
      client.sismemberAsync('x:car-userId:102', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    describe('setIndex (update)', function() {
      before(function(done) {
        readModel.setIndex('car', {
          entityId: 1234,
          indexName: 'userId',
          value: [102, 103, 104]
        }).then(function() {
          done();
        }).catch(done);
      });

      it('keeps index (val 1)', function(done) {
        client.sismemberAsync('x:car-userId:102', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('adds index (val 2)', function(done) {
        client.sismemberAsync('x:car-userId:103', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('adds index (val 3)', function(done) {
        client.sismemberAsync('x:car-userId:104', 'car:1234').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('removes previous index (val 1)', function(done) {
        client.sismemberAsync('x:car-userId:100', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });

      it('removes previous index (val 2)', function(done) {
        client.sismemberAsync('x:car-userId:101', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });
    });
  });

  describe('setInvertedIndex', function() {

    before(function(done) {
      readModel.setInvertedIndex('car', {
        entityIds: [1234, 1235, 1236],
        indexName: 'userId',
        value: 105
      }).then(function() {
        done();
      }).catch(done);
    });

    it('adds index (entity 1)', function(done) {
      client.sismemberAsync('x:car-userId:105', 'car:1234').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (entity 2)', function(done) {
      client.sismemberAsync('x:car-userId:105', 'car:1235').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    it('adds index (entity 3)', function(done) {
      client.sismemberAsync('x:car-userId:105', 'car:1236').then(function(res) {
        expect(res).to.equal(1);
        done();
      }).catch(done);
    });

    describe('setInvertedIndex (update)', function() {

      before(function(done) {
        readModel.setInvertedIndex('car', {
          entityIds: [1236, 1237, 1238],
          indexName: 'userId',
          value: 105
        }).then(function() {
          done();
        }).catch(done);
      });

      it('keeps existing index (entity 1)', function(done) {
        client.sismemberAsync('x:car-userId:105', 'car:1236').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('adds index (entity 2)', function(done) {
        client.sismemberAsync('x:car-userId:105', 'car:1237').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('adds index (entity 3)', function(done) {
        client.sismemberAsync('x:car-userId:105', 'car:1238').then(function(res) {
          expect(res).to.equal(1);
          done();
        }).catch(done);
      });

      it('removes previous index (entity 1)', function(done) {
        client.sismemberAsync('x:car-userId:105', 'car:1234').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });

      it('removes previous index (entity 2)', function(done) {
        client.sismemberAsync('x:car-userId:105', 'car:1235').then(function(res) {
          expect(res).to.equal(0);
          done();
        }).catch(done);
      });
    });
  });

  describe('delete', function() {

    var entity = {
      id: 42,
      priceRange: '1,000-5,000',
      yearOfManufacture: 2000,
      price: 1000,
      make: 'Honda',
      featureIds: [1, 2, 3]
    };

    before(function(done) {
      readModel.set('car', entity)
        .then(function() {
          return readModel.setIndex('car', {
            entityId: 42,
            indexName: 'userId',
            value: [100, 101, 102]
          });
        })
        .then(function() {
          return readModel.delete('car', 42);
        })
        .then(function() {
          done();
        })
        .catch(done);
    });

    it('removes the entity', function(done) {
      client.existsAsync('car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes the hash', function(done) {
      client.existsAsync('h:car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes the field index', function(done) {
      client.sismemberAsync('x:car-priceRange:1,000-5,000', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes the field index (by function)', function(done) {
      client.sismemberAsync('x:car-year:99', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes the field indices (by array 1)', function(done) {
      client.sismemberAsync('x:car-featureId:1', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes the field indices (by array 2)', function(done) {
      client.sismemberAsync('x:car-featureId:2', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes the field indices (by array 3)', function(done) {
      client.sismemberAsync('x:car-featureId:3', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes inverted indices (val 1)', function(done) {
      client.sismemberAsync('x:car-userId:100', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes inverted indices (val 2)', function(done) {
      client.sismemberAsync('x:car-userId:101', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });

    it('removes inverted indices (val 3)', function(done) {
      client.sismemberAsync('x:car-userId:102', 'car:42').then(function(res) {
        expect(res).to.equal(0);
        done();
      }).catch(done);
    });
  });

  describe('get', function() {

    var user1cars = [];
    var user2cars = [];

    before(function(done) {
      var entities = [];


      // create 100 entities
      for (var i = 1; i <= 100; i++) {

        var priceRange = (i <= 25) ? '1,000-5,000' : '5,000-6,000';
        var yearOfManufacture = (i % 4 === 0) ? 1 : 2;
        var price = (i % 2 === 0) ? 1 : 2;
        var featureIds = (i % 10 === 0) ? [1, 2, 3] : [4, 5];

        var name;
        if (i <= 25) {
          name = 'yxwvutsrqponmlkjihgfedcba' [i - 1];
        } else if (i <= 50) {
          name = 'z';
        } else if (i <= 75) {
          name = 'za';
        } else {
          name = 'zb';
        }

        if (i <= 50) {
          user1cars.push(i);
        } else {
          user2cars.push(i);
        }

        entities.push({
          id: i,
          priceRange: priceRange,
          yearOfManufacture: yearOfManufacture,
          price: price,
          make: name,
          featureIds: featureIds
        });
      }

      client.flushdbAsync()
        .then(function() {
          return Promise.all(entities.map(function(e) {
            return readModel.set('car', e);
          }));
        })
        .then(function() {
          return readModel.setInvertedIndex('car', {
            indexName: 'userId',
            entityIds: user1cars,
            value: 1
          });
        })
        .then(function() {
          return readModel.setInvertedIndex('car', {
            indexName: 'userId',
            entityIds: user2cars,
            value: 2
          });
        })
        .then(function() {
          done();
        });
    });

    describe('get by single field index', function() {

      var getResult = function() {
        return readModel.get('car', {
          priceRange: '1,000-5,000'
        });
      };

      it('reports total matching items', function(done) {
        getResult().then(function(result) {
          expect(result.total).to.equal(25);
          done();
        }).catch(done);
      });

      it('uses default page size', function(done) {
        getResult().then(function(result) {
          expect(result.items.length).to.equal(10);
          done();
        }).catch(done);
      });

      it('sorts by defaultSortField', function(done) {
        getResult().then(function(result) {
          expect(result.items[0].make).to.equal('a');
          expect(result.items[1].make).to.equal('b');
          expect(result.items[2].make).to.equal('c');
          expect(result.items[3].make).to.equal('d');
          expect(result.items[4].make).to.equal('e');
          expect(result.items[5].make).to.equal('f');
          expect(result.items[6].make).to.equal('g');
          expect(result.items[7].make).to.equal('h');
          expect(result.items[8].make).to.equal('i');
          expect(result.items[9].make).to.equal('j');
          done();
        }).catch(done);
      });

      describe('descending alpha sort', function() {
        var getResultByNameDesc = function() {
          return readModel.get('car', {
            priceRange: '1,000-5,000'
          }, {
            make: -1
          });
        };

        it('sorts descending', function(done) {
          getResultByNameDesc().then(function(result) {
            expect(result.items[0].make).to.equal('y');
            expect(result.items[1].make).to.equal('x');
            expect(result.items[2].make).to.equal('w');
            expect(result.items[3].make).to.equal('v');
            expect(result.items[4].make).to.equal('u');
            expect(result.items[5].make).to.equal('t');
            expect(result.items[6].make).to.equal('s');
            expect(result.items[7].make).to.equal('r');
            expect(result.items[8].make).to.equal('q');
            expect(result.items[9].make).to.equal('p');
            done();
          }).catch(done);
        });
      });

      describe('integer field sort', function() {
        var getResultsSortByprice = function() {
          return readModel.get('car', {
            priceRange: '1,000-5,000'
          }, {
            price: 1
          });
        };

        it('sorts by integer', function(done) {
          getResultsSortByprice().then(function(result) {
            result.items.forEach(function(item) {
              expect(item.price).to.equal(1);
            });
            done();
          }).catch(done);
        });

        describe('descending', function() {
          var getResultsSortBypriceDesc = function() {
            return readModel.get('car', {
              priceRange: '1,000-5,000'
            }, {
              price: -1
            });
          };

          it('sorts by integer desc', function(done) {
            getResultsSortBypriceDesc().then(function(result) {
              result.items.forEach(function(item) {
                expect(item.price).to.equal(2);
              });
              done();
            }).catch(done);
          });

        });
      });

      describe('paging', function() {

        it('uses pageSize', function(done) {
          readModel.get('car', {
            priceRange: '1,000-5,000'
          }, {}, {
            pageSize: 5,
            pageNumber: 1
          }).then(function(result) {
            expect(result.items.length).to.equal(5);
            done();
          }).catch(done);
        });

        it('uses pageNumber', function(done) {
          readModel.get('car', {
            priceRange: '1,000-5,000'
          }, {}, {
            pageSize: 20,
            pageNumber: 2
          }).then(function(result) {
            expect(result.items.length).to.equal(5);
            done();
          }).catch(done);
        });

      });

    });

    describe('get by multiple (single val) field indices', function() {
      var getResult = function() {
        return readModel.get('car', {
          priceRange: '1,000-5,000',
          year: 1
        });
      };

      it('intersects (total)', function(done) {
        getResult().then(function(res) {
          // console.log(util.inspect(res, {
          //   depth: null
          // }));
          expect(res.total).to.equal(6);
          done();
        }).catch(done);
      });

      it('intersects (check values)', function(done) {
        getResult().then(function(res) {
          res.items.forEach(function(item) {
            expect(item.priceRange).to.equal('1,000-5,000');
            expect(item.yearOfManufacture).to.equal(1);
          });
          done();
        }).catch(done);
      });
    });

    describe('get by multiple (single val & array) field indices', function() {
      var getResult = function() {
        return readModel.get('car', {
          priceRange: '1,000-5,000',
          year: 1,
          featureId: 1
        });
      };

      it('intersects (total)', function(done) {
        getResult().then(function(res) {
          console.log(util.inspect(res, {
            depth: null
          }));
          expect(res.total).to.equal(1);
          done();
        }).catch(done);
      });

      it('intersects (check values)', function(done) {
        getResult().then(function(res) {
          res.items.forEach(function(item) {
            expect(item.priceRange).to.equal('1,000-5,000');
            expect(item.yearOfManufacture).to.equal(1);
            expect(item.featureIds).to.include(1);
          });
          done();
        }).catch(done);
      });
    });

    describe('get by multiple array value indices', function() {
      var getResult = function() {
        return readModel.get('car', {
          priceRange: '1,000-5,000',
          year: 2,
          featureId: [1, 4]
        }, {}, {
          pageSize: 20
        });
      };

      it('unions and intersects (total)', function(done) {
        getResult().then(function(res) {
          // console.log(util.inspect(res, {
          //   depth: null
          // }));
          expect(res.total).to.equal(19);
          done();
        }).catch(done);
      });

      it('unions and intersects (check values)', function(done) {
        getResult().then(function(res) {
          res.items.forEach(function(item) {
            expect(item.priceRange).to.equal('1,000-5,000');
            expect(item.yearOfManufacture).to.equal(2);
            expect(item.featureIds).to.satisfy(function(vals) {
              return _.includes(vals, 1) || _.includes(vals, 4);
            });
          });
          done();
        }).catch(done);
      });
    });

    describe('get by external index', function() {

      it('gets all matching (total)', function(done) {
        readModel.get('car', {
          userId: 1
        }).then(function(result) {
          expect(result.total).to.equal(50);
          done();
        }).catch(done);
      });

      it('gets all matching (check)', function(done) {
        readModel.get('car', {
          userId: 1
        }).then(function(result) {
          result.items.forEach(function(item) {
            expect(user1cars).to.include(item.id);
          });
          done();
        }).catch(done);
      });

      it('combines with field index', function(done) {
        readModel.get('car', {
          userId: 1,
          year: 1
        }).then(function(result) {
          expect(result.total).to.equal(12);
          result.items.forEach(function(item) {
            expect(user1cars).to.include(item.id);
            expect(item.yearOfManufacture).to.equal(1);
          });
          done();
        }).catch(done);
      });
    });
  });
});