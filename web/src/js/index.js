import '../css/index.css';
import { TemplateVar } from './helpers/template-var.js';
import { initHomePage } from './pages/home-page.js';
import { initLoginPage } from './pages/login-page.js';
import { initPublishPage } from './pages/publish-page.js';

const pageHandlers = {
	home: initHomePage,
	login: initLoginPage,
	publish: initPublishPage,
};

function dispatchPage() {
	const page = TemplateVar.get('page');
	const handler = pageHandlers[page] || initHomePage;
	handler();
}

dispatchPage();