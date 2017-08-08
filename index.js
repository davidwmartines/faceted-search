'use strict';
var util = require('util');
var _ = require('lodash');
var redis = require('redis');
var Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var clientInstance;

var entities = {};

var readModelConfig = {
  host: 'localhost',
  port: '6379',
  auth_pass: undefined,
  pageSize: 10,
  tempSetExpireSeconds: 5
};

function log(msg, args) {
  if (readModelConfig.log) {
    try {
      readModelConfig.log.debug(msg, args);
    } catch (err) {
      console.log(err);
    }
  }
}

function getClient() {
  if (readModelConfig.client) {
    return readModelConfig.client;
  }
  if (clientInstance) {
    return clientInstance;
  }
  clientInstance = redis.createClient(readModelConfig.port, readModelConfig.host, {
    auth_pass: readModelConfig.auth_pass
  });
  return clientInstance;
}

/**
 * Configures read-model.
 * @param  {object} options Object specifying the config options.
 * Options:
 * pageSize: default 10
 * tempSetExpireSeconds: default 5
 * log: function() : default undefined,
 * host: default 'localhost',
 * port: default '6379',
 * auth_pass: default undefined,
 * client: default undefined
 */
module.exports.init = function(options) {
  if (!options) {
    throw new Error('options param required for init function.');
  }
  readModelConfig = _.merge(readModelConfig, options);
  log('read-model config', util.inspect(readModelConfig, {
    depth: 1
  }));
};

/**
 * Registers an entity type for use with read-model.
 * @param {string} type - The type of entity.
 * @param {object} options - The options.
 * Example:
 * {
    idField: 'string' | function(entity){ },
    indexedFields: [{
      fieldName: 'string',
      getValue: function(entity){ } //optional
    }],
    sortFields: [{
      fieldName: 'string',
      alpha: true|false,
      getValue: function(entity){ } //optional
    }],
    defaultSortField: '' //required
  }
 */
module.exports.register = function(type, options) {

  if (!type) {
    throw new Error('type required for register function.');
  }
  if (!options) {
    throw new Error('options required for register function.');
  }
  if (!options.idField) {
    throw new Error('options.idField required for register function.');
  }
  if (!options.defaultSortField) {
    throw new Error('options.defaultSortField required for register function.');
  }
  if (!_.find(options.sortFields, {
      fieldName: options.defaultSortField
    })) {
    throw new Error(options.defaultSortField + ' is not specified as a sortField');
  }

  options.sortTypes = {};
  options.sortFields.forEach(function(sortField) {
    options.sortTypes[sortField.fieldName] = {
      alpha: sortField.alpha
    };
  });
  entities[type] = options;
  log('registered entity', type);
};

/**
 * Sets an entity.
 * @param {string} type - The type of entity.
 * @param {object} entity - The entity object.
 */
module.exports.set = function(type, entity) {

  if (!type) {
    throw new Error('type param required for set function.');
  }

  if (!entity) {
    throw new Error('entity param required for set function.');
  }

  var config = entities[type];

  if (!config) {
    throw new Error(type + ' is not configured in read-model');
  }

  var id = (typeof config.idField === 'function') ? config.idField(entity) : entity[config.idField];

  var entityKey = type + ':' + id;

  var client = getClient();
  var multi = client.multi();

  return client.existsAsync(entityKey).then(function(exists) {

    // store object
    multi.set(entityKey, JSON.stringify(entity));

    // hash for sorting
    var hashKey = 'h:' + entityKey;
    config.sortFields.forEach(function(sortField) {
      var sortVal = (sortField.getValue) ? sortField.getValue(entity) : entity[sortField.fieldName];
      multi.hset(hashKey, sortField.fieldName, sortVal);
    });

    // update indices
    var indexUpdates = config.indexedFields.map(function(index) {
      var indexVal = (index.getValue) ? index.getValue(entity) : entity[index.fieldName];
      if (exists === 0) {
        return addIndex(type, entityKey, index.fieldName, indexVal, multi);
      } else {
        return updateIndex(type, entityKey, index.fieldName, indexVal, client, multi);
      }
    });

    return Promise.all(indexUpdates).then(function() {
      return multi.execAsync().catch(function(err) {
        throw err;
      });
    });
  });
};

/**
 * Updates the index of an entity to one or more values.
 * @return {Promise}
 */
function updateIndex(type, entityKey, indexName, indexVal, client, multi) {
  var indexKeyPrefix = 'x:' + type + '-' + indexName + ':';
  var indexKey = indexKeyPrefix + indexVal;

  // remove entity from any existing index values
  return client.keysAsync(indexKeyPrefix + '*').then(function(existingIndices) {
    existingIndices.forEach(function(existingIndex) {
      log('checking existing index', existingIndex);
      if (Array.isArray(indexVal)) {
        if (!_.find(indexVal, function(val) {
            return indexKeyPrefix + val === existingIndex;
          })) {
          log('removing from', existingIndex);
          multi.srem(existingIndex, entityKey);
        }
      } else if (existingIndex !== indexKey) {
        log('removing from', existingIndex);
        multi.srem(existingIndex, entityKey);
      }
    });
  }).then(function() {
    return addIndex(type, entityKey, indexName, indexVal, multi);
  });
}

/**
 * Adds an entity to the index of one or more values.
 * @return {Promise}
 */
function addIndex(type, entityKey, indexName, indexVal, multi) {
  var indexKeyPrefix = 'x:' + type + '-' + indexName + ':';

  if (Array.isArray(indexVal)) {
    indexVal.forEach(function(val) {
      var valKey = indexKeyPrefix + val;
      multi.sadd(valKey, entityKey);
    });
  } else {
    var indexKey = indexKeyPrefix + indexVal;
    multi.sadd(indexKey, entityKey);
  }
  return Promise.resolve();
}

/**
 * Updates the indices of multiple entities to a value.
 * @return {Promise}
 */
function updateInvertedIndex(type, entityKeys, indexName, indexVal, client, multi) {
  var indexKey = 'x:' + type + '-' + indexName + ':' + indexVal;
  multi.del(indexKey);
  multi.sadd(indexKey, entityKeys);
  return Promise.resolve();
}

/**
 * Indexes an entity by one or more external values.
 * @param  {string} type - The type of entity.
 * @param  {object} options - Object specifying the index properties.
 * Example:
 * {
    entityId: object,
    indexName: 'string',
    value: object|Array // value(s) the entity should be indexed by
  }
 */
module.exports.setIndex = function(type, options) {

  if (!type) {
    throw new Error('type param required for setIndex function.');
  }

  if (!options) {
    throw new Error('options param required for setIndex function.');
  }

  if (!options.entityId) {
    throw new Error('options.entityId param required for setIndex function.');
  }

  if (!options.indexName) {
    throw new Error('options.indexName param required for setIndex function.');
  }

  if (!options.value) {
    throw new Error('options.value param required for setIndex function.');
  }

  var client = getClient();
  var multi = client.multi();
  var entityKey = type + ':' + options.entityId;
  return client.existsAsync(entityKey).then(function(exists) {
    var action;
    if (exists === 0) {
      action = addIndex(type, entityKey, options.indexName, options.value, multi);
    } else {
      action = updateIndex(type, entityKey, options.indexName, options.value, client, multi);
    }
    return action
      .then(function() {
        return multi.execAsync().catch(function(err) {
          throw err;
        });
      });
  });

};

/**
 * Indexes multiple entities by a single external value.
 * @param  {string} type - The type of entity.
 * @param  {object} options - Object specifying the index properties.
 * Example:
 * {
    value : object // value the entities should be indexed by
    entityIds: Array, // the entity Ids
    indexName: 'string'
  }
 */
module.exports.setInvertedIndex = function(type, options) {

  if (!type) {
    throw new Error('type param required for setInvertedIndex function.');
  }

  if (!options) {
    throw new Error('options param required for setInvertedIndex function.');
  }

  if (!options.value) {
    throw new Error('options.value param required for setInvertedIndex function.');
  }

  if (!options.entityIds) {
    throw new Error('options.entityIds param required for setInvertedIndex function.');
  }

  if (options.entityIds.length === 0) {
    throw new Error('options.entityIds param cannot be empty for setInvertedIndex function.');
  }

  if (!options.indexName) {
    throw new Error('options.indexName param required for setInvertedIndex function.');
  }

  var client = getClient();
  var multi = client.multi();
  var entityKeys = options.entityIds.map(function(id) {
    return type + ':' + id;
  });
  return updateInvertedIndex(type, entityKeys, options.indexName, options.value, client, multi)
    .then(function() {
      return multi.execAsync().catch(function(err) {
        throw err;
      });
    });
};

/**
 * Deletes an entity.
 * @param  {string} type - The type of entity.
 * @param  {object} id - The id of the entity to be deleted.
 */
module.exports.delete = function(type, id) {

  if (!type) {
    throw new Error('type param required for delete function.');
  }

  if (!id) {
    throw new Error('id param required for delete function.');
  }

  var entityKey = type + ':' + id;
  var client = getClient();
  var multi = client.multi();

  var indexKeyPrefix = 'x:' + type + '-*';
  return client.keysAsync(indexKeyPrefix)
    .then(function(indices) {

      // remove from indices
      indices.forEach(function(index) {
        multi.srem(index, entityKey);
      });

      // remove hash
      multi.del('h:' + entityKey);

      // remove entity
      multi.del(entityKey);

      return multi.execAsync();
    })
    .then(function() {
      log('deleted', entityKey);
    })
    .catch(function(err) {
      throw err;
    });
};


/**
 * Gets a paginated, sorted array (plus total count) of the entities based on index criteria.
 * @param {string} type - The type of entity.
 * @param {object} criteria - Object specifying the query criteria.
 *  Example: {fieldName: value, fieldName: [val, val,...], ...}
 * @param {object} sort - Object specifying the sorting.
 *  Example: {fieldName: 1|-1} //1=ASC, -1=DESC
 * @param {object} paging - Object specifying the paging.
 *  Example: {pageNumber: n, pageSize: n}
 * @return {object} {items: The array of entities, total: the total count of matching entities}
 */
module.exports.get = function(type, criteria, sort, paging) {

  if (!type) {
    throw new Error('type param required for get function.');
  }

  if (!criteria) {
    throw new Error('criteria param required for get function.');
  }

  log('get', criteria);

  if (!entities[type]) {
    throw new Error(type + ' is not configured in read-model');
  }

  var client = getClient();

  return Promise.bind({})
    .then(function() {
      return getResultSetInfo();
    })
    .then(function(resultSetInfo) {
      log('result set key', resultSetInfo.key);
      this.resultSetInfo = resultSetInfo;
      return makeResultSet(resultSetInfo);
    })
    .then(function(count) {
      this.total = count;
    })
    .then(function() {
      var sortCmd = [this.resultSetInfo.key];
      addSortExpression(sortCmd);
      addPagingExpression(sortCmd);
      log('sort', sortCmd.join(' '));
      return client.sortAsync(sortCmd);
    })
    .then(function(ids) {
      log('found %s items', ids.length);
      if (ids.length > 0) {
        return client.mgetAsync(ids);
      }
      return Promise.resolve([]);
    })
    .then(function(entities) {
      var parsed = entities.map(function(entity) {
        return JSON.parse(entity);
      });
      return {
        items: parsed,
        total: this.total
      };
    });

  function getResultSetInfo() {
    var unions = [];
    var intersections = [];
    Object.keys(criteria).forEach(function(key) {
      var val = criteria[key];
      if (Array.isArray(val) && val.length > 0) {
        if (val.length > 1) {
          val.forEach(function(v) {
            unions.push(getIndexKey(key, v));
          });
        } else {
          intersections.push(getIndexKey(key, val[0]));
        }
      } else {
        intersections.push(getIndexKey(key, val));
      }
    });

    var unionsKey = unions.join('_');
    var intersectionsKey = intersections.join('|');
    var key;
    if (unions.length > 0 && intersections.length > 0) {
      key = unionsKey + '|' + intersectionsKey;
    } else {
      key = unionsKey + intersectionsKey;
    }

    return Promise.resolve({
      unions: unions,
      unionsKey: unionsKey,
      intersections: intersections,
      intersectionsKey: intersectionsKey,
      key: key
    });

    function getIndexKey(key, val) {
      return 'x:' + type + '-' + key + ':' + val;
    }
  }

  function makeResultSet(resultSetInfo) {
    if (resultSetInfo.unions.length > 0) {
      return makeUnion(resultSetInfo.unionsKey, resultSetInfo.unions).then(function() {
        if (resultSetInfo.intersections.length > 0) {
          resultSetInfo.intersections.push(resultSetInfo.unionsKey);
          return makeIntersection(resultSetInfo.key, resultSetInfo.intersections);
        } else {
          return client.scardAsync(resultSetInfo.key);
        }
      });
    } else if (resultSetInfo.intersections.length > 0) {
      return makeIntersection(resultSetInfo.key, resultSetInfo.intersections);
    } else {
      throw new Error('criteria was empty');
    }
  }

  function makeUnion(resultSetKey, sources) {
    return client.existsAsync(resultSetKey)
      .then(function(exists) {
        if (exists === 0) {
          return client.sunionstoreAsync(resultSetKey, sources).then(function(count) {
            client.expire(resultSetKey, readModelConfig.tempSetExpireSeconds);
          });
        }
        log('using existing union', resultSetKey);
        return Promise.resolve();
      });
  }

  function makeIntersection(resultSetKey, sources) {
    return client.existsAsync(resultSetKey)
      .then(function(exists) {
        if (exists === 0) {
          return client.sinterstoreAsync(resultSetKey, sources).then(function(count) {
            client.expire(resultSetKey, readModelConfig.tempSetExpireSeconds);
            return count;
          });
        }
        log('using existing intersection', resultSetKey);
        return client.scardAsync(resultSetKey);
      });
  }

  function addSortExpression(cmd) {
    var sortField, desc;
    if (sort && Object.keys(sort).length > 0) {
      sortField = Object.keys(sort)[0];
      desc = sort[sortField] === -1;
    }
    if (sortField && !entities[type].sortTypes[sortField]) {
      throw new Error(sortField + ' is not a configured sortField for entity type ' + type + ' in read-model');
    }
    sortField = sortField || entities[type].defaultSortField;
    cmd.push('BY');
    cmd.push('h:*->' + sortField);
    if (entities[type].sortTypes[sortField].alpha) {
      cmd.push('ALPHA');
    }
    if (desc) {
      cmd.push('DESC');
    }
  }

  function addPagingExpression(cmd) {
    var pageNumber, pageSize;
    if (paging && paging.pageSize) {
      pageSize = paging.pageSize;
    } else {
      pageSize = readModelConfig.pageSize;
    }
    if (paging && paging.pageNumber) {
      pageNumber = paging.pageNumber;
    } else {
      pageNumber = 1;
    }
    cmd.push('LIMIT');
    cmd.push((pageNumber - 1) * pageSize);
    cmd.push(pageSize);
  }
};

module.exports.quit = function() {
  if (clientInstance) {
    clientInstance.quit();
  }
};