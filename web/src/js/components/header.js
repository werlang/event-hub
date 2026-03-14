import { getCurrentSession } from '../helpers/session.js';

const loginButton = document.querySelector('#header-login-link');

/**
 * Checks the current session and updates the login button to link to the dashboard if authenticated.
 */
export async function updateLoginButton(messageElement) {
    const session = await getCurrentSession();
    if (!session.isAuthenticated) {
        return;
    }

    const userName = session.user?.name;
    loginButton.href = '/dashboard';
    loginButton.textContent = userName;
}