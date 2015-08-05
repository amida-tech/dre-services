'use strict';

module.exports = function (grunt) {

    // Load grunt tasks automatically
    require('load-grunt-tasks')(grunt);
    // Time how long tasks take. Can help when optimizing build times
    require('time-grunt')(grunt);

    // Unified Watch Object
    var watchFiles = {
        serverJS: ['Gruntfile.js', 'server.js', 'lib/**/*.js'],
        mochaTests: ['test/unit/*.js', 'test/e2e/**/*.js', 'test/e2e/*.js'],
        oauthTests: ['test/oauth/*.js']
    };

    var appConfig = {
        app: require('./bower.json').appPath || 'app',
        dist: require('./bower.json').distPath || 'dist'
    };

    // Making grunt default to force in order not to break the project.
    //grunt.option('force', true); //DISABLED, not good idea in general

    // Default task(s).
    grunt.registerTask('default', ['jshint', 'jsbeautifier:beautify', 'env:test', 'express:dev', 'mochaTest:test']); //need to add in 'mochaTest:oauthTest'

    grunt.registerTask('oauth', ['env:test', 'express:dev', 'jshint', 'mochaTest:oauthTest']);

    // Run benchmark tests
    grunt.registerTask('benchmark', ['execute']);

    // Not ready for use
    grunt.registerTask('coverage', ['shell:run_istanbul']);

    // Test task.
    //grunt.registerTask('test', ['env:test', 'jshint', 'lint', 'concurrent:test']);
    grunt.registerTask('live', ['concurrent:default']);

    // Print a timestamp (useful for when watching)
    grunt.registerTask('timestamp', function () {
        grunt.log.subhead(Date());
    });

    // Client tasks 
    grunt.registerTask('build', ['jshint', 'jsbeautifier:beautify']);
    grunt.registerTask('dev', ['jshint', 'jsbeautifier:beautify', 'watch']);
    grunt.registerTask('test', ['jshint', 'jsbeautifier:beautify', 'watch']);

    // Project Configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        // Project settings
        yeoman: appConfig,

        watch: {
            serverJS: {
                files: watchFiles.serverJS,
                tasks: ['jshint', 'jsbeautifier'],
                options: {
                    livereload: true
                }
            }
        },
        jshint: {
            files: [
                'Gruntfile.js', 'package.json', '*.js', './lib/*.js', './lib/**/*.js', './test/*.js', './test/**/*.js', '<%= yeoman.app %>/scripts/{,*/}*.js',
                '!./lib/dre/remove_dups.js', '!./test/coverage/lcov-report/**/*.js'
            ],
            options: {
                reporter: require('jshint-stylish'),
                "bitwise": true,
                "browser": false,
                "camelcase": false,
                "curly": true,
                "eqeqeq": true,
                "esnext": true,
                "expr": true,
                "globals": {
                    "$": false,
                    "DeepDiff": false,
                    "_": true,
                    "after": true,
                    "angular": false,
                    "before": true,
                    "describe": true,
                    "done": true,
                    "it": true,
                    "moment": false,
                    "Promise": true,
                    "xdescribe": true,
                    "xit": true
                },
                "immed": true,
                "indent": 4,
                "latedef": "nofunc",
                "multistr": true,
                "newcap": true,
                "noarg": true,
                "node": true,
                "quotmark": false,
                "regexp": true,
                "smarttabs": true,
                "trailing": true,
                "undef": true,
                "unused": false
            }
        },
        jsbeautifier: {
            beautify: {
                src: ['Gruntfile.js', 'lib/*.js', 'lib/**/*.js', 'test/**/*.js', '*.js', 'test/xmlmods/*.json'],
                options: {
                    config: '.jsbeautifyrc'
                }
            },
            check: {
                src: ['Gruntfile.js', 'lib/*.js', 'lib/**/*.js', 'test/**/*.js', '*.js', 'test/xmlmods/*.json'],
                options: {
                    mode: 'VERIFY_ONLY',
                    config: '.jsbeautifyrc'
                }
            }
        },

        // Add vendor prefixed styles
        autoprefixer: {
            options: {
                browsers: ['last 1 version']
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: 'client/.tmp/styles/',
                    src: '{,*/}*.css',
                    dest: 'client/.tmp/styles/'
                }]
            }
        },
        nodemon: {
            dev: {
                script: 'server.js',
                options: {
                    //nodeArgs: ['--debug'],
                    ext: 'js,html',
                    watch: watchFiles.serverJS
                }
            }
        },
        // Replace Google CDN references
        cdnify: {
            dist: {
                html: ['<%= yeoman.dist %>/*.html']
            }
        },
        // The following *-min tasks will produce minified files in the dist folder
        // By default, your `index.html`'s <!-- Usemin block --> will take care of
        // minification. These next options are pre-configured if you do not wish
        // to use the Usemin blocks.
        imagemin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= yeoman.app %>/images',
                    src: '{,*/}*.{png,jpg,jpeg,gif}',
                    dest: '<%= yeoman.dist %>/images'
                }]
            }
        },
        svgmin: {
            dist: {
                files: [{
                    expand: true,
                    cwd: '<%= yeoman.app %>/images',
                    src: '{,*/}*.svg',
                    dest: '<%= yeoman.dist %>/images'
                }]
            }
        },
        htmlmin: {
            dist: {
                options: {
                    collapseWhitespace: true,
                    conservativeCollapse: true,
                    collapseBooleanAttributes: true,
                    removeCommentsFromCDATA: true,
                    removeOptionalTags: true
                },
                files: [{
                    expand: true,
                    cwd: '<%= yeoman.dist %>/views',
                    src: ['{,*/}*.html'],
                    dest: '<%= yeoman.dist %>/views'
                }]
            }
        },
        uglify: {
            dist: {
                options: {
                    mangle: false
                },
                files: [{
                    expand: true,
                    cwd: '.tmp/scripts',
                    src: '{,**/}*.js',
                    dest: '<%= yeoman.dist %>/scripts'
                }]
            }
        },
        // Run some tasks in parallel to speed up the build process
        concurrent: {
            default: ['nodemon', 'watch'],
            test: ['env:test', 'nodemon', 'watch', 'mochaTest:test', 'mochaTest:oauthTest'],
            options: {
                logConcurrentOutput: true,
                limit: 10
            }
        },
        env: {
            options: {
                //Shared Options Hash
            },
            all: {
                src: ["env/*"],
                options: {
                    envdir: true
                }
            },
            test: {
                DBname: 'devtests'
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec',
                    timeout: '10000'
                },
                src: watchFiles.mochaTests
            },
            oauthTest: {
                options: {
                    reporter: 'spec',
                    timeout: '10000'
                },
                src: watchFiles.oauthTests
            }
        },
        express: {
            dev: {
                options: {
                    script: './server.js'
                }
            }
        },
        execute: {
            target: {
                src: ['./lib/benchmark/index.js']
            }
        },
        shell: {
            run_istanbul: {
                command: "./cover.sh"
            }
        }
    });
};
