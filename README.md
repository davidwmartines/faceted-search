
# read-model

Node.js module for basic (but fast) faceted-searches using Redis.


## Idea
Data to be searched (the read-model) can be stored separately from an underlying transactional model, in a manner optimized for high-performance reads.  Rather than caching search results after an initial cache-miss, the read-model is pre-loaded with data structures that can support a wide variety of structured searches. Redis sets are used to create indexes based on pre-defined values that will be used for filtering.  The sets are intersected and/or unioned as needed to get a result set.  As changes are made to the transactional model, the read-model needs to be notified so that it's model and indexes are updated (i.e. eventual consistency). 

## Features
 - Stores entities as JSON objects.
 - Any number of entity fields can be indexed (i.e. made available to be included as searchable value).
 - Entities can be indexed by an array of external values.
 - Multiple entities can be indexed by a single external value.
 - Supports paginated searches.
 - Supports sorting (asc/desc, numerical or alpha) based on predefined entity fields.

## basic benchmarks

Getting a page of 100 items, using various combinations of search facets.

Note that the more search criteria specified, the faster it is since the interesctions reduce size of the the pre-paginated/sorted set.

with dataset of 1,000 items:
  - using 1 intersection (alpha sort): 5ms
  - using 1 index (alpha sort): 2ms
  - using 2 interesctions (alpha sort): 1ms
  - using 3 intersections (alpha sort): 1ms
  - using 1 union (alpha sort): 1ms
  - using 2 unions (alpha sort): 2ms
  - using 3 intersections and 2 unions (alpha sort): 1ms
  - using 1 intersection: 1ms
  - using 1 index: 1ms
  - using 2 interesctions: 2ms
  - using 3 intersections: 0ms
  - using 1 union: 1ms
  - using 2 unions: 2ms
  - using 3 intersections and 2 unions: 3ms

with dataset of 5,000 items:
  - using 1 intersection (alpha sort): 4ms
  - using 1 index (alpha sort): 3ms
  - using 2 interesctions (alpha sort): 1ms
  - using 3 intersections (alpha sort): 1ms
  - using 1 union (alpha sort): 1ms
  - using 2 unions (alpha sort): 16ms
  - using 3 intersections and 2 unions (alpha sort): 5ms
  - using 1 intersection: 4ms
  - using 1 index: 3ms
  - using 2 interesctions: 1ms
  - using 3 intersections: 0ms
  - using 1 union: 1ms
  - using 2 unions: 8ms
  - using 3 intersections and 2 unions: 17ms

with dataset of 10,000 items:
  - using 1 intersection (alpha sort): 6ms
  - using 1 index (alpha sort): 14ms
  - using 2 interesctions (alpha sort): 5ms
  - using 3 intersections (alpha sort): 1ms
  - using 1 union (alpha sort): 16ms
  - using 2 unions (alpha sort): 18ms
  - using 3 intersections and 2 unions (alpha sort): 10ms
  - using 1 intersection: 8ms
  - using 1 index: 16ms
  - using 2 interesctions: 2ms
  - using 3 intersections: 1ms
  - using 1 union: 3ms
  - using 2 unions: 16ms
  - using 3 intersections and 2 unions: 10ms

with dataset of 50,000 items:
  - using 1 intersection (alpha sort): 33ms
  - using 1 index (alpha sort): 29ms
  - using 2 interesctions (alpha sort): 8ms
  - using 3 intersections (alpha sort): 7ms
  - using 1 union (alpha sort): 15ms
  - using 2 unions (alpha sort): 86ms
  - using 3 intersections and 2 unions (alpha sort): 44ms
  - using 1 intersection: 30ms
  - using 1 index: 27ms
  - using 2 interesctions: 6ms
  - using 3 intersections: 4ms
  - using 1 union: 12ms
  - using 2 unions: 85ms
  - using 3 intersections and 2 unions: 44ms

with dataset of 100,000 items:
  - using 1 intersection (alpha sort): 63ms
  - using 1 index (alpha sort): 64ms
  - using 2 interesctions (alpha sort): 13ms
  - using 3 intersections (alpha sort): 9ms
  - using 1 union (alpha sort): 18ms
  - using 2 unions (alpha sort): 164ms
  - using 3 intersections and 2 unions (alpha sort): 79ms
  - using 1 intersection: 49ms
  - using 1 index: 51ms
  - using 2 interesctions: 14ms
  - using 3 intersections: 10ms
  - using 1 union: 20ms
  - using 2 unions: 161ms
  - using 3 intersections and 2 unions: 78ms

with dataset of 500,000 items:
  - using 1 intersection (alpha sort): 70ms
  - using 1 index (alpha sort): 54ms
  - using 2 interesctions (alpha sort): 30ms
  - using 3 intersections (alpha sort): 11ms
  - using 1 union (alpha sort): 101ms
  - using 2 unions (alpha sort): 863ms
  - using 3 intersections and 2 unions (alpha sort): 303ms
  - using 1 intersection: 54ms
  - using 1 index: 50ms
  - using 2 interesctions: 27ms
  - using 3 intersections: 10ms
  - using 1 union: 101ms
  - using 2 unions: 840ms
  - using 3 intersections and 2 unions: 269ms

with dataset of 1,000,000 items:
  - using 1 intersection (alpha sort): 78ms
  - using 1 index (alpha sort): 55ms
  - using 2 interesctions (alpha sort): 35ms
  - using 3 intersections (alpha sort): 10ms
  - using 1 union (alpha sort): 234ms
  - using 2 unions (alpha sort): 1742ms
  - using 3 intersections and 2 unions (alpha sort): 536ms
  - using 1 intersection: 57ms
  - using 1 index: 48ms
  - using 2 interesctions: 31ms
  - using 3 intersections: 8ms
  - using 1 union: 226ms
  - using 2 unions: 1747ms
  - using 3 intersections and 2 unions: 561ms
