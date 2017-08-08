'use strict';

var gulp = require('gulp');
var gulpMocha = require('gulp-mocha');
var gulpUtil = require('gulp-util');

gulp.task('test', function() {
  var options = getOptions({
    reporter: 'spec',
    timeout: undefined
  });
  return gulp.src('./test/*.tests.js')
    .pipe(gulpMocha(options))
    .on('error', gulpUtil.log);
});

gulp.task('integration-test', function() {
  var options = getOptions({
    reporter: 'spec',
    timeout: undefined
  });
  return gulp.src('./test/integration-test.js')
    .pipe(gulpMocha(options))
    .on('error', gulpUtil.log);
});

function getOptions(defaults) {
  var args = process.argv[0] == 'node' ? process.argv.slice(3) : process.argv.slice(2);
  var minimist = require('minimist');
  return minimist(args, {
    default: defaults
  });
}