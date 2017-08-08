'use strict';
var redis = require('redis');
var Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var readModel = require('../index');
var client = redis.createClient();
init();

var pageSize = 100;

console.log('page size', pageSize);

runWithCount(1000)
  .then(function() {
    return runWithCount(5000);
  })
  .then(function() {
    return runWithCount(10000);
  })
  .then(function() {
    return runWithCount(50000);
  })
  .then(function() {
    return runWithCount(100000);
  })
  .then(function() {
    return runWithCount(500000);
  })
  .then(function() {
    return runWithCount(1000000);
  })
  .finally(function() {
    client.quit();
    readModel.quit();
  });

function runWithCount(count) {
  console.log('with ' + count + ' items');


  var loader;
  if (count <= 100000) {
    loader = load(count);
  } else {
    var chunks = [];
    for (var i = 1; i < count + 1; i += 100000) {
      chunks.push(i);
    }
    loader = Promise.each(chunks, function(val) {
      return load(100000, val);
    });
  }
  return client.flushdbAsync()
    .then(function() {
      return loader;
    })
    .then(function() {
      console.time(' get items using 1 intersection (alpha sort)');
      return getItemsUsing1Intersection_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 1 intersection (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 1 index (alpha sort)');
      return getItemsUsing1Index_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 1 index (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 2 interesctions (alpha sort)');
      return getItemsUsing2Intersections_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 2 interesctions (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 3 intersections (alpha sort)');
      return getItemsUsing3Intersections_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 3 intersections (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 1 union (alpha sort)');
      return getItemsUsing1Union_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 1 union (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 2 unions (alpha sort)');
      return getItemsUsing2Unions_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 2 unions (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 3 intersections and 2 unions (alpha sort)');
      return getItemsUsing3IntersectionsAnd2Unions_alpha();
    })
    .then(function() {
      console.timeEnd(' get items using 3 intersections and 2 unions (alpha sort)');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 1 intersection');
      return getItemsUsing1Intersection();
    })
    .then(function() {
      console.timeEnd(' get items using 1 intersection');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 1 index');
      return getItemsUsing1Index();
    })
    .then(function() {
      console.timeEnd(' get items using 1 index');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 2 interesctions');
      return getItemsUsing2Intersections();
    })
    .then(function() {
      console.timeEnd(' get items using 2 interesctions');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 3 intersections');
      return getItemsUsing3Intersections();
    })
    .then(function() {
      console.timeEnd(' get items using 3 intersections');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 1 union');
      return getItemsUsing1Union();
    })
    .then(function() {
      console.timeEnd(' get items using 1 union');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 2 unions');
      return getItemsUsing2Unions();
    })
    .then(function() {
      console.timeEnd(' get items using 2 unions');
      return cleanUpTempSets();
    })
    .then(function() {
      console.time(' get items using 3 intersections and 2 unions');
      return getItemsUsing3IntersectionsAnd2Unions();
    })
    .then(function() {
      console.timeEnd(' get items using 3 intersections and 2 unions');
      return cleanUpTempSets();
    })
    .catch(function(err) {
      console.error(err);
    });

}

function init() {
  readModel.init({
    pageSize: pageSize
      //log: console.log
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
}

function load(count, startId) {

  console.time('load');
  console.log('load args', count, startId);

  var user1cars = [];
  var user2cars = [];
  var entities = [];

  if (startId) {
    count = startId + count - 1;
  }

  if (!startId) {
    startId = 1;
  }

  for (var i = startId; i <= count; i++) {

    var priceRange = (i <= (count / 4)) ? '1,000-5,000' : '5,000-6,000';
    var yearOfManufacture = (i % 4 === 0) ? 1 : 2;
    var price = (i % 2 === 0) ? 1 : 2;
    var featureIds = (i % 10 === 0) ? [1, 2, 3] : (i % 25 === 0) ? [4, 5] : [6, 7];

    var name;
    if (i <= (count / 4)) {
      name = 'yxwvutsrqponmlkjihgfedcba' [i - 1];
    } else if (i <= (count / 2)) {
      name = 'z';
    } else if (i <= (count / 0.75)) {
      name = 'za';
    } else {
      name = 'zb';
    }

    if (i % 2 === 0) {
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
  console.log('loading entities ' + startId + ' - ' + count);
  console.time('set ' + entities.length);
  return Promise.all(entities.map(function(e) {
      return readModel.set('car', e);
    }))
    .then(function() {
      console.timeEnd('set ' + entities.length);
      console.log('loaded entities');
      console.log('setting InvertedIndex 1', user1cars.length);
      return readModel.setInvertedIndex('car', {
        indexName: 'userId',
        entityIds: user1cars,
        value: 1
      });
    })
    .then(function() {
      console.log('setting InvertedIndex 2', user2cars.length);
      return readModel.setInvertedIndex('car', {
        indexName: 'userId',
        entityIds: user2cars,
        value: 2
      }).then(function() {
        console.timeEnd('load');
        console.log('load complete');
      })
    });
}

function cleanUpTempSets() {
  var multi = client.multi();
  return client.keysAsync('*_*')
    .then(function(keys) {
      keys.forEach(function(key) {
        //console.log('del', key);
        multi.del(key);
      });
      return client.keysAsync('*|*').then(function(keys) {
        keys.forEach(function(key) {
          // console.log('del', key);
          multi.del(key);
        });
      });
    })
    .then(function() {
      return multi.execAsync();
    });
}

function getItemsUsing1Index_alpha() {
  return readModel.get('car', {
    userId: 1
  });
}

function getItemsUsing1Intersection_alpha() {
  return readModel.get('car', {
    userId: 1,
    year: 1
  });
}

function getItemsUsing2Intersections_alpha() {
  return readModel.get('car', {
    userId: 1,
    year: 1,
    featureId: 1
  });
}

function getItemsUsing3Intersections_alpha() {
  return readModel.get('car', {
    userId: 1,
    year: 1,
    featureId: 1,
    priceRange: '1,000-5,000'
  });
}

function getItemsUsing1Union_alpha() {
  return readModel.get('car', {
    featureId: [1, 4]
  });
}

function getItemsUsing2Unions_alpha() {
  return readModel.get('car', {
    featureId: [1, 4, 6]
  });
}

function getItemsUsing3IntersectionsAnd2Unions_alpha() {
  return readModel.get('car', {
    userId: 1,
    year: 1,
    featureId: [1, 4, 6],
    priceRange: '1,000-5,000'
  });
}


function getItemsUsing1Index() {
  return readModel.get('car', {
    userId: 1
  }, {
    price: 1
  });
}

function getItemsUsing1Intersection() {
  return readModel.get('car', {
    userId: 1,
    year: 1
  }, {
    price: 1
  });
}

function getItemsUsing2Intersections() {
  return readModel.get('car', {
    userId: 1,
    year: 1,
    featureId: 1
  }, {
    price: 1
  });
}

function getItemsUsing3Intersections() {
  return readModel.get('car', {
    userId: 1,
    year: 1,
    featureId: 1,
    priceRange: '1,000-5,000'
  }, {
    price: 1
  });
}

function getItemsUsing1Union() {
  return readModel.get('car', {
    featureId: [1, 4]
  }, {
    price: 1
  });
}

function getItemsUsing2Unions() {
  return readModel.get('car', {
    featureId: [1, 4, 6]
  }, {
    price: 1
  });
}

function getItemsUsing3IntersectionsAnd2Unions() {
  return readModel.get('car', {
    userId: 1,
    year: 1,
    featureId: [1, 4, 6],
    priceRange: '1,000-5,000'
  }, {
    price: 1
  });
}