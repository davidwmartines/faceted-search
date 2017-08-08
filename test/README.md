
## Example
Say we want to search for cars by any combination of the following properties:
 - Make
 - Model
 - Year
 - Color
 - Mileage Range
 - Price Range

Assume we can generate entities like the following:
```js
{
  id: 426578903,
  make: 'Honda',
  model: 'Accord',
  year: 1999,
  color: 'Blue',
  mileageRange: '100,000+',
  mileage: 145801,
  price: 1000,
  priceRange: '<=1,000'
}
```

The first step is to register the 'car' entity type with read-model.  This is a one time operation to be done at app startup time.

 ```js
var readModel = require('read-model');

readModel.register('car', {
      idField: 'id',
      indexedFields: [{
        fieldName: 'make'
      }, {
        fieldName: 'model'
      }, {
        fieldName: 'year'
      }, {
        fieldName: 'color'
      }, {
        fieldName: 'mileageRange'
      }, {
        fieldName: 'priceRange'
      }, {
      ],
      sortFields: [{
        fieldName: 'make',
        alpha: true
      }, {
        fieldName: 'model',
        alpha: true
      },{
        fieldName: 'year'
      },{
        fieldName: 'color',
        alpha: true
      },{
        fieldName: 'mileage'
      },{
        fieldName: 'price'
      }],
      defaultSortField: 'year'
    });
  });

 ```

The read-model then needs to be populated with cars.
 ```js
readModel.set('car', {id: 426578903, make: 'Honda', model: 'Accord', year: 1999, color: 'Blue', mileage: 145801, mileageRange: '100,000+', price: 1000, priceRange: '<=1,000'});
readModel.set('car', {id: 426578903, make: 'Honda', model: 'Accord', year: 2000, color: 'Red', mileage: 90675, mileageRange: '50,000-100,000', price: 1100, priceRange: '1,000-2,000'});
readModel.set('car', {id: 426578903, make: 'Honda', model: 'Civic', year: 1980, color: 'White', mileage: 345612, mileageRange: '100,000+', price: 800, priceRange: '<=1,000'});
readModel.set('car', {id: 426578903, make: 'Toyota', model: 'Corolla', year: 2010, color: 'Blue', mileage: 54390, mileageRange: '50,000-100,000', price: 4999, priceRange: '1,000-5,000'});
 ```


We also have a requirement to associate cars to users, based on a recommendation engine.  This way, given a user-id, we can show the list of cars recommended to them.  Since each car could be associated to hundreds or thousands of shoppers, it would be inefficient to store an array of user-ids in each car entity.   For this, we will use the setInvertedIndex function to index a single car by an array of user-ids.
