import { getCurrentSession } from '../helpers/session.js';
import { clearToken } from '../helpers/api.js';

const loginButton = document.querySelector('#header-login-link');
const logoutButton = document.querySelector('#header-logout-link');

/**
 * Checks the current session and updates the login button to link to the dashboard if authenticated.
 */
export async function updateLoginButton(messageElement) {
    const session = await getCurrentSession();
    if (!session.isAuthenticated) {
        return;
    }

    const userName = session.user?.name;
    const initials = userName ? userName.split(' ').map((n) => n[0]).filter((c,i,a) => i === 0 || i === a.length - 1).join('').toUpperCase() : 'U';
    loginButton.href = '/dashboard';
    loginButton.textContent = initials;

    logoutButton.classList.add('active');
    logoutButton.addEventListener('click', async (e) => {
        // remove auth token and send user to login page
        clearToken();
        window.location.href = '/';
    });
}