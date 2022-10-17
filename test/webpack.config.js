const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const dev = argv.mode === 'development' || (env && env.WEBPACK_SERVE);
    return {
        entry: './test/index.ts',
        output: {
            filename: 'bundle.js',
            path: path.resolve(__dirname, 'deploy'),
        },
        mode: dev ? 'development' : 'production',
        devtool: dev ? 'inline-source-map' : undefined,
        optimization: {
            minimize: !dev,
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './test/index.html',
                inject: 'body',
            }),
        ],
        devServer: {
            static: {
                directory: path.join(__dirname, './dist'),
            },
            port: 8080,
            open: {
                target: ['http://localhost:8080'],
                app: {
                    name: "google-chrome",
                },
            },
        },
        module: {
            rules: [{
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    exclude: /node_modules/,
                    options: {
                        compilerOptions: {
                            noEmit: false,
                            incremental: true,
                        },
                        experimentalWatchApi: true,
                    },
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
    }
};