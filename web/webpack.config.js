import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';

export default {
    entry: {
        home: './src/js/index.js',
        auth: './src/js/auth.js',
        publish: './src/js/publish.js',
    },
    output: {
        filename: 'js/[name].min.js',
        path: path.resolve(import.meta.dirname, './public/'),
        publicPath: '/',
    },
    target: ['web', 'es2020'],
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                terserOptions: {
                    format: {
                        comments: false,
                    },
                    mangle: true,
                },
            }),
            new CssMinimizerPlugin({
                minimizerOptions: {
                    preset: [
                        "default",
                        {
                            discardComments: { removeAll: true },
                        },
                    ],
                },
            }),
        ],
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                ],
            },
            {
                test: /\.(png|jpg|webp|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/img/generated/[hash][ext][query]'
                }
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/fonts/[name][ext][query]'
                }
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'css/[name].min.css',
        }),
    ],
    watchOptions: {
        ignored: ['**/node_modules'],
    },
    devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devServer: {
        hot: true,
        port: 80,
        allowedHosts: 'all',
        proxy: [
            {
                context: '/',
                target: 'http://localhost:3000',
            },
        ],
    }
};
