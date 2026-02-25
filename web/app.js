import express from 'express';
import mustacheExpress from 'mustache-express';

const app = express();
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', new URL('./src/html/', import.meta.url).pathname);

app.get('/', (req, res) => {
    res.render('index', {});
});

// static assets
app.use(express.static(new URL('../public/', import.meta.url).pathname));

// 404
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, host, () => {
    console.log(`Academic Events Web running on http://${host}:${port}`);
});

export { app };
