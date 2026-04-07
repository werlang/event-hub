import { BackgroundTask } from './background-task.js';

const task = new BackgroundTask('every sunday at 18:00', callback , {
    name: 'weekly-sunday-foo',
});

function callback() {
    console.log('Foo.Bar');
}


export { task }
