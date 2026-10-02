type Credenciales = { APP_USER: string; APP_PASSWORD: string };

// Usuario y contraseña desde el .env (Cypress 16: cy.env para valores sensibles)
const credenciales = () => cy.env<Credenciales>(['APP_USER', 'APP_PASSWORD'], { log: false });

// Sin sesión, index.php redirige (a http, ver observación de seguridad) y no muestra el panel.
// Cypress no puede seguir el cambio de https a http, así que se valida con una consulta directa.
const verificarSinAccesoAlPanel = () => {
  cy.request({ url: 'index.php', followRedirect: false }).then((resp) => {
    expect(resp.status).to.eq(302);
    expect(resp.headers.location).to.match(/accessdenied\.php|login\.php/);
  });
};

const login = (user: string, password: string) => {
  cy.visit('login.php');
  cy.get('input[name="userName"]').type(user);
  cy.get('input[name="password"]').type(password, { log: false });
  cy.get('button.login-submit').click();
};

describe('Login', () => {
  it('LOGIN-01 | Login exitoso con usuario válido', () => {
    credenciales().then(({ APP_USER, APP_PASSWORD }) => {
      login(APP_USER, APP_PASSWORD);

      cy.url().should('match', /index\.php/);
      cy.title().should('eq', 'Panel de control - ANPR - UltraIP');
      cy.contains(APP_USER).should('be.visible');
    });

    // Pausa de 2 segundos para ver el Panel de control
    cy.wait(2000);
  });

  it('LOGIN-02 | Login con contraseña incorrecta', () => {
    credenciales().then(({ APP_USER, APP_PASSWORD }) => {
      // Contraseña distinta a la válida del .env
      login(APP_USER, `${APP_PASSWORD}-incorrecta`);
    });

    cy.get('#loginError').should(
      'have.text',
      'Cuenta de usuario inválida. Verifique su usuario y/o contraseña.'
    );
    cy.url().should('match', /login\.php/);
    cy.title().should('eq', 'Login - ANPR - UltraIP');

    // Sin sesión iniciada, no se puede entrar al Panel de control
    verificarSinAccesoAlPanel();
  });

  it('LOGIN-03 | Login con campos vacíos', () => {
    cy.visit('login.php');

    // Click en Login sin completar usuario ni contraseña
    cy.get('button.login-submit').click();

    cy.get('#loginError').should('have.text', 'Debe ingresar usuario y contraseña.');
    cy.url().should('match', /login\.php/);
    cy.title().should('eq', 'Login - ANPR - UltraIP');
  });

  it('LOGOUT-01 | Cerrar sesión vuelve al login', () => {
    credenciales().then(({ APP_USER, APP_PASSWORD }) => login(APP_USER, APP_PASSWORD));
    cy.url().should('match', /index\.php/);

    // Pausa de 2 segundos para ver el Panel de control
    cy.wait(2000);

    // Abrir el menú del usuario y hacer click en Logout
    cy.get('a.user').click();
    cy.get('a.logout').click();

    cy.url().should('match', /login\.php/);
    cy.title().should('eq', 'Login - ANPR - UltraIP');

    // Con la sesión cerrada, no se puede entrar al Panel de control
    verificarSinAccesoAlPanel();
  });
});
