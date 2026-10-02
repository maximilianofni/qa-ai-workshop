describe('Smoke', () => {
  it('SMOKE-01 | La página de login abre en Chrome', () => {
    cy.visit('login.php');

    cy.title().should('eq', 'Login - ANPR - UltraIP');
    cy.get('input[name="userName"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button.login-submit').should('be.visible');
  });
});
