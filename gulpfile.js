var gulp = require('gulp'),
    connect = require('gulp-connect'),
    sass = require('gulp-ruby-sass'),
    shell = require('gulp-shell'),
    apidoc = require('gulp-apidoc');

gulp.task('connect', function() {
    connect.server({
        livereload: true,
        port: 8005
    });
});

gulp.task('reload', function() {
    gulp.src('./dist/**/*.*')
        .pipe(connect.reload());
});

gulp.task('sass', function() {
   gulp.src('./sass/*.scss')
       .pipe(sass())
       .pipe(gulp.dest('dist/css'));
});

gulp.task('js', function() {
    gulp.src('./js/*.js')
        .pipe(gulp.dest('dist/js'));
});

gulp.task('watch', function() {
    gulp.watch(['./sass/*.scss'], ['sass']);
    gulp.watch(['./js/*.js'], ['js']);
    gulp.watch(['./dist/**/*.*'], ['reload']);
});

gulp.task('jsdoc', shell.task([
    './node_modules/.bin/jsdoc -c ./jsdoc.json -d ./doc/frontend'
]));

gulp.task('apidoc', function(){
    apidoc.exec({
        src: "backend/",
        dest: "doc/backend",
        includeFilters: [ ".*\\.js$" ]
    });
});

gulp.task('default', ['connect', 'watch', 'sass', 'js']);